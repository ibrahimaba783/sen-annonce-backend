const Category = require('./models/Category');
const User = require('./models/User');
const Annonce = require('./models/Annonce');
const Message = require('./models/Message');
const Notification = require('./models/Notification');

const defaultCategories = [
  { nom: 'Immobilier', icone: '🏠', description: 'Maisons, appartements, terrains, meublés' },
  { nom: 'Véhicules', icone: '🚗', description: 'Voitures, motos, pièces détachées, location' },
  { nom: 'Électronique', icone: '📱', description: 'Smartphones, TV, son, électroménager' },
  { nom: 'Maison', icone: '🏡', description: 'Meubles, décoration, jardin' },
  { nom: 'Emplois', icone: '💼', description: 'Offres d\'emploi, stages, formations' },
  { nom: 'Autres', icone: '📦', description: 'Autres produits et services' },
];

const seedCategories = async () => {
  try {
    const categoryMap = {};
    for (const cat of defaultCategories) {
      let doc = await Category.findOne({ nom: cat.nom });
      if (!doc) {
        doc = await Category.create(cat);
        console.log(`✅ Catégorie créée : ${cat.nom}`);
      }
      categoryMap[cat.nom] = doc._id;
    }

    // Administrateur
    let adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      adminUser = await User.create({
        nom: 'SenAnnonce',
        prenom: 'Administrateur',
        email: 'admin@senannonce.sn',
        motDePasse: 'Admin123456!',
        role: 'admin',
        isVerified: true,
      });
      console.log('✅ Compte admin créé');
    }

    // Amadou Diop (vendeur vérifié de la maquette)
    let amadou = await User.findOne({ email: 'amadou.diop@gmail.com' });
    if (!amadou) {
      amadou = await User.create({
        nom: 'Diop',
        prenom: 'Amadou',
        email: 'amadou.diop@gmail.com',
        motDePasse: 'Pass1234!',
        telephone: '+221 77 123 45 67',
        role: 'prestataire',
        isVerified: true,
      });
      console.log('✅ Compte Amadou Diop créé');
    }

    // Moussa Ndiaye
    let moussa = await User.findOne({ email: 'moussa.ndiaye@gmail.com' });
    if (!moussa) {
      moussa = await User.create({
        nom: 'Ndiaye',
        prenom: 'Moussa',
        email: 'moussa.ndiaye@gmail.com',
        motDePasse: 'Pass1234!',
        telephone: '+221 78 987 65 43',
        role: 'client',
        isVerified: true,
      });
      console.log('✅ Compte Moussa Ndiaye créé');
    }

    // Seed Annonces matching Figma Wireframes if none exist
    const totalAds = await Annonce.countDocuments();
    if (totalAds === 0) {
      const demoAds = [
        {
          titre: 'iPhone 13 Pro',
          description: 'iPhone 13 Pro en très bon état, 128Go, batterie 85%. Débloqué tout opérateur. Fourni avec boîte et câble.',
          prix: 350000,
          categorie: categoryMap['Électronique'] || Object.values(categoryMap)[0],
          utilisateur: amadou._id,
          ville: 'Dakar',
          statut: 'validee',
          actif: true,
          vues: 142,
        },
        {
          titre: 'Appartement 3 pièces à louer',
          description: 'Bel appartement F3 meublé à Almadies, grand salon lumineux, 2 chambres avec salles de bain, cuisine équipée.',
          prix: 250000,
          categorie: categoryMap['Immobilier'] || Object.values(categoryMap)[0],
          utilisateur: amadou._id,
          ville: 'Dakar',
          statut: 'validee',
          actif: true,
          vues: 98,
        },
        {
          titre: 'Toyota Camry 2018',
          description: 'Toyota Camry 2018 automatique, moteur essence 4 cylindres, faible kilométrage, climatisation d\'origine.',
          prix: 5500000,
          categorie: categoryMap['Véhicules'] || Object.values(categoryMap)[0],
          utilisateur: amadou._id,
          ville: 'Pikine',
          statut: 'validee',
          actif: true,
          vues: 215,
        },
        {
          titre: 'MacBook Pro 2020',
          description: 'MacBook Pro 13 pouces M1, 8GB RAM, 256GB SSD, état neuf, chargeur original inclus.',
          prix: 6500000,
          categorie: categoryMap['Électronique'] || Object.values(categoryMap)[0],
          utilisateur: moussa._id,
          ville: 'Rufisque',
          statut: 'validee',
          actif: true,
          vues: 85,
        }
      ];
      await Annonce.insertMany(demoAds);
      console.log('✅ Annonces de démonstration créées');
    }

    // Seed conversations & messages if none exist
    const totalMsg = await Message.countDocuments();
    if (totalMsg === 0 && amadou && moussa) {
      await Message.create({
        expediteur: moussa._id,
        recepteur: amadou._id,
        contenu: 'Bonjour, votre iPhone 13 Pro est-il toujours disponible ?',
      });
      await Message.create({
        expediteur: amadou._id,
        recepteur: moussa._id,
        contenu: 'Oui, il est toujours disponible.',
      });
      await Message.create({
        expediteur: moussa._id,
        recepteur: amadou._id,
        contenu: 'Quel est le dernier prix ?',
      });
      await Message.create({
        expediteur: amadou._id,
        recepteur: moussa._id,
        contenu: '310 000 FCFA, prix fixe.',
      });
      console.log('✅ Messages de démonstration créés');
    }

    // Seed notifications if none exist
    const totalNotifs = await Notification.countDocuments();
    if (totalNotifs === 0 && amadou) {
      await Notification.create({
        utilisateur: amadou._id,
        titre: 'Moussa Ndiaye vous a envoyé un message',
        message: 'Concernant votre annonce iPhone 13 Pro.',
        type: 'message',
        lu: false,
      });
      await Notification.create({
        utilisateur: amadou._id,
        titre: 'Votre annonce est en ligne',
        message: 'iPhone 13 Pro est maintenant visible par les acheteurs.',
        type: 'validation',
        lu: true,
      });
      await Notification.create({
        utilisateur: amadou._id,
        titre: 'Votre compte a été vérifié',
        message: 'Vous bénéficiez maintenant du badge vendeur vérifié.',
        type: 'admin',
        lu: true,
      });
      console.log('✅ Notifications de démonstration créées');
    }
  } catch (err) {
    console.error('Erreur lors du seeding :', err.message);
  }
};

module.exports = seedCategories;
