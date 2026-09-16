/**
 * Migration 03 — turn each party's opening balance into an OPENING row in the
 * party ledger.
 *
 * The ledger is the only place a balance is ever computed from, so an opening
 * balance that exists only as a column on the party is invisible. Re-running
 * replaces the OPENING rows rather than adding to them, so it can never
 * double-count.
 *
 *   node scripts/migrations/03-opening-balances.mjs --dry-run
 *   node scripts/migrations/03-opening-balances.mjs
 */

import { connect, coll, DRY_RUN, round2, finish, fail } from "./_lib.mjs";

const TAG = "03-opening-balances";
const FALLBACK_OPENING_DATE = "2026-04-01"; // start of FY 2026-27

async function main() {
  console.log(`[${TAG}] ${DRY_RUN ? "DRY RUN — no writes" : "applying"}`);
  await connect(TAG);

  const parties = coll("parties");
  const ledger = coll("party_ledger");

  const stats = { scanned: 0, written: 0, zeroSkipped: 0, totalDebit: 0, totalCredit: 0 };

  // Clear existing OPENING rows first so this is a replace, not an append.
  const existingOpenings = await ledger.countDocuments({ sourceKind: "OPENING" });
  if (existingOpenings && !DRY_RUN) {
    await ledger.deleteMany({ sourceKind: "OPENING" });
  }
  console.log(`[${TAG}] cleared ${existingOpenings} existing OPENING row(s)`);

  for (const p of await parties.find({}).toArray()) {
    stats.scanned++;

    const amount = round2(p.openingBalance);
    if (!amount) {
      stats.zeroSkipped++;
      continue;
    }

    const isDebit = (p.openingType ?? "DR") === "DR";
    const row = {
      partyId: p.partyId,
      entryDate: p.openingDate || FALLBACK_OPENING_DATE,
      sourceKind: "OPENING",
      sourceId: "",
      sourceNumber: "OPENING",
      narration: "Opening balance",
      debit: isDebit ? amount : 0,
      credit: isDebit ? 0 : amount,
      isReversal: false,
      reversalOfId: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (!DRY_RUN) await ledger.insertOne(row);

    stats.written++;
    if (isDebit) stats.totalDebit = round2(stats.totalDebit + amount);
    else stats.totalCredit = round2(stats.totalCredit + amount);
  }

  console.log(
    `[${TAG}] receivable opening ₹${stats.totalDebit.toFixed(2)} · ` +
      `payable opening ₹${stats.totalCredit.toFixed(2)}`,
  );

  await finish(TAG, [stats]);
}

main().catch((err) => fail(TAG, err));
