const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    vendeur: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    articles: [
      {
        annonce: { type: mongoose.Schema.Types.ObjectId, ref: 'Annonce', required: true },
        titre: { type: String, required: true },
        prix: { type: Number, required: true },
        quantite: { type: Number, default: 1 },
        image: { type: String, default: '' },
      },
    ],
    total: { type: Number, required: true },
    adresseLivraison: { type: String, required: true },
    villeLivraison: { type: String, required: true },
    telephone: { type: String, required: true },
    modePaiement: { type: String, default: 'Paiement à la livraison' },
    noteVendeur: { type: String, default: '' },
    statut: {
      type: String,
      enum: ['en_attente', 'acceptee', 'en_cours_livraison', 'livree', 'refusee', 'annulee'],
      default: 'en_attente',
    },
    motifRefus: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
