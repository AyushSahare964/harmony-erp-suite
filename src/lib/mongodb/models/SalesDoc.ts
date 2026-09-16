/**
 * SalesDoc — the single source of truth for every sale document:
 * quotation, invoice and credit note, counter sale and clinical bill alike.
 *
 * One collection means one register, one ledger feed and one GSTR-1 query.
 *
 * Immutability rule (D6): once `status` is POSTED, nothing financial on this
 * document may change. Corrections are a credit note or a cancel-and-reissue.
 * `docNumber` is allocated at POST time only — never for a DRAFT — because a
 * number handed to an abandoned draft leaves a gap in the GST series.
 */

import mongoose, { Schema, type Document } from "mongoose";
import { roundMoney } from "@/lib/utils/moneyUtils";

export type SalesDocType = "QUOTATION" | "INVOICE" | "CREDIT_NOTE";
export type SalesDocStatus = "DRAFT" | "POSTED" | "CANCELLED" | "CONVERTED";
export type InvoiceType = "GST" | "NON_GST" | "BILL_OF_SUPPLY" | "EXPORT";
export type LinkType = "COUNTER_SALE" | "CLIENT_ACCOUNT";
export type PaymentStatus = "UNPAID" | "PARTIAL" | "PAID";
export type ItemClass = "GOODS" | "SERVICE";

export type SalesLineType =
  | "Vaccine"
  | "Consultation"
  | "Pharmacy"
  | "Procedure"
  | "Diagnostic"
  | "Service"
  | "Food"
  | "Accessory";

export const SALES_LINE_TYPES: SalesLineType[] = [
  "Vaccine",
  "Consultation",
  "Pharmacy",
  "Procedure",
  "Diagnostic",
  "Service",
  "Food",
  "Accessory",
];

export interface ISalesLine {
  lineNo: number;
  itemId?: string;
  itemCode?: string;
  /** Snapshot of the name as billed — never resolved by join at read time. */
  itemName: string;
  itemClass: ItemClass;
  lineType: SalesLineType;
  description?: string;
  tag?: string;
  serialNo?: string;

  batchId?: string;
  batchNo?: string;
  expiryDate?: string;

  /** Per-line patient, so billing history is answerable per pet. */
  animalId?: string;

  hsnSac?: string;
  uom?: string;

  quantity: number;
  /** Moves stock, never charged. */
  freeQuantity: number;
  rate: number;

  discountType: "percentage" | "fixed";
  discountValue: number;
  discountAmount: number;

  taxableValue: number;
  gstRate: number;
  cessRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  lineTotal: number;

  /** "RX:<visitId>:<section>:<elementId>" — the Rx sync idempotency key. */
  sourceRef?: string;
}

export interface ISalesDoc extends Document {
  docType: SalesDocType;
  /** Empty while DRAFT. */
  docNumber: string;
  docDate: string;
  branchId: string;

  invoiceType: InvoiceType;
  linkType: LinkType;

  partyId?: string;
  partyName: string;
  partyGstin?: string;
  partyAddress?: string;
  partyMobile?: string;

  animalId?: string;
  animalName?: string;
  visitId?: string;
  consultationId?: string;

  placeOfSupply: string;
  isInterstate: boolean;
  reverseCharge: boolean;

  soldByStaffId?: string;
  soldByStaffName?: string;

  priceInclusive: boolean;

  lines: ISalesLine[];

  subTotal: number;
  discountTotal: number;
  /** Bill-level discount in rupees, apportioned across lines by taxable value. */
  invoiceDiscount: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  shippingAmount: number;
  shippingTaxable: boolean;
  roundOff: number;
  grandTotal: number;

  paidAmount: number;
  balanceDue: number;
  paymentStatus: PaymentStatus;

  status: SalesDocStatus;

  referenceDoc?: string;
  deliveryTerms?: string;
  /** Internal note — must never appear on a printed document. */
  remarksPrivate?: string;
  validUntil?: string;

  convertedToDocNo?: string;
  revisedFromId?: string;
  /** For a credit note: the invoice it reverses. */
  againstDocNo?: string;
  againstDocId?: string;

  postedAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;

  createdBy?: string;
  createdByName?: string;

  createdAt: Date;
  updatedAt: Date;
}

