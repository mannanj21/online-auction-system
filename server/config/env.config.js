import dotenv from "dotenv";
dotenv.config();

export const env = {
  port: process.env.PORT || 4000,
  origin: process.env.ORIGIN,
  node_env: process.env.NODE_ENV,
  mongo_uri: process.env.MONGO_URL,
  jwt_secret: process.env.JWT_SECRET,
  jwt_expires_in: process.env.JWT_EXPIRES_IN || "7d",
  cookie_domain: process.env.COOKIE_DOMAIN, // e.g., ".yourdomain.com" for cross-subdomain
  cloudinary_cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinary_api_key: process.env.CLOUDINARY_API_KEY,
  cloudinary_api_secret: process.env.CLOUDINARY_API_SECRET,
  cloudinary_url: process.env.CLOUDINARY_URL,
  resend_api_key: process.env.RESEND_API_KEY,
  bid_increment_min: parseInt(process.env.BID_INCREMENT_MIN) || 1,
  bid_increment_max: parseInt(process.env.BID_INCREMENT_MAX) || 10,
  redis_url: process.env.REDIS_URL,
};

// Validate critical environment variables at startup
const requiredVars = ["mongo_uri", "jwt_secret", "origin"];
for (const key of requiredVars) {
  if (!env[key]) {
    console.error(
      `FATAL: Missing required environment variable: ${key.toUpperCase()}`,
    );
    process.exit(1);
  }
}
