import { placeBid } from "../services/bid.service.js";
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

describe("Bid Concurrency (Optimistic Concurrency Control)", () => {
  it("allows exactly 1 winner under N concurrent bids", async () => {
    const N = 10;
    const seller = await createUser({ email: "seller@test.com" });
    const bidders = await Promise.all(
      Array.from({ length: N }, (_, i) => createUser({ email: `bidder${i}@test.com` }))
    );
    const auction = await createAuction(seller._id, { currentPrice: 100, startingPrice: 100 });

    // Fire N simultaneous bids, all at the same valid amount (105)
    const results = await Promise.allSettled(
      bidders.map((b) =>
        placeBid({ auctionId: auction._id.toString(), userId: b._id.toString(), bidAmount: 105 })
      )
    );

    const successes = results.filter((r) => r.status === "fulfilled");
    const conflicts = results.filter(
      (r) => r.status === "rejected" && r.reason?.statusCode === 409
    );

    // Level 1: exactly 1 winner, N-1 conflicts
    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(N - 1);

    // Level 2: DB state is consistent
    const finalProduct = await Product.findById(auction._id);
    expect(finalProduct.currentPrice).toBe(105);
    expect(finalProduct.bids).toHaveLength(1);
  });
});