const SalesLineSchema = new Schema<ISalesLine>(
  {
    lineNo: { type: Number, required: true },
    itemId: { type: String, default: "" },
    itemCode: { type: String, default: "" },
    itemName: { type: String, required: true },
    itemClass: { type: String, enum: ["GOODS", "SERVICE"], default: "GOODS" },
    lineType: { type: String, enum: SALES_LINE_TYPES, default: "Service" },
    description: { type: String, default: "" },
    tag: { type: String, default: "" },
    serialNo: { type: String, default: "" },

    batchId: { type: String, default: "" },
    batchNo: { type: String, default: "" },
    expiryDate: { type: String, default: "" },

    animalId: { type: String, default: "" },

    hsnSac: { type: String, default: "" },
    uom: { type: String, default: "" },

    quantity: { type: Number, required: true, default: 1 },
    freeQuantity: { type: Number, default: 0 },
    rate: { type: Number, required: true, default: 0 },

    discountType: { type: String, enum: ["percentage", "fixed"], default: "percentage" },
    discountValue: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },

    taxableValue: { type: Number, default: 0 },
    gstRate: { type: Number, default: 0 },
    cessRate: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    cess: { type: Number, default: 0 },
    lineTotal: { type: Number, default: 0 },

    sourceRef: { type: String, default: "" },
  },
  { _id: false },
);

const SalesDocSchema = new Schema<ISalesDoc>(
  {
    docType: {
      type: String,
      required: true,
      enum: ["QUOTATION", "INVOICE", "CREDIT_NOTE"],
      index: true,
    },
    docNumber: { type: String, default: "", index: true },
    docDate: { type: String, required: true, index: true },
    branchId: { type: String, default: "MAIN", index: true },

    invoiceType: {
      type: String,
      enum: ["GST", "NON_GST", "BILL_OF_SUPPLY", "EXPORT"],
      default: "GST",
    },
    linkType: {
      type: String,
      enum: ["COUNTER_SALE", "CLIENT_ACCOUNT"],
      default: "COUNTER_SALE",
    },

    partyId: { type: String, default: "", index: true },
    partyName: { type: String, default: "CASH" },
    partyGstin: { type: String, default: "" },
    partyAddress: { type: String, default: "" },
    partyMobile: { type: String, default: "" },

    animalId: { type: String, default: "", index: true },
    animalName: { type: String, default: "" },
    visitId: { type: String, default: "", index: true },
    consultationId: { type: String, default: "" },

    placeOfSupply: { type: String, default: "27" },
    isInterstate: { type: Boolean, default: false },
    reverseCharge: { type: Boolean, default: false },

    soldByStaffId: { type: String, default: "" },
    soldByStaffName: { type: String, default: "" },

    priceInclusive: { type: Boolean, default: false },

    lines: { type: [SalesLineSchema], default: [] },

    subTotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    invoiceDiscount: { type: Number, default: 0 },
    taxableValue: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    cess: { type: Number, default: 0 },
    shippingAmount: { type: Number, default: 0 },
    shippingTaxable: { type: Boolean, default: false },
    roundOff: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },

    paidAmount: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ["UNPAID", "PARTIAL", "PAID"],
      default: "UNPAID",
      index: true,
    },

    status: {
      type: String,
      enum: ["DRAFT", "POSTED", "CANCELLED", "CONVERTED"],
      default: "DRAFT",
      index: true,
    },

    referenceDoc: { type: String, default: "" },
    deliveryTerms: { type: String, default: "" },
    remarksPrivate: { type: String, default: "" },
    validUntil: { type: String, default: "" },

    convertedToDocNo: { type: String, default: "" },
    revisedFromId: { type: String, default: "" },
    againstDocNo: { type: String, default: "" },
    againstDocId: { type: String, default: "" },

    postedAt: { type: Date },
    cancelledAt: { type: Date },
    cancelReason: { type: String, default: "" },

    createdBy: { type: String, default: "" },
    createdByName: { type: String, default: "" },
  },
  { timestamps: true, collection: "sales_docs" },
);

// A posted number is unique per type; drafts (docNumber "") are exempt via the
// partial filter, so any number of drafts can coexist.
SalesDocSchema.index(
  { docType: 1, docNumber: 1 },
  { unique: true, partialFilterExpression: { docNumber: { $gt: "" } } },
);
SalesDocSchema.index({ docDate: -1, status: 1 });
SalesDocSchema.index({ partyId: 1, docDate: -1 });
SalesDocSchema.index({ status: 1, balanceDue: 1 });

export const SalesDocModel =
  (mongoose.models["SalesDoc"] as mongoose.Model<ISalesDoc>) ??
  mongoose.model<ISalesDoc>("SalesDoc", SalesDocSchema);

/**
 * Payment status is ALWAYS derived — never accepted from a client.
 * The half-paisa tolerance stops a rounding crumb leaving a bill "PARTIAL"
 * forever when it has really been settled.
 */
export function derivePaymentStatus(
  grandTotal: number,
  paidAmount: number,
): { paymentStatus: PaymentStatus; balanceDue: number } {
  const balanceDue = roundMoney(grandTotal - paidAmount);
  if (balanceDue <= 0.005) return { paymentStatus: "PAID", balanceDue: 0 };
  if (paidAmount > 0.005) return { paymentStatus: "PARTIAL", balanceDue };
  return { paymentStatus: "UNPAID", balanceDue };
}
