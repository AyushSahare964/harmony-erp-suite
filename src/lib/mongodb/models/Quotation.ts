import mongoose, { Schema, Document } from "mongoose";

export interface IQuotationItem {
  id: string;
  name: string;
  category: "Procedure" | "Consultation" | "Pharmacy" | "Diagnostic" | "Surgery" | "Boarding" | "General";
  quantity: number;
  rate: number;
  discountPercent: number;
  gstRate: number;
  lineTotal: number;
  uom?: string;
  serialNo?: string;
  description?: string;
}

export interface IQuotation extends Document {
  quotationNo: string;
  quotationType?: "GST" | "Non-GST" | "Bill of Supply";
  date: string;
  validUntil: string;
  linkTo?: "Counter Sale" | "Client Account" | "Patient CRM";
  petName: string;
  species?: string;
  breed?: string;
  ownerName: string;
  ownerPhone?: string;
  doctorName?: string;
  address?: string;
  placeOfSupply?: string;
  clientGstin?: string;
  items: IQuotationItem[];
  subtotal: number;
  totalDiscount: number;
  totalGst: number;
  shippingCosts?: number;
  grandTotal: number;
  quotationReference?: string;
  deliveryTerms?: string;
  remarks?: string;
  notes?: string;
  status: "Draft" | "Sent" | "Accepted" | "Converted" | "Expired";
  convertedInvoiceNo?: string;
  createdAt: Date;
  updatedAt: Date;
}

const QuotationSchema = new Schema<IQuotation>(
  {
    quotationNo: { type: String, required: true, unique: true },
    quotationType: { type: String, default: "GST" },
    date: { type: String, required: true },
    validUntil: { type: String, required: true },
    linkTo: { type: String, default: "Counter Sale" },
    petName: { type: String, default: "General / Counter" },
    species: { type: String, default: "Canine" },
    breed: { type: String, default: "" },
    ownerName: { type: String, required: true },
    ownerPhone: { type: String, default: "" },
    doctorName: { type: String, default: "Dr. Rohit Sharma" },
    address: { type: String, default: "" },
    placeOfSupply: { type: String, default: "Maharashtra" },
    clientGstin: { type: String, default: "" },
    items: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true },
        category: { type: String, default: "General" },
        quantity: { type: Number, default: 1 },
        rate: { type: Number, default: 0 },
        discountPercent: { type: Number, default: 0 },
        gstRate: { type: Number, default: 0 },
        lineTotal: { type: Number, default: 0 },
        uom: { type: String, default: "SET" },
        serialNo: { type: String, default: "" },
        description: { type: String, default: "" },
      },
    ],
    subtotal: { type: Number, default: 0 },
    totalDiscount: { type: Number, default: 0 },
    totalGst: { type: Number, default: 0 },
    shippingCosts: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    quotationReference: { type: String, default: "" },
    deliveryTerms: { type: String, default: "" },
    remarks: { type: String, default: "" },
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
  (mongoose.models["Quotation"] as mongoose.Model<IQuotation>) ||
  mongoose.model<IQuotation>("Quotation", QuotationSchema);
