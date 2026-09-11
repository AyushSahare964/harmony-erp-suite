import mongoose, { Schema, Document } from "mongoose";

export interface IQuotationItem {
  id: string;
  name: string;
  category: "Procedure" | "Consultation" | "Pharmacy" | "Diagnostic" | "Surgery" | "Boarding";
  quantity: number;
  rate: number;
  discountPercent: number;
  gstRate: number;
  lineTotal: number;
}

export interface IQuotation extends Document {
  quotationNo: string;
  date: string;
  validUntil: string;
  petName: string;
  species?: string;
  breed?: string;
  ownerName: string;
  ownerPhone?: string;
  doctorName?: string;
  items: IQuotationItem[];
  subtotal: number;
  totalDiscount: number;
  totalGst: number;
  grandTotal: number;
  notes?: string;
  status: "Draft" | "Sent" | "Accepted" | "Converted" | "Expired";
  convertedInvoiceNo?: string;
  createdAt: Date;
  updatedAt: Date;
}

const QuotationSchema = new Schema<IQuotation>(
  {
    quotationNo: { type: String, required: true, unique: true },
    date: { type: String, required: true },
    validUntil: { type: String, required: true },
    petName: { type: String, required: true },
    species: { type: String, default: "Canine" },
    breed: { type: String, default: "" },
    ownerName: { type: String, required: true },
    ownerPhone: { type: String, default: "" },
    doctorName: { type: String, default: "Dr. Rohit Sharma" },
    items: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true },
        category: { type: String, default: "Procedure" },
        quantity: { type: Number, default: 1 },
        rate: { type: Number, default: 0 },
        discountPercent: { type: Number, default: 0 },
        gstRate: { type: Number, default: 0 },
        lineTotal: { type: Number, default: 0 },
      },
    ],
    subtotal: { type: Number, default: 0 },
    totalDiscount: { type: Number, default: 0 },
    totalGst: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Draft", "Sent", "Accepted", "Converted", "Expired"],
      default: "Draft",
    },
    convertedInvoiceNo: { type: String },
  },
  { timestamps: true }
);

export const Quotation =
  mongoose.models.Quotation || mongoose.model<IQuotation>("Quotation", QuotationSchema);
