/**
 * MongoDB Backup Script for Harmony ERP Suite
 * 
 * Extracts all collections and documents from the MongoDB database,
 * preserving MongoDB BSON types (ObjectIds, Dates, Numbers) using BSON Extended JSON (EJSON).
 * 
 * Outputs:
 *  - backups/mongodb-backup-latest.json (consolidated backup of all collections)
 *  - backups/archive/mongodb-backup-YYYY-MM-DD_HH-mm-ss.json (timestamped snapshot)
 *  - backups/collections/<collectionName>.json (per-collection backups)
 *  - backups/backup-metadata.json (backup stats and metadata)
 * 
 * Run via:
 *   npm run db:backup
 *   or: node scripts/backup-mongodb.mjs
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

function formatDate(date) {
  const pad = (n) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${y}-${m}-${d}_${h}-${min}-${s}`;
}

async function backup() {
  console.log("==========================================");
  console.log("   Harmony ERP - MongoDB Backup Utility   ");
  console.log("==========================================\n");

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
    const dbName = db.databaseName;
    console.log(`Connected successfully to database: [${dbName}]\n`);

    const now = new Date();
    const timestampStr = formatDate(now);

    const backupDir = path.join(ROOT, "backups");
    const collectionsDir = path.join(backupDir, "collections");
    const archiveDir = path.join(backupDir, "archive");

    fs.mkdirSync(backupDir, { recursive: true });
    fs.mkdirSync(collectionsDir, { recursive: true });
    fs.mkdirSync(archiveDir, { recursive: true });

    // Fetch all collection names
    const collectionsList = await db.listCollections().toArray();
    // Exclude system collections
    const collections = collectionsList
      .map((c) => c.name)
      .filter((name) => !name.startsWith("system."));

    console.log(`Found ${collections.length} collections. Starting extraction...\n`);

    const fullBackupData = {
      _metadata: {
        exportedAt: now.toISOString(),
        database: dbName,
        totalCollections: collections.length,
        version: "1.0",
        collections: {},
      },
      collections: {},
    };

    let grandTotalDocs = 0;
    const statsTable = [];

    for (const name of collections) {
      const col = db.collection(name);
      const docs = await col.find({}).toArray();
      const count = docs.length;
      grandTotalDocs += count;

      fullBackupData._metadata.collections[name] = count;
      fullBackupData.collections[name] = docs;

      // Save individual collection file
      const colFilePath = path.join(collectionsDir, `${name}.json`);
      const colJson = BSON.EJSON.stringify(docs, { relaxed: true }, 2);
      fs.writeFileSync(colFilePath, colJson, "utf8");

      statsTable.push({
        Collection: name,
        Documents: count,
        Status: count > 0 ? "Backed up" : "Empty (saved)",
      });
    }

    // Save consolidated backup file
    const consolidatedJson = BSON.EJSON.stringify(fullBackupData, { relaxed: true }, 2);
    const latestFilePath = path.join(backupDir, "mongodb-backup-latest.json");
    fs.writeFileSync(latestFilePath, consolidatedJson, "utf8");

    // Save timestamped archive copy
    const archiveFilePath = path.join(archiveDir, `mongodb-backup-${timestampStr}.json`);
    fs.writeFileSync(archiveFilePath, consolidatedJson, "utf8");

    // Save metadata summary file
    const metaSummary = {
      backupTimestamp: now.toISOString(),
      formattedDate: now.toLocaleString(),
      database: dbName,
      totalCollections: collections.length,
      totalDocuments: grandTotalDocs,
      latestBackupFile: "backups/mongodb-backup-latest.json",
      archiveFile: `backups/archive/mongodb-backup-${timestampStr}.json`,
      collectionFilesDirectory: "backups/collections/",
      collectionsSummary: fullBackupData._metadata.collections,
    };
    fs.writeFileSync(
      path.join(backupDir, "backup-metadata.json"),
      JSON.stringify(metaSummary, null, 2),
      "utf8"
    );

    console.table(statsTable);

    console.log("\n==========================================");
    console.log("           BACKUP COMPLETED               ");
    console.log("==========================================");
    console.log(`Total Collections : ${collections.length}`);
    console.log(`Total Documents   : ${grandTotalDocs}`);
    console.log(`Latest Backup     : ${path.relative(ROOT, latestFilePath)}`);
    console.log(`Archived Backup   : ${path.relative(ROOT, archiveFilePath)}`);
    console.log(`Per-Collection Dir: ${path.relative(ROOT, collectionsDir)}`);
    console.log(`Metadata Summary  : ${path.relative(ROOT, path.join(backupDir, "backup-metadata.json"))}`);
    console.log("==========================================\n");
  } catch (err) {
    console.error("Backup failed with error:", err);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

backup();
