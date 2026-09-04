import mongoose, { Schema, Document } from "mongoose";

export interface IPrescriptionLine {
  lineType: "Vaccine" | "Consultation" | "Pharmacy" | "Procedure" | "Diagnostic" | "Service" | "Food" | "Accessory";
  itemCode?: string | undefined;
  batchNo?: string | undefined;
  name: string;
  dosageInstructions?: string | undefined;
  quantity: number;
  unitPrice: number;
  /** @deprecated use discountType + discountValue instead; kept for backward-compat with old records */
  discountPercent: number;
  // ── Per-line discount audit fields (REQ-DISC-05) ──
  discountType?: "percentage" | "fixed" | undefined;
  discountValue?: number | undefined;   // raw user-entered value
  discountAmount?: number | undefined;  // computed monetary discount (stored for audit)
  taxableAmount?: number | undefined;   // amount after discount, before tax
  gstRate: number;
  lineTotal: number;
}

export interface IPaymentRecord {
  mode: "UPI" | "Cash" | "Card" | "NetBanking" | "Cheque" | "Account Due";
  amount: number;
  trxRef?: string | undefined;
  timestamp: string;
}

export interface IClinicalVisit extends Document {
  visitId: string;
  invoiceNo: string;
  prescriptionNo: string;
  date: string;
  branch: string;
  billType: "GST" | "Non-GST";
  petId: string;
  petName: string;
  species: string;
  breed: string;
  ownerId: string;
  ownerName: string;
  ownerPhone: string;
  doctorName: string;
  receptionistName: string;
  
  status: "Admitted" | "In Consultation" | "Diagnosed" | "Billed" | "Paid" | "Closed";
  
  vitals?: {
    weightKg?: number | undefined;
    tempC?: number | undefined;
    heartRate?: number | undefined;
    complaint?: string | undefined;
  } | undefined;
  
  diagnosis?: string | undefined;
  clinicalNotes?: string | undefined;
  
  nextVisitDate?: string | undefined;
  nextVaccineDate?: string | undefined;
  nextDewormingDate?: string | undefined;
  
  items: IPrescriptionLine[];
  
  subtotal: number;
  billDiscount: number;
  taxableAmount: number;
  gstAmount: number;
  roundOff: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  
  payments: IPaymentRecord[];
  
  inventoryDeducted: boolean;
  accountingPosted: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

const PrescriptionLineSchema = new Schema<IPrescriptionLine>({
  lineType: { type: String, required: true, enum: ["Vaccine", "Consultation", "Pharmacy", "Procedure", "Diagnostic", "Service", "Food", "Accessory"] },
  itemCode: { type: String },
  batchNo: { type: String },
  name: { type: String, required: true },
  dosageInstructions: { type: String },
  quantity: { type: Number, required: true, default: 1 },
  unitPrice: { type: Number, required: true, default: 0 },
  discountPercent: { type: Number, default: 0 },
  // Per-line discount audit fields
  discountType: { type: String, enum: ["percentage", "fixed"] },
  discountValue: { type: Number },
  discountAmount: { type: Number },
  taxableAmount: { type: Number },
  gstRate: { type: Number, default: 0 },
  lineTotal: { type: Number, required: true, default: 0 },
});

const PaymentRecordSchema = new Schema<IPaymentRecord>({
  mode: { type: String, required: true, enum: ["UPI", "Cash", "Card", "NetBanking", "Cheque", "Account Due"] },
  amount: { type: Number, required: true },
  trxRef: { type: String },
  timestamp: { type: String, required: true },
});

const ClinicalVisitSchema = new Schema<IClinicalVisit>(
  {
    visitId: { type: String, required: true, unique: true, index: true },
    invoiceNo: { type: String, required: true, unique: true, index: true },
    prescriptionNo: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true },
    branch: { type: String, default: "Main Clinic" },
    billType: { type: String, enum: ["GST", "Non-GST"], default: "GST" },
    petId: { type: String, required: true, index: true },
    petName: { type: String, required: true },
    species: { type: String, default: "Canine" },
    breed: { type: String, default: "Mix" },
    ownerId: { type: String, required: true, index: true },
    ownerName: { type: String, required: true },
    ownerPhone: { type: String, required: true },
    doctorName: { type: String, default: "Dr. Rohit Sharma" },
    receptionistName: { type: String, default: "Front Desk" },
    
    status: {
      type: String,
      enum: ["Admitted", "In Consultation", "Diagnosed", "Billed", "Paid", "Closed"],
      default: "Admitted",
      index: true,
    },
    
    vitals: {
      weightKg: { type: Number },
      tempC: { type: Number },
      heartRate: { type: Number },
      complaint: { type: String },
    },
    
    diagnosis: { type: String },
    clinicalNotes: { type: String },
    
    nextVisitDate: { type: String },
    nextVaccineDate: { type: String },
    nextDewormingDate: { type: String },
    
    items: { type: [PrescriptionLineSchema], default: [] },
    
    subtotal: { type: Number, default: 0 },
    billDiscount: { type: Number, default: 0 },
    taxableAmount: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },
    
    payments: { type: [PaymentRecordSchema], default: [] },
    
    inventoryDeducted: { type: Boolean, default: false },
    accountingPosted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const ClinicalVisit = (mongoose.models["ClinicalVisit"] || mongoose.model<IClinicalVisit>("ClinicalVisit", ClinicalVisitSchema)) as mongoose.Model<IClinicalVisit>;
