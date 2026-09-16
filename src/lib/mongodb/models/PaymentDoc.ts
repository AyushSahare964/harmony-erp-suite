/**
 * PaymentDoc — money in and money out, with split tenders and bill-wise
 * allocation. Absorbs the older SupplierPayment collection.
 *
 * Two invariants the server enforces on every write (plan §6):
 *   Σ splits.amount      === totalAmount     (to the paisa)
 *   Σ allocations.amount <= totalAmount      (the excess is an on-account advance)
 *
 * A cheque or DD starts PENDING, not CLEARED — the money is not ours until the
 * instrument clears, and a bounce has to be able to reverse cleanly.
 */

import mongoose, { Schema, type Document } from "mongoose";
import { roundMoney } from "@/lib/utils/moneyUtils";

export type PaymentDirection = "IN" | "OUT";
export type PayMode = "CASH" | "CHEQUE" | "CARD" | "UPI" | "WALLET" | "DD" | "BANK_TRANSFER";
export type ClearingStatus = "PENDING" | "CLEARED" | "BOUNCED";
export type AllocationDocKind = "SALE" | "PURCHASE";

export const PAY_MODES: PayMode[] = [
  "CASH",
  "CHEQUE",
  "CARD",
  "UPI",
  "WALLET",
  "DD",
  "BANK_TRANSFER",
];

/** Every mode except cash must carry a reference number. */
export const MODES_REQUIRING_REFERENCE: PayMode[] = [
  "CHEQUE",
  "CARD",
  "UPI",
  "WALLET",
  "DD",
  "BANK_TRANSFER",
];

/** Instruments that are not money in hand until they clear. */
export const MODES_NEEDING_CLEARING: PayMode[] = ["CHEQUE", "DD"];

export interface IPaymentSplit {
  payMode: PayMode;
  amount: number;
  referenceNo?: string;
  bankName?: string;
  instrumentDate?: string;
  clearingStatus: ClearingStatus;
  clearedAt?: Date;
  bouncedAt?: Date;
  bounceReason?: string;
}

export interface IPaymentAllocation {
  docKind: AllocationDocKind;
  docId: string;
  docNumber: string;
  amount: number;
}

export interface IPaymentDoc extends Document {
  docNumber: string;
  docDate: string;
  branchId: string;
  direction: PaymentDirection;

  partyId: string;
  partyName: string;

  totalAmount: number;
  allocatedAmount: number;
  /** On-account advance — offered against this party's next invoice. */
  unallocatedAmount: number;

  splits: IPaymentSplit[];
  allocations: IPaymentAllocation[];

  /** Client-generated; a repeat returns the original receipt. */
  idempotencyKey?: string;

  narration?: string;
  status: "POSTED" | "CANCELLED";
  cancelledAt?: Date;
  cancelReason?: string;

  createdBy?: string;
  createdByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSplitSchema = new Schema<IPaymentSplit>(
  {
    payMode: { type: String, required: true, enum: PAY_MODES },
    amount: { type: Number, required: true },
    referenceNo: { type: String, default: "" },
    bankName: { type: String, default: "" },
    instrumentDate: { type: String, default: "" },
    clearingStatus: {
      type: String,
      enum: ["PENDING", "CLEARED", "BOUNCED"],
      default: "CLEARED",
    },
    clearedAt: { type: Date },
    bouncedAt: { type: Date },
    bounceReason: { type: String, default: "" },
  },
  { _id: false },
);

const PaymentAllocationSchema = new Schema<IPaymentAllocation>(
  {
    docKind: { type: String, required: true, enum: ["SALE", "PURCHASE"] },
    docId: { type: String, required: true },
    docNumber: { type: String, default: "" },
    amount: { type: Number, required: true },
  },
  { _id: false },
);

const PaymentDocSchema = new Schema<IPaymentDoc>(
  {
    docNumber: { type: String, default: "", index: true },
    docDate: { type: String, required: true, index: true },
    branchId: { type: String, default: "MAIN" },
    direction: { type: String, required: true, enum: ["IN", "OUT"], index: true },

    partyId: { type: String, default: "", index: true },
    partyName: { type: String, default: "" },

    totalAmount: { type: Number, required: true },
    allocatedAmount: { type: Number, default: 0 },
    unallocatedAmount: { type: Number, default: 0 },

    splits: { type: [PaymentSplitSchema], default: [] },
    allocations: { type: [PaymentAllocationSchema], default: [] },

    idempotencyKey: { type: String, default: "" },

    narration: { type: String, default: "" },
    status: { type: String, enum: ["POSTED", "CANCELLED"], default: "POSTED", index: true },
    cancelledAt: { type: Date },
    cancelReason: { type: String, default: "" },

    createdBy: { type: String, default: "" },
    createdByName: { type: String, default: "" },
  },
  { timestamps: true, collection: "payment_docs" },
);

PaymentDocSchema.index(
  { direction: 1, docNumber: 1 },
  { unique: true, partialFilterExpression: { docNumber: { $gt: "" } } },
);
// Sparse-unique: the retry guard. Blank keys never collide.
PaymentDocSchema.index(
  { idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $gt: "" } } },
);
PaymentDocSchema.index({ partyId: 1, docDate: -1 });
PaymentDocSchema.index({ "splits.clearingStatus": 1 });

export const PaymentDocModel =
  (mongoose.models["PaymentDoc"] as mongoose.Model<IPaymentDoc>) ??
  mongoose.model<IPaymentDoc>("PaymentDoc", PaymentDocSchema);

/**
 * Validate a payment before it is written. Returns a list of human-readable
 * problems; an empty list means the payment is well-formed.
 */
export function validatePaymentShape(input: {
  totalAmount: number;
  splits: Array<Pick<IPaymentSplit, "payMode" | "amount" | "referenceNo">>;
  allocations: Array<Pick<IPaymentAllocation, "amount">>;
}): string[] {
  const errors: string[] = [];

  if (!(input.totalAmount > 0)) errors.push("Payment amount must be greater than zero.");
  if (!input.splits.length) errors.push("At least one payment mode is required.");

  const splitSum = roundMoney(input.splits.reduce((s, x) => s + (x.amount || 0), 0));
  if (splitSum !== roundMoney(input.totalAmount)) {
    errors.push(
      `Payment modes total ₹${splitSum.toFixed(2)} but the receipt is ₹${roundMoney(
        input.totalAmount,
      ).toFixed(2)}. They must match exactly.`,
    );
  }

  for (const s of input.splits) {
    if (!(s.amount > 0)) {
      errors.push(`${s.payMode}: amount must be greater than zero.`);
    }
    if (MODES_REQUIRING_REFERENCE.includes(s.payMode) && !s.referenceNo?.trim()) {
      errors.push(`${s.payMode}: a reference number is required.`);
    }
  }

  const allocSum = roundMoney(input.allocations.reduce((s, x) => s + (x.amount || 0), 0));
  if (allocSum > roundMoney(input.totalAmount) + 0.005) {
    errors.push(
      `Allocated ₹${allocSum.toFixed(2)} exceeds the receipt of ₹${roundMoney(
        input.totalAmount,
      ).toFixed(2)}.`,
    );
  }

  return errors;
}

/** Default clearing state for a mode — cheques and DDs are not money yet. */
export function defaultClearingStatus(mode: PayMode): ClearingStatus {
  return MODES_NEEDING_CLEARING.includes(mode) ? "PENDING" : "CLEARED";
}
