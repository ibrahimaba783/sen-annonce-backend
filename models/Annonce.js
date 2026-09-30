const mongoose = require('mongoose');

const annonceSchema = new mongoose.Schema(
  {
    titre: { type: String, required: true },
    description: { type: String, required: true },
    prix: { type: Number, required: true },
    categorie: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    utilisateur: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ville: { type: String, required: true },
    images: [{ type: String }],
    actif: { type: Boolean, default: true },
    statut: { type: String, enum: ['en_attente', 'validee', 'refusee'], default: 'validee' },
    vues: { type: Number, default: 0 },
    signalements: { type: Number, default: 0 },
  },
  { timestamps: true }
);

annonceSchema.index({ titre: 'text', description: 'text', ville: 'text' });

module.exports = mongoose.model('Annonce', annonceSchema);
