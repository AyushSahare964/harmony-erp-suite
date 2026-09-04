import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { ClinicalVisit, type IClinicalVisit } from "@/lib/mongodb/models/ClinicalVisit";
import { Owner } from "@/lib/mongodb/models/Owner";
import { Pet } from "@/lib/mongodb/models/Pet";
import { StockBatch } from "@/lib/mongodb/models/StockBatch";
import { FinanceTransaction } from "@/lib/mongodb/models/FinanceTransaction";
import { ErpRow } from "@/lib/mongodb/models/ErpRow";
import { nextSeq } from "./counters";

function toPlain<T>(v: any): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

async function maxVisitSeq(): Promise<number> {
  const latest = (await ClinicalVisit.findOne({}).sort({ visitId: -1 }).lean()) as { visitId?: string } | null;
  if (!latest?.visitId) return 0;
  const num = parseInt(latest.visitId.replace(/^[^\d]+/, ""), 10);
  return isNaN(num) ? 0 : num;
}

async function maxInvoiceSeq(): Promise<number> {
  const latest = (await ClinicalVisit.findOne({}).sort({ invoiceNo: -1 }).lean()) as { invoiceNo?: string } | null;
  if (!latest?.invoiceNo) return 0;
  const parts = latest.invoiceNo.split("/");
  const num = parseInt(parts[parts.length - 1] || "", 10);
  return isNaN(num) ? 0 : num;
}

async function maxRxSeq(): Promise<number> {
  const latest = (await ClinicalVisit.findOne({}).sort({ prescriptionNo: -1 }).lean()) as { prescriptionNo?: string } | null;
  if (!latest?.prescriptionNo) return 0;
  const num = parseInt(latest.prescriptionNo.replace(/^[^\d]+/, ""), 10);
  return isNaN(num) ? 0 : num;
}

// ─── Input Schemas ────────────────────────────────────────────────────────────

const AdmitPatientInputZ = z.object({
  petId: z.string().optional(),
  petName: z.string().min(1, "Patient name is required"),
  species: z.string().default("Canine"),
  breed: z.string().default("Mix"),
  ownerId: z.string().optional(),
  ownerName: z.string().min(1, "Pet parent name is required"),
  ownerPhone: z.string().min(1, "Contact phone is required"),
  branch: z.string().default("Central Avenue, Nagpur"),
  billType: z.enum(["GST", "Non-GST"]).default("GST"),
  doctorName: z.string().default("Dr. Rohit Sharma"),
  receptionistName: z.string().default("Front Desk"),
  allergies: z.array(z.string()).optional(),
  vitals: z.object({
    weightKg: z.number().optional(),
    tempC: z.number().optional(),
    heartRate: z.number().optional(),
    complaint: z.string().optional(),
  }).optional(),
});

const PrescriptionLineZ = z.object({
  lineType: z.enum(["Vaccine", "Consultation", "Pharmacy", "Procedure", "Diagnostic", "Service", "Food", "Accessory"]),
  itemCode: z.string().optional(),
  batchNo: z.string().optional(),
  name: z.string().min(1),
  dosageInstructions: z.string().optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  discountPercent: z.number().min(0).max(100).default(0),
  // Per-line discount audit fields (REQ-DISC)
  discountType: z.enum(["percentage", "fixed"]).optional(),
  discountValue: z.number().min(0).optional(),
  discountAmount: z.number().min(0).optional(),
  taxableAmount: z.number().min(0).optional(),
  gstRate: z.number().min(0).max(100).default(0),
  lineTotal: z.number().min(0),
});

