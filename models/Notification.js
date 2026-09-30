const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    utilisateur: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    titre: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['info', 'message', 'validation', 'favori', 'admin'], default: 'info' },
    lien: { type: String, default: '' },
    lu: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
