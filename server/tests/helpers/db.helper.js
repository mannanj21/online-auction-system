import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongoServer;

export const connect = async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
};

export const disconnect = async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
};

export const clearDatabase = async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
};
