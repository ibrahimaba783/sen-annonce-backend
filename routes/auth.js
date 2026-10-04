const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// Envoi de l'email de réinitialisation (config via variables d'environnement)
const sendResetEmail = async (to, link) => {
  const port = Number(process.env.SMTP_PORT) || 587;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: 'SenAnnonce : réinitialisation de votre mot de passe',
    text: `Pour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) : ${link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
    html: `<p>Pour choisir un nouveau mot de passe, cliquez ici (lien valable 1 heure) :</p>
           <p><a href="${link}">${link}</a></p>
           <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`,
  });
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
  const reponse = { message: 'Si ce compte existe, un lien de réinitialisation a été envoyé.' };

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Veuillez saisir votre email' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (user && !user.isBlocked) {
      const token = crypto.randomBytes(32).toString('hex');
      user.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
      user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 heure
      await user.save();

      const link = `${process.env.FRONTEND_URL}/reinitialiser-mot-de-passe/${token}`;

      try {
        await sendResetEmail(user.email, link);
      } catch (mailErr) {
        console.error('❌ Envoi email impossible :', mailErr.message);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
      }
    }

    // Même réponse dans tous les cas : on ne révèle pas si le compte existe
    res.json(reponse);
  } catch (err) {
    console.error('❌ Erreur mot de passe oublié :', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST Réinitialisation avec le jeton reçu par email
router.post('/reinitialiser-mot-de-passe/:token', async (req, res) => {
  try {
    const { nouveauMotDePasse } = req.body;

    if (!nouveauMotDePasse || nouveauMotDePasse.length < 6) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères' });
    }

    const hash = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hash,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Lien invalide ou expiré' });
    }

    user.motDePasse = nouveauMotDePasse; // hashé automatiquement par le pre('save')
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Mot de passe modifié avec succès' });
  } catch (err) {
    console.error('❌ Erreur réinitialisation :', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ================= CONNEXION GOOGLE / FACEBOOK =================
const userPayload = (user) => ({
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

// Seuls client et vendeur sont acceptés : un admin ne peut jamais être créé ici
const cleanRole = (role) =>
  role === 'vendeur' || role === 'prestataire' ? 'vendeur' : role === 'client' ? 'client' : null;

const socialLogin = async ({ provider, providerId, email, prenom, nom, photo, role }, res) => {
  const idField = provider === 'google' ? 'googleId' : 'facebookId';

  let user = await User.findOne({ [idField]: providerId });
  if (!user) user = await User.findOne({ email: email.toLowerCase() });

  // Compte existant : on le relie si besoin
  if (user) {
    if (user.isBlocked) {
      return res.status(403).json({ message: 'Ce compte a été bloqué par un administrateur' });
    }
    let changed = false;
    if (!user[idField]) { user[idField] = providerId; changed = true; }
    if (!user.photo && photo) { user.photo = photo; changed = true; }
    if (changed) await user.save();
    return res.json(userPayload(user));
  }

  // Nouveau compte : il faut connaître le rôle
  const roleFinal = cleanRole(role);
  if (!roleFinal) return res.json({ needsRole: true });

  user = await User.create({
    nom: nom || '-',
    prenom: prenom || '-',
    email,
    motDePasse: crypto.randomBytes(32).toString('hex'), // mot de passe aléatoire (champ obligatoire)
    photo: photo || '',
    role: roleFinal,
    isVerified: true,
    [idField]: providerId,
  });
  res.status(201).json(userPayload(user));
};

router.post('/google', async (req, res) => {
  try {
    const { credential, role } = req.body;
    if (!credential) return res.status(400).json({ message: 'Jeton Google manquant' });

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const p = ticket.getPayload();

    if (!p.email || !p.email_verified) {
      return res.status(400).json({ message: "L'email de ce compte Google n'est pas vérifié" });
    }

    await socialLogin(
      { provider: 'google', providerId: p.sub, email: p.email, prenom: p.given_name, nom: p.family_name, photo: p.picture, role },
      res
    );
  } catch (err) {
    console.error('❌ Erreur Google :', err.message);
    res.status(401).json({ message: 'Connexion Google invalide' });
  }
});

router.post('/facebook', async (req, res) => {
  try {
    const { accessToken, userID, role } = req.body;
    if (!accessToken || !userID) return res.status(400).json({ message: 'Jeton Facebook manquant' });

    const appToken = `${process.env.FACEBOOK_APP_ID}|${process.env.FACEBOOK_APP_SECRET}`;

    // 1. Vérifier que le jeton est valide, émis pour notre app, et pour cet utilisateur
    const dbg = await (await fetch(
      `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appToken)}`
    )).json();
    const d = dbg.data;
    if (!d || !d.is_valid || d.app_id !== process.env.FACEBOOK_APP_ID || d.user_id !== userID) {
      return res.status(401).json({ message: 'Connexion Facebook invalide' });
    }

    // 2. Récupérer le profil
    const me = await (await fetch(
      `https://graph.facebook.com/me?fields=id,first_name,last_name,email,picture.type(large)&access_token=${encodeURIComponent(accessToken)}`
    )).json();
    if (!me.id) return res.status(401).json({ message: 'Connexion Facebook invalide' });

    if (!me.email) {
      return res.status(400).json({
        message: "Facebook n'a pas partagé votre email. Utilisez Google ou un compte classique.",
      });
    }

    await socialLogin(
      { provider: 'facebook', providerId: me.id, email: me.email, prenom: me.first_name, nom: me.last_name, photo: me.picture?.data?.url, role },
      res
    );
  } catch (err) {
    console.error('❌ Erreur Facebook :', err.message);
    res.status(401).json({ message: 'Connexion Facebook invalide' });
  }
});

module.exports = router;