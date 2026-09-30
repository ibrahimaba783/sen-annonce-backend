const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Annonce = require('../models/Annonce');
const Notification = require('../models/Notification');
const { protect, vendeur } = require('../middleware/auth');

router.use(protect);

// POST /api/orders - Passer une commande (depuis panier ou achat direct)
router.post('/', async (req, res) => {
  try {
    const { articles, adresseLivraison, villeLivraison, telephone, modePaiement, noteVendeur } = req.body;

    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return res.status(400).json({ message: 'Aucun article dans la commande' });
    }
    if (!adresseLivraison || !villeLivraison || !telephone) {
      return res.status(400).json({ message: 'Adresse, ville et téléphone de livraison sont obligatoires' });
    }

    // Récupérer et vérifier la validité de chaque annonce
    const populatedArticles = [];
    for (const item of articles) {
      const annonce = await Annonce.findById(item.annonceId || item.annonce);
      if (!annonce || !annonce.actif) {
        return res.status(400).json({ message: `L'annonce "${item.titre || 'sélectionnée'}" n'est plus disponible.` });
      }
      if (annonce.utilisateur.toString() === req.user._id.toString()) {
        return res.status(400).json({ message: `Vous ne pouvez pas commander votre propre annonce "${annonce.titre}".` });
      }
      populatedArticles.push({
        annonce,
        quantite: item.quantite || 1,
      });
    }

    // Regrouper les articles par vendeur
    const articlesParVendeur = {};
    populatedArticles.forEach(({ annonce, quantite }) => {
      const vendeurId = annonce.utilisateur.toString();
      if (!articlesParVendeur[vendeurId]) {
        articlesParVendeur[vendeurId] = [];
      }
      articlesParVendeur[vendeurId].push({
        annonce: annonce._id,
        titre: annonce.titre,
        prix: annonce.prix,
        quantite,
        image: annonce.images?.[0] || '',
      });
    });

    const commandesCrees = [];

    // Créer une commande distincte pour chaque vendeur
    for (const [vendeurId, listArticles] of Object.entries(articlesParVendeur)) {
      const total = listArticles.reduce((sum, item) => sum + item.prix * item.quantite, 0);

      const commande = await Order.create({
        client: req.user._id,
        vendeur: vendeurId,
        articles: listArticles,
        total,
        adresseLivraison,
        villeLivraison,
        telephone,
        modePaiement: modePaiement || 'Paiement à la livraison',
        noteVendeur: noteVendeur || '',
        statut: 'en_attente',
      });

      commandesCrees.push(commande);

      // Notification au vendeur
      await Notification.create({
        utilisateur: vendeurId,
        titre: '🛒 Nouvelle commande reçue !',
        message: `${req.user.prenom} ${req.user.nom} a passé une commande de ${total.toLocaleString()} FCFA.`,
        type: 'info',
        lien: '/vendeur/commandes',
      });
    }

    // Vider le panier de l'utilisateur après commande réussie
    let cart = await Cart.findOne({ utilisateur: req.user._id });
    if (cart) {
      cart.articles = [];
      await cart.save();
    }

    res.status(201).json({
      message: 'Commande(s) effectuée(s) avec succès !',
      commandes: commandesCrees,
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// GET /api/orders/client - Commandes passées par l'utilisateur connecté
router.get('/client', async (req, res) => {
  try {
    const commandes = await Order.find({ client: req.user._id })
      .populate('vendeur', 'nom prenom telephone photo email')
      .sort('-createdAt');
    res.json(commandes);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// GET /api/orders/vendeur - Commandes reçues par le vendeur connecté
router.get('/vendeur', vendeur, async (req, res) => {
  try {
    const commandes = await Order.find({ vendeur: req.user._id })
      .populate('client', 'nom prenom telephone email photo')
      .sort('-createdAt');
    res.json(commandes);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// PATCH /api/orders/:id/statut - Mise à jour du statut par le vendeur
router.patch('/:id/statut', vendeur, async (req, res) => {
  try {
    const { statut, motifRefus } = req.body;
    const commande = await Order.findById(req.params.id);

    if (!commande) {
      return res.status(404).json({ message: 'Commande introuvable' });
    }

    // Vérifier que c'est bien le vendeur ou un admin
    if (commande.vendeur.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Non autorisé à gérer cette commande' });
    }

    if (statut) commande.statut = statut;
    if (motifRefus) commande.motifRefus = motifRefus;

    await commande.save();

    // Libellés lisibles pour la notification client
    const libellesStatuts = {
      acceptee: 'acceptée par le vendeur',
      en_cours_livraison: 'en cours de livraison 🚚',
      livree: 'livrée avec succès 🎉',
      refusee: 'refusée par le vendeur',
      annulee: 'annulée',
    };

    const statutText = libellesStatuts[statut] || statut;

    // Les annonces restent toujours visibles : une livraison ne les désactive plus.

    // Notifier le client
    await Notification.create({
      utilisateur: commande.client,
      titre: `Mise à jour de commande`,
      message: `Votre commande #${commande._id.toString().slice(-6)} est maintenant ${statutText}.${motifRefus ? ` Motif: ${motifRefus}` : ''}`,
      type: statut === 'refusee' ? 'admin' : 'validation',
      lien: '/mes-commandes',
    });

    res.json(commande);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

module.exports = router;