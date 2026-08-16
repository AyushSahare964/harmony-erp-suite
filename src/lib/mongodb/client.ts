/**
 * MongoDB Atlas — Singleton Mongoose connection.
 * Runs ONLY on the server (inside TanStack Start server functions).
 */

import mongoose from "mongoose";

declare global {
  // eslint-disable-next-line no-var
  var __mongooseConn: typeof mongoose | undefined;
}

const MONGODB_URI = process.env["MONGODB_URI"];

if (!MONGODB_URI) {
  throw new Error(
    "[MongoDB] MONGODB_URI is not set. Add it to .env: MONGODB_URI=mongodb+srv://..."
  );
}

export async function connectDB(): Promise<typeof mongoose> {
  if (global.__mongooseConn && mongoose.connection.readyState === 1) {
    return global.__mongooseConn;
  }

  try {
    const conn = await mongoose.connect(MONGODB_URI!, {
      serverApi: { version: "1", strict: true, deprecationErrors: true },
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    global.__mongooseConn = conn;
    console.log("[MongoDB] Connected to Atlas successfully.");
    return conn;
  } catch (err) {
    console.error("[MongoDB] Connection failed:", err);
    throw err;
  }
}

export default mongoose;
