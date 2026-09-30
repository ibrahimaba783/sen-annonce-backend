const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Annonce = require('../models/Annonce');
const Message = require('../models/Message');
const { protect, admin } = require('../middleware/auth');
const { notifyUser, notifyOtherAdmins, nomComplet } = require('../utils/adminNotify');

router.use(protect, admin);

const ROLES_AUTORISES = ['client', 'vendeur', 'admin'];
const libelleRole = { client: 'client', vendeur: 'vendeur', prestataire: 'vendeur', admin: 'administrateur' };

// GET statistiques dashboard
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalAnnonces = await Annonce.countDocuments();
    const enAttente = await Annonce.countDocuments({ statut: 'en_attente' });
    const signalements = await Annonce.countDocuments({ signalements: { $gt: 0 } });

    res.json({ totalUsers, totalAnnonces, enAttente, signalements });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// GET données du graphique mensuel
router.get('/chart-stats', async (req, res) => {
  try {
    const chartData = [
      { mois: 'Jan', annonces: 120, utilisateurs: 80 },
      { mois: 'Fév', annonces: 210, utilisateurs: 150 },
      { mois: 'Mar', annonces: 350, utilisateurs: 280 },
      { mois: 'Avr', annonces: 480, utilisateurs: 390 },
      { mois: 'Mai', annonces: 620, utilisateurs: 510 },
      { mois: 'Juin', annonces: 850, utilisateurs: 740 },
    ];
    res.json(chartData);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// GET annonces signalées
router.get('/signalements', async (req, res) => {
  try {
    const annoncesSignalees = await Annonce.find({ signalements: { $gt: 0 } })
      .populate('categorie', 'nom')
      .populate('utilisateur', 'nom prenom email')
      .sort('-signalements');
    res.json(annoncesSignalees);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// GET tous les utilisateurs
router.get('/utilisateurs', async (req, res) => {
  try {
    const users = await User.find().select('-motDePasse').sort('-createdAt');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// PATCH bloquer/débloquer un utilisateur
router.patch('/utilisateurs/:id/bloquer', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Vous ne pouvez pas bloquer votre propre compte' });
    }

    user.isBlocked = !user.isBlocked;
    await user.save();

    const action = user.isBlocked ? 'bloqué' : 'débloqué';

    await notifyUser(user._id, {
      titre: user.isBlocked ? 'Compte bloqué' : 'Compte débloqué',
      message: user.isBlocked
        ? 'Votre compte a été bloqué par un administrateur. Contactez le support pour plus d\'informations.'
        : 'Votre compte a été débloqué. Vous pouvez de nouveau vous connecter.',
    });

    await notifyOtherAdmins(
      req.user,
      `Compte ${action}`,
      `${nomComplet(req.user)} a ${action} le compte de ${nomComplet(user)} (${user.email}).`
    );

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// PATCH changer le rôle d'un utilisateur (nommer un admin, etc.)
router.patch('/utilisateurs/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!ROLES_AUTORISES.includes(role)) {
      return res.status(400).json({ message: 'Rôle invalide (client, vendeur ou admin)' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

    // Un admin ne peut pas modifier son propre rôle : il reste toujours au moins un admin
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Vous ne pouvez pas modifier votre propre rôle' });
    }

    const ancienRole = libelleRole[user.role] || user.role;
    if ((ancienRole === 'vendeur' && role === 'vendeur') || user.role === role) {
      return res.json(user); // rien à changer
    }

    user.role = role;
    await user.save();

    const nouveauRole = libelleRole[role];

    await notifyUser(user._id, {
      titre: 'Votre rôle a changé',
      message: `Un administrateur vous a attribué le rôle « ${nouveauRole} ». Reconnectez-vous pour voir vos nouveaux accès.`,
    });

    await notifyOtherAdmins(
      req.user,
      'Rôle modifié',
      `${nomComplet(req.user)} a changé le rôle de ${nomComplet(user)} (${user.email}) : ${ancienRole} → ${nouveauRole}.`
    );

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// POST contacter un utilisateur (message + notification)
router.post('/utilisateurs/:id/contacter', async (req, res) => {
  try {
    const sujet = (req.body.sujet || '').trim();
    const contenu = (req.body.message || '').trim();

    if (!sujet || !contenu) {
      return res.status(400).json({ message: 'Sujet et message requis' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Vous ne pouvez pas vous écrire à vous-même' });
    }

    await Message.create({
      expediteur: req.user._id,
      recepteur: user._id,
      contenu: `📢 ${sujet}\n\n${contenu}`,
    });

    await notifyUser(user._id, {
      titre: `Message de l'administration : ${sujet}`,
      message: contenu.length > 80 ? `${contenu.slice(0, 80)}...` : contenu,
      type: 'message',
      lien: `/conversation/${req.user._id}`,
    });

    res.status(201).json({ message: 'Message envoyé' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// GET toutes les annonces (y compris inactives)
router.get('/annonces', async (req, res) => {
  try {
    const annonces = await Annonce.find()
      .populate('categorie', 'nom')
      .populate('utilisateur', 'nom prenom email')
      .sort('-createdAt');
    res.json(annonces);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// PATCH valider une annonce en attente
router.patch('/annonces/:id/valider', async (req, res) => {
  try {
    const annonce = await Annonce.findByIdAndUpdate(
      req.params.id,
      { statut: 'validee', signalements: 0 },
      { new: true }
    );
    if (!annonce) return res.status(404).json({ message: 'Annonce introuvable' });

    await notifyUser(annonce.utilisateur, {
      titre: 'Annonce validée !',
      message: `Félicitations, votre annonce "${annonce.titre}" a été validée par l'administrateur et est maintenant en ligne.`,
      type: 'validation',
      lien: `/annonce/${annonce._id}`,
    });

    res.json(annonce);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// DELETE supprimer une annonce (modération)
router.delete('/annonces/:id', async (req, res) => {
  try {
    const annonce = await Annonce.findById(req.params.id).populate('utilisateur', 'nom prenom');
    if (!annonce) return res.status(404).json({ message: 'Annonce introuvable' });

    await notifyUser(annonce.utilisateur?._id || annonce.utilisateur, {
      titre: 'Annonce supprimée',
      message: `Votre annonce "${annonce.titre}" a été supprimée par un administrateur car elle ne respectait pas les règles.`,
    });

    await notifyOtherAdmins(
      req.user,
      'Annonce supprimée',
      `${nomComplet(req.user)} a supprimé l'annonce "${annonce.titre}" de ${nomComplet(annonce.utilisateur || {})}.`
    );

    await annonce.deleteOne();
    res.json({ message: 'Annonce supprimée par l\'administrateur' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

module.exports = router;