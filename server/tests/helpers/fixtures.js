import User from "../../models/user.model.js";
import Product from "../../models/product.model.js";
import bcrypt from "bcrypt";

export const createUser = async (overrides = {}) => {
  const password = await bcrypt.hash(overrides.password || "Password123", 10);
  return User.create({
    name: "Test User",
    email: `test-${Date.now()}@example.com`,
    password,
    avatar: "https://example.com/avatar.png",
    ...overrides,
  });
};

export const createAuction = async (sellerId, overrides = {}) => {
  const now = new Date();
  const future = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
  return Product.create({
    itemName: "Test Item",
    itemDescription: "A test auction item",
    itemCategory: "Electronics",
    itemImage: { public_id: "test_id", url: "https://example.com/img.jpg" },
    startingPrice: 100,
    currentPrice: 100,
    itemStartDate: now,
    itemEndDate: future,
    seller: sellerId,
    bids: [],
    ...overrides,
  });
};
