const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer')) {
    try {
      token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-motDePasse');
      if (!req.user) {
        return res.status(401).json({ message: 'Utilisateur introuvable' });
      }
      if (req.user.isBlocked) {
        return res.status(403).json({ message: 'Compte bloqué' });
      }
      return next();
    } catch (err) {
      return res.status(401).json({ message: 'Token invalide ou expiré' });
    }
  }
  return res.status(401).json({ message: 'Non autorisé, token manquant' });
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ message: 'Accès réservé aux administrateurs' });
};

// Middleware d'autorisation pour publication (tout utilisateur connecté peut publier)
const vendeur = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Veuillez vous connecter pour continuer' });
  }
  return next();
};

module.exports = { protect, admin, vendeur };