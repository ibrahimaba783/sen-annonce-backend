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

// Vendeur ou Admin uniquement
const vendeur = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Veuillez vous connecter pour continuer' });
  }
  if (req.user.role === 'client') {
    return res.status(403).json({ message: 'Les comptes clients ne peuvent pas publier ou gérer des annonces. Veuillez utiliser un compte vendeur.' });
  }
  if (['vendeur', 'prestataire', 'admin'].includes(req.user.role)) {
    return next();
  }
  return res.status(403).json({ message: 'Accès réservé aux vendeurs' });
};

module.exports = { protect, admin, vendeur };