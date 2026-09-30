const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema(
  {
    utilisateur: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    articles: [
      {
        annonce: { type: mongoose.Schema.Types.ObjectId, ref: 'Annonce', required: true },
        quantite: { type: Number, default: 1, min: 1 },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Cart', cartSchema);
