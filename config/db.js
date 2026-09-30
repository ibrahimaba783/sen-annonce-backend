const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL, { family: 4 });
    console.log('✅ MongoDB connecté');
  } catch (err) {
    console.error('❌ Erreur MongoDB :', err.message);
    if (err.reason && err.reason.servers) {
      for (const [server, desc] of err.reason.servers) {
        console.error(`   → ${server} :`, desc.error?.message || desc.error || 'pas de détail');
      }
    }
    process.exit(1);
  }
};

module.exports = connectDB;