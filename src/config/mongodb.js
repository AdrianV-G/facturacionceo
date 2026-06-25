const mongoose = require('mongoose');

let isConnected = false;

const connectMongo = async () => {
  if (isConnected) return;

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log('✅ MongoDB Atlas conectado');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error.message);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('⚠️  MongoDB desconectado');
});

module.exports = { connectMongo };
