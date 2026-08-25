import { createServerFn } from "@tanstack/react-start";
import { connectDB } from "@/lib/mongodb/client";

export interface MongoStatusRow {
  connected: boolean;
  readyState: number;
  databaseName: string;
  host: string;
  latencyMs: number;
  error?: string | undefined;
}

export const getMongoStatusFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<MongoStatusRow> => {
    const start = Date.now();
    try {
      const conn = await connectDB();
      const latencyMs = Date.now() - start;
      const db = conn.connection.db;
      return {
        connected: conn.connection.readyState === 1,
        readyState: conn.connection.readyState,
        databaseName: db ? db.databaseName : "vetos_erp",
        host: conn.connection.host || "cluster0.d5k2cce.mongodb.net",
        latencyMs,
      };
    } catch (err) {
      return {
        connected: false,
        readyState: 0,
        databaseName: "vetos_erp",
        host: "cluster0.d5k2cce.mongodb.net",
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : "Connection failed",
      };
    }
  });
