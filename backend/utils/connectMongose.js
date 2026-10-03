const mongoose = require('mongoose');

async function connectMongoose() {
  try {
    console.log('mongo_url: ', process.env.MONGO_URL);
    await mongoose.connect(process.env.MONGO_URL, {
      serverSelectionTimeoutMS: 30000,
    });
    console.log('connected to db');
  } catch (error) {
    console.error(`failed to connect to the db: ${error.message}`);
  }
}

module.exports = { connectMongoose };
