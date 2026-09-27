import dns from "node:dns";
import * as mongooseModule from "mongoose";

// Only configure custom DNS servers on Windows local dev to resolve local ISP issues
if (typeof process !== "undefined" && process.platform === "win32" && typeof dns.setServers === "function") {
  try {
    dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
  } catch {
    // Ignore on non-Windows or restricted environments
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

function getMongoUri(): string {
  if (typeof process !== "undefined" && typeof (process as unknown as { loadEnvFile?: () => void }).loadEnvFile === "function") {
    try {
      (process as unknown as { loadEnvFile: () => void }).loadEnvFile();
    } catch {
      // .env might not exist in some cloud runners or already loaded
    }
  }

  const raw = typeof process !== "undefined" && (process.env["MONGODB_URI"] || process.env["VITE_MONGODB_URI"]);
  if (!raw) {
    throw new Error("MONGODB_URI (or VITE_MONGODB_URI) is not set. Add it to .env or the deployment's environment variables.");
  }

  // Clean any extraneous whitespace or enclosing quotes
  return raw.trim().replace(/^["']|["']$/g, "").trim();
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
    const isWin = typeof process !== "undefined" && process.platform === "win32";
    const opts: mongooseModule.ConnectOptions = {
      maxPoolSize: 15,
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 30000,
      connectTimeoutMS: 8000,
      retryWrites: true,
      ...(isWin ? { family: 4 } : {}),
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

