const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

router.post('/inscription', async (req, res) => {
  try {
    const { nom, prenom, email, motDePasse, telephone, role } = req.body;

    if (!nom || !prenom || !email || !motDePasse) {
      return res.status(400).json({ message: 'Tous les champs obligatoires doivent être remplis' });
    }

    // Role doit être 'client' ou 'vendeur'. Jamais 'admin' depuis l'inscription.
    const roleFinal = (role === 'vendeur' || role === 'prestataire') ? 'vendeur' : 'client';

    const existe = await User.findOne({ email: email.toLowerCase() });
    if (existe) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }

    const user = await User.create({ nom, prenom, email, motDePasse, telephone, role: roleFinal });

    res.status(201).json({
      _id: user._id,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      telephone: user.telephone,
      photo: user.photo,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

router.post('/connexion', async (req, res) => {
  try {
    const { email, identifiant, motDePasse } = req.body;
    const searchVal = (identifiant || email || '').trim();

    if (!searchVal || !motDePasse) {
      return res.status(400).json({ message: 'Veuillez saisir votre identifiant et mot de passe' });
    }

    const user = await User.findOne({
      $or: [
        { email: searchVal.toLowerCase() },
        { telephone: searchVal }
      ]
    });

    if (!user) {
      return res.status(401).json({ message: 'Email/Téléphone ou mot de passe incorrect' });
    }
    if (user.isBlocked) {
      return res.status(403).json({ message: 'Ce compte a été bloqué par un administrateur' });
    }

    const match = await user.comparePassword(motDePasse);
    if (!match) {
      return res.status(401).json({ message: 'Email/Téléphone ou mot de passe incorrect' });
    }

    res.json({
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
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

router.get('/vendeur/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('nom prenom photo telephone isVerified createdAt');
    if (!user) return res.status(404).json({ message: 'Vendeur introuvable' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

router.get('/profil', protect, async (req, res) => {
  res.json(req.user);
});

router.put('/profil', protect, upload.single('photo'), async (req, res) => {
  try {
    const { nom, prenom, telephone } = req.body;
    const user = await User.findById(req.user._id);

    if (nom) user.nom = nom;
    if (prenom) user.prenom = prenom;
    if (telephone) user.telephone = telephone;
    if (req.file) {
      user.photo = `/uploads/${req.file.filename}`;
    }

    await user.save();
    res.json({
      _id: user._id,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      telephone: user.telephone,
      photo: user.photo,
      role: user.role,
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// DELETE Photo de profil
router.delete('/profil/photo', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.photo = '';
    await user.save();
    res.json({
      _id: user._id,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      telephone: user.telephone,
      photo: '',
      role: user.role,
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// PUT Changement de mot de passe
router.put('/changement-mot-de-passe', protect, async (req, res) => {
  try {
    const { ancienMotDePasse, nouveauMotDePasse } = req.body;
    if (!ancienMotDePasse || !nouveauMotDePasse) {
      return res.status(400).json({ message: 'Tous les champs sont requis' });
    }

    const user = await User.findById(req.user._id);
    const match = await user.comparePassword(ancienMotDePasse);
    if (!match) {
      return res.status(400).json({ message: 'L\'ancien mot de passe est incorrect' });
    }

    user.motDePasse = nouveauMotDePasse;
    await user.save();
    res.json({ message: 'Mot de passe modifié avec succès' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// POST Mot de passe oublié
router.post('/mot-de-passe-oublie', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Veuillez saisir votre email' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Pour des raisons de sécurité, répondre OK même si l'email n'existe pas
      return res.json({ message: 'Si ce compte existe, un lien de réinitialisation a été envoyé.' });
    }

    // Réinitialisation simulée / lien généré
    res.json({ message: 'Si ce compte existe, un lien de réinitialisation a été envoyé.' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

module.exports = router;