const FinalizeVisitInputZ = z.object({
  visitId: z.string().min(1),
  petId: z.string().optional(),
  petName: z.string().optional(),
  species: z.string().optional(),
  breed: z.string().optional(),
  ownerId: z.string().optional(),
  ownerName: z.string().optional(),
  ownerPhone: z.string().optional(),
  branch: z.string().optional(),
  billType: z.enum(["GST", "Non-GST"]).optional().default("GST"),
  doctorName: z.string().optional(),
  diagnosis: z.string().optional(),
  clinicalNotes: z.string().optional(),
  nextVisitDate: z.string().optional(),
  nextVaccineDate: z.string().optional(),
  nextDewormingDate: z.string().optional(),
  items: z.array(PrescriptionLineZ),
  subtotal: z.number(),
  billDiscount: z.number().default(0),
  taxableAmount: z.number(),
  gstAmount: z.number(),
  roundOff: z.number().default(0),
  totalAmount: z.number(),
  amountPaid: z.number(),
  paymentMode: z.enum(["UPI", "Cash", "Card", "NetBanking", "Cheque", "Account Due"]).default("UPI"),
  trxRef: z.string().optional(),
});


// ─── Initial Seed Visits ──────────────────────────────────────────────────────

const SEED_VISITS = [
  {
    visitId: "V-0001",
    invoiceNo: "INV/2026-27/0905",
    prescriptionNo: "RX-0905",
    date: new Date().toISOString().slice(0, 10),
    branch: "Perfect Society",
    billType: "GST" as const,
    petId: "PET-0004",
    petName: "Keechu",
    species: "Canine",
    breed: "Labrador",
    ownerId: "OWN-0004",
    ownerName: "Ria Meshram",
    ownerPhone: "9765432100",
    doctorName: "Dr. Rohit Sharma",
    receptionistName: "Jyoti Sahare",
    status: "Paid" as const,
    vitals: { weightKg: 31.0, tempC: 38.6, complaint: "Annual 9-in-1 vaccination and routine health check" },
    diagnosis: "Healthy adult canine. Routine vaccination completed.",
    clinicalNotes: "Vaccinated with Canishot DHPPIL. No adverse reactions observed. Keep hydrated.",
    nextVisitDate: "2026-09-22",
    nextVaccineDate: "2027-08-22",
    nextDewormingDate: "2026-11-22",
    items: [
      { lineType: "Vaccine" as const, name: "Canishot DHPPIL", quantity: 1, unitPrice: 1350, discountPercent: 0, gstRate: 5, lineTotal: 1350 },
      { lineType: "Vaccine" as const, name: "Canishot CV", quantity: 1, unitPrice: 500, discountPercent: 0, gstRate: 5, lineTotal: 500 },
      { lineType: "Vaccine" as const, name: "Nobivac R (Rabies)", quantity: 1, unitPrice: 800, discountPercent: 0, gstRate: 5, lineTotal: 800 },
      { lineType: "Consultation" as const, name: "General Physical Examination", quantity: 1, unitPrice: 850, discountPercent: 0, gstRate: 18, lineTotal: 850 },
    ],
    subtotal: 3500,
    billDiscount: 0,
    taxableAmount: 3300,
    gstAmount: 200,
    roundOff: 0,
    totalAmount: 3500,
    amountPaid: 3500,
    balanceDue: 0,
    payments: [{ mode: "UPI" as const, amount: 3500, timestamp: new Date().toISOString() }],
    inventoryDeducted: true,
    accountingPosted: true,
  },
  {
    visitId: "V-0002",
    invoiceNo: "INV/2026-27/0906",
    prescriptionNo: "RX-0906",
    date: new Date().toISOString().slice(0, 10),
    branch: "Perfect Society",
    billType: "GST" as const,
    petId: "PET-0002",
    petName: "XYZ",
    species: "Feline",
    breed: "Persian",
    ownerId: "OWN-0002",
    ownerName: "Kunjan Ninawe",
    ownerPhone: "9823044556",
    doctorName: "Dr. Aisha Nair",
    receptionistName: "Jyoti Sahare",
    status: "Paid" as const,
    vitals: { weightKg: 4.2, tempC: 39.1, complaint: "Mild fever and sluggish appetite since yesterday" },
    diagnosis: "Acute feline viral rhinitis (mild).",
    clinicalNotes: "Administered anti-inflammatory injection. Prescribed oral antibiotic syrup.",
    items: [
      { lineType: "Consultation" as const, name: "Specialist Feline Consultation", quantity: 1, unitPrice: 500, discountPercent: 0, gstRate: 18, lineTotal: 500 },
      { lineType: "Pharmacy" as const, name: "Amoxyclav Oral Drops 30ml", quantity: 1, unitPrice: 250, discountPercent: 0, gstRate: 12, lineTotal: 250 },
    ],
    subtotal: 750,
    billDiscount: 0,
    taxableAmount: 700,
    gstAmount: 50,
    roundOff: 0,
    totalAmount: 750,
    amountPaid: 750,
    balanceDue: 0,
    payments: [{ mode: "Cash" as const, amount: 750, timestamp: new Date().toISOString() }],
    inventoryDeducted: true,
    accountingPosted: true,
  },
];

