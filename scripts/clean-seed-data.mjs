import { MongoClient } from "mongodb";
import process from "node:process";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("Missing MONGODB_URI environment variable");
  process.exit(1);
}

const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    const db = client.db();
    console.log("Connected to MongoDB:", db.databaseName);

    // 1. Purge inventory_items
    const invRes = await db.collection("inventory_items").deleteMany({});
    console.log(`[inventory_items] Deleted ${invRes.deletedCount} items.`);

    // 2. Purge stock_batches & stock_ledger
    const batchRes = await db.collection("stock_batches").deleteMany({});
    console.log(`[stock_batches] Deleted ${batchRes.deletedCount} batches.`);

    const ledgerRes = await db.collection("stock_ledger").deleteMany({});
    console.log(`[stock_ledger] Deleted ${ledgerRes.deletedCount} ledger entries.`);

    // 3. Purge lab_orders / lab collections
    const labRes = await db.collection("lab_orders").deleteMany({});
    console.log(`[lab_orders] Deleted ${labRes.deletedCount} lab orders.`);

    // 4. Purge feeding_plans / nutrition
    const feedRes = await db.collection("feeding_plans").deleteMany({});
    console.log(`[feeding_plans] Deleted ${feedRes.deletedCount} feeding plans.`);

    const foodPurchRes = await db.collection("foodpurchases").deleteMany({});
    console.log(`[foodpurchases] Deleted ${foodPurchRes.deletedCount} food purchase records.`);

    // 5. Purge facility bookings (boarding, swimming)
    const facRes = await db.collection("facilities").deleteMany({});
    console.log(`[facilities] Deleted ${facRes.deletedCount} facility documents.`);

    const boardRes = await db.collection("boarding_bookings").deleteMany({});
    console.log(`[boarding_bookings] Deleted ${boardRes.deletedCount} boarding documents.`);

    const swimRes = await db.collection("swimming_sessions").deleteMany({});
    console.log(`[swimming_sessions] Deleted ${swimRes.deletedCount} swimming documents.`);

    // 6. Purge pharmacy bills / retail sales
    const pharmRes = await db.collection("retail_bills").deleteMany({});
    console.log(`[retail_bills] Deleted ${pharmRes.deletedCount} retail bills.`);

    // 7. Purge finance transactions (keep accounts structure)
    const finTxRes = await db.collection("finance_transactions").deleteMany({});
    console.log(`[finance_transactions] Deleted ${finTxRes.deletedCount} finance transactions.`);

    // Reset opening balances in accounts collection to 0 if any remain positive
    const accReset = await db.collection("accounts").updateMany(
      { openingBalance: { $gt: 0 } },
      { $set: { openingBalance: 0 } }
    );
    console.log(`[accounts] Reset opening balances to 0 for ${accReset.modifiedCount} accounts.`);

    // 8. Purge erp_rows for target modules
    const targetModules = [
      "crm-pets",
      "laboratory",
      "lab_orders",
      "pharmacy",
      "retail_sales",
      "nutrition",
      "nutrition_plans",
      "boarding",
      "boarding_bookings",
      "swimming",
      "swimming_sessions",
      "accounting",
      "inventory",
      "live_inventory",
      "identity",
      "identity-global",
      "hrms",
      "payroll",
      "marketing",
      "communication",
      "documents",
      "integrations",
      "integrations-global",
    ];

    const erpRes = await db.collection("erp_rows").deleteMany({
      moduleId: { $in: targetModules },
    });
    console.log(`[erp_rows] Deleted ${erpRes.deletedCount} erp_rows for target modules.`);

    console.log("\nDatabase cleanup of seed data complete.");
  } catch (err) {
    console.error("Cleanup error:", err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

run();
