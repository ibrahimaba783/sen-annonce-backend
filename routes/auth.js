
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

    const roleFinal = (role === 'vendeur' || role === 'prestataire') ? 'vendeur' : 'client';

    const existe = await User.findOne({ email: email.toLowerCase() });

    if (existe) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }

    const user = await User.create({
      nom,
      prenom,
      email,
      motDePasse,
      telephone,
      role: roleFinal
    });

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
    console.error('❌ Erreur inscription :', err);

    res.status(500).json({
      message: 'Erreur serveur',
      error: err.message
    });
  }
});

router.post('/connexion', async (req, res) => {
  try {
    const { email, identifiant, motDePasse } = req.body;
    const searchVal = (identifiant || email || '').trim();

    console.log('\n================ CONNEXION ================');
    console.log('📥 Identifiant reçu :', searchVal);
    console.log('🔐 Mot de passe reçu :', motDePasse ? 'OUI' : 'NON');

    if (!searchVal || !motDePasse) {
      console.log('❌ Champs de connexion manquants');
      console.log('===========================================\n');

      return res.status(400).json({
        message: 'Veuillez saisir votre identifiant et mot de passe'
      });
    }

    const user = await User.findOne({
      $or: [
        { email: searchVal.toLowerCase() },
        { telephone: searchVal }
      ]
    });

    console.log(
      '👤 Utilisateur trouvé :',
      user ? `OUI → ${user.email} (${user.role})` : 'NON'
    );

    if (!user) {
      console.log('❌ Aucun utilisateur correspondant dans MongoDB Atlas');
      console.log('===========================================\n');

      return res.status(401).json({
        message: 'Email/Téléphone ou mot de passe incorrect'
      });
    }

    console.log('🆔 ID utilisateur :', user._id.toString());
    console.log('👤 Nom :', user.prenom, user.nom);
    console.log('📧 Email :', user.email);
    console.log('📱 Téléphone :', user.telephone || 'Aucun');
    console.log('🎭 Rôle :', user.role);
    console.log('🚫 Compte bloqué :', user.isBlocked ? 'OUI' : 'NON');

    if (user.isBlocked) {
      console.log('❌ Connexion refusée : compte bloqué');
      console.log('===========================================\n');

      return res.status(403).json({
        message: 'Ce compte a été bloqué par un administrateur'
      });
    }

    const match = await user.comparePassword(motDePasse);

    console.log(
      '🔑 Mot de passe correct :',
      match ? 'OUI' : 'NON'
    );

    if (!match) {
      console.log('❌ Mot de passe incorrect');
      console.log('===========================================\n');

      return res.status(401).json({
        message: 'Email/Téléphone ou mot de passe incorrect'
      });
    }

    console.log('✅ CONNEXION RÉUSSIE');
    console.log('===========================================\n');

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
    console.error('🔥 ERREUR CONNEXION :', err);

    res.status(500).json({
      message: 'Erreur serveur',
      error: err.message
    });
  }
});

router.get('/vendeur/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('nom prenom photo telephone isVerified createdAt');

    if (!user) {
      return res.status(404).json({
        message: 'Vendeur introuvable'
      });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({
      message: 'Erreur serveur',
      error: err.message
    });
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
      user.photo = req.file.path;
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
    console.error('❌ Erreur modification profil :', err);

    res.status(500).json({
      message: 'Erreur serveur',
      error: err.message
    });
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
    console.error('❌ Erreur suppression photo :', err);

    res.status(500).json({
      message: 'Erreur serveur',
      error: err.message
    });
  }
});

// PUT Changement de mot de passe
router.put('/changement-mot-de-passe', protect, async (req, res) => {
  try {
    const { ancienMotDePasse, nouveauMotDePasse } = req.body;

    if (!ancienMotDePasse || !nouveauMotDePasse) {
      return res.status(400).json({
        message: 'Tous les champs sont requis'
      });
    }

    const user = await User.findById(req.user._id);

    const match = await user.comparePassword(ancienMotDePasse);

    if (!match) {
      return res.status(400).json({
        message: 'L\'ancien mot de passe est incorrect'
      });
    }

    user.motDePasse = nouveauMotDePasse;

    await user.save();

    res.json({
      message: 'Mot de passe modifié avec succès'
    });
  } catch (err) {
    console.error('❌ Erreur changement mot de passe :', err);

    res.status(500).json({
      message: 'Erreur serveur',
      error: err.message
    });
  }
});

// POST Mot de passe oublié
router.post('/mot-de-passe-oublie', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: 'Veuillez saisir votre email'
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase()
    });

    if (!user) {
      return res.json({
        message: 'Si ce compte existe, un lien de réinitialisation a été envoyé.'
      });
    }

    res.json({
      message: 'Si ce compte existe, un lien de réinitialisation a été envoyé.'
    });
  } catch (err) {
  console.error('\n========== ERREUR CRÉATION ANNONCE ==========');
  console.error('❌ Message :', err.message);
  console.error('❌ Nom :', err.name);
  console.error('❌ Stack :', err.stack);
  console.error('=============================================\n');

  res.status(500).json({
    message: 'Erreur serveur',
    error: err.message
    });
  }
});

module.exports = router;

