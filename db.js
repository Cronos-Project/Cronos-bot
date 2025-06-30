const mongoose = require('mongoose');

async function conectarMongo() {
  try {
    await mongoose.connect(process.env.MONGO_URI); // opções removidas
    console.log('🟢 Conectado ao MongoDB!');
  } catch (err) {
    console.error('🔴 Erro ao conectar no MongoDB:', err);
  }
}

module.exports = conectarMongo;
