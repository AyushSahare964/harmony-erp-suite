import mongoose, { Schema, Document } from "mongoose";

export interface IPrescriptionLine {
  lineType:
    | "Vaccine"
    | "Consultation"
    | "Pharmacy"
    | "Procedure"
    | "Diagnostic"
    | "Service"
    | "Food"
    | "Accessory";
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
  discountValue?: number | undefined; // raw user-entered value
  discountAmount?: number | undefined; // computed monetary discount (stored for audit)
  taxableAmount?: number | undefined; // amount after discount, before tax
  gstRate: number;
  /** Per-line GST toggle in the Billing & Settlement tab; falls back to the bill-wide billType when unset. */
  gstApplicable?: boolean | undefined;
  lineTotal: number;
  // ── Stable Client ID and Idempotent Sync Tracking (§1.2 & §4.5) ──
  id?: string | undefined;
  sourceType?: "RX_ITEM" | "RX_CONSULT" | "RX_LAB" | null | undefined;
  sourceId?: string | undefined;
  rxSection?: string | undefined;
}

export interface IPaymentRecord {
  id?: string | undefined;
  paymentId?: string | undefined;
  mode: "UPI" | "Cash" | "Card" | "NetBanking" | "Cheque" | "Account Due";
  amount: number;
  trxRef?: string | undefined;
  timestamp: string;
  recordedBy?: string | undefined;
  notes?: string | undefined;
}

// ── Structured Prescription Clinical Schema Types (New_prescription_imp_plan.md) ──
export interface IImmediateMedicine {
  id: string;
  medicineName: string;
  itemCode?: string | undefined;
  quantity: number;
  unit: string;
  customUnit?: string | undefined;
  dosage: string;
  instructions: string;
  remarks?: string | undefined;
  unitPrice?: number | undefined;
}

export interface IPrescribedMedicine {
  id: string;
  medicineName: string;
  itemCode?: string | undefined;
  quantity: number;
  unit: string;
  customUnit?: string | undefined;
  dosage: string;
  frequency: string;
  duration: string;
  durationUnit?: string | undefined;
  route: string;
  instructions: string;
  remarks?: string | undefined;
  unitPrice?: number | undefined;
}

export interface IInjectable {
  id: string;
  name: string;
  itemCode?: string | undefined;
  dose: number;
  doseUnit: string;
  route: string;
  quantity: number;
  frequency?: string | undefined;
  dateTimeAdministered: string;
  instructions: string;
  remarks?: string | undefined;
  unitPrice?: number | undefined;
}

export interface IAnimalFoodItem {
  id: string;
  name: string;
  itemCode?: string | undefined;
  quantity: number;
  unit: string;
  frequency: string;
  instructions: string;
  remarks?: string | undefined;
  unitPrice?: number | undefined;
}

export interface IPrescribedFoodItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  frequency: string;
  instructions: string;
  duration: string;
  remarks?: string | undefined;
}

export interface IAccessoryItem {
  id: string;
  name: string;
  itemCode?: string | undefined;
  quantity: number;
  remarks?: string | undefined;
  unitPrice?: number | undefined;
}

export interface IFollowUpData {
  required: boolean;
  nextTreatmentDate?: string | undefined;
  nextVaccineDate?: string | undefined;
  nextDewormingDate?: string | undefined;
  otherFollowUp?:
    | {
        type: string;
        customType?: string | undefined;
        date?: string | undefined;
      }
    | undefined;
}

export interface IPrescriptionData {
  prescriptionId?: string | undefined;
  dateOfVisit?: string | undefined;
  weight?: number | undefined;
  weightUnit?: "kg" | "lb" | undefined;
  bodyTemperature?: number | undefined;
  temperatureUnit?: "°C" | "°F" | undefined;
  previousHistory?: string | undefined;
  symptomsText?: string | undefined;
  symptomTags?: string[] | undefined;
  clinicalFindings?: string[] | undefined;
  clinicalFindingsOther?: string | undefined;
  immediateMedicines?: IImmediateMedicine[] | undefined;
  prescribedMedicines?: IPrescribedMedicine[] | undefined;
  injectables?: IInjectable[] | undefined;
  followUp?: IFollowUpData | undefined;
  animalFood?: IAnimalFoodItem[] | undefined;
  prescribedFood?: IPrescribedFoodItem[] | undefined;
  accessories?: IAccessoryItem[] | undefined;
  savedAt?: string | undefined;
  // ── Versioning & Section-Level Tracking (§1.3, §1.10, §4.1) ──
  version?: number | undefined;
  sectionSavedAt?: Record<string, string> | undefined;
  consultationFee?: number | undefined;
  consultationFeePreset?: string | undefined;
  followupRequired?: boolean | undefined;
  laboratoryRequired?: boolean | undefined;
  followUpEntries?: Record<string, any> | undefined;
  bloodTests?:
    Array<{ id: string; labTestId?: string; testName: string; status?: string }> | undefined;
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

