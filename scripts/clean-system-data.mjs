import { MongoClient } from "mongodb";

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

    const collectionsToPurge = [
      "clinicalvisits",
      "pets",
      "owners",
      "parties",
      "finance_transactions",
      "inventory_items",
      "stock_batches",
      "stock_ledger",
      "erp_rows",
      "lab_orders",
      "facilities",
      "boarding_bookings",
      "swimming_sessions",
      "retail_bills",
      "feeding_plans",
      "foodpurchases",
      "quotations",
      "reminders",
      "expenses",
      "purchasebills",
      "supplierpayments",
      "party_ledger",
      "payment_docs",
      "sales_docs",
      "fin_daily_summary",
      "suppliers",
    ];

    for (const colName of collectionsToPurge) {
      try {
        const res = await db.collection(colName).deleteMany({});
        console.log(`[${colName}] Deleted ${res.deletedCount} documents.`);
      } catch (err) {
        console.warn(`Could not purge ${colName}:`, err.message);
      }
    }

    // Reset counters to 0 so new records start from sequence 1
    const counterResult = await db.collection("counters").updateMany({}, { $set: { seq: 0 } });
    console.log(`[counters] Reset ${counterResult.modifiedCount} sequence counters to 0.`);

    // Reset opening balances in accounts collection to 0
    try {
      const accReset = await db.collection("accounts").updateMany(
        { openingBalance: { $gt: 0 } },
        { $set: { openingBalance: 0 } }
      );
      console.log(`[accounts] Reset opening balances to 0 for ${accReset.modifiedCount} accounts.`);
    } catch (_) {}

    // Update clinicName for existing staff in users collection
    const userUpdate = await db.collection("users").updateMany(
      { clinicName: "VetCare Specialty Pet Hospital" },
      { $set: { clinicName: "Real Care Small Animal Clinic", branch: "Nagpur" } }
    );
    console.log(`[users] Updated clinicName for ${userUpdate.modifiedCount} staff user(s).`);

    console.log("\nAll seed and test data successfully purged from MongoDB database!");
  } catch (err) {
    console.error("Cleanup error:", err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

run();
