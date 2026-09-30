const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const Annonce = require('../models/Annonce');
const { protect } = require('../middleware/auth');

router.use(protect);

// GET /api/cart - Récupérer le panier de l'utilisateur
router.get('/', async (req, res) => {
  try {
    let cart = await Cart.findOne({ utilisateur: req.user._id }).populate({
      path: 'articles.annonce',
      populate: { path: 'categorie', select: 'nom icone' },
    });

    if (!cart) {
      cart = await Cart.create({ utilisateur: req.user._id, articles: [] });
    }

    // Filtrer les annonces inactives ou supprimées
    cart.articles = cart.articles.filter((item) => item.annonce && item.annonce.actif);
    await cart.save();

    res.json(cart);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// POST /api/cart/add - Ajouter un article au panier
router.post('/add', async (req, res) => {
  try {
    const { annonceId, quantite = 1 } = req.body;
    if (!annonceId) return res.status(400).json({ message: 'Identifiant de l\'annonce requis' });

    const annonce = await Annonce.findById(annonceId);
    if (!annonce || !annonce.actif) {
      return res.status(404).json({ message: 'Annonce non disponible ou épuisée' });
    }

    // Un utilisateur ne peut pas acheter sa propre annonce
    if (annonce.utilisateur.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Vous ne pouvez pas ajouter votre propre annonce au panier' });
    }

    let cart = await Cart.findOne({ utilisateur: req.user._id });
    if (!cart) {
      cart = new Cart({ utilisateur: req.user._id, articles: [] });
    }

    const itemIndex = cart.articles.findIndex(
      (item) => item.annonce.toString() === annonceId
    );

    if (itemIndex > -1) {
      cart.articles[itemIndex].quantite += Number(quantite);
    } else {
      cart.articles.push({ annonce: annonceId, quantite: Number(quantite) });
    }

    await cart.save();
    const updatedCart = await Cart.findById(cart._id).populate({
      path: 'articles.annonce',
      populate: { path: 'categorie', select: 'nom icone' },
    });

    res.json(updatedCart);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// PUT /api/cart/update - Modifier la quantité d'un article
router.put('/update', async (req, res) => {
  try {
    const { annonceId, quantite } = req.body;
    let cart = await Cart.findOne({ utilisateur: req.user._id });
    if (!cart) return res.status(404).json({ message: 'Panier introuvable' });

    const itemIndex = cart.articles.findIndex(
      (item) => item.annonce.toString() === annonceId
    );

    if (itemIndex > -1) {
      if (Number(quantite) <= 0) {
        cart.articles.splice(itemIndex, 1);
      } else {
        cart.articles[itemIndex].quantite = Number(quantite);
      }
      await cart.save();
    }

    const updatedCart = await Cart.findById(cart._id).populate({
      path: 'articles.annonce',
      populate: { path: 'categorie', select: 'nom icone' },
    });

    res.json(updatedCart);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// DELETE /api/cart/remove/:annonceId - Supprimer un article du panier
router.delete('/remove/:annonceId', async (req, res) => {
  try {
    let cart = await Cart.findOne({ utilisateur: req.user._id });
    if (!cart) return res.status(404).json({ message: 'Panier introuvable' });

    cart.articles = cart.articles.filter(
      (item) => item.annonce.toString() !== req.params.annonceId
    );

    await cart.save();
    const updatedCart = await Cart.findById(cart._id).populate({
      path: 'articles.annonce',
      populate: { path: 'categorie', select: 'nom icone' },
    });

    res.json(updatedCart);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// DELETE /api/cart/clear - Vider le panier
router.delete('/clear', async (req, res) => {
  try {
    let cart = await Cart.findOne({ utilisateur: req.user._id });
    if (cart) {
      cart.articles = [];
      await cart.save();
    }
    res.json({ message: 'Panier vidé' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

module.exports = router;
