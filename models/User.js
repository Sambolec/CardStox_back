const User = {
  schema: {
    username: String,
    email: String,
    password: String,
    createdAt: Date,
    wishlist: [String],
    bought: [String],
    sold: [String]
  }
};

module.exports = User;
