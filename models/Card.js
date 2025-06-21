// MORAŠ DOBRO NAUČIT ČA JE MONGOOSE I ZAŠTO GA KORISTIŠ, POŠTO TO NISMO KORISTILI U SKLOPU KOLEGIJA
const mongoose = require('mongoose');

const CardSchema = new mongoose.Schema({
  name: String,
  game: String,
  set: String,
  price: Number,
  history: [Number],
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

module.exports = mongoose.model('Card', CardSchema);
