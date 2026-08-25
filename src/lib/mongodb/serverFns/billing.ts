import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { ClinicalVisit, type IClinicalVisit } from "@/lib/mongodb/models/ClinicalVisit";
import { FinanceTransaction } from "@/lib/mongodb/models/FinanceTransaction";
import { nextSeq } from "./counters";

function toPlain<T>(v: any): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

// ─── Initial Seed Invoices (Matching Screenshots) ──────────────────────────

const SEED_BILLING_INVOICES = [
  {
    visitId: "V-0905",
    invoiceNo: "INV-905",
    prescriptionNo: "RX-0905",
    date: "2026-08-22",
    branch: "Perfect Society",
    billType: "Non-GST" as const,
    petId: "PET-0004",
    petName: "keechu",
    species: "Canine",
    breed: "Labrador",
    ownerId: "OWN-0004",
    ownerName: "ria meshram",
    ownerPhone: "9765432100",
    doctorName: "Dr. Rohit Sharma",
    receptionistName: "Jyoti Sahare",
    status: "Paid" as const,
    vitals: { weightKg: 31.0, tempC: 38.6, complaint: "Annual 9-in-1 vaccination" },
    diagnosis: "Healthy adult canine. Routine vaccination completed.",
    clinicalNotes: "Vaccinated with Canishot DHPPIL. Keep hydrated.",
    nextVisitDate: "Not scheduled",
    nextVaccineDate: "Not scheduled",
    nextDewormingDate: "Not scheduled",
    items: [
      { lineType: "Vaccine" as const, name: "canishot dhppil", quantity: 1, unitPrice: 1350, discountPercent: 0, gstRate: 0, lineTotal: 1350 },
      { lineType: "Vaccine" as const, name: "canishot cv", quantity: 1, unitPrice: 500, discountPercent: 0, gstRate: 0, lineTotal: 500 },
      { lineType: "Vaccine" as const, name: "nobivac r", quantity: 1, unitPrice: 800, discountPercent: 0, gstRate: 0, lineTotal: 800 },
      { lineType: "Vaccine" as const, name: "bronx", quantity: 1, unitPrice: 850, discountPercent: 0, gstRate: 0, lineTotal: 850 },
    ],
    subtotal: 3500,
    billDiscount: 0,
    taxableAmount: 3500,
    gstAmount: 0,
    roundOff: 0,
    totalAmount: 3500,
    amountPaid: 3500,
    balanceDue: 0,
    payments: [{ mode: "UPI" as const, amount: 3500, timestamp: "2026-08-22T05:54:00.000Z" }],
    inventoryDeducted: true,
    accountingPosted: true,
  },
  {
    visitId: "V-0906",
    invoiceNo: "INV-906",
    prescriptionNo: "RX-0906",
    date: "2026-08-22",
    branch: "Main Clinic",
    billType: "GST" as const,
    petId: "PET-0002",
    petName: "Crystal",
    species: "Feline",
    breed: "Persian",
    ownerId: "OWN-0002",
    ownerName: "Kunjan Ninawe",
    ownerPhone: "9823044556",
    doctorName: "Dr. Aisha Nair",
    status: "Paid" as const,
    items: [
      { lineType: "Consultation" as const, name: "General Feline Consultation", quantity: 1, unitPrice: 500, discountPercent: 0, gstRate: 18, lineTotal: 500 },
      { lineType: "Pharmacy" as const, name: "Oral Drops 30ml", quantity: 1, unitPrice: 250, discountPercent: 0, gstRate: 12, lineTotal: 250 },
    ],
    subtotal: 750,
    billDiscount: 0,
    taxableAmount: 700,
    gstAmount: 50,
    roundOff: 0,
    totalAmount: 750,
    amountPaid: 750,
    balanceDue: 0,
    payments: [{ mode: "Cash" as const, amount: 750, timestamp: "2026-08-22T08:15:00.000Z" }],
  },
  {
    visitId: "V-0894",
    invoiceNo: "INV-894",
    prescriptionNo: "RX-0894",
    date: "2026-08-21",
    branch: "Main Clinic",
    billType: "GST" as const,
    petId: "PET-0002",
    petName: "Crystal",
    species: "Feline",
    breed: "Persian",
    ownerId: "OWN-0002",
    ownerName: "Kunjan Ninawe",
    ownerPhone: "9823044556",
    doctorName: "Dr. Aisha Nair",
    status: "Paid" as const,
    items: [
      { lineType: "Diagnostic" as const, name: "Complete Blood Count (CBC)", quantity: 1, unitPrice: 750, discountPercent: 0, gstRate: 18, lineTotal: 750 },
    ],
    subtotal: 750,
    billDiscount: 0,
    taxableAmount: 700,
    gstAmount: 50,
    roundOff: 0,
    totalAmount: 750,
    amountPaid: 750,
    balanceDue: 0,
    payments: [{ mode: "UPI" as const, amount: 750, timestamp: "2026-08-21T11:20:00.000Z" }],
  },
  {
    visitId: "V-0898",
    invoiceNo: "INV-898",
    prescriptionNo: "RX-0898",
    date: "2026-08-21",
    branch: "Main Clinic",
    billType: "GST" as const,
    petId: "PET-0007",
    petName: "Rveit",
    species: "Canine",
    breed: "Beagle",
    ownerId: "OWN-0007",
    ownerName: "Ankita",
    ownerPhone: "9823077889",
    doctorName: "Dr. Rohit Sharma",
    status: "Paid" as const,
    items: [
      { lineType: "Pharmacy" as const, name: "NexGard Spectra 7.5-15kg", quantity: 1, unitPrice: 917, discountPercent: 0, gstRate: 12, lineTotal: 917 },
    ],
    subtotal: 917,
    billDiscount: 0,
    taxableAmount: 818.75,
    gstAmount: 98.25,
    roundOff: 0,
    totalAmount: 917,
    amountPaid: 917,
    balanceDue: 0,
    payments: [{ mode: "Card" as const, amount: 917, timestamp: "2026-08-21T14:45:00.000Z" }],
  },
  {
    visitId: "V-0900",
    invoiceNo: "INV-900",
    prescriptionNo: "RX-0900",
    date: "2026-08-21",
    branch: "Main Clinic",
    billType: "GST" as const,
    petId: "PET-0008",
    petName: "mouz",
    species: "Feline",
    breed: "Indie Cat",
    ownerId: "OWN-0008",
    ownerName: "tarannum",
    ownerPhone: "9823011445",
    doctorName: "Dr. Aisha Nair",
    status: "Paid" as const,
    items: [
      { lineType: "Pharmacy" as const, name: "Broadline Spot-on for Cats", quantity: 1, unitPrice: 420, discountPercent: 0, gstRate: 12, lineTotal: 420 },
    ],
    subtotal: 420,
    billDiscount: 0,
    taxableAmount: 375,
    gstAmount: 45,
    roundOff: 0,
    totalAmount: 420,
    amountPaid: 420,
    balanceDue: 0,
    payments: [{ mode: "UPI" as const, amount: 420, timestamp: "2026-08-21T16:10:00.000Z" }],
  },
  {
    visitId: "V-0896",
    invoiceNo: "INV-896",
    prescriptionNo: "RX-0896",
    date: "2026-08-21",
    branch: "Main Clinic",
    billType: "GST" as const,
    petId: "PET-0005",
    petName: "sino",
    species: "Canine",
    breed: "Shih Tzu",
    ownerId: "OWN-0005",
    ownerName: "Joshna Tagde",
    ownerPhone: "9822998877",
    doctorName: "Dr. Rohit Sharma",
    status: "Paid" as const,
    category: "Clinical" as const,
    items: [
      { lineType: "Consultation" as const, name: "Dermatology Workup & Otoscopy", quantity: 1, unitPrice: 750, discountPercent: 0, gstRate: 18, lineTotal: 750 },
    ],
    subtotal: 750,
    billDiscount: 0,
    taxableAmount: 635.6,
    gstAmount: 114.4,
    roundOff: 0,
    totalAmount: 750,
    amountPaid: 750,
    balanceDue: 0,
    payments: [{ mode: "UPI" as const, amount: 750, timestamp: "2026-08-21T17:30:00.000Z" }],
  },
  {
    visitId: "V-0907",
    invoiceNo: "INV-907",
    prescriptionNo: "BRD-1001",
    date: "2026-08-22",
    branch: "Main Clinic",
    billType: "Non-GST" as const,
    petId: "PET-0001",
    petName: "Bruno",
    species: "Canine",
    breed: "Golden Retriever",
    ownerId: "OWN-0001",
    ownerName: "Tariq Hussain",
    ownerPhone: "+91 90000 11111",
    doctorName: "Dr. Rohit Sharma",
    status: "Paid" as const,
    category: "Boarding" as const,
    items: [
      { lineType: "Procedure" as const, name: "Deluxe Kennel Stay (5 Nights @ ₹1,200/day)", quantity: 5, unitPrice: 1200, discountPercent: 0, gstRate: 0, lineTotal: 6000 },
      { lineType: "Pharmacy" as const, name: "Daily Royal Canin Dietary Plan & Care", quantity: 5, unitPrice: 250, discountPercent: 0, gstRate: 0, lineTotal: 1250 },
    ],
    subtotal: 7250,
    billDiscount: 0,
    taxableAmount: 7250,
    gstAmount: 0,
    roundOff: 0,
    totalAmount: 7250,
    amountPaid: 7250,
    balanceDue: 0,
    payments: [{ mode: "UPI" as const, amount: 7250, timestamp: "2026-08-22T09:30:00.000Z" }],
  },
  {
    visitId: "V-0908",
    invoiceNo: "INV-908",
    prescriptionNo: "SW-201",
    date: "2026-08-22",
    branch: "Main Clinic",
    billType: "GST" as const,
    petId: "PET-0003",
    petName: "Rocky",
    species: "Canine",
    breed: "German Shepherd",
    ownerId: "OWN-0003",
    ownerName: "Kavitha Nair",
    ownerPhone: "+91 90000 77777",
    doctorName: "Dr. Aisha Nair",
    status: "Paid" as const,
    category: "Swimming" as const,
    items: [
      { lineType: "Procedure" as const, name: "Canine Hydrotherapy & Assisted Pool Swim (45 min)", quantity: 1, unitPrice: 850, discountPercent: 0, gstRate: 18, lineTotal: 850 },
      { lineType: "Pharmacy" as const, name: "Hydro-Rehab Drying & Coat Conditioning", quantity: 1, unitPrice: 350, discountPercent: 0, gstRate: 18, lineTotal: 350 },
    ],
    subtotal: 1200,
    billDiscount: 0,
    taxableAmount: 1017,
    gstAmount: 183,
    roundOff: 0,
    totalAmount: 1200,
    amountPaid: 1200,
    balanceDue: 0,
    payments: [{ mode: "UPI" as const, amount: 1200, timestamp: "2026-08-22T11:00:00.000Z" }],
  },
  {
    visitId: "V-0909",
    invoiceNo: "INV-909",
    prescriptionNo: "LAB-8803",
    date: "2026-08-22",
    branch: "Main Clinic",
    billType: "GST" as const,
    petId: "PET-0002",
    petName: "Luna",
    species: "Feline",
    breed: "Persian",
    ownerId: "OWN-0002",
    ownerName: "Vikram Shetty",
    ownerPhone: "+91 90000 66666",
    doctorName: "Dr. Rohit Sharma",
    status: "Paid" as const,
    category: "Laboratory" as const,
    items: [
      { lineType: "Diagnostic" as const, name: "Kidney Function Biochemistry Panel (BUN/Creatinine)", quantity: 1, unitPrice: 950, discountPercent: 0, gstRate: 18, lineTotal: 950 },
      { lineType: "Diagnostic" as const, name: "Urinalysis with Microscopic Sediment", quantity: 1, unitPrice: 500, discountPercent: 0, gstRate: 18, lineTotal: 500 },
    ],
    subtotal: 1450,
    billDiscount: 0,
    taxableAmount: 1228.8,
    gstAmount: 221.2,
    roundOff: 0,
    totalAmount: 1450,
    amountPaid: 1450,
    balanceDue: 0,
    payments: [{ mode: "Card" as const, amount: 1450, timestamp: "2026-08-22T12:45:00.000Z" }],
  },
  {
    visitId: "V-0910",
    invoiceNo: "INV-910",
    prescriptionNo: "RET-402",
    date: "2026-08-22",
    branch: "Main Clinic",
    billType: "GST" as const,
    petId: "PET-0005",
    petName: "Milo",
    species: "Canine",
    breed: "Beagle",
    ownerId: "OWN-0005",
    ownerName: "Ananya Sharma",
    ownerPhone: "+91 90000 55555",
    doctorName: "Dr. Aisha Nair",
    status: "Paid" as const,
    category: "Pharmacy" as const,
    items: [
      { lineType: "Pharmacy" as const, name: "Ergonomic Padded Dog Harness (L)", quantity: 1, unitPrice: 1250, discountPercent: 0, gstRate: 18, lineTotal: 1250 },
      { lineType: "Pharmacy" as const, name: "Nylon Training Leash 6ft", quantity: 1, unitPrice: 450, discountPercent: 0, gstRate: 18, lineTotal: 450 },
    ],
    subtotal: 1700,
    billDiscount: 0,
    taxableAmount: 1440.68,
    gstAmount: 259.32,
    roundOff: 0,
    totalAmount: 1700,
    amountPaid: 1700,
    balanceDue: 0,
    payments: [{ mode: "UPI" as const, amount: 1700, timestamp: "2026-08-22T14:15:00.000Z" }],
  },
  {
    visitId: "V-0911",
    invoiceNo: "INV-911",
    prescriptionNo: "NUT-202",
    date: "2026-08-22",
    branch: "Main Clinic",
    billType: "GST" as const,
    petId: "PET-0002",
    petName: "Luna",
    species: "Feline",
    breed: "Persian",
    ownerId: "OWN-0002",
    ownerName: "Vikram Shetty",
    ownerPhone: "+91 90000 66666",
    doctorName: "Dr. Rohit Sharma",
    status: "Partially Paid" as const,
    category: "Nutrition" as const,
    items: [
      { lineType: "Pharmacy" as const, name: "Royal Canin Renal Support 4kg Diet", quantity: 1, unitPrice: 2450, discountPercent: 0, gstRate: 5, lineTotal: 2450 },
    ],
    subtotal: 2450,
    billDiscount: 0,
    taxableAmount: 2333.33,
    gstAmount: 116.67,
    roundOff: 0,
    totalAmount: 2450,
    amountPaid: 1500,
    balanceDue: 950,
    payments: [{ mode: "Cash" as const, amount: 1500, timestamp: "2026-08-22T15:00:00.000Z" }],
  },

  {
    visitId: "V-0895",
    invoiceNo: "INV-895",
    prescriptionNo: "RX-0895",
    date: "2026-08-21",
    branch: "Main Clinic",
    billType: "GST" as const,
    petId: "PET-0006",
    petName: "joy",
    species: "Canine",
    breed: "Golden Retriever",
    ownerId: "OWN-0006",
    ownerName: "R",
    ownerPhone: "9823099112",
    doctorName: "Dr. Rohit Sharma",
    status: "Billed" as const,
    items: [
      { lineType: "Procedure" as const, name: "Wound Dressing & Antibiotic Flush", quantity: 1, unitPrice: 800, discountPercent: 0, gstRate: 18, lineTotal: 800 },
    ],
    subtotal: 800,
    billDiscount: 0,
    taxableAmount: 677.96,
    gstAmount: 122.04,
    roundOff: 0,
    totalAmount: 800,
    amountPaid: 0,
    balanceDue: 800,
    payments: [],
  },
  {
    visitId: "V-0897",
    invoiceNo: "INV-897",
    prescriptionNo: "RX-0897",
    date: "2026-08-21",
    branch: "Main Clinic",
    billType: "GST" as const,
    petId: "PET-0003",
    petName: "chutki",
    species: "Canine",
    breed: "Pug",
    ownerId: "OWN-0003",
    ownerName: "Anushka Kolhatkar",
    ownerPhone: "9422188776",
    doctorName: "Dr. Aisha Nair",
    status: "Paid" as const,
    items: [
      { lineType: "Pharmacy" as const, name: "Bravecto Chewable Tablet for Dogs", quantity: 1, unitPrice: 874, discountPercent: 0, gstRate: 12, lineTotal: 874 },
    ],
    subtotal: 874,
    billDiscount: 0,
    taxableAmount: 780.35,
    gstAmount: 93.65,
    roundOff: 0,
    totalAmount: 874,
    amountPaid: 874,
    balanceDue: 0,
    payments: [{ mode: "UPI" as const, amount: 874, timestamp: "2026-08-21T19:15:00.000Z" }],
  },
];

