const Category = require('./models/Category');
const User = require('./models/User');

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
    // Catégories par défaut
    for (const cat of defaultCategories) {
      const existe = await Category.findOne({ nom: cat.nom });
      if (!existe) {
        await Category.create(cat);
        console.log(`✅ Catégorie créée : ${cat.nom}`);
      }
    }

    // Administrateur : créé seulement si ADMIN_EMAIL et ADMIN_PASSWORD sont définis
    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || '';

    if (adminEmail && adminPassword) {
      const adminExiste = await User.findOne({ role: 'admin' });
      if (!adminExiste) {
        await User.create({
          nom: 'SenAnnonce',
          prenom: 'Administrateur',
          email: adminEmail,
          motDePasse: adminPassword,
          role: 'admin',
          isVerified: true,
        });
        console.log('✅ Compte admin créé');
      }
    }
  } catch (err) {
    console.error('Erreur lors du seeding :', err.message);
  }
};

module.exports = seedCategories;