async function ensureVisitsSeeded() {
  await connectDB();
  const count = await ClinicalVisit.countDocuments();
  if (count === 0) {
    for (const v of SEED_VISITS) {
      await ClinicalVisit.findOneAndUpdate({ visitId: v.visitId }, { $setOnInsert: v }, { upsert: true });
    }
  }
}

// ─── Server Functions ─────────────────────────────────────────────────────────

export const listVisitsFn = createServerFn({ method: "GET" }).handler(async () => {
  await ensureVisitsSeeded();
  const visits = await ClinicalVisit.find({}).sort({ createdAt: -1 }).limit(50).lean();
  return toPlain<any[]>(visits);
});

export const admitPatientFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => AdmitPatientInputZ.parse(data))
  .handler(async ({ data }: { data: z.infer<typeof AdmitPatientInputZ> }) => {
    await connectDB();
    const visitId = await nextSeq("clinical_visit", "V", 4, maxVisitSeq);
    const invSeq = await nextSeq("invoice_no", "INV/2026-27", 4, maxInvoiceSeq);
    const rxSeq = await nextSeq("prescription_no", "RX", 4, maxRxSeq);
    const ownerId = data.ownerId || (await nextSeq("owner", "OWN", 4));
    const petId = data.petId || (await nextSeq("pet", "PET", 4));

    // Auto-upsert into CRM collections
    try {
      await Owner.findOneAndUpdate(
        { ownerId },
        {
          $setOnInsert: {
            ownerId,
            name: data.ownerName,
            phone: data.ownerPhone,
            city: "Nagpur",
            preferredPaymentMode: "UPI",
            outstandingBalance: 0,
            status: "Active",
          },
        },
        { upsert: true }
      );
      await Pet.findOneAndUpdate(
        { petId },
        {
          $setOnInsert: {
            petId,
            ownerId,
            name: data.petName,
            species: data.species,
            breed: data.breed,
            weightKg: data.vitals?.weightKg,
            status: "Active",
          },
          ...(data.allergies && data.allergies.length > 0 ? { $set: { allergies: data.allergies } } : {}),
        },
        { upsert: true }
      );
    } catch (crmErr) {
      console.warn("[CRM Auto-Sync] Warning during auto-upsert:", crmErr);
    }

    const docPayload: any = {
      ...data,
      allergies: data.allergies || [],
      ownerId,
      petId,
      visitId,
      invoiceNo: invSeq,
      prescriptionNo: rxSeq,
      date: new Date().toISOString().slice(0, 10),
      status: "Admitted",
      items: [],
      subtotal: 0,
      billDiscount: 0,
      taxableAmount: 0,
      gstAmount: 0,
      roundOff: 0,
      totalAmount: 0,
      amountPaid: 0,
      balanceDue: 0,
      payments: [],
      inventoryDeducted: false,
      accountingPosted: false,
    };

    const newVisit = await ClinicalVisit.create(docPayload);
    return toPlain<any>(newVisit.toObject ? newVisit.toObject() : newVisit);
  });

