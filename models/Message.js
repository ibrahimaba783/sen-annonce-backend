const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    expediteur: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recepteur: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    annonce: { type: mongoose.Schema.Types.ObjectId, ref: 'Annonce' },
    contenu: { type: String, required: true },
    lu: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Message', messageSchema);
