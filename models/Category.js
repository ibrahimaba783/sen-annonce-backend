const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    nom: { type: String, required: true, unique: true },
    icone: { type: String, default: '📦' },
    description: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Category', categorySchema);
