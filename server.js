require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const seedCategories = require('./seed');

const app = express();

const User = require('./models/User');

// Connexion MongoDB & Initialisation du Seeder
connectDB().then(async () => {
  try {
    // Migration: s'assurer que tous les anciens utilisateurs ont un rôle par défaut ('client')
    await User.updateMany({ $or: [{ role: { $exists: false } }, { role: null }] }, { role: 'client' });
  } catch (e) {
    console.error('Erreur migration rôles:', e.message);
  }
  seedCategories();
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Route de test
app.get('/', (req, res) => {
  res.json({ message: 'API Annonces.sn fonctionne !' });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/annonces', require('./routes/annonces'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/admin', require('./routes/admin'));

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({ message: 'Route introuvable' });
});

// Gestion globale des erreurs (multer, Cloudinary, etc.)
app.use((err, req, res, next) => {
  console.error('❌ Erreur :', err);
  if (res.headersSent) return next(err);

  let status = err.status || err.http_code || 500;
  let message = err.message || 'Erreur serveur';

  if (err.code === 'LIMIT_FILE_SIZE') {
    status = 400;
    message = 'Photo trop lourde (5 Mo maximum par photo)';
  } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    status = 400;
    message = 'Trop de photos (5 maximum)';
  }

  res.status(status >= 400 && status < 600 ? status : 500).json({ message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur le port ${PORT}`);
});