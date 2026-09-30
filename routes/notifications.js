const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');

router.use(protect);

const idValide = (id) => mongoose.Types.ObjectId.isValid(id);

// GET /api/notifications - mes notifications (les plus récentes d'abord)
router.get('/', async (req, res) => {
  try {
    const notifications = await Notification.find({ utilisateur: req.user._id }).sort('-createdAt').limit(200);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// GET /api/notifications/unread-count - nombre de notifications non lues (badge de la barre)
router.get('/unread-count', async (req, res) => {
  try {
    const count = await Notification.countDocuments({ utilisateur: req.user._id, lu: false });
    res.json({ unreadCount: count });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// Tout marquer comme lu
const lireTout = async (req, res) => {
  try {
    await Notification.updateMany({ utilisateur: req.user._id, lu: false }, { lu: true });
    res.json({ message: 'Toutes les notifications sont marquées comme lues' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};
router.route('/lire-tout').patch(lireTout).put(lireTout);

// Supprimer toutes les notifications déjà lues
router.delete('/lues', async (req, res) => {
  try {
    const resultat = await Notification.deleteMany({ utilisateur: req.user._id, lu: true });
    res.json({ message: 'Notifications lues supprimées', supprimees: resultat.deletedCount });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// Marquer une notification comme lue
const lireUne = async (req, res) => {
  try {
    if (!idValide(req.params.id)) return res.status(400).json({ message: 'Identifiant invalide' });
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, utilisateur: req.user._id },
      { lu: true },
      { new: true }
    );
    if (!notif) return res.status(404).json({ message: 'Notification introuvable' });
    res.json(notif);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};
router.route('/:id/lu').patch(lireUne).put(lireUne);
router.route('/:id/lire').patch(lireUne).put(lireUne);

// Supprimer une notification
router.delete('/:id', async (req, res) => {
  try {
    if (!idValide(req.params.id)) return res.status(400).json({ message: 'Identifiant invalide' });
    const notif = await Notification.findOneAndDelete({ _id: req.params.id, utilisateur: req.user._id });
    if (!notif) return res.status(404).json({ message: 'Notification introuvable' });
    res.json({ message: 'Notification supprimée' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

module.exports = router;