  vitals?:
    | {
        weightKg?: number | undefined;
        tempC?: number | undefined;
        heartRate?: number | undefined;
        complaint?: string | undefined;
        weight?: number | undefined;
        weightUnit?: "kg" | "lb" | undefined;
        temp?: number | undefined;
        tempUnit?: "°C" | "°F" | undefined;
      }
    | undefined;

  diagnosis?: string | undefined;
  clinicalNotes?: string | undefined;

  nextVisitDate?: string | undefined;
  nextVaccineDate?: string | undefined;
  nextDewormingDate?: string | undefined;

  prescriptionData?: IPrescriptionData | undefined;

  items: IPrescriptionLine[];

  subtotal: number;
  billDiscount: number;
  taxableAmount: number;
  gstAmount: number;
  roundOff: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  pendingAmount?: number;
  paymentStatus?: "Full" | "Partial" | "Unpaid";

  payments: IPaymentRecord[];

  /** Once billing is migrated onto SalesDoc, these mirror its posted state so
   *  existing clinical screens keep reading a totalAmount/balanceDue here
   *  without needing to know SalesDoc exists (plan D2). SalesDoc is the
   *  source of truth; these fields are written by postSalesDocFn only. */
  salesDocNo?: string | undefined;
  salesDocId?: string | undefined;
  /** Rx edits made after the linked invoice was already posted — a posted
   *  document is never silently mutated, so these queue for the biller to
   *  resolve via a new invoice or a credit note (plan §8 rule 3). */
  pendingAddendum?:
    | Array<{
        sourceRef: string;
        description: string;
        addedAt: string;
      }>
    | undefined;

  inventoryDeducted: boolean;
  accountingPosted: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const PrescriptionLineSchema = new Schema<IPrescriptionLine>({
  lineType: {
    type: String,
    required: true,
    enum: [
      "Vaccine",
      "Consultation",
      "Pharmacy",
      "Procedure",
      "Diagnostic",
      "Service",
      "Food",
      "Accessory",
    ],
  },
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
  gstApplicable: { type: Boolean },
  lineTotal: { type: Number, required: true, default: 0 },
  id: { type: String },
  sourceType: { type: String, enum: ["RX_ITEM", "RX_CONSULT", "RX_LAB", null] },
  sourceId: { type: String },
  rxSection: { type: String },
});

const PaymentRecordSchema = new Schema<IPaymentRecord>({
  id: { type: String },
  paymentId: { type: String },
  mode: {
    type: String,
    required: true,
    enum: ["UPI", "Cash", "Card", "NetBanking", "Cheque", "Account Due"],
  },
  amount: { type: Number, required: true },
  trxRef: { type: String },
  timestamp: { type: String, required: true },
  recordedBy: { type: String },
  notes: { type: String },
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
      weight: { type: Number },
      weightUnit: { type: String, default: "kg" },
      temp: { type: Number },
      tempUnit: { type: String, default: "°C" },
    },

    diagnosis: { type: String },
    clinicalNotes: { type: String },

    nextVisitDate: { type: String },
    nextVaccineDate: { type: String },
    nextDewormingDate: { type: String },

    prescriptionData: { type: Schema.Types.Mixed },

    items: { type: [PrescriptionLineSchema], default: [] },

    subtotal: { type: Number, default: 0 },
    billDiscount: { type: Number, default: 0 },
    taxableAmount: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },
    pendingAmount: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ["Full", "Partial", "Unpaid"],
      default: "Full",
    },

    payments: { type: [PaymentRecordSchema], default: [] },

    salesDocNo: { type: String, default: "", index: true },
    salesDocId: { type: String, default: "" },
    pendingAddendum: {
      type: [
        {
          sourceRef: { type: String, required: true },
          description: { type: String, default: "" },
          addedAt: { type: String, default: "" },
        },
      ],
      default: [],
    },

    inventoryDeducted: { type: Boolean, default: false },
    accountingPosted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const ClinicalVisit = (mongoose.models["ClinicalVisit"] ||
  mongoose.model<IClinicalVisit>(
    "ClinicalVisit",
    ClinicalVisitSchema,
  )) as mongoose.Model<IClinicalVisit>;
