const express = require('express');
const Card = require('../models/Card');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/', async (req, res) => {
  const cards = await Card.find();
  res.json(cards);
});

router.post('/', auth, async (req, res) => {
  const card = new Card({ ...req.body, ownerId: req.user.id, history: [req.body.price] });
  await card.save();
  res.json(card);
});

router.get('/:id', async (req, res) => {
  const card = await Card.findById(req.params.id);
  res.json(card);
});

router.put('/:id/price', auth, async (req, res) => {
  const card = await Card.findById(req.params.id);
  card.price = req.body.price;
  card.history.push(req.body.price);
  await card.save();
  res.json(card);
});

module.exports = router;
