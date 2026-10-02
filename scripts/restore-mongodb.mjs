/**
 * MongoDB Restore Script for Harmony ERP Suite
 * 
 * Restores collections and documents into MongoDB from a backup file,
 * restoring true MongoDB types (ObjectIds, Dates, etc.) using BSON Extended JSON (EJSON).
 * 
 * Usage:
 *   npm run db:restore
 *   node scripts/restore-mongodb.mjs
 * 
 * Options:
 *   --file=<path>          Specify custom backup file (default: backups/mongodb-backup-latest.json)
 *   --collection=<name>    Restore only one specific collection (e.g. --collection=pets)
 *   --drop                 Clear existing collection documents before restoring (clean restore)
 *   --dry-run              Inspect and simulate restore without writing any changes to MongoDB
 */

import { MongoClient, BSON } from "mongodb";
import fs from "node:fs";
import path from "node:path";
import dns from "node:dns";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

// Configure DNS for Windows environments to resolve Atlas SRV records
if (process.platform === "win32" && typeof dns.setServers === "function") {
  try {
    dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
  } catch {
    // Ignore if not permitted
  }
}

function getMongoUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  if (process.env.VITE_MONGODB_URI) return process.env.VITE_MONGODB_URI;

  const envFiles = [".env.local", ".env", "atlas-credentials.env"];
  for (const file of envFiles) {
    const fullPath = path.join(ROOT, file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed.startsWith("MONGODB_URI=") || trimmed.startsWith("VITE_MONGODB_URI=")) {
          const val = trimmed.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
          if (val) return val;
        }
      }
    }
  }

  throw new Error("Could not find MONGODB_URI in environment or .env files.");
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    file: null,
    collection: null,
    drop: false,
    dryRun: false,
  };

  for (const arg of args) {
    if (arg.startsWith("--file=")) {
      options.file = arg.slice("--file=".length).trim();
    } else if (arg.startsWith("--collection=")) {
      options.collection = arg.slice("--collection=".length).trim();
    } else if (arg === "--drop") {
      options.drop = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    }
  }

  return options;
}

async function restore() {
  console.log("==========================================");
  console.log("   Harmony ERP - MongoDB Restore Utility  ");
  console.log("==========================================\n");

  const options = parseArgs();
  const backupFilePath = options.file
    ? path.resolve(ROOT, options.file)
    : path.join(ROOT, "backups", "mongodb-backup-latest.json");

  if (!fs.existsSync(backupFilePath)) {
    console.error(`Backup file not found at: ${backupFilePath}`);
    console.error("Please run 'npm run db:backup' first to generate a backup, or pass a valid --file=<path>.");
    process.exit(1);
  }

  console.log(`Loading backup from: ${path.relative(ROOT, backupFilePath)}`);
  const rawContent = fs.readFileSync(backupFilePath, "utf8");
  
  let backupData;
  try {
    backupData = BSON.EJSON.parse(rawContent, { relaxed: true });
  } catch (err) {
    console.error("Failed to parse backup JSON file:", err.message);
    process.exit(1);
  }

  let collectionsMap = {};
  if (backupData.collections && typeof backupData.collections === "object") {
    // Standard consolidated backup format
    collectionsMap = backupData.collections;
  } else if (Array.isArray(backupData) && options.collection) {
    // Single collection file passed directly
    collectionsMap[options.collection] = backupData;
  } else {
    // Maybe an object where keys are collection names
    collectionsMap = backupData;
  }

  const collectionNames = Object.keys(collectionsMap).filter((k) => !k.startsWith("_"));
  const targetCollections = options.collection
    ? collectionNames.filter((name) => name === options.collection)
    : collectionNames;

  if (targetCollections.length === 0) {
    console.error(`No matching collections found to restore. Requested: '${options.collection}'`);
    console.log("Available in file:", collectionNames.join(", "));
    process.exit(1);
  }

  if (options.dryRun) {
    console.log("MODE: DRY RUN (no modifications will be performed)\n");
  } else if (options.drop) {
    console.log("MODE: DROP & OVERWRITE (collections will be cleared before restoring documents)\n");
  } else {
    console.log("MODE: UPSERT (missing documents added, existing matched by _id updated)\n");
  }

  const uri = getMongoUri();
  const maskedUri = uri.replace(/\/\/([^:]+):[^@]+@/, "//$1:****@");
  console.log(`Connecting to: ${maskedUri}`);

  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });

  try {
    await client.connect();
    const db = client.db();
    console.log(`Connected to database: [${db.databaseName}]\n`);

    const results = [];
    let totalRestored = 0;

    for (const name of targetCollections) {
      const docs = collectionsMap[name];
      if (!Array.isArray(docs)) continue;

      const col = db.collection(name);
      let inserted = 0;
      let updated = 0;
      let skipped = 0;

      if (options.dryRun) {
        results.push({
          Collection: name,
          "Docs in Backup": docs.length,
          Action: `${docs.length} docs would be restored (Dry Run)`,
        });
        continue;
      }

      if (options.drop && docs.length > 0) {
        await col.deleteMany({});
      }

      if (docs.length === 0) {
        results.push({
          Collection: name,
          "Docs in Backup": 0,
          Action: "Empty collection",
        });
        continue;
      }

      if (options.drop) {
        // Fast batch insert when dropped
        const insertRes = await col.insertMany(docs, { ordered: false });
        inserted = insertRes.insertedCount;
      } else {
        // Upsert by _id so existing data is safe and missing deleted data is restored
        const bulk = col.initializeUnorderedBulkOp();
        for (const doc of docs) {
          if (doc._id !== undefined) {
            bulk.find({ _id: doc._id }).upsert().replaceOne(doc);
          } else {
            bulk.insert(doc);
          }
        }
        const bulkRes = await bulk.execute();
        inserted = bulkRes.upsertedCount + bulkRes.insertedCount;
        updated = bulkRes.matchedCount;
      }

      totalRestored += docs.length;
      results.push({
        Collection: name,
        "Docs in Backup": docs.length,
        Action: options.drop
          ? `Inserted ${inserted}`
          : `Restored/Upserted ${inserted + updated} (${inserted} new, ${updated} updated)`,
      });
    }

    console.table(results);

    console.log("\n==========================================");
    console.log("           RESTORE COMPLETED              ");
    console.log("==========================================");
    console.log(`Collections Processed : ${targetCollections.length}`);
    console.log(`Total Documents In Set: ${totalRestored}`);
    console.log("==========================================\n");
  } catch (err) {
    console.error("Restore failed with error:", err);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

restore();
