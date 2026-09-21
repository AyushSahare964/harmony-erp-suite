/**
 * purge-test-data.mjs
 *
 * Wipes ALL test / generated data from the vetos_erp MongoDB database.
 * SAFE: Keeps only the two default login accounts - makarand & ayush.
 * Keeps system masters (uoms, tax_codes, payment_modes, expensecategories, paymentaccounts, org_branches, lab_test_catalog).
 *
 * Usage:
 *   node --env-file=.env scripts/purge-test-data.mjs
 */

import { MongoClient } from "mongodb";
import process from "node:process";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("Missing MONGODB_URI environment variable.");
  console.error("Run: node --env-file=.env scripts/purge-test-data.mjs");
  process.exit(1);
}

const client = new MongoClient(uri);

const COLLECTIONS_TO_PURGE = [
  "clinicalvisits",
  "pets",
  "owners",
  "followups",
  "reminders",
  "vaccinations",
  "dewormingrecords",
  "bloodtests",
  "finance_transactions",
  "fin_daily_summary",
  "party_ledger",
  "payment_docs",
  "sales_docs",
  "quotations",
  "expenses",
  "purchasebills",
  "supplierpayments",
  "billing_reminders",
  "billingreminders",
  "inventory_items",
  "stock_batches",
  "stock_ledger",
  "parties",
  "suppliers",
  "lab_orders",
  "facilities",
  "boarding_bookings",
  "swimming_sessions",
  "retail_bills",
  "feeding_plans",
  "foodpurchases",
  "audit_logs",
  "clientsubscriptions",
  "subscriptionplans",
];

async function run() {
  try {
    await client.connect();
    const db = client.db();
    console.log("Connected to MongoDB:", db.databaseName);
    console.log("=".repeat(60));

    let totalDeleted = 0;
    for (const colName of COLLECTIONS_TO_PURGE) {
      try {
        const res = await db.collection(colName).deleteMany({});
        console.log(`[${colName}] Deleted ${res.deletedCount} documents.`);
        totalDeleted += res.deletedCount;
      } catch (err) {
        console.warn(`[${colName}] Skipped:`, err.message);
      }
    }

    // Purge transactional / test erp_rows, preserving the master lab_test_catalog
    try {
      const erpRes = await db.collection("erp_rows").deleteMany({
        moduleId: { $ne: "lab_test_catalog" },
      });
      console.log(`[erp_rows] Deleted ${erpRes.deletedCount} test documents (preserved lab_test_catalog).`);
      totalDeleted += erpRes.deletedCount;
    } catch (err) {
      console.warn("[erp_rows] Error cleaning:", err.message);
    }

    console.log("=".repeat(60));
    console.log("Total test documents deleted:", totalDeleted);

    // Delete all users EXCEPT makarand & ayush
    const keepPattern = /makarand|ayush/i;
    const allUsers = await db.collection("users").find({}, { projection: { _id: 1, fullName: 1, email: 1 } }).toArray();
    const toDeleteIds = allUsers
      .filter((u) => !keepPattern.test(u.fullName) && !keepPattern.test(u.email))
      .map((u) => u._id);

    const keptUsers = allUsers.filter(
      (u) => keepPattern.test(u.fullName) || keepPattern.test(u.email)
    );

    console.log("[users] Found " + allUsers.length + " total users.");
    console.log("[users] Keeping " + keptUsers.length + " account(s):");
    for (const u of keptUsers) {
      console.log("  -> " + u.fullName + " <" + u.email + ">");
    }

    if (toDeleteIds.length > 0) {
      const rtRes = await db.collection("refresh_tokens").deleteMany({ userId: { $in: toDeleteIds } });
      console.log("[refresh_tokens] Removed " + rtRes.deletedCount + " tokens for deleted users.");
      const userDelRes = await db.collection("users").deleteMany({ _id: { $in: toDeleteIds } });
      console.log("[users] Deleted " + userDelRes.deletedCount + " test user(s).");
    } else {
      console.log("[users] No extra users to delete. Only Ayush and Makarand are present.");
    }

    // Clear stale refresh tokens
    const staleRt = await db.collection("refresh_tokens").deleteMany({});
    if (staleRt.deletedCount > 0) {
      console.log("[refresh_tokens] Cleared " + staleRt.deletedCount + " stale session(s).");
    }

    // Reset sequence counters to 0
    const counterResult = await db.collection("counters").updateMany({}, { $set: { seq: 0 } });
    console.log("[counters] Reset " + counterResult.modifiedCount + " counter(s) to 0.");

    // Reset number_series
    try {
      const nsResult = await db.collection("number_series").updateMany({}, { $set: { lastNumber: 0 } });
      console.log("[number_series] Reset " + nsResult.modifiedCount + " number series.");
    } catch (_) {}

    // Reset payment account balances
    try {
      const paRes = await db.collection("payment_accounts").updateMany({}, { $set: { balance: 0 } });
      console.log("[payment_accounts] Reset " + paRes.modifiedCount + " balance(s) to 0.");
    } catch (_) {}

    // Reset opening balances
    try {
      const accReset = await db.collection("accounts").updateMany(
        { openingBalance: { $gt: 0 } },
        { $set: { openingBalance: 0 } }
      );
      console.log("[accounts] Reset " + accReset.modifiedCount + " opening balance(s) to 0.");
    } catch (_) {}

    console.log("=".repeat(60));
    console.log("SUCCESS - All test data has been removed. Credentials for Ayush and Makarand remain intact.");
    console.log("=".repeat(60));
  } catch (err) {
    console.error("Fatal cleanup error:", err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

run();
