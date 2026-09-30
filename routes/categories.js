const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const { protect, admin } = require('../middleware/auth');

// GET toutes les catégories
router.get('/', async (req, res) => {
  const categories = await Category.find().sort('nom');
  res.json(categories);
});

// POST créer (admin)
router.post('/', protect, admin, async (req, res) => {
  try {
    const { nom, icone, description } = req.body;
    const categorie = await Category.create({ nom, icone, description });
    res.status(201).json(categorie);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// PUT modifier (admin)
router.put('/:id', protect, admin, async (req, res) => {
  try {
    const categorie = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(categorie);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// DELETE (admin)
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: 'Catégorie supprimée' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

module.exports = router;
