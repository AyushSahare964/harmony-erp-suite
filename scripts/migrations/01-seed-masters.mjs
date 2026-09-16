/**
 * Migration 01 — seed the finance masters.
 *
 * Idempotent: every write is an upsert keyed on a natural key, so running this
 * twice changes nothing. Run it before anything else in the finance module —
 * the tax engine needs OrgBranch.stateCode, and posting needs NumberSeries.
 *
 *   node scripts/migrations/01-seed-masters.mjs            # apply
 *   node scripts/migrations/01-seed-masters.mjs --dry-run  # report only
 */

import mongoose from "mongoose";
import process from "node:process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

const DRY_RUN = process.argv.includes("--dry-run");

// ─── Connection ───────────────────────────────────────────────────────────────

/** Try each candidate URI in turn; auth failures fall through to the next. */
async function connectWithFallback() {
  const candidates = [];
  if (process.env.MONGODB_URI) candidates.push(["MONGODB_URI env", process.env.MONGODB_URI]);

  const envPath = path.join(ROOT, "atlas-credentials.env");
  if (fs.existsSync(envPath)) {
    const line = fs
      .readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith("MONGODB_URI="));
    const value = line?.slice("MONGODB_URI=".length).trim().replace(/^["']|["']$/g, "");
    if (value) candidates.push(["atlas-credentials.env", value]);
  }

  const clientPath = path.join(ROOT, "src", "lib", "mongodb", "client.ts");
  if (fs.existsSync(clientPath)) {
    const match = fs
      .readFileSync(clientPath, "utf8")
      .match(/DEFAULT_URI\s*=\s*["'`]([^"'`]+)["'`]/);
    if (match?.[1]) candidates.push(["client.ts DEFAULT_URI", match[1]]);
  }

  if (!candidates.length) throw new Error("No MongoDB connection string found.");

  let lastError;
  for (const [source, uri] of candidates) {
    const redacted = uri.replace(/:\/\/([^:]+):[^@]+@/, "://$1:****@");
    try {
      console.log(`[01-seed-masters] trying ${source}: ${redacted}`);
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
      console.log(`[01-seed-masters] connected via ${source}`);
      return;
    } catch (err) {
      console.log(`[01-seed-masters]   ${source} failed: ${err.message}`);
      lastError = err;
      await mongoose.disconnect().catch(() => {});
    }
  }
  throw lastError;
}

// ─── Seed data (implementation plan §12) ──────────────────────────────────────

const FY_CODE = "2026-27";
const BRANCH_ID = "MAIN";
/** Every rate row is effective from the start of the FY we are seeding. */
const EFFECTIVE_FROM = "2026-04-01";

const ORG_BRANCH = {
  code: "MAIN",
  name: "Real Care Small Animal Clinic",
  legalName: "Real Care Small Animal Clinic",
  stateCode: "27", // Maharashtra — drives CGST+SGST vs IGST
  city: "Nagpur",
  address: "Central Avenue, Nagpur",
  invoiceFooter: "Thank you for trusting us with your pet's care.",
  isComposition: false,
  lutEnabled: false,
  isDefault: true,
  isActive: true,
};

/** Common veterinary HSN (goods) and SAC (services) codes. */
const TAX_CODES = [
  { code: "3004", kind: "HSN", description: "Medicaments for therapeutic use", gstRate: 12 },
  { code: "30049099", kind: "HSN", description: "Other medicaments, veterinary", gstRate: 12 },
  { code: "3002", kind: "HSN", description: "Vaccines for veterinary medicine", gstRate: 5 },
  { code: "2309", kind: "HSN", description: "Animal feed preparations", gstRate: 18 },
  { code: "23091000", kind: "HSN", description: "Dog or cat food, retail packs", gstRate: 18 },
  { code: "9018", kind: "HSN", description: "Medical / veterinary instruments", gstRate: 12 },
  { code: "4201", kind: "HSN", description: "Saddlery and harness for animals", gstRate: 18 },
  { code: "3808", kind: "HSN", description: "Disinfectants, ectoparasiticides", gstRate: 18 },
  { code: "998351", kind: "SAC", description: "Veterinary services for pet animals", gstRate: 0 },
  { code: "999319", kind: "SAC", description: "Other human health services", gstRate: 0 },
  { code: "998729", kind: "SAC", description: "Grooming and boarding services", gstRate: 18 },
];

const UOMS = [
  { code: "PCS", name: "Pieces", decimals: 0, sortOrder: 1 },
  { code: "STRIP", name: "Strip", decimals: 0, sortOrder: 2 },
  { code: "TAB", name: "Tablet", decimals: 0, sortOrder: 3 },
  { code: "BOTTLE", name: "Bottle", decimals: 0, sortOrder: 4 },
  { code: "VIAL", name: "Vial", decimals: 0, sortOrder: 5 },
  { code: "ML", name: "Millilitre", decimals: 2, sortOrder: 6 },
  { code: "GM", name: "Gram", decimals: 2, sortOrder: 7 },
  { code: "KG", name: "Kilogram", decimals: 3, sortOrder: 8 },
  { code: "DOSE", name: "Dose", decimals: 0, sortOrder: 9 },
  { code: "SESSION", name: "Session", decimals: 0, sortOrder: 10 },
  { code: "BOX", name: "Box", decimals: 0, sortOrder: 11 },
  { code: "PACKET", name: "Packet", decimals: 0, sortOrder: 12 },
];

const EXPENSE_CATEGORIES = [
  "Rent", "Salary", "Electricity", "Water", "Internet & Phone",
  "Vehicle & Fuel", "Clinic Consumables", "Housekeeping",
  "Equipment Maintenance", "Marketing", "Professional Fees",
  "Bank Charges", "Licence & Statutory", "Miscellaneous",
].map((name, i) => ({ name, nature: "BUSINESS", sortOrder: 100 + i, isActive: true }));

/** ITC is claimable on these; the expense form reveals the GST block for them. */
const GST_INPUT_ELIGIBLE = new Set([
  "Clinic Consumables", "Equipment Maintenance", "Internet & Phone",
  "Marketing", "Professional Fees", "Vehicle & Fuel",
]);

const NUMBER_SERIES = [
  { docType: "INV", prefix: "INV" },
  { docType: "QTN", prefix: "QTN" },
  { docType: "CRN", prefix: "CRN" },
  { docType: "PUR", prefix: "PUR" },
  { docType: "DBN", prefix: "DBN" },
  { docType: "PIN", prefix: "PIN" },
  { docType: "POUT", prefix: "POUT" },
  { docType: "EXP", prefix: "EXP" },
];

const PAYMENT_MODES = [
  { code: "CASH", name: "Cash", requiresReference: false, sortOrder: 1 },
  { code: "UPI", name: "UPI", requiresReference: true, sortOrder: 2 },
  { code: "CARD", name: "Card", requiresReference: true, sortOrder: 3 },
  { code: "CHEQUE", name: "Cheque", requiresReference: true, sortOrder: 4, needsClearing: true },
  { code: "DD", name: "Demand Draft", requiresReference: true, sortOrder: 5, needsClearing: true },
  { code: "WALLET", name: "Mobile Wallet", requiresReference: true, sortOrder: 6 },
  { code: "BANK_TRANSFER", name: "Bank Transfer", requiresReference: true, sortOrder: 7 },
];

// ─── Runner ───────────────────────────────────────────────────────────────────

const report = [];

async function upsertMany(collName, rows, keyOf, label) {
  const coll = mongoose.connection.collection(collName);
  let inserted = 0;
  let matched = 0;

  for (const row of rows) {
    const key = keyOf(row);
    const existing = await coll.findOne(key);

    if (existing) {
      matched++;
      continue;
    }
    if (!DRY_RUN) {
      await coll.insertOne({ ...row, createdAt: new Date(), updatedAt: new Date() });
    }
    inserted++;
  }

  report.push({ master: label, collection: collName, existing: matched, seeded: inserted });
}

async function main() {
  console.log(`[01-seed-masters] ${DRY_RUN ? "DRY RUN — no writes" : "applying"}`);
  await connectWithFallback();

  await upsertMany(
    "org_branches",
    [ORG_BRANCH],
    (r) => ({ code: r.code }),
    "Org branch"
  );

  await upsertMany(
    "tax_codes",
    TAX_CODES.map((t) => ({
      ...t,
      cessRate: 0,
      effectiveFrom: EFFECTIVE_FROM,
      effectiveTo: null,
      isActive: true,
    })),
    (r) => ({ code: r.code, effectiveFrom: r.effectiveFrom }),
    "Tax codes (HSN / SAC)"
  );

  await upsertMany(
    "uoms",
    UOMS.map((u) => ({ ...u, isActive: true })),
    (r) => ({ code: r.code }),
    "Units of measure"
  );

  // Expense categories already carry a deliberate, doctor-approved list seeded
  // by the ExpenseCategory model. Do not layer the generic list on top of it —
  // that would give the expense form two overlapping taxonomies. Seed only into
  // an empty collection; otherwise just tag ITC eligibility on what is there.
  const expenseColl = mongoose.connection.collection("expensecategories");
  const existingCategories = await expenseColl.countDocuments();

  if (existingCategories === 0) {
    await upsertMany(
      "expensecategories",
      EXPENSE_CATEGORIES.map((c) => ({
        ...c,
        isGstInputEligible: GST_INPUT_ELIGIBLE.has(c.name),
      })),
      (r) => ({ name: r.name }),
      "Expense categories"
    );
  } else {
    let tagged = 0;
    for (const doc of await expenseColl.find({}).toArray()) {
      if (typeof doc.isGstInputEligible === "boolean") continue;
      if (!DRY_RUN) {
        await expenseColl.updateOne(
          { _id: doc._id },
          { $set: { isGstInputEligible: GST_INPUT_ELIGIBLE.has(doc.name), updatedAt: new Date() } }
        );
      }
      tagged++;
    }
    report.push({
      master: "Expense categories (kept existing list)",
      collection: "expensecategories",
      existing: existingCategories,
      seeded: 0,
      tagged,
    });
  }

  await upsertMany(
    "number_series",
    NUMBER_SERIES.map((s) => ({
      branchId: BRANCH_ID,
      docType: s.docType,
      fyCode: FY_CODE,
      prefix: s.prefix,
      padding: 4,
      // lastNumber counts what has been USED; 0 means the next one is 0001.
      lastNumber: 0,
    })),
    (r) => ({ branchId: r.branchId, docType: r.docType, fyCode: r.fyCode }),
    `Number series (FY ${FY_CODE})`
  );

  await upsertMany(
    "payment_modes",
    PAYMENT_MODES.map((m) => ({ ...m, needsClearing: m.needsClearing ?? false, isActive: true })),
    (r) => ({ code: r.code }),
    "Payment modes"
  );

  console.table(report);

  const totalSeeded = report.reduce((s, r) => s + r.seeded, 0);
  console.log(
    DRY_RUN
      ? `[01-seed-masters] dry run complete — ${totalSeeded} row(s) would be inserted.`
      : `[01-seed-masters] done — ${totalSeeded} row(s) inserted, the rest already existed.`
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[01-seed-masters] FAILED:", err.message);
  process.exitCode = 1;
  return mongoose.disconnect().catch(() => {});
});