export const finalizeVisitAndBillFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => FinalizeVisitInputZ.parse(data))
  .handler(async ({ data }: { data: z.infer<typeof FinalizeVisitInputZ> }) => {
    await connectDB();

    let visit = await ClinicalVisit.findOne({ visitId: data.visitId });
    if (!visit) {
      const invSeq = await nextSeq("invoice_no", "INV/2026-27", 4, maxInvoiceSeq);
      const rxSeq = await nextSeq("prescription_no", "RX", 4, maxRxSeq);
      visit = new ClinicalVisit({
        visitId: data.visitId,
        invoiceNo: invSeq,
        prescriptionNo: rxSeq,
        date: new Date().toISOString().slice(0, 10),
        branch: data.branch || "Main Clinic",
        billType: data.billType || "GST",
        petId: data.petId || "PET-0001",
        petName: data.petName || "Patient",
        species: data.species || "Canine",
        breed: data.breed || "Standard",
        ownerId: data.ownerId || "OWN-0001",
        ownerName: data.ownerName || "Client",
        ownerPhone: data.ownerPhone || "N/A",
        doctorName: data.doctorName || "Dr. Rohit Sharma",
        receptionistName: "Front Desk",
        status: "Admitted",
        items: [],
        subtotal: 0,
        totalAmount: 0,
        amountPaid: 0,
        balanceDue: 0,
        payments: [],
      });
    }


    const now = new Date().toISOString();
    const paymentRecord = {
      mode: data.paymentMode,
      amount: data.amountPaid,
      trxRef: data.trxRef || undefined,
      timestamp: now,
    };

    const balanceDue = Math.max(0, data.totalAmount - data.amountPaid);
    const status = balanceDue === 0 ? "Paid" : "Billed";

    // 1. Server-side duplicate medicine check (REQ-RX-02)
    const seenCodes = new Set<string>();
    for (const item of data.items) {
      if (item.itemCode) {
        if (seenCodes.has(item.itemCode)) {
          throw new Error(`Duplicate medicine entry detected: ${item.name} (${item.itemCode}). Each medicine can only appear once per prescription.`);
        }
        seenCodes.add(item.itemCode);
      }
    }

    // 2. FEFO Inventory Deduction for pharmacy, vaccine, food, and accessory lines
    for (const item of data.items) {
      if (item.lineType === "Pharmacy" || item.lineType === "Vaccine" || item.lineType === "Food" || item.lineType === "Accessory") {
        try {
          const filter: any = { qty: { $gt: 0 } };
          if (item.batchNo) filter.batchNo = item.batchNo;
          if (item.itemCode) filter.itemCode = item.itemCode;

          const batch = await StockBatch.findOne(filter).sort({ expiryDate: 1 });
          if (batch) {
            batch.qty = Math.max(0, batch.qty - item.quantity);
            await batch.save();
          }
        } catch (e) {
          console.warn("[Inventory FEFO] Could not deduct batch for item:", item.name, e);
        }
      }
    }

    // 2. Post Double-Entry Journal in Accounting
    try {
      const jvNo = await nextSeq("journal_entry", "JV", 4);
      const isCashOrBank = data.paymentMode === "Cash" || data.paymentMode === "UPI" || data.paymentMode === "Card";
      const debitAccount = isCashOrBank ? "1200" : "1300"; // HDFC/Cash or Accounts Receivable

      await FinanceTransaction.create({
        type: "journal",
        data: {
          journalNo: jvNo,
          date: new Date().toISOString().slice(0, 10),
          voucherType: "Sales Invoice",
          lines: [
            { account: debitAccount, debit: data.totalAmount, credit: 0 },
            { account: "4100", debit: 0, credit: data.taxableAmount },
            ...(data.gstAmount > 0 ? [{ account: "2200", debit: 0, credit: data.gstAmount }] : []),
          ],
          narration: `Clinical Invoice ${visit.invoiceNo} for ${visit.petName} (Owner: ${visit.ownerName})`,
          isOpeningEntry: false,
          isAccrual: false,
        },
      });

      if (data.amountPaid > 0) {
        const peNo = await nextSeq("payment_entry", "PE", 4);
        await FinanceTransaction.create({
          type: "payment",
          data: {
            paymentNo: peNo,
            paymentType: "Receive",
            paymentDate: new Date().toISOString().slice(0, 10),
            partyType: "Customer",
            partyName: visit.ownerName,
            modeOfPayment: data.paymentMode,
            bankAccount: data.paymentMode === "Cash" ? "Cash on Hand" : "HDFC Current",
            referenceNo: data.trxRef || visit.invoiceNo,
            paidAmount: data.amountPaid,
            narration: `Payment received for ${visit.invoiceNo}`,
            references: [
              {
                invoiceNo: visit.invoiceNo,
                invoiceDate: visit.date,
                dueDate: visit.date,
                invoiceAmount: data.totalAmount,
                outstanding: balanceDue,
                allocatedAmount: data.amountPaid,
              },
            ],
          },
        });
      }
    } catch (e) {
      console.warn("[Accounting Auto-Post] Journal entry creation error:", e);
    }

    // 3. Update Clinical Visit Record
    visit.diagnosis = data.diagnosis || undefined;
    visit.clinicalNotes = data.clinicalNotes || undefined;
    visit.nextVisitDate = data.nextVisitDate || undefined;
    visit.nextVaccineDate = data.nextVaccineDate || undefined;
    visit.nextDewormingDate = data.nextDewormingDate || undefined;
    visit.items = data.items as any;
    visit.subtotal = data.subtotal;
    visit.billDiscount = data.billDiscount;
    visit.taxableAmount = data.taxableAmount;
    visit.gstAmount = data.gstAmount;
    visit.roundOff = data.roundOff;
    visit.totalAmount = data.totalAmount;
    visit.amountPaid = data.amountPaid;
    visit.balanceDue = balanceDue;
    visit.payments = [paymentRecord] as any;
    visit.status = status;
    visit.inventoryDeducted = true;
    await visit.save();

    // 4. Save into Clinical Reports & Medical Records Master (ErpRow with moduleId: "clinical_reports")
    try {
      const repId = await nextSeq("report", "REP", 4);
      const isVaccine = (data.items || []).some((i: any) => i.lineType === "Vaccine");
      const category = isVaccine ? "Consultation & Vaccines" : "Consultation & Rx";

      await ErpRow.create({
        moduleId: "clinical_reports",
        data: {
          reportId: repId,
          title: `OPD Clinical Consultation & Treatment — ${visit.diagnosis || "Health Review"}`,
          category,
          pet: visit.petName,
          petId: visit.petId,
          species: visit.species,
          breed: visit.breed,
          owner: visit.ownerName,
          ownerPhone: visit.ownerPhone,
          doctor: visit.doctorName || data.doctorName || "Dr. Rohit Sharma",
          date: visit.date || new Date().toISOString().slice(0, 10),
          status: "Verified & Signed",
          isNarrative: true,
          narrative: `Chief Complaint: ${visit.vitals?.complaint || "Routine Clinical Consultation"}\n\nClinical Findings: ${visit.diagnosis || "Examination completed"}\n\nNotes & Advice: ${visit.clinicalNotes || "As prescribed."}\n\nPrescription (${visit.prescriptionNo}):\n${(data.items || []).map((it: any) => `• ${it.name} (Qty: ${it.quantity}) - ${it.dosageInstructions || "As advised"}`).join("\n")}`,
          totalAmount: visit.totalAmount,
        },
      });
    } catch (e) {
      console.warn("[Clinical Reports Auto-Save] Error creating report record:", e);
    }

    // 5. Auto-sync Next Visit Date to Appointments Queue
    if (data.nextVisitDate) {
      try {
        const nextToken = Math.floor(100 + Math.random() * 900);
        await ErpRow.findOneAndUpdate(
          {
            moduleId: "appointments",
            "data.petId": visit.petId,
            "data.date": data.nextVisitDate,
          },
          {
            $set: {
              moduleId: "appointments",
              data: {
                token: nextToken,
                petId: visit.petId,
                pet: visit.petName,
                species: visit.species || "Canine",
                breed: visit.breed || "Standard",
                owner: visit.ownerName,
                phone: visit.ownerPhone,
                doctor: visit.doctorName || "Dr. Rohit Sharma",
                reason: `Follow-up Consultation: ${data.diagnosis || "Post-treatment review"}`,
                slot: "09:30 AM",
                date: data.nextVisitDate,
                status: "Scheduled",
                priority: "Follow-up",
                createdAt: new Date().toISOString(),
              },
            },
          },
          { upsert: true }
        );
      } catch (appErr) {
        console.warn("[Appointment Auto-Sync] Warning during appointment sync:", appErr);
      }
    }

    return toPlain<any>(visit.toObject ? visit.toObject() : visit);
  });

