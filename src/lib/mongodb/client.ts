/**
 * MongoDB Atlas — Singleton Mongoose connection.
 * Runs on the server (inside TanStack Start server functions).
 */

import dns from "node:dns";
import * as mongooseModule from "mongoose";

// Configure reliable DNS servers (Google + Cloudflare DNS) for Node.js SRV resolution on Windows
if (typeof dns.setServers === "function") {
  try {
    dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
  } catch {
    // Ignore in environments where setServers is restricted
  }
}

// Safe CommonJS / ESM default resolution
const mongoose =
  (mongooseModule as unknown as { default?: typeof mongooseModule }).default ||
  mongooseModule;

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __mongooseCache: MongooseCache | undefined;
}

let cached: MongooseCache = global.__mongooseCache || { conn: null, promise: null };
if (!global.__mongooseCache) {
  global.__mongooseCache = cached;
}

const DEFAULT_URI =
  "mongodb+srv://ayushsahare899_db_user:Sanskruti%4012@cluster0.d5k2cce.mongodb.net/vetos_erp?retryWrites=true&w=majority&appName=Cluster0";

function getMongoUri(): string {
  if (typeof process !== "undefined" && typeof (process as unknown as { loadEnvFile?: () => void }).loadEnvFile === "function") {
    try {
      (process as unknown as { loadEnvFile: () => void }).loadEnvFile();
    } catch {
      // .env might not exist in some cloud runners or already loaded
    }
  }

  const uri =
    process.env["MONGODB_URI"] ||
    process.env["VITE_MONGODB_URI"] ||
    DEFAULT_URI;

  return uri;
}

export async function connectDB(): Promise<typeof mongoose> {
  // If already connected, return cached connection
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (mongoose.connection.readyState === 1) {
    cached.conn = mongoose;
    return mongoose;
  }

  // If a connection attempt is already in progress, reuse the existing promise
  if (!cached.promise) {
    const uri = getMongoUri();
    const opts: mongooseModule.ConnectOptions = {
      maxPoolSize: 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 15000,
      retryWrites: true,
      family: 4, // Force IPv4 to prevent IPv6 DNS delays on Windows
    };

    cached.promise = mongoose.connect(uri, opts).then((m) => {
      console.log("[MongoDB] Connected to Atlas successfully.");
      cached.conn = m;
      return m;
    }).catch((err) => {
      console.error("[MongoDB] Connection error:", err);
      cached.promise = null;
      cached.conn = null;
      throw err;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    cached.conn = null;
    throw err;
  }

  return cached.conn;
}

export default mongoose;

