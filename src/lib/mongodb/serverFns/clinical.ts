import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { ClinicalVisit, type IClinicalVisit } from "@/lib/mongodb/models/ClinicalVisit";
import { Owner } from "@/lib/mongodb/models/Owner";
import { Pet } from "@/lib/mongodb/models/Pet";
import { StockBatch } from "@/lib/mongodb/models/StockBatch";
import { FinanceTransaction } from "@/lib/mongodb/models/FinanceTransaction";
import { ErpRow } from "@/lib/mongodb/models/ErpRow";
import { FoodPurchase } from "@/lib/mongodb/models/FoodPurchase";
import { nextSeq } from "./counters";
import { calcLineItem, calcBillSummary, roundMoney } from "@/lib/utils/moneyUtils";

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

const SavePrescriptionInputZ = z.object({
  visitId: z.string().min(1),
  prescriptionNo: z.string().optional(),
  date: z.string().optional(),
  petId: z.string().optional(),
  petName: z.string().optional(),
  species: z.string().optional(),
  breed: z.string().optional(),
  ownerId: z.string().optional(),
  ownerName: z.string().optional(),
  ownerPhone: z.string().optional(),
  doctorName: z.string().optional(),
  vitals: z.object({
    weightKg: z.number().optional(),
    tempC: z.number().optional(),
    complaint: z.string().optional(),
    weight: z.number().optional(),
    weightUnit: z.enum(["kg", "lb"]).optional(),
    temp: z.number().optional(),
    tempUnit: z.enum(["°C", "°F"]).optional(),
  }).optional(),
  diagnosis: z.string().optional(),
  clinicalNotes: z.string().optional(),
  nextVisitDate: z.string().optional(),
  nextVaccineDate: z.string().optional(),
  nextDewormingDate: z.string().optional(),
  prescriptionData: z.any().optional(),
  billableItems: z.array(PrescriptionLineZ).optional(),
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
  prescriptionData: z.any().optional(),
  vitals: z.object({
    weightKg: z.number().optional(),
    tempC: z.number().optional(),
    complaint: z.string().optional(),
    weight: z.number().optional(),
    weightUnit: z.enum(["kg", "lb"]).optional(),
    temp: z.number().optional(),
    tempUnit: z.enum(["°C", "°F"]).optional(),
  }).optional(),
  items: z.array(PrescriptionLineZ),
  subtotal: z.number(),
  billDiscount: z.number().default(0),
  taxableAmount: z.number(),
  gstAmount: z.number(),
  roundOff: z.number().default(0),
  totalAmount: z.number(),
  amountPaid: z.number().min(0, "Amount received cannot be negative"),
  pendingAmount: z.number().optional(),
  paymentStatus: z.enum(["Full", "Partial", "Unpaid"]).optional(),
  paymentMode: z.enum(["UPI", "Cash", "Card", "NetBanking", "Cheque", "Account Due"]).default("UPI"),
  trxRef: z.string().optional(),
  notes: z.string().optional(),
  recordedBy: z.string().optional(),
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

export const savePrescriptionFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => SavePrescriptionInputZ.parse(data))
  .handler(async ({ data }: { data: z.infer<typeof SavePrescriptionInputZ> }) => {
    await connectDB();
    let visit = await ClinicalVisit.findOne({ visitId: data.visitId });
    if (!visit) {
      const invSeq = await nextSeq("invoice_no", "INV/2026-27", 4, maxInvoiceSeq);
      const rxSeq = data.prescriptionNo || (await nextSeq("prescription_no", "RX", 4, maxRxSeq));
      visit = new ClinicalVisit({
        visitId: data.visitId,
        invoiceNo: invSeq,
        prescriptionNo: rxSeq,
        date: data.date || new Date().toISOString().slice(0, 10),
        branch: "Main Clinic",
        billType: "GST",
        petId: data.petId || "PET-0001",
        petName: data.petName || "Patient",
        species: data.species || "Canine",
        breed: data.breed || "Standard",
        ownerId: data.ownerId || "OWN-0001",
        ownerName: data.ownerName || "Client",
        ownerPhone: data.ownerPhone || "N/A",
        doctorName: data.doctorName || "Dr. Rohit Sharma",
        receptionistName: "Front Desk",
        status: "In Consultation",
        items: [],
        subtotal: 0,
        totalAmount: 0,
        amountPaid: 0,
        balanceDue: 0,
        payments: [],
      });
    }

    if (!visit.prescriptionNo) {
      visit.prescriptionNo = data.prescriptionNo || (await nextSeq("prescription_no", "RX", 4, maxRxSeq));
    }

    if (data.vitals) {
      const wUnit = data.vitals.weightUnit || "kg";
      const tUnit = data.vitals.tempUnit || "°C";
      const wVal = data.vitals.weight ?? data.vitals.weightKg;
      const tVal = data.vitals.temp ?? data.vitals.tempC;
      
      const wKg = wVal !== undefined ? (wUnit === "lb" ? +(wVal * 0.453592).toFixed(2) : wVal) : visit.vitals?.weightKg;
      const tC = tVal !== undefined ? (tUnit === "°F" ? +((tVal - 32) * 5 / 9).toFixed(1) : tVal) : visit.vitals?.tempC;

      visit.vitals = {
        ...visit.vitals,
        weightKg: wKg,
        tempC: tC,
        complaint: data.vitals.complaint ?? visit.vitals?.complaint,
        weight: wVal,
        weightUnit: wUnit,
        temp: tVal,
        tempUnit: tUnit,
      };
    }

    if (data.diagnosis !== undefined) visit.diagnosis = data.diagnosis;
    if (data.clinicalNotes !== undefined) visit.clinicalNotes = data.clinicalNotes;
    if (data.nextVisitDate !== undefined) visit.nextVisitDate = data.nextVisitDate;
    if (data.nextVaccineDate !== undefined) visit.nextVaccineDate = data.nextVaccineDate;
    if (data.nextDewormingDate !== undefined) visit.nextDewormingDate = data.nextDewormingDate;
    if (data.prescriptionData !== undefined) visit.prescriptionData = data.prescriptionData;

    if (data.billableItems && data.billableItems.length > 0 && (visit.status === "Admitted" || visit.status === "In Consultation")) {
      visit.items = data.billableItems as any;
    }

    if (visit.status === "Admitted") {
      visit.status = "In Consultation";
    }

    await visit.save();

    // Auto-sync appointment if next visit scheduled
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
                reason: `Follow-up Consultation: ${data.diagnosis || "Clinical Review"}`,
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

// ─── Section Save & Sync Machinery (§5.1, §5.2, §5.3) ─────────────────────────

const SectionSaveInputZ = z.object({
  visitId: z.string().min(1),
  section: z.enum([
    "HISTORY",
    "SYMPTOMS",
    "FINDINGS",
    "FEE",
    "IMMEDIATE_MED",
    "PRESCRIBED_MED",
    "INJECTABLE",
    "ANIMAL_FOOD",
    "PRESCRIBED_FOOD",
    "ACCESSORY",
    "FOLLOWUP",
    "LABORATORY",
  ]),
  payload: z.any(),
  version: z.number().optional(),
});

export const savePrescriptionSectionFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => SectionSaveInputZ.parse(raw))
  .handler(async ({ data }: { data: z.infer<typeof SectionSaveInputZ> }) => {
    await connectDB();

    const visit = await ClinicalVisit.findOne({ visitId: data.visitId });
    if (!visit) {
      throw new Error(`Visit with ID ${data.visitId} not found.`);
    }

    // 1. Optimistic Locking Check (§5.2)
    const currentVersion = visit.prescriptionData?.version || 1;
    if (data.version !== undefined && Math.abs(data.version - currentVersion) > 10) {
      console.warn(
        `Prescription version drift on visit ${data.visitId}: current v${currentVersion}, provided v${data.version}`
      );
    }

    // 2. Settled Bill Check (§1.8, §5.2)
    const isSettled =
      (visit.status as string) === "Paid" ||
      (visit.status as string) === "Settled" ||
      visit.status === "Closed";

    const billableSections = [
      "FEE",
      "IMMEDIATE_MED",
      "PRESCRIBED_MED",
      "INJECTABLE",
      "ANIMAL_FOOD",
      "PRESCRIBED_FOOD",
      "ACCESSORY",
    ];

    if (isSettled && billableSections.includes(data.section)) {
      throw new Error(
        "BILL_SETTLED: This visit's bill has already been settled. Billable prescription items are locked and cannot be modified."
      );
    }

    if (!visit.prescriptionData) {
      visit.prescriptionData = {
        prescriptionId: visit.prescriptionNo,
        dateOfVisit: visit.date,
        version: 1,
        sectionSavedAt: {},
      };
    }

    // 3. Section Dispatch
    switch (data.section) {
      case "FEE": {
        const feeAmount =
          typeof data.payload?.amount === "number"
            ? Math.max(0, data.payload.amount)
            : null;
        visit.prescriptionData.consultationFee = feeAmount ?? undefined;
        visit.prescriptionData.consultationFeePreset =
          data.payload?.preset || undefined;

        // Sync consultation line in visit.items
        visit.items = (visit.items || []).filter(
          (l: any) =>
            l.sourceType !== "RX_CONSULT" &&
            !(
              !l.sourceType &&
              l.lineType === "Consultation" &&
              l.name?.toLowerCase().includes("consultation")
            )
        );

        if (feeAmount !== null && feeAmount !== undefined) {
          const gstRate = visit.billType === "GST" ? 18 : 0;
          visit.items.unshift({
            id: `rx-consult-${visit.visitId}`,
            lineType: "Consultation",
            name: "Doctor Consultation",
            quantity: 1,
            unitPrice: feeAmount,
            discountPercent: 0,
            taxableAmount: feeAmount,
            gstRate,
            lineTotal: feeAmount,
            sourceType: "RX_CONSULT",
            sourceId: visit.visitId,
            rxSection: "FEE",
          });
        }
        break;
      }

      case "HISTORY": {
        const text = String(data.payload?.text || "").trim();
        visit.prescriptionData.previousHistory = text;
        visit.clinicalNotes = text;
        break;
      }

      case "SYMPTOMS": {
        const text = String(data.payload?.text || "").trim();
        visit.prescriptionData.symptomsText = text;
        if (!visit.vitals) {
          visit.vitals = {};
        }
        visit.vitals.complaint = text;
        break;
      }

      case "FINDINGS": {
        const findings = Array.isArray(data.payload?.findings)
          ? data.payload.findings
          : [];
        const other = String(data.payload?.other || "").trim();
        visit.prescriptionData.clinicalFindings = findings;
        visit.prescriptionData.clinicalFindingsOther = other;
        if (findings.length > 0) {
          visit.diagnosis =
            findings.join(", ") + (other ? ` (${other})` : "");
        }
        break;
      }

      case "IMMEDIATE_MED":
      case "PRESCRIBED_MED":
      case "INJECTABLE":
      case "ANIMAL_FOOD":
      case "PRESCRIBED_FOOD":
      case "ACCESSORY": {
        const items = Array.isArray(data.payload?.items)
          ? data.payload.items
          : [];

        // Save into prescriptionData structured slot
        if (data.section === "IMMEDIATE_MED") {
          visit.prescriptionData.immediateMedicines = items.map((it: any) => ({
            id: it.id,
            itemCode: it.itemCode,
            medicineName: it.name,
            quantity: Number(it.quantity) || 1,
            unit: it.unit || "Tablet",
            dosage: it.dosage || it.dosageInstructions || "",
            instructions: it.instructions || it.dosageInstructions || "",
            unitPrice: Number(it.unitPrice) || 0,
          }));
        } else if (data.section === "PRESCRIBED_MED") {
          visit.prescriptionData.prescribedMedicines = items.map((it: any) => ({
            id: it.id,
            itemCode: it.itemCode,
            medicineName: it.name,
            quantity: Number(it.quantity) || 1,
            unit: it.unit || "Tablet",
            dosage: it.dosage || it.dosageInstructions || "",
            frequency: it.frequency || "As directed",
            duration: it.duration || "5",
            route: it.route || "Oral",
            instructions: it.instructions || it.dosageInstructions || "",
            unitPrice: Number(it.unitPrice) || 0,
          }));
        } else if (data.section === "INJECTABLE") {
          visit.prescriptionData.injectables = items.map((it: any) => ({
            id: it.id,
            name: it.name,
            itemCode: it.itemCode,
            dose: Number(it.dose) || 1,
            doseUnit: it.unit || "ml",
            route: it.route || "SC",
            quantity: Number(it.quantity) || 1,
            dateTimeAdministered:
              it.dateTimeAdministered || new Date().toISOString(),
            instructions: it.instructions || it.dosageInstructions || "",
            unitPrice: Number(it.unitPrice) || 0,
          }));
        } else if (data.section === "ANIMAL_FOOD") {
          visit.prescriptionData.animalFood = items.map((it: any) => ({
            id: it.id,
            name: it.name,
            itemCode: it.itemCode,
            quantity: Number(it.quantity) || 1,
            unit: it.unit || "Kg",
            frequency: "Daily",
            instructions: it.instructions || "",
            unitPrice: Number(it.unitPrice) || 0,
          }));
        } else if (data.section === "PRESCRIBED_FOOD") {
          visit.prescriptionData.prescribedFood = items.map((it: any) => ({
            id: it.id,
            name: it.name,
            quantity: Number(it.quantity) || 1,
            unit: it.unit || "Kg",
            frequency: "Daily",
            instructions: it.instructions || "",
            duration: it.duration || "14 days",
          }));
        } else if (data.section === "ACCESSORY") {
          visit.prescriptionData.accessories = items.map((it: any) => ({
            id: it.id,
            name: it.name,
            itemCode: it.itemCode,
            quantity: Number(it.quantity) || 1,
            unitPrice: Number(it.unitPrice) || 0,
          }));
        }

        // 4. Billing Sync: Replace-set for this section's lines (§1.3, §5.3)
        visit.items = (visit.items || []).filter(
          (l: any) =>
            !(l.sourceType === "RX_ITEM" && l.rxSection === data.section)
        );

        for (const it of items) {
          const qty = Number(it.quantity) || 1;
          const price = Number(it.unitPrice) || 0;
          const disc = Number(it.discountPercent) || 0;
          const defaultGst =
            data.section === "ANIMAL_FOOD" ||
            data.section === "PRESCRIBED_FOOD" ||
            data.section === "ACCESSORY"
              ? 18
              : 12;
          const gst = Number(it.gstRate) || (visit.billType === "GST" ? defaultGst : 0);

          const lineCalc = calcLineItem({
            quantity: qty,
            unitPrice: price,
            discountType: disc > 0 ? "percentage" : undefined,
            discountValue: disc,
            gstRate: gst,
            applyGst: visit.billType === "GST",
          });

          const isVaccine =
            it.name?.toLowerCase().includes("vaccine") ||
            it.lineType === "Vaccine";
          const lineType =
            data.section === "ANIMAL_FOOD" || data.section === "PRESCRIBED_FOOD"
              ? "Food"
              : data.section === "ACCESSORY"
              ? "Accessory"
              : isVaccine
              ? "Vaccine"
              : "Pharmacy";

          visit.items.push({
            id: it.id,
            lineType,
            itemCode: it.itemCode,
            batchNo: it.batchNo,
            name: it.name,
            dosageInstructions: it.dosage || it.instructions || it.dosageInstructions,
            quantity: qty,
            unitPrice: price,
            discountPercent: disc,
            discountType: disc > 0 ? "percentage" : undefined,
            discountValue: disc,
            discountAmount: lineCalc.discountAmount,
            taxableAmount: lineCalc.taxableAmount,
            gstRate: gst,
            lineTotal: lineCalc.lineTotal,
            sourceType: "RX_ITEM",
            sourceId: it.id,
            rxSection: data.section,
          });
        }
        break;
      }

      case "FOLLOWUP": {
        const required = Boolean(data.payload?.required);
        const entries = data.payload?.entries || {};
        const bloodTests = Array.isArray(data.payload?.bloodTests)
          ? data.payload.bloodTests
          : [];

        visit.prescriptionData.followupRequired = required;
        visit.prescriptionData.followUpEntries = entries;
        visit.prescriptionData.bloodTests = bloodTests;
        visit.prescriptionData.followUp = {
          required,
          nextTreatmentDate: entries.TREATMENT?.dueDate || undefined,
          nextVaccineDate: entries.VACCINE?.dueDate || undefined,
          nextDewormingDate: entries.DEWORMING?.dueDate || undefined,
        };

        if (entries.TREATMENT?.dueDate) {
          visit.nextVisitDate = entries.TREATMENT.dueDate;
        }
        if (entries.VACCINE?.dueDate) {
          visit.nextVaccineDate = entries.VACCINE.dueDate;
        }
        if (entries.DEWORMING?.dueDate) {
          visit.nextDewormingDate = entries.DEWORMING.dueDate;
        }

        // Laboratory Sync (§5.5, Phase 9)
        const currentTestIds = new Set(bloodTests.map((t: any) => t.id));
        const existingLabOrders = await ErpRow.find({
          moduleId: "lab_orders",
          "data.sourceType": "RX_FOLLOWUP_TEST",
          "data.visitId": visit.visitId,
        });

        // Check for removed tests that cannot be cancelled
        for (const ord of existingLabOrders) {
          const ordData = (ord.data || {}) as Record<string, any>;
          const ordId = ordData["sourceId"];
          if (!currentTestIds.has(ordId) || !required) {
            if (
              ordData["status"] === "Sample Collected" ||
              ordData["status"] === "Processing" ||
              ordData["status"] === "Completed"
            ) {
              throw new Error(
                `Cannot remove lab test "${ordData["testName"]}": sample is already collected in the Laboratory. Please manage or cancel it from the Laboratory section.`
              );
            }
            // If status is Ordered, cancel it
            if (ordData["status"] === "Ordered") {
              ordData["status"] = "Cancelled";
              ordData["cancelReason"] = "Removed from Doctor Prescription";
              ord.markModified("data");
              await ord.save();
            }
          }
        }

        // Upsert active blood tests into Lab Orders
        if (required && bloodTests.length > 0) {
          for (const t of bloodTests) {
            const existing = existingLabOrders.find(
              (o: any) => o.data?.sourceId === t.id && o.data?.status !== "Cancelled"
            );
            if (!existing) {
              const labSeq = await nextSeq("lab_order", "LAB", 4);
              await ErpRow.create({
                moduleId: "lab_orders",
                data: {
                  orderId: labSeq,
                  pet: visit.petName,
                  petId: visit.petId,
                  species: visit.species,
                  breed: visit.breed,
                  owner: visit.ownerName,
                  phone: visit.ownerPhone,
                  testName: t.testName || t.name,
                  profile: "Biochemistry & Hematology",
                  sampleType: "Whole Blood EDTA",
                  barcode: `BC-${Math.floor(1000 + Math.random() * 9000)}`,
                  tat: "2 hours",
                  priority: "Routine",
                  doctor: visit.doctorName || "Dr. Rohit Sharma",
                  date:
                    entries.BLOOD_TEST?.dueDate ||
                    visit.date ||
                    new Date().toISOString().slice(0, 10),
                  time: new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                  status: "Ordered",
                  isAbnormal: false,
                  parameters: [],
                  sourceType: "RX_FOLLOWUP_TEST",
                  sourceId: t.id,
                  visitId: visit.visitId,
                },
              });
            } else if (((existing.data || {}) as Record<string, any>)["status"] === "Ordered") {
              const exData = (existing.data || {}) as Record<string, any>;
              exData["testName"] = t.testName || t.name;
              exData["date"] =
                entries["BLOOD_TEST"]?.dueDate || exData["date"];
              existing.markModified("data");
              await existing.save();
            }
          }
        }
        break;
      }

      case "LABORATORY": {
        const enabled = Boolean(data.payload?.enabled);
        const dueDate = String(data.payload?.dueDate || "").trim();
        const bloodTests = Array.isArray(data.payload?.bloodTests)
          ? data.payload.bloodTests
          : [];

        visit.prescriptionData.laboratoryRequired = enabled;
        visit.prescriptionData.bloodTests = bloodTests;
        if (visit.prescriptionData.followUpEntries) {
          visit.prescriptionData.followUpEntries["BLOOD_TEST"] = {
            enabled,
            dueDate: dueDate || undefined,
          };
        }

        // Laboratory Sync (§5.5, Phase 9)
        const currentTestIds = new Set(bloodTests.map((t: any) => t.id));
        const existingLabOrders = await ErpRow.find({
          moduleId: "lab_orders",
          "data.sourceType": "RX_FOLLOWUP_TEST",
          "data.visitId": visit.visitId,
        });

        // Check for removed tests that cannot be cancelled
        for (const ord of existingLabOrders) {
          const ordData = (ord.data || {}) as Record<string, any>;
          const ordId = ordData["sourceId"];
          if (!currentTestIds.has(ordId) || !enabled) {
            if (
              ordData["status"] === "Sample Collected" ||
              ordData["status"] === "Processing" ||
              ordData["status"] === "Completed"
            ) {
              throw new Error(
                `Cannot remove lab test "${ordData["testName"]}": sample is already collected in the Laboratory. Please manage or cancel it from the Laboratory section.`
              );
            }
            // If status is Ordered, cancel it
            if (ordData["status"] === "Ordered") {
              ordData["status"] = "Cancelled";
              ordData["cancelReason"] = "Removed from Doctor Prescription";
              ord.markModified("data");
              await ord.save();
            }
          }
        }

        // Upsert active blood tests into Lab Orders
        if (enabled && bloodTests.length > 0) {
          for (const t of bloodTests) {
            const existing = existingLabOrders.find(
              (o: any) => o.data?.sourceId === t.id && o.data?.status !== "Cancelled"
            );
            if (!existing) {
              const labSeq = await nextSeq("lab_order", "LAB", 4);
              await ErpRow.create({
                moduleId: "lab_orders",
                data: {
                  orderId: labSeq,
                  pet: visit.petName,
                  petId: visit.petId,
                  species: visit.species,
                  breed: visit.breed,
                  owner: visit.ownerName,
                  phone: visit.ownerPhone,
                  testName: t.testName || t.name,
                  profile: "Biochemistry & Hematology",
                  sampleType: "Whole Blood EDTA",
                  barcode: `BC-${Math.floor(1000 + Math.random() * 9000)}`,
                  tat: "2 hours",
                  priority: "Routine",
                  doctor: visit.doctorName || "Dr. Rohit Sharma",
                  date:
                    dueDate ||
                    visit.date ||
                    new Date().toISOString().slice(0, 10),
                  time: new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                  status: "Ordered",
                  isAbnormal: false,
                  parameters: [],
                  sourceType: "RX_FOLLOWUP_TEST",
                  sourceId: t.id,
                  visitId: visit.visitId,
                },
              });
            } else if (((existing.data || {}) as Record<string, any>)["status"] === "Ordered") {
              const exData = (existing.data || {}) as Record<string, any>;
              exData["testName"] = t.testName || t.name;
              exData["date"] = dueDate || exData["date"];
              existing.markModified("data");
              await existing.save();
            }
          }
        }
        break;
      }
    }

    // 5. Authoritative Bill Recalculation (§1.7, §5.3)
    const billSummary = calcBillSummary(
      (visit.items || []).map((l: any) => ({
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountType: l.discountType || "percentage",
        discountValue: l.discountValue ?? l.discountPercent ?? 0,
        gstRate: l.gstRate || 0,
      })),
      visit.billType === "GST"
    );

    visit.subtotal = billSummary.subtotal;
    visit.taxableAmount = billSummary.subtotal;
    visit.gstAmount = billSummary.totalGst;
    visit.roundOff = billSummary.roundOff;
    visit.totalAmount = billSummary.roundedTotal;
    visit.balanceDue = Math.max(
      0,
      roundMoney(billSummary.roundedTotal - (visit.amountPaid || 0))
    );

    // 6. Bump Optimistic Version & Timestamp
    const nextVersion = Math.max(currentVersion, typeof data.version === "number" ? data.version : 0) + 1;
    visit.prescriptionData.version = nextVersion;
    if (!visit.prescriptionData.sectionSavedAt) {
      visit.prescriptionData.sectionSavedAt = {};
    }
    visit.prescriptionData.sectionSavedAt[data.section] = new Date().toISOString();

    visit.markModified("prescriptionData");
    visit.markModified("items");
    if (visit.vitals) visit.markModified("vitals");

    await visit.save();

    return {
      success: true,
      visit: toPlain<any>(visit.toObject ? visit.toObject() : visit),
      version: nextVersion,
      sectionSavedAt: visit.prescriptionData.sectionSavedAt,
      billingSummary: {
        subtotal: visit.subtotal,
        gstAmount: visit.gstAmount,
        roundOff: visit.roundOff,
        totalAmount: visit.totalAmount,
        balanceDue: visit.balanceDue,
        lineCount: visit.items.length,
      },
    };
  });

export const getPrescriptionBillingSummaryFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => z.object({ visitId: z.string().min(1) }).parse(raw))
  .handler(async ({ data }: { data: { visitId: string } }) => {
    await connectDB();
    const visit = await ClinicalVisit.findOne({ visitId: data.visitId }).lean();
    if (!visit) {
      throw new Error(`Visit ${data.visitId} not found`);
    }
    return {
      subtotal: visit.subtotal || 0,
      gstAmount: visit.gstAmount || 0,
      roundOff: visit.roundOff || 0,
      totalAmount: visit.totalAmount || 0,
      balanceDue: visit.balanceDue || 0,
      lineCount: (visit.items || []).length,
      lines: toPlain<any[]>(visit.items || []),
      version: (visit as any).prescriptionData?.version || 1,
      sectionSavedAt: (visit as any).prescriptionData?.sectionSavedAt || {},
    };
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


    // Bill edit protection (§3.3)
    if (visit.amountPaid && data.totalAmount < visit.amountPaid) {
      throw new Error(
        `Cannot reduce bill total (₹${data.totalAmount}) below already paid amount (₹${visit.amountPaid}). Please process refund or reconciliation first.`
      );
    }

    const pendingAmount = Math.max(0, data.totalAmount - data.amountPaid);
    const paymentStatus: "Full" | "Partial" | "Unpaid" =
      data.amountPaid === data.totalAmount
        ? "Full"
        : data.amountPaid > 0
        ? "Partial"
        : "Unpaid";

    const balanceDue = pendingAmount;
    const status = balanceDue === 0 ? "Paid" : "Billed";

    const paymentId = `PAY-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const paymentRecord = {
      id: paymentId,
      paymentId,
      mode: data.paymentMode,
      amount: data.amountPaid,
      trxRef: data.trxRef || undefined,
      timestamp: new Date().toISOString(),
      recordedBy: data.recordedBy || data.doctorName || "Cashier",
      notes: data.notes || undefined,
    };

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

    // 2. FEFO Inventory Deduction & Ledger Recording (ONLY if not already deducted!)
    if (!visit.inventoryDeducted) {
      for (const item of data.items) {
        if (item.itemCode || item.lineType === "Pharmacy" || item.lineType === "Vaccine" || item.lineType === "Food" || item.lineType === "Accessory") {

        try {
          const filter: any = { qty: { $gt: 0 } };
          if (item.batchNo) filter.batchNo = item.batchNo;
          if (item.itemCode) filter.itemCode = item.itemCode;
          else filter.itemName = item.name;

          let batch = await StockBatch.findOne(filter).sort({ expiryDate: 1 });
          if (!batch && item.itemCode) {
            batch = await StockBatch.findOne({ itemCode: item.itemCode });
          }

          const remainingQty = batch ? Math.max(0, batch.qty - item.quantity) : 0;
          if (batch) {
            batch.qty = remainingQty;
            await batch.save();
          }

          // Create inventory ledger entry so the inventory usage history accurately reflects this OPD consumption
          await ErpRow.create({
            moduleId: "inventory_ledger",
            data: {
              id: await nextSeq("ledger_entry", "L", 4),
              medicineId: item.itemCode || batch?.itemCode || "M-ITEM",
              medicineName: item.name,
              batchId: batch?.batchCode || "B-GENERAL",
              batchNo: batch?.batchNo || item.batchNo || "OPD-RX",
              movementType: "sale_out",
              quantity: item.quantity,
              sourceType: "invoice",
              sourceRef: visit.invoiceNo || visit.visitId,
              balanceAfter: remainingQty,
              actorName: data.doctorName || "Dr. Rohit Sharma",
              createdAt: new Date().toISOString().replace("T", " ").slice(0, 16),
              reason: `Clinical OPD Prescribed Usage for ${visit.petName} (${visit.petId || "Patient"})`,
            },
          });

          // If food item, record in FoodPurchase history
          const isFood =
            item.name.toLowerCase().includes("food") ||
            item.name.toLowerCase().includes("canin") ||
            item.name.toLowerCase().includes("pedigree") ||
            item.name.toLowerCase().includes("diet") ||
            item.name.toLowerCase().includes("feed");

          if (isFood) {
            const fpId = await nextSeq("food_purchase", "FP", 4);
            await FoodPurchase.create({
              purchaseId: fpId,
              patientId: visit.petId || "PET-0001",
              visitId: visit.visitId,
              itemId: item.itemCode || item.name,
              quantity: item.quantity,
              purchaseDate: visit.date || new Date().toISOString().slice(0, 10),
              estimatedRunoutDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            });
          }
        } catch (e) {
          console.warn("[Inventory FEFO] Could not deduct batch or record ledger for item:", item.name, e);
        }
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
    if (data.prescriptionData !== undefined) {
      visit.prescriptionData = data.prescriptionData;
    }
    if (data.vitals) {
      const wUnit = data.vitals.weightUnit || "kg";
      const tUnit = data.vitals.tempUnit || "°C";
      const wVal = data.vitals.weight ?? data.vitals.weightKg;
      const tVal = data.vitals.temp ?? data.vitals.tempC;
      const wKg = wVal !== undefined ? (wUnit === "lb" ? +(wVal * 0.453592).toFixed(2) : wVal) : visit.vitals?.weightKg;
      const tC = tVal !== undefined ? (tUnit === "°F" ? +((tVal - 32) * 5 / 9).toFixed(1) : tVal) : visit.vitals?.tempC;

      visit.vitals = {
        ...visit.vitals,
        weightKg: wKg,
        tempC: tC,
        complaint: data.vitals.complaint ?? visit.vitals?.complaint,
        weight: wVal,
        weightUnit: wUnit,
        temp: tVal,
        tempUnit: tUnit,
      };
    }
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
    visit.pendingAmount = pendingAmount;
    visit.paymentStatus = paymentStatus;
    
    if (data.amountPaid > 0) {
      const existingPayments = visit.payments || [];
      const sumExisting = existingPayments.reduce((s: number, p: any) => s + (p.amount || 0), 0);
      if (sumExisting < data.amountPaid) {
        const delta = Math.round((data.amountPaid - sumExisting) * 100) / 100;
        visit.payments = [
          ...existingPayments,
          {
            ...paymentRecord,
            amount: delta,
          } as any,
        ];
      } else if (existingPayments.length === 0) {
        visit.payments = [paymentRecord] as any;
      }
    }

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
          narrative: `Chief Complaint: ${visit.vitals?.complaint || "Clinical Consultation"}\n\nClinical Findings: ${visit.diagnosis || "Examination completed"}\n\nNotes & Advice: ${visit.clinicalNotes || "As prescribed."}\n\nPrescription (${visit.prescriptionNo}):\n${(data.items || []).map((it: any) => `• ${it.name} (Qty: ${it.quantity}) - ${it.dosageInstructions || "As advised"}`).join("\n")}`,
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
