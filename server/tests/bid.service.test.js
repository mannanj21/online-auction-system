import { jest } from "@jest/globals";
import { placeBid, BidError } from "../services/bid.service.js";
import { connect, disconnect, clearDatabase } from "./helpers/db.helper.js";
import { createUser, createAuction } from "./helpers/fixtures.js";
import Product from "../models/product.model.js";

beforeAll(async () => {
  await connect();
});

afterAll(async () => {
  await disconnect();
});

afterEach(async () => {
  await clearDatabase();
});

describe("Bid Service", () => {
  let seller;
  let bidder;
  let auction;

  beforeEach(async () => {
    seller = await createUser({ email: "seller@test.com" });
    bidder = await createUser({ email: "bidder@test.com" });
    auction = await createAuction(seller._id, { currentPrice: 100, startingPrice: 100 });
  });

  it("should reject seller bidding on their own auction", async () => {
    await expect(
      placeBid({
        auctionId: auction._id.toString(),
        userId: seller._id.toString(),
        bidAmount: 105,
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "You cannot bid on your own auction",
    });
  });

  it("should reject bid on expired auction", async () => {
    const past = new Date(Date.now() - 1000);
    const expiredAuction = await createAuction(seller._id, { itemEndDate: past });

    await expect(
      placeBid({
        auctionId: expiredAuction._id.toString(),
        userId: bidder._id.toString(),
        bidAmount: 105,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Auction has already ended",
    });
  });

  it("should reject bid below minBid", async () => {
    await expect(
      placeBid({
        auctionId: auction._id.toString(),
        userId: bidder._id.toString(),
        bidAmount: 100, // minBid is 101
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Bid must be at least Rs 101",
    });
  });

  it("should reject bid above maxBid", async () => {
    await expect(
      placeBid({
        auctionId: auction._id.toString(),
        userId: bidder._id.toString(),
        bidAmount: 120, // maxBid is 110
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Bid must be at max Rs 110",
    });
  });

  it("should reject non-existent auction", async () => {
    const fakeId = seller._id.toString(); // Just a valid Mongo ID
    await expect(
      placeBid({
        auctionId: fakeId,
        userId: bidder._id.toString(),
        bidAmount: 105,
      })
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Auction not found",
    });
  });

  it("should reject invalid amount", async () => {
    await expect(
      placeBid({
        auctionId: auction._id.toString(),
        userId: bidder._id.toString(),
        bidAmount: "abc",
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Invalid bid amount",
    });
  });

  it("should accept valid bid and update DB", async () => {
    const result = await placeBid({
      auctionId: auction._id.toString(),
      userId: bidder._id.toString(),
      bidAmount: 105,
    });

    expect(result.bidderName).toBe(bidder.name);
    expect(result.auction.currentPrice).toBe(105);
    expect(result.auction.bids).toHaveLength(1);
    expect(result.auction.bids[0].bidAmount).toBe(105);

    const dbAuction = await Product.findById(auction._id);
    expect(dbAuction.currentPrice).toBe(105);
    expect(dbAuction.bids).toHaveLength(1);
  });
});
