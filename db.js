const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config();

const mongoURI = process.env.MONGO_URI;
const dbName = process.env.MONGO_DB_NAME;

let db = null;

async function connectToDatabase() {
  if (db) return db;
  try {
    const client = new MongoClient(mongoURI);
    await client.connect();
    console.log('Connected to MongoDB');
    db = client.db(dbName);
    return db;
  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
    throw err;
  }
}

module.exports = { connectToDatabase };