async function ensureBillingSeeded() {
  await connectDB();
  const count = await ClinicalVisit.countDocuments();
  if (count === 0) {
    for (const v of SEED_BILLING_INVOICES) {
      await ClinicalVisit.findOneAndUpdate({ visitId: v.visitId }, { $setOnInsert: v }, { upsert: true });
    }
  }
}

// ─── Input Schemas ────────────────────────────────────────────────────────────

const FilterInvoicesInputZ = z.object({
  query: z.string().optional(),
  datePreset: z.enum(["all", "today", "yesterday", "7days", "30days", "custom"]).optional().default("all"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.string().optional().default("all"),
});

const RecordPaymentInputZ = z.object({
  invoiceNo: z.string().min(1),
  amount: z.number().positive(),
  mode: z.enum(["UPI", "Cash", "Card", "NetBanking", "Cheque"]),
  trxRef: z.string().optional(),
});

// ─── Server Functions ─────────────────────────────────────────────────────────

export const listInvoicesFn = createServerFn({ method: "GET" })
  .validator((filter: unknown) => FilterInvoicesInputZ.parse(filter || {}))
  .handler(async ({ data: filter }: { data: z.infer<typeof FilterInvoicesInputZ> }) => {
    await ensureBillingSeeded();

    const queryObj: any = {};

    // Text search
    if (filter.query?.trim()) {
      const q = filter.query.trim();
      queryObj.$or = [
        { invoiceNo: { $regex: q, $options: "i" } },
        { petName: { $regex: q, $options: "i" } },
        { petId: { $regex: q, $options: "i" } },
        { ownerName: { $regex: q, $options: "i" } },
        { ownerPhone: { $regex: q, $options: "i" } },
      ];
    }

    // Status filter
    if (filter.status && filter.status !== "all") {
      queryObj.status = filter.status;
    }

    const invoices = await ClinicalVisit.find(queryObj).sort({ createdAt: -1, date: -1 }).limit(100).lean();
    return toPlain<any[]>(invoices);
  });

export const recordInvoicePaymentFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => RecordPaymentInputZ.parse(data))
  .handler(async ({ data }: { data: z.infer<typeof RecordPaymentInputZ> }) => {
    await connectDB();

    const visit = await ClinicalVisit.findOne({ invoiceNo: data.invoiceNo });
    if (!visit) throw new Error(`Invoice ${data.invoiceNo} not found`);

    const newPayment = {
      mode: data.mode,
      amount: data.amount,
      trxRef: data.trxRef || undefined,
      timestamp: new Date().toISOString(),
    };

    const currentPaid = (visit.amountPaid || 0) + data.amount;
    const currentBal = Math.max(0, (visit.totalAmount || 0) - currentPaid);

    visit.amountPaid = currentPaid;
    visit.balanceDue = currentBal;
    visit.status = currentBal === 0 ? "Paid" : "Billed";
    visit.payments.push(newPayment as any);

    await visit.save();

    // Post to accounting
    try {
      const peNo = await nextSeq("payment_entry", "PE", 4);
      await FinanceTransaction.create({
        type: "payment",
        data: {
          paymentNo: peNo,
          paymentType: "Receive",
          paymentDate: new Date().toISOString().slice(0, 10),
          partyType: "Customer",
          partyName: visit.ownerName,
          modeOfPayment: data.mode,
          bankAccount: data.mode === "Cash" ? "Cash on Hand" : "HDFC Current",
          referenceNo: data.trxRef || visit.invoiceNo,
          paidAmount: data.amount,
          narration: `Payment installment received for ${visit.invoiceNo}`,
          references: [
            {
              invoiceNo: visit.invoiceNo,
              invoiceDate: visit.date,
              dueDate: visit.date,
              invoiceAmount: visit.totalAmount,
              outstanding: currentBal,
              allocatedAmount: data.amount,
            },
          ],
        },
      });
    } catch (e) {
      console.warn("Accounting entry failed", e);
    }

    return toPlain<any>(visit.toObject ? visit.toObject() : visit);
  });

export const deleteInvoiceFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ invoiceNo: z.string() }).parse(data))
  .handler(async ({ data }: { data: { invoiceNo: string } }) => {
    await connectDB();
    await ClinicalVisit.deleteOne({ invoiceNo: data.invoiceNo });
    return { success: true };
  });
