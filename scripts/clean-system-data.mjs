import mongoose from "mongoose";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const cvResult = await db.collection("clinicalvisits").deleteMany({});
  console.log("Deleted clinicalvisits:", cvResult.deletedCount);

  const pResult = await db.collection("parties").deleteMany({});
  console.log("Deleted parties:", pResult.deletedCount);

  const ftResult = await db.collection("finance_transactions").deleteMany({});
  console.log("Deleted finance_transactions:", ftResult.deletedCount);

  const erResult = await db.collection("erp_rows").deleteMany({});
  console.log("Deleted erp_rows:", erResult.deletedCount);

  const petResult = await db.collection("pets").deleteMany({});
  console.log("Deleted pets:", petResult.deletedCount);

  const ownResult = await db.collection("owners").deleteMany({});
  console.log("Deleted owners:", ownResult.deletedCount);

  // Reset counters to 0
  const counterResult = await db.collection("counters").updateMany({}, { $set: { seq: 0 } });
  console.log("Reset counters:", counterResult.modifiedCount);

  console.log("Database cleanup completed successfully.");
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
