/**
 * Staff money events (salary accrued, advances, payments, repayments).
 * Append-only. Expense reimbursements are NOT stored here — the staff ledger
 * derives them from Expense.paidByStaffId. The future payroll module writes
 * SALARY rows here when a run is approved.
 *
 * Convention (same as every ledger): balance = Σdebit − Σcredit.
 *   credit = we owe the staff more (salary accrued, advance repaid)
 *   debit  = money we paid or advanced to the staff
 */
import mongoose, { Schema, type Document } from "mongoose";
import { STAFF_ENTRY_KINDS, type StaffEntryKind } from "@/lib/ledger/buildLedger";


export interface IStaffLedgerEntry extends Document {
  /** Reserved for multi-tenant; the UI does not expose it yet. */
  branchId: string;
  staffId: string;
  entryDate: string;
  kind: StaffEntryKind;
  voucherNo: string;
  narration: string;
  debit: number;
  credit: number;
  createdAt: Date;
}

const StaffLedgerEntrySchema = new Schema<IStaffLedgerEntry>(
  {
    branchId: { type: String, default: "MAIN", index: true },
    staffId: { type: String, required: true, index: true },
    entryDate: { type: String, required: true },
    kind: { type: String, enum: STAFF_ENTRY_KINDS, required: true },
    voucherNo: { type: String, default: "" },
    narration: { type: String, default: "" },
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "staff_ledger" },
);
StaffLedgerEntrySchema.index({ staffId: 1, entryDate: 1 });

export const StaffLedgerEntryModel =
  (mongoose.models["StaffLedgerEntry"] as mongoose.Model<IStaffLedgerEntry>) ??
  mongoose.model<IStaffLedgerEntry>("StaffLedgerEntry", StaffLedgerEntrySchema);
