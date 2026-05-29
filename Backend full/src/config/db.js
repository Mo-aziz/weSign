const mongoose = require('mongoose');
const { isProduction } = require('./env');

function getMongoUri() {
  if (isProduction) {
    return process.env.MONGODB_URI;
  }

  return process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/wesign';
}

async function connectDB() {
  const MONGODB_URI = getMongoUri();

  if (!MONGODB_URI) {
    console.error('MONGODB_URI is required in production');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error', err);
    process.exit(1);
  }
}

module.exports = {
  connectDB,
};

