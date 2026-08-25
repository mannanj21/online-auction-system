import request from "supertest";
import { jest } from "@jest/globals";

jest.unstable_mockModule("../utils/geoDetails.js", () => ({
  getLocationFromIp: jest.fn().mockResolvedValue({
    country: "MockCountry",
    region: "MockRegion",
    city: "MockCity",
    isp: "MockISP",
  }),
  getClientIp: jest.fn().mockReturnValue("127.0.0.1"),
}));

const { app } = await import("../app.js");
const { connect, disconnect, clearDatabase } = await import("./helpers/db.helper.js");
const { createUser } = await import("./helpers/fixtures.js");

beforeAll(async () => {
  await connect();
});

afterAll(async () => {
  await disconnect();
});

afterEach(async () => {
  await clearDatabase();
});

describe("Auth Routes", () => {
  describe("POST /api/auth/signup", () => {
    it("should register a user successfully", async () => {
      const res = await request(app)
        .post("/api/auth/signup")
        .send({
          name: "New User",
          email: "new@example.com",
          password: "Password123",
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe("User registered successfully");
      expect(res.headers["set-cookie"]).toBeDefined();
    });

    it("should reject duplicate email", async () => {
      await createUser({ email: "exist@example.com" });

      const res = await request(app)
        .post("/api/auth/signup")
        .send({
          name: "Another",
          email: "exist@example.com",
          password: "Password123",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("User already exists");
    });

    it("should reject missing fields", async () => {
      const res = await request(app)
        .post("/api/auth/signup")
        .send({
          email: "new@example.com",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("All fields are required");
    });

    it("should reject short password", async () => {
      const res = await request(app)
        .post("/api/auth/signup")
        .send({
          name: "User",
          email: "new@example.com",
          password: "short",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Password must be at least 8 characters long");
    });
  });

  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      await createUser({ email: "login@example.com", password: "Password123" });
    });

    it("should login successfully", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "login@example.com",
          password: "Password123",
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Login Successful");
      expect(res.headers["set-cookie"]).toBeDefined();
    });

    it("should reject wrong password but keep enumeration-safe message", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "login@example.com",
          password: "wrong",
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid email or password");
    });

    it("should reject non-existent email but keep enumeration-safe message", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "none@example.com",
          password: "Password123",
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid email or password");
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should clear the cookie", async () => {
      const res = await request(app).post("/api/auth/logout");

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Logged out successfully");
      
      const cookies = res.headers["set-cookie"] || [];
      const hasClearedCookie = cookies.some(c => c.startsWith("auth_token=;"));
      expect(hasClearedCookie).toBe(true);
    });
  });
});