export const deleteVisitFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ visitId: z.string() }).parse(data))
  .handler(async ({ data }: { data: { visitId: string } }) => {
    await connectDB();
    await ClinicalVisit.deleteOne({ visitId: data.visitId });
    return { success: true };
  });

export const getLatestVisitFn = createServerFn({ method: "GET" })
  .validator((data: unknown) => z.object({ petId: z.string(), excludeVisitId: z.string().optional() }).parse(data))
  .handler(async ({ data }) => {
    await connectDB();
    const query: any = { petId: data.petId, status: "Completed" };
    if (data.excludeVisitId) {
      query.visitId = { $ne: data.excludeVisitId };
    }
    const visit = await ClinicalVisit.findOne(query).sort({ date: -1, createdAt: -1 }).lean();
    return toPlain<any>(visit);
  });

export const getPatientHistoryFn = createServerFn({ method: "GET" })
  .validator(
    (data: unknown) =>
      z.object({
        petId: z.string().optional(),
        petName: z.string().optional(),
        excludeVisitId: z.string().optional(),
      }).parse(data)
  )
  .handler(async ({ data }) => {
    await connectDB();
    await ensureVisitsSeeded();

    const clauses: any[] = [];
    if (data.petId && data.petId.trim()) {
      clauses.push({ petId: data.petId.trim() });
    }
    if (data.petName && data.petName.trim()) {
      clauses.push({ petName: { $regex: new RegExp(`^${data.petName.trim()}$`, "i") } });
    }

    if (clauses.length === 0) return [];

    const query: any = { $or: clauses };
    if (data.excludeVisitId) {
      query.visitId = { $ne: data.excludeVisitId };
    }

    const visits = await ClinicalVisit.find(query)
      .sort({ date: -1, createdAt: -1 })
      .limit(30)
      .lean();

    return toPlain<any[]>(visits);
  });

export const getUpcomingFollowUpsFn = createServerFn({ method: "GET" })
  .validator((data: unknown) => z.object({ daysAhead: z.number().optional() }).parse(data))
  .handler(async ({ data }) => {
    await connectDB();
    const daysAhead = data.daysAhead ?? 14;
    const today = new Date().toISOString().slice(0, 10);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    const futureDateStr = futureDate.toISOString().slice(0, 10);

    const visits = await ClinicalVisit.find({
      nextVisitDate: { $gte: today, $lte: futureDateStr },
    })
      .sort({ nextVisitDate: 1 })
      .limit(50)
      .lean();

    return toPlain<any[]>(visits.map((v: any) => ({
      visitId: v.visitId,
      petId: v.petId,
      petName: v.petName,
      ownerId: v.ownerId,
      ownerName: v.ownerName,
      ownerPhone: v.ownerPhone,
      species: v.species,
      breed: v.breed,
      nextVisitDate: v.nextVisitDate,
      nextDewormingDate: v.nextDewormingDate,
      doctorName: v.doctorName,
      diagnosis: v.diagnosis,
    })));
  });
