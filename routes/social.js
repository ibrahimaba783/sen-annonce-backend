const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

const router = express.Router();
const googleClient = new OAuth2Client();
const GRAPH = 'https://graph.facebook.com';

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

const reponseUtilisateur = (user) => ({
  _id: user._id,
  nom: user.nom,
  prenom: user.prenom,
  email: user.email,
  telephone: user.telephone,
  photo: user.photo,
  role: user.role,
  isVerified: user.isVerified,
  token: generateToken(user._id),
});

// Un compte social ne peut jamais devenir admin : seuls ces deux rôles sont acceptés
const roleChoisi = (role) => {
  if (role === 'vendeur' || role === 'prestataire') return 'vendeur';
  if (role === 'client') return 'client';
  return null;
};

const lireJson = async (url) => {
  const reponse = await fetch(url);
  return reponse.json();
};

// Connecte le compte existant, ou le crée si le rôle a été choisi
const connecterOuCreer = async (res, { provider, providerId, email, prenom, nom, role }) => {
  const champ = provider === 'google' ? 'googleId' : 'facebookId';
  const emailNorm = String(email).toLowerCase();

  let user = await User.findOne({ [champ]: providerId });

  // Même email qu'un compte existant : on relie les deux
  if (!user) {
    user = await User.findOne({ email: emailNorm });
    if (user) {
      user[champ] = providerId;
      await user.save();
    }
  }

  if (user) {
    if (user.isBlocked) {
      return res.status(403).json({ message: 'Ce compte a été bloqué par un administrateur' });
    }
    return res.json(reponseUtilisateur(user));
  }

  // Nouveau compte : on a besoin de savoir si la personne est cliente ou vendeuse
  const roleFinal = roleChoisi(role);
  if (!roleFinal) {
    return res.json({ nouveau: true, profil: { prenom, nom, email: emailNorm } });
  }

  user = await User.create({
    nom: nom || ' ',
    prenom: prenom || 'Utilisateur',
    email: emailNorm,
    // mot de passe aléatoire : le compte se connecte avec Google ou Facebook
    motDePasse: crypto.randomBytes(32).toString('hex'),
    role: roleFinal,
    [champ]: providerId,
  });

  return res.status(201).json(reponseUtilisateur(user));
};

// POST /api/auth/google
router.post('/google', async (req, res) => {
  const { credential, role } = req.body || {};
  if (!credential) return res.status(400).json({ message: 'Jeton Google manquant' });
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(500).json({ message: "La connexion Google n'est pas configurée sur le serveur" });
  }

  let profil;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    profil = ticket.getPayload();
  } catch (err) {
    return res.status(401).json({ message: 'Connexion Google invalide ou expirée, réessayez' });
  }

  if (!profil?.sub || !profil.email || !profil.email_verified) {
    return res.status(400).json({ message: "Votre adresse email Google n'est pas vérifiée" });
  }

  try {
    const [prenomDefaut, ...reste] = String(profil.name || '').split(' ');
    await connecterOuCreer(res, {
      provider: 'google',
      providerId: profil.sub,
      email: profil.email,
      prenom: profil.given_name || prenomDefaut,
      nom: profil.family_name || reste.join(' '),
      role,
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// POST /api/auth/facebook
router.post('/facebook', async (req, res) => {
  const { accessToken, role } = req.body || {};
  const appId = process.env.FACEBOOK_APP_ID;
  const secret = process.env.FACEBOOK_APP_SECRET;

  if (!accessToken) return res.status(400).json({ message: 'Jeton Facebook manquant' });
  if (!appId || !secret) {
    return res.status(500).json({ message: "La connexion Facebook n'est pas configurée sur le serveur" });
  }

  let profil;
  try {
    // 1. Vérifie que le jeton est valide ET qu'il a été délivré pour TON application
    const debug = await lireJson(
      `${GRAPH}/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(`${appId}|${secret}`)}`
    );
    if (!debug?.data?.is_valid || String(debug.data.app_id) !== String(appId)) throw new Error('jeton invalide');

    // 2. Lit le profil de la personne
    profil = await lireJson(`${GRAPH}/me?fields=id,first_name,last_name,name,email&access_token=${encodeURIComponent(accessToken)}`);
    if (!profil?.id || profil.error || String(profil.id) !== String(debug.data.user_id)) throw new Error('profil invalide');
  } catch (err) {
    return res.status(401).json({ message: 'Connexion Facebook invalide ou expirée, réessayez' });
  }

  if (!profil.email) {
    return res.status(400).json({
      message: "Votre compte Facebook ne partage pas d'adresse email. Utilisez Google ou créez un compte avec votre email.",
    });
  }

  try {
    const [prenomDefaut, ...reste] = String(profil.name || '').split(' ');
    await connecterOuCreer(res, {
      provider: 'facebook',
      providerId: profil.id,
      email: profil.email,
      prenom: profil.first_name || prenomDefaut,
      nom: profil.last_name || reste.join(' '),
      role,
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

module.exports = router;