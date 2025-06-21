const Card = {
  schema: {
    name: String,
    game: String,
    set: String,
    price: Number,
    priceHistory: [{
      date: Date,
      price: Number
    }]
  }
};

module.exports = Card;
