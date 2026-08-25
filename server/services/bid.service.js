import Product from "../models/product.model.js";
import { env } from "../config/env.config.js";

export class BidError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "BidError";
  }
}

export const placeBid = async ({ auctionId, userId, bidAmount }) => {
  const amount = Number(bidAmount);
  if (isNaN(amount)) {
    throw new BidError(400, "Invalid bid amount");
  }

  const product = await Product.findById(auctionId);
  if (!product) {
    throw new BidError(404, "Auction not found");
  }

  if (product.seller.toString() === userId) {
    throw new BidError(403, "You cannot bid on your own auction");
  }

  if (new Date(product.itemEndDate) < new Date()) {
    throw new BidError(400, "Auction has already ended");
  }

  const minBid = Math.max(product.currentPrice, product.startingPrice) + env.bid_increment_min;
  const maxBid = Math.max(product.currentPrice, product.startingPrice) + env.bid_increment_max;

  if (amount < minBid) {
    throw new BidError(400, `Bid must be at least Rs ${minBid}`);
  }
  if (amount > maxBid) {
    throw new BidError(400, `Bid must be at max Rs ${maxBid}`);
  }

  const updatedProduct = await Product.findOneAndUpdate(
    {
      _id: auctionId,
      currentPrice: product.currentPrice, // Only update if price hasn't changed
      itemEndDate: { $gt: new Date() },
    },
    {
      $set: { currentPrice: amount },
      $push: {
        bids: {
          bidder: userId,
          bidAmount: amount,
        },
      },
    },
    { new: true },
  )
    .populate("seller", "name")
    .populate("bids.bidder", "name");

  if (!updatedProduct) {
    throw new BidError(409, "Bid failed — price changed. Please try again.");
  }

  updatedProduct.bids.sort(
    (a, b) => new Date(b.bidTime) - new Date(a.bidTime),
  );

  const bidderName =
    updatedProduct.bids.find((b) => b.bidder?._id?.toString() === userId)?.bidder
      ?.name || "Someone";

  return { auction: updatedProduct, bidderName };
};
