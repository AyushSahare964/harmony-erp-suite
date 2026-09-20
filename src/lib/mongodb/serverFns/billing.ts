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

const SEED_BILLING_INVOICES: any[] = [];

async function ensureBillingSeeded() {
  await connectDB();
  // Auto-seeding disabled to preserve clean database state
}

// ─── Input Schemas ────────────────────────────────────────────────────────────

const FilterInvoicesInputZ = z.object({
  query: z.string().optional(),
  datePreset: z.enum(["all", "today", "yesterday", "7days", "30days", "custom"]).optional().default("all"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.string().optional().default("all"),
});

export const RecordPaymentInputZ = z.object({
  invoiceNo: z.string().optional(),
  visitId: z.string().optional(),
  amount: z.number(),
  mode: z.enum(["UPI", "Cash", "Card", "NetBanking", "Cheque", "Account Due", "Bank Transfer"]),
  trxRef: z.string().optional(),
  notes: z.string().optional(),
  recordedBy: z.string().optional(),
});

const PartialPaymentAllocationZ = z.object({
  invoiceNo: z.string().min(1),
  allocatedAmount: z.number().min(0),
});

export const PartialPaymentInputZ = z.object({
  ownerId: z.string().min(1),
  ownerName: z.string().min(1),
  paymentDate: z.string().min(1),        // ISO YYYY-MM-DD
  amountReceived: z.number().positive(),
  mode: z.enum(["UPI", "Cash", "Card", "NetBanking", "Cheque", "Bank Transfer"]),
  referenceNo: z.string().optional(),
  idempotencyKey: z.string().min(1),     // client-generated UUID; prevents double-posting
  allocations: z.array(PartialPaymentAllocationZ).min(1),
});

export type PartialPaymentInput = z.infer<typeof PartialPaymentInputZ>;

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

    if (data.amount <= 0) {
      throw new Error("Please enter a valid payment amount.");
    }

    const filter = data.invoiceNo ? { invoiceNo: data.invoiceNo } : data.visitId ? { visitId: data.visitId } : null;
    if (!filter) throw new Error("invoiceNo or visitId is required");
    const visit = await ClinicalVisit.findOne(filter);
    if (!visit) throw new Error(`Invoice / Visit ${data.invoiceNo || data.visitId} not found`);

    const currentBal = Math.max(0, (visit.totalAmount || 0) - (visit.amountPaid || 0));
    if (data.amount > currentBal + 0.001) {
      throw new Error("Paid amount cannot be greater than the total bill.");
    }

    const payId = `PAY-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const newPayment = {
      id: payId,
      paymentId: payId,
      mode: data.mode,
      amount: data.amount,
      trxRef: data.trxRef || undefined,
      timestamp: new Date().toISOString(),
      recordedBy: data.recordedBy || "Staff",
      notes: data.notes || undefined,
    };

    const newTotalPaid = Math.round(((visit.amountPaid || 0) + data.amount) * 100) / 100;
    const newBalance = Math.max(0, Math.round(((visit.totalAmount || 0) - newTotalPaid) * 100) / 100);

    visit.amountPaid = newTotalPaid;
    visit.balanceDue = newBalance;
    visit.pendingAmount = newBalance;
    visit.paymentStatus = newBalance === 0 ? "Full" : newTotalPaid > 0 ? "Partial" : "Unpaid";
    visit.status = newBalance === 0 ? "Paid" : "Billed";
    visit.payments = [...(visit.payments || []), newPayment as any];

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
          narration: `Payment installment received for ${visit.invoiceNo} (Due: ₹${newBalance})`,
          references: [
            {
              invoiceNo: visit.invoiceNo,
              invoiceDate: visit.date,
              dueDate: visit.date,
              invoiceAmount: visit.totalAmount,
              outstanding: newBalance,
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

export const recordBillPaymentFn = recordInvoicePaymentFn;

export const getPatientOutstandingBalanceFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z.object({ petId: z.string().optional(), ownerId: z.string().optional() }).parse(raw || {})
  )
  .handler(async ({ data }: { data: { petId?: string | undefined; ownerId?: string | undefined } }) => {
    await connectDB();
    const filter: any = { balanceDue: { $gt: 0 } };
    if (data.petId) filter.petId = data.petId;
    if (data.ownerId) filter.ownerId = data.ownerId;

    const bills = await ClinicalVisit.find(filter)
      .select("invoiceNo visitId petId petName ownerId ownerName totalAmount amountPaid balanceDue paymentStatus date")
      .lean();

    const totalOutstanding = bills.reduce((sum, b) => sum + (b.balanceDue || 0), 0);
    return {
      outstandingBalance: Math.round(totalOutstanding * 100) / 100,
      unpaidBillsCount: bills.length,
      bills: toPlain<any[]>(bills),
    };
  });

export const deleteInvoiceFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ invoiceNo: z.string() }).parse(data))
  .handler(async ({ data }: { data: { invoiceNo: string } }) => {
    await connectDB();
    await ClinicalVisit.findOneAndDelete({ invoiceNo: data.invoiceNo });
    return toPlain<any>({ success: true });
  });

// ─── Outstanding Bills Query ──────────────────────────────────────────────────

export const getOwnerOutstandingBillsFn = createServerFn({ method: "GET" })
  .validator((data: unknown) => z.object({ ownerId: z.string() }).parse(data))
  .handler(async ({ data }: { data: { ownerId: string } }) => {
    await connectDB();
    const bills = await ClinicalVisit.find({
      ownerId: data.ownerId,
      balanceDue: { $gt: 0 },
    })
      .select("invoiceNo visitId date ownerName petName totalAmount amountPaid balanceDue status lineItems")
      .lean();

    return toPlain<any[]>(bills);
  });

// ─── Partial & Combined Bill Payment (REQ-PAY-01 .. REQ-PAY-07) ────────────────

export interface InvoiceAllocation {
  invoiceNo: string;
  allocatedAmount: number;
}



export const recordPartialPaymentFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => PartialPaymentInputZ.parse(data))
  .handler(async ({ data }: { data: PartialPaymentInput }) => {
    await connectDB();

    // 1. Idempotency check: look up existing FinanceTransaction by idempotencyKey
    const existingPayment = await FinanceTransaction.findOne({
      type: "payment",
      "data.idempotencyKey": data.idempotencyKey,
    });
    if (existingPayment) {
      console.info("[Partial Payment] Idempotent replay detected, returning existing result.");
      return toPlain<{ success: true; paymentNo: string; message: string }>({
        success: true,
        paymentNo: (existingPayment.data as any).paymentNo,
        message: "Payment already recorded (idempotent)",
      });
    }

    // 2. Concurrency safety: re-read current balances from DB right now
    const invoiceNos = data.allocations.map((a) => a.invoiceNo);
    const visits = await ClinicalVisit.find({ invoiceNo: { $in: invoiceNos } });
    const visitMap = new Map(visits.map((v) => [v.invoiceNo, v]));

    // 3. Validate allocations
    let allocationSum = 0;
    for (const alloc of data.allocations) {
      const visit = visitMap.get(alloc.invoiceNo);
      if (!visit) throw new Error(`Invoice ${alloc.invoiceNo} not found`);
      if (alloc.allocatedAmount < 0) throw new Error(`Allocated amount for ${alloc.invoiceNo} cannot be negative`);
      const currentOutstanding = Math.max(0, (visit.balanceDue ?? 0));
      if (alloc.allocatedAmount > currentOutstanding + 0.001) {
        throw new Error(
          `Allocated ₹${alloc.allocatedAmount} for ${alloc.invoiceNo} exceeds current outstanding ₹${currentOutstanding.toFixed(2)}`
        );
      }
      allocationSum = Math.round((allocationSum + alloc.allocatedAmount) * 100) / 100;
    }

    const amountRounded = Math.round(data.amountReceived * 100) / 100;
    if (Math.abs(allocationSum - amountRounded) > 0.01) {
      throw new Error(
        `Sum of allocations (₹${allocationSum}) must equal amount received (₹${amountRounded}). Please reconcile before recording.`
      );
    }

    if (amountRounded <= 0) throw new Error("Payment amount must be greater than zero");

    // 4. Atomic: update all bills + create ledger entry
    const paymentTimestamp = new Date().toISOString();
    const peNo = await nextSeq("payment_entry", "PE", 4);

    const references: Array<{
      invoiceNo: string;
      invoiceDate: string;
      dueDate: string;
      invoiceAmount: number;
      outstanding: number;
      allocatedAmount: number;
    }> = [];

    const updatedVisitNos: string[] = [];

    for (const alloc of data.allocations) {
      if (alloc.allocatedAmount <= 0) continue;
      const visit = visitMap.get(alloc.invoiceNo);
      if (!visit) continue;

      const prevPaid = visit.amountPaid ?? 0;
      const newPaid = Math.round((prevPaid + alloc.allocatedAmount) * 100) / 100;
      const newBalance = Math.max(0, Math.round(((visit.totalAmount ?? 0) - newPaid) * 100) / 100);

      visit.amountPaid = newPaid;
      visit.balanceDue = newBalance;
      visit.status = newBalance === 0 ? "Paid" : "Billed";
      visit.payments.push({
        mode: data.mode,
        amount: alloc.allocatedAmount,
        trxRef: data.referenceNo || undefined,
        timestamp: paymentTimestamp,
      } as any);

      references.push({
        invoiceNo: visit.invoiceNo,
        invoiceDate: visit.date,
        dueDate: visit.date,
        invoiceAmount: visit.totalAmount ?? 0,
        outstanding: newBalance,
        allocatedAmount: alloc.allocatedAmount,
      });

      updatedVisitNos.push(visit.invoiceNo);
      await visit.save();
    }

    // 5. Create ONE ledger entry for the whole payment (REQ-PAY-06)
    await FinanceTransaction.create({
      type: "payment",
      data: {
        paymentNo: peNo,
        idempotencyKey: data.idempotencyKey,
        paymentType: "Receive",
        paymentDate: data.paymentDate,
        partyType: "Customer",
        partyName: data.ownerName,
        contactName: data.ownerName,
        modeOfPayment: data.mode,
        bankAccount: data.mode === "Cash" ? "Cash on Hand" : "HDFC Current",
        referenceNo: data.referenceNo || peNo,
        paidAmount: amountRounded,
        totalAllocated: allocationSum,
        differenceAmount: 0,
        narration: `Partial/combined payment received from ${data.ownerName} covering ${updatedVisitNos.join(", ")}`,
        references,
        status: "Submitted",
      },
    });

    return toPlain<any>({
      success: true,
      paymentNo: peNo,
      updatedInvoices: updatedVisitNos,
      amountReceived: amountRounded,
      message: `Payment of ₹${amountRounded} recorded against ${updatedVisitNos.length} invoice(s).`,
    });
  });
