const User = require('../models/User');
const Notification = require('../models/Notification');

// Une notification ratée ne doit jamais bloquer l'action de l'admin
const safe = async (fn) => {
  try {
    await fn();
  } catch (err) {
    console.error('Erreur notification admin:', err.message);
  }
};

// Prévient la personne concernée par l'action
const notifyUser = (userId, { titre, message, lien = '', type = 'admin' }) =>
  safe(() => Notification.create({ utilisateur: userId, titre, message, type, lien }));

// Prévient tous les AUTRES admins (pas celui qui a fait l'action)
const notifyOtherAdmins = (actor, titre, message) =>
  safe(async () => {
    const admins = await User.find({ role: 'admin', _id: { $ne: actor._id } }).select('_id');
    if (admins.length === 0) return;
    await Notification.insertMany(
      admins.map((a) => ({
        utilisateur: a._id,
        titre,
        message,
        type: 'admin',
        lien: '/admin/utilisateurs',
      }))
    );
  });

const nomComplet = (u) => `${u.prenom || ''} ${u.nom || ''}`.trim();

module.exports = { notifyUser, notifyOtherAdmins, nomComplet };