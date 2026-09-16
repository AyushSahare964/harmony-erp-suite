/**
 * PartyLedger — every event that moves a counterparty's balance.
 *
 * There is deliberately NO mutable "balance" column anywhere. Outstanding is
 * always recomputed as `opening ± Σ(debit − credit)`. A stored balance drifts
 * the first time a write half-fails, and then nobody can tell which number is
 * true; a ledger cannot drift because it is append-only.
 *
 * Convention (from the clinic's point of view):
 *   debit  ↑ what the party owes us   (sale invoice, payment out, debit note)
 *   credit ↓ what the party owes us   (payment in, credit note, purchase bill)
 */

import mongoose, { Schema, type Document } from "mongoose";
import { roundMoney } from "@/lib/utils/moneyUtils";

export type LedgerSourceKind =
  | "OPENING"
  | "SALE"
  | "CREDIT_NOTE"
  | "PURCHASE"
  | "DEBIT_NOTE"
  | "PAYMENT"
  | "EXPENSE"
  | "ADJUSTMENT";

export const LEDGER_SOURCE_KINDS: LedgerSourceKind[] = [
  "OPENING",
  "SALE",
  "CREDIT_NOTE",
  "PURCHASE",
  "DEBIT_NOTE",
  "PAYMENT",
  "EXPENSE",
  "ADJUSTMENT",
];

export interface IPartyLedger extends Document {
  partyId: string;
  /** ISO YYYY-MM-DD. */
  entryDate: string;
  sourceKind: LedgerSourceKind;
  sourceId?: string;
  sourceNumber?: string;
  narration?: string;
  debit: number;
  credit: number;
  /** True for rows written to undo an earlier row (cancel, cheque bounce). */
  isReversal: boolean;
  reversalOfId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PartyLedgerSchema = new Schema<IPartyLedger>(
  {
    partyId: { type: String, required: true, index: true },
    entryDate: { type: String, required: true, index: true },
    sourceKind: { type: String, required: true, enum: LEDGER_SOURCE_KINDS },
    sourceId: { type: String, default: "" },
    sourceNumber: { type: String, default: "", index: true },
    narration: { type: String, default: "" },
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },
    isReversal: { type: Boolean, default: false },
    reversalOfId: { type: String, default: "" },
  },
  { timestamps: true, collection: "party_ledger" },
);

// Supports both the ledger report (keyset paged) and the outstanding rollup.
PartyLedgerSchema.index({ partyId: 1, entryDate: 1, _id: 1 });

export const PartyLedgerModel =
  (mongoose.models["PartyLedger"] as mongoose.Model<IPartyLedger>) ??
  mongoose.model<IPartyLedger>("PartyLedger", PartyLedgerSchema);

/**
 * Net balance for a party, computed from the ledger alone.
 * Positive = the party owes us (receivable). Negative = we owe them (payable).
 */
export async function computePartyBalance(partyId: string, asOfIso?: string): Promise<number> {
  const match: Record<string, unknown> = { partyId };
  if (asOfIso) match["entryDate"] = { $lte: asOfIso };

  const [agg] = await PartyLedgerModel.aggregate<{ debit: number; credit: number }>([
    { $match: match },
    { $group: { _id: null, debit: { $sum: "$debit" }, credit: { $sum: "$credit" } } },
  ]);

  return roundMoney((agg?.debit ?? 0) - (agg?.credit ?? 0));
}

/** Same rollup for many parties at once — used by the outstanding reports. */
export async function computeBalances(
  partyIds: string[],
  asOfIso?: string,
): Promise<Map<string, number>> {
  if (!partyIds.length) return new Map();

  const match: Record<string, unknown> = { partyId: { $in: partyIds } };
  if (asOfIso) match["entryDate"] = { $lte: asOfIso };

  const rows = await PartyLedgerModel.aggregate<{
    _id: string;
    debit: number;
    credit: number;
  }>([
    { $match: match },
    { $group: { _id: "$partyId", debit: { $sum: "$debit" }, credit: { $sum: "$credit" } } },
  ]);

  return new Map(rows.map((r) => [r._id, roundMoney(r.debit - r.credit)]));
}
