const express = require('express');
const Card = require('../models/Card');
const router = express.Router();

router.get('/simulate', async (req, res) => {
  const cards = await Card.find();
  for (let card of cards) {
    const change = (Math.random() - 0.5) * 10; // -5 do +5
    card.price = Math.max(1, card.price + change);
    card.history.push(card.price);
    await card.save();
  }
  res.json({ msg: 'Market simulated' });
});

module.exports = router;
