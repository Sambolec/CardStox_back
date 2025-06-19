const express = require('express');
const cors = require('cors');
const { connectToDatabase } = require('./db.js');
const { ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

let db;
connectToDatabase().then(database => {
  db = database;
  console.log('Database connected');
}).catch(err => {
  console.error('Database connection failed:', err);
});

// JWT Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Missing token' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token' });

  jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret', (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

// User Registration
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existingUser = await db.collection('users').findOne({ 
      $or: [{ email }, { username }] 
    });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.collection('users').insertOne({
      username,
      email,
      password: hashedPassword,
      createdAt: new Date(),
      wishlist: [],
      bought: [],
      sold: []
    });

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// User Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const user = await db.collection('users').findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id.toString(), username: user.username },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '1d' }
    );

    res.json({ 
      token, 
      username: user.username, 
      userId: user._id 
    });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// User Profile Endpoint
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const userId = new ObjectId(req.user.userId);
    const user = await db.collection('users').findOne({ _id: userId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Helper to fetch cards by IDs (convert string IDs to ObjectIds)
    const toObjectIds = (ids) => ids?.map(id => new ObjectId(id)) || [];
    async function fetchCards(ids) {
      if (!ids.length) return [];
      return await db.collection('cards').find({ _id: { $in: ids } }).toArray();
    }

    const [wishlist, bought, sold] = await Promise.all([
      fetchCards(toObjectIds(user.wishlist)),
      fetchCards(toObjectIds(user.bought)),
      fetchCards(toObjectIds(user.sold))
    ]);

    // Calculate stats (sum price of bought and sold)
    const totalValue = [...bought, ...sold].reduce((sum, card) => sum + (parseFloat(card.price) || 0), 0);

    res.json({
      username: user.username,
      email: user.email,
      wishlist,
      bought,
      sold,
      totalCards: bought.length + sold.length,
      totalValue: totalValue,
      memberSince: user.createdAt ? user.createdAt.getFullYear() : new Date().getFullYear()
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Buy Card Endpoint (stores cardId as string)
app.post('/api/buy/:cardId', authenticateToken, async (req, res) => {
  try {
    const userId = new ObjectId(req.user.userId);
    const cardId = req.params.cardId;

    // Validate card exists
    const card = await db.collection('cards').findOne({ _id: new ObjectId(cardId) });
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    // Add cardId as string to user's bought array (remove from wishlist if present)
    await db.collection('users').updateOne(
      { _id: userId },
      { $addToSet: { bought: cardId }, $pull: { wishlist: cardId } }
    );

    res.json({ message: 'Card bought successfully', cardName: card.name });
  } catch (err) {
    res.status(500).json({ error: 'Failed to buy card' });
  }
});

// Sell Card Endpoint (moves from bought to sold)
app.post('/api/sell/:cardId', authenticateToken, async (req, res) => {
  try {
    const userId = new ObjectId(req.user.userId);
    const cardId = req.params.cardId;

    // Remove from bought, add to sold
    await db.collection('users').updateOne(
      { _id: userId },
      { $pull: { bought: cardId }, $addToSet: { sold: cardId } }
    );
    res.json({ message: 'Card sold and moved to sold cards' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to sell card' });
  }
});

// Wishlist Card Endpoint (stores cardId as string)
app.post('/api/wishlist/:cardId', authenticateToken, async (req, res) => {
  try {
    const userId = new ObjectId(req.user.userId);
    const cardId = req.params.cardId;

    // Validate card exists
    const card = await db.collection('cards').findOne({ _id: new ObjectId(cardId) });
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    // Add cardId as string to user's wishlist array
    await db.collection('users').updateOne(
      { _id: userId },
      { $addToSet: { wishlist: cardId } }
    );

    res.json({ message: 'Card added to wishlist', cardName: card.name });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add card to wishlist' });
  }
});

// Remove from Wishlist Endpoint
app.delete('/api/wishlist/:cardId', authenticateToken, async (req, res) => {
  try {
    const userId = new ObjectId(req.user.userId);
    const cardId = req.params.cardId;

    await db.collection('users').updateOne(
      { _id: userId },
      { $pull: { wishlist: cardId } }
    );

    res.json({ message: 'Card removed from wishlist' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove card from wishlist' });
  }
});

// GET all cards (for home page, only cards NOT bought by any user)
app.get('/api/cards', async (req, res) => {
  try {
    // Get all bought and sold card IDs from all users
    const users = await db.collection('users').find({}).toArray();
    const boughtIds = users.flatMap(u => u.bought || []);
    const soldIds = users.flatMap(u => u.sold || []);
    const removedIds = [...boughtIds, ...soldIds];
    const unsoldCards = await db.collection('cards').find({
      _id: { $nin: removedIds.map(id => new ObjectId(id)) }
    }).toArray();
    res.json(unsoldCards);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cards' });
  }
});

// GET popular cards (≥€20 price increase in last 10 days)
app.get('/api/popular', async (req, res) => {
  try {
    const now = new Date();
    const tenDaysAgo = new Date(now);
    tenDaysAgo.setDate(now.getDate() - 10);

    const cards = await db.collection('cards').find().toArray();

    const popular = cards.filter(card => {
      if (!card.priceHistory || card.priceHistory.length < 2) return false;

      // Sort priceHistory by date ascending
      const sortedHistory = card.priceHistory
        .map(p => ({ ...p, date: new Date(p.date) }))
        .sort((a, b) => a.date - b.date);

      const latestPrice = sortedHistory[sortedHistory.length - 1].price;

      // Find price as of 10 days ago
      let priceTenDaysAgo = null;
      for (let i = sortedHistory.length - 1; i >= 0; i--) {
        if (sortedHistory[i].date <= tenDaysAgo) {
          priceTenDaysAgo = sortedHistory[i].price;
          break;
        }
      }
      if (priceTenDaysAgo === null) {
        priceTenDaysAgo = sortedHistory[0].price;
      }

      return latestPrice - priceTenDaysAgo >= 20;
    });

    res.json(popular);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch popular cards' });
  }
});

// GET one card by id
app.get('/api/cards/:id', async (req, res) => {
  try {
    const cardId = req.params.id;
    if (!ObjectId.isValid(cardId)) {
      return res.status(400).json({ error: 'Invalid card ID format' });
    }
    const card = await db.collection('cards').findOne({ _id: new ObjectId(cardId) });
    if (!card) return res.status(404).json({ error: 'Card not found' });
    res.json(card);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch card' });
  }
});

// POST new card
app.post('/api/cards', async (req, res) => {
  const newCard = req.body;
  try {
    const result = await db.collection('cards').insertOne(newCard);
    res.status(201).json({ insertedId: result.insertedId });
  } catch (err) {
    res.status(400).json({ error: 'Failed to add card' });
  }
});

// PATCH update card
app.patch('/api/cards/:id', async (req, res) => {
  const update = req.body;
  try {
    const result = await db.collection('cards').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: update }
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Card not found' });
    res.json({ modifiedCount: result.modifiedCount });
  } catch (err) {
    res.status(400).json({ error: 'Failed to update card' });
  }
});

// DELETE card
app.delete('/api/cards/:id', async (req, res) => {
  try {
    const result = await db.collection('cards').deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Card not found' });
    res.json({ deletedCount: result.deletedCount });
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete card' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
