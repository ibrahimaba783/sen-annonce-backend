const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const Annonce = require('../models/Annonce');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { protect, vendeur } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Échappe les caractères spéciaux d'une recherche utilisateur
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Identifie l'utilisateur connecté s'il y en a un (sans jamais bloquer la requête)
const idUtilisateurOptionnel = (req) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer')) return null;
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    return decoded.id || null;
  } catch (err) {
    return null;
  }
};

// GET /api/annonces - recherche + filtres (accueil public)
router.get('/', async (req, res) => {
  try {
    const { q, categorie, ville, prixMin, prixMax, tri } = req.query;
    // Seules les annonces en ligne et non modérées négativement sont visibles
    const filtre = { actif: true, statut: { $nin: ['en_attente', 'refusee'] } };

    if (q) {
      const motif = new RegExp(escapeRegex(q), 'i');
      filtre.$or = [{ titre: motif }, { description: motif }];
    }
    if (categorie) filtre.categorie = categorie;
    if (ville) filtre.ville = new RegExp(escapeRegex(ville), 'i');
    if (prixMin || prixMax) {
      filtre.prix = {};
      if (prixMin) filtre.prix.$gte = Number(prixMin);
      if (prixMax) filtre.prix.$lte = Number(prixMax);
    }

    let sort = '-createdAt';
    if (tri === 'popularite') sort = '-vues';
    if (tri === 'prix_asc') sort = 'prix';
    if (tri === 'prix_desc') sort = '-prix';

    const annonces = await Annonce.find(filtre)
      .populate('categorie', 'nom icone')
      .populate('utilisateur', 'nom prenom photo')
      .sort(sort);

    res.json(annonces);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// GET mes annonces (prestataire/admin uniquement)
router.get('/mes-annonces', protect, vendeur, async (req, res) => {
  const annonces = await Annonce.find({ utilisateur: req.user._id })
    .populate('categorie', 'nom icone')
    .sort('-createdAt');
  res.json(annonces);
});

// GET mes favoris (placé avant /:id pour éviter tout conflit de route)
router.get('/utilisateur/favoris', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'favoris',
      populate: { path: 'categorie', select: 'nom icone' },
    });
    res.json(user.favoris || []);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// GET une annonce (détail) - ne compte PLUS les vues
router.get('/:id', async (req, res) => {
  try {
    const annonce = await Annonce.findById(req.params.id)
      .populate('categorie', 'nom icone')
      .populate('utilisateur', 'nom prenom photo telephone createdAt isVerified');

    if (!annonce) return res.status(404).json({ message: 'Annonce introuvable' });
    res.json(annonce);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// POST compter une vue (jamais pour le propriétaire de l'annonce)
router.post('/:id/vue', async (req, res) => {
  try {
    const annonce = await Annonce.findById(req.params.id).select('utilisateur vues');
    if (!annonce) return res.status(404).json({ message: 'Annonce introuvable' });

    const userId = idUtilisateurOptionnel(req);
    if (userId && annonce.utilisateur.toString() === userId.toString()) {
      return res.json({ vues: annonce.vues, compte: false });
    }

    const misAJour = await Annonce.findByIdAndUpdate(req.params.id, { $inc: { vues: 1 } }, { new: true }).select('vues');
    res.json({ vues: misAJour.vues, compte: true });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// POST créer une annonce (prestataire/admin uniquement)
router.post('/', protect, vendeur, upload.array('images', 5), async (req, res) => {
  try {
    const { titre, description, prix, categorie, ville } = req.body;
    const images = req.files ? req.files.map((f) => f.path) : [];

    const annonce = await Annonce.create({
      titre,
      description,
      prix,
      categorie,
      ville,
      images,
      utilisateur: req.user._id,
      statut: 'validee',
    });

    // Notification de publication
    await Notification.create({
      utilisateur: req.user._id,
      titre: 'Annonce publiée !',
      message: `Félicitations, votre annonce "${titre}" a été publiée avec succès.`,
      type: 'validation',
      lien: `/annonce/${annonce._id}`,
    });

    res.status(201).json(annonce);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// PUT modifier une annonce
router.put('/:id', protect, upload.array('images', 5), async (req, res) => {
  try {
    const annonce = await Annonce.findById(req.params.id);
    if (!annonce) return res.status(404).json({ message: 'Annonce introuvable' });
    if (annonce.utilisateur.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Non autorisé' });
    }

    const { titre, description, prix, categorie, ville } = req.body;
    if (titre) annonce.titre = titre;
    if (description) annonce.description = description;
    if (prix) annonce.prix = prix;
    if (categorie) annonce.categorie = categorie;
    if (ville) annonce.ville = ville;

    if (req.files && req.files.length > 0) {
      const nouvellesImages = req.files.map((f) => f.path);
      annonce.images = nouvellesImages;
    }

    await annonce.save();
    res.json(annonce);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// PATCH activer/désactiver
router.patch('/:id/statut', protect, async (req, res) => {
  try {
    const annonce = await Annonce.findById(req.params.id);
    if (!annonce) return res.status(404).json({ message: 'Annonce introuvable' });
    if (annonce.utilisateur.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Non autorisé' });
    }
    annonce.actif = !annonce.actif;
    await annonce.save();
    res.json(annonce);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// DELETE supprimer
router.delete('/:id', protect, async (req, res) => {
  try {
    const annonce = await Annonce.findById(req.params.id);
    if (!annonce) return res.status(404).json({ message: 'Annonce introuvable' });
    if (annonce.utilisateur.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Non autorisé' });
    }
    await annonce.deleteOne();
    res.json({ message: 'Annonce supprimée' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// POST signaler une annonce
router.post('/:id/signaler', protect, async (req, res) => {
  try {
    const annonce = await Annonce.findByIdAndUpdate(
      req.params.id,
      { $inc: { signalements: 1 } },
      { new: true }
    );
    if (!annonce) return res.status(404).json({ message: 'Annonce introuvable' });
    res.json({ message: 'Annonce signalée, merci pour votre vigilance' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// POST favoris (ajouter/retirer)
router.post('/:id/favori', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const index = user.favoris.indexOf(req.params.id);
    let estFavori = false;

    if (index === -1) {
      user.favoris.push(req.params.id);
      estFavori = true;
    } else {
      user.favoris.splice(index, 1);
    }
    await user.save();

    // Notifier le propriétaire si l'annonce est ajoutée aux favoris
    if (estFavori) {
      const annonce = await Annonce.findById(req.params.id);
      if (annonce && annonce.utilisateur.toString() !== req.user._id.toString()) {
        await Notification.create({
          utilisateur: annonce.utilisateur,
          titre: 'Nouveau favori',
          message: `${user.prenom} ${user.nom} a ajouté votre annonce "${annonce.titre}" à ses favoris.`,
          type: 'favori',
          lien: `/annonce/${annonce._id}`,
        });
      }
    }

    res.json({ favoris: user.favoris, estFavori });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

module.exports = router;