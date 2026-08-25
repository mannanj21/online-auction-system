import request from "supertest";
import { jest } from "@jest/globals";
import { app } from "../app.js";
import { connect, disconnect, clearDatabase } from "./helpers/db.helper.js";
import { createUser, createAuction } from "./helpers/fixtures.js";
import Upload from "../models/upload.model.js";
import { generateToken } from "../utils/jwt.js";

beforeAll(async () => {
  await connect();
});

afterAll(async () => {
  await disconnect();
});

afterEach(async () => {
  await clearDatabase();
});

describe("Auction Routes", () => {
  let user;
  let userCookie;

  beforeEach(async () => {
    user = await createUser();
    const token = generateToken(user._id, user.role);
    userCookie = `auth_token=${token}; Path=/; HttpOnly`;
  });

  describe("POST /api/auction", () => {
    it("should create auction successfully", async () => {
      // Create a pending upload
      const upload = await Upload.create({ formId: "form123" });

      const res = await request(app)
        .post("/api/auction")
        .set("Cookie", userCookie)
        .send({
          itemName: "Test Auction",
          startingPrice: 100,
          itemDescription: "Description",
          itemCategory: "Other",
          itemEndDate: new Date(Date.now() + 86400000), // 1 day
          formId: "form123",
          public_id: "img123",
          secure_url: "https://img",
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe("Auction created successfully");
    });

    it("should reject missing image info", async () => {
      await Upload.create({ formId: "form123" });

      const res = await request(app)
        .post("/api/auction")
        .set("Cookie", userCookie)
        .send({
          itemName: "Test Auction",
          startingPrice: 100,
          itemDescription: "Description",
          itemCategory: "Other",
          itemEndDate: new Date(Date.now() + 86400000), // 1 day
          formId: "form123",
          // missing public_id and secure_url
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Image is required");
    });
  });

  describe("GET /api/auction/:id", () => {
    it("should return 404 for unknown ID", async () => {
      const res = await request(app)
        .get(`/api/auction/${user._id.toString()}`)
        .set("Cookie", userCookie);

      expect(res.status).toBe(404);
    });

    it("should set winner on expired auction with bids", async () => {
      const seller = await createUser({ email: "seller2@example.com" });
      const auction = await createAuction(seller._id, {
        itemEndDate: new Date(Date.now() - 1000), // expired
        bids: [{ bidder: user._id, bidAmount: 150 }],
      });

      const res = await request(app)
        .get(`/api/auction/${auction._id.toString()}`)
        .set("Cookie", userCookie); // accessing as bidder

      expect(res.status).toBe(200);
      expect(res.body.winner._id).toBe(user._id.toString());
      expect(res.body.isSold).toBe(true);
    });
  });

  describe("GET /api/auction", () => {
    it("should respect pagination", async () => {
      const seller = await createUser({ email: "seller3@example.com" });
      for (let i = 0; i < 5; i++) {
        await createAuction(seller._id);
      }

      const res = await request(app)
        .get("/api/auction?page=1&limit=2")
        .set("Cookie", userCookie);

      expect(res.status).toBe(200);
      expect(res.body.auctions).toHaveLength(2);
      expect(res.body.pagination.totalPages).toBe(3); // 5 total, limit 2
      expect(res.body.pagination.total).toBe(5);
    });
  });
});
