/**
 * Payments — money in and money out, split tenders, bill-wise allocation,
 * advances and cheque clearing.
 *
 * Implements plan §6 in full. Every rule is enforced here, server-side; the
 * UI's copy of the rules is a convenience for the biller, never the authority.
 *
 * There is no such thing as a negative payment. A refund is a credit note plus
 * a Payment OUT allocated against it, which is what keeps GSTR-1 CDNR correct.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { withTransaction, sessionOpt } from "@/lib/mongodb/txn";
import { docPayload, docPayloads } from "@/lib/mongodb/docPayload";
import {
  PaymentDocModel,
  validatePaymentShape,
  defaultClearingStatus,
  MODES_NEEDING_CLEARING,
  PAY_MODES,
  type PayMode,
} from "@/lib/mongodb/models/PaymentDoc";
import { SalesDocModel, derivePaymentStatus } from "@/lib/mongodb/models/SalesDoc";
import { PurchaseBill } from "@/lib/mongodb/models/PurchaseBill";
import { PartyLedgerModel } from "@/lib/mongodb/models/PartyLedger";
import { PartyModel } from "@/lib/mongodb/models/Party";
import { AuditLogModel } from "@/lib/mongodb/models/AuditLog";
import { ReminderModel } from "@/lib/mongodb/models/Reminder";
import { ClinicalVisit } from "@/lib/mongodb/models/ClinicalVisit";
import { allocateDocNumber } from "./counters";
import { bumpDailySummary } from "./salesDocs";
import { roundMoney } from "@/lib/utils/moneyUtils";
import { todayIST, formatDisplayDate } from "@/lib/utils/dateUtils";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const SplitZ = z.object({
  payMode: z.enum(PAY_MODES as [PayMode, ...PayMode[]]),
  amount: z.number().positive(),
  referenceNo: z.string().optional(),
  bankName: z.string().optional(),
  instrumentDate: z.string().optional(),
});

const AllocationZ = z.object({
  docKind: z.enum(["SALE", "PURCHASE"]).default("SALE"),
  docId: z.string().min(1),
  docNumber: z.string().optional(),
  amount: z.number().min(0),
});

const CreatePaymentZ = z.object({
  direction: z.enum(["IN", "OUT"]).default("IN"),
  docDate: z.string().min(1),
  branchId: z.string().default("MAIN"),
  partyId: z.string().optional(),
  partyName: z.string().default(""),
  splits: z.array(SplitZ).min(1, "Add at least one payment mode"),
  allocations: z.array(AllocationZ).default([]),
  idempotencyKey: z.string().optional(),
  narration: z.string().optional(),
  createdBy: z.string().optional(),
  createdByName: z.string().optional(),
});

export type CreatePaymentInput = z.infer<typeof CreatePaymentZ>;

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface PaymentSplitRow {
  payMode: string;
  amount: number;
  referenceNo: string;
  bankName: string;
  instrumentDate: string;
  clearingStatus: string;
}

export interface PaymentAllocationRow {
  docKind: string;
  docId: string;
  docNumber: string;
  amount: number;
}

export interface PaymentRow {
  _id: string;
  docNumber: string;
  docDate: string;
  direction: string;
  partyId: string;
  partyName: string;
  totalAmount: number;
  allocatedAmount: number;
  unallocatedAmount: number;
  splits: PaymentSplitRow[];
  allocations: PaymentAllocationRow[];
  narration: string;
  status: string;
  modesLabel: string;
  hasPending: boolean;
  createdAt: string;
}

function toRow(d: Record<string, unknown>): PaymentRow {
  const splits = ((d["splits"] as PaymentSplitRow[]) ?? []).map((s) => ({
    payMode: String(s.payMode ?? ""),
    amount: Number(s.amount ?? 0),
    referenceNo: String(s.referenceNo ?? ""),
    bankName: String(s.bankName ?? ""),
    instrumentDate: String(s.instrumentDate ?? ""),
    clearingStatus: String(s.clearingStatus ?? "CLEARED"),
  }));
  return {
    _id: String(d["_id"] ?? ""),
    docNumber: String(d["docNumber"] ?? ""),
    docDate: String(d["docDate"] ?? ""),
    direction: String(d["direction"] ?? "IN"),
    partyId: String(d["partyId"] ?? ""),
    partyName: String(d["partyName"] ?? ""),
    totalAmount: Number(d["totalAmount"] ?? 0),
    allocatedAmount: Number(d["allocatedAmount"] ?? 0),
    unallocatedAmount: Number(d["unallocatedAmount"] ?? 0),
    splits,
    allocations: ((d["allocations"] as PaymentAllocationRow[]) ?? []).map((a) => ({
      docKind: String(a.docKind ?? "SALE"),
      docId: String(a.docId ?? ""),
      docNumber: String(a.docNumber ?? ""),
      amount: Number(a.amount ?? 0),
    })),
    narration: String(d["narration"] ?? ""),
    status: String(d["status"] ?? "POSTED"),
    modesLabel: splits.map((s) => s.payMode).join(" + "),
    hasPending: splits.some((s) => s.clearingStatus === "PENDING"),
    createdAt: d["createdAt"] ? new Date(d["createdAt"] as string).toISOString() : "",
  };
}

// ─── Auto-allocation (oldest first) ───────────────────────────────────────────

export interface AllocationSuggestion {
  docKind: "SALE" | "PURCHASE";
  docId: string;
  docNumber: string;
  docDate: string;
  grandTotal: number;
  balanceDue: number;
  amount: number;
}

export const autoAllocateFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z
      .object({
        partyId: z.string().min(1),
        amount: z.number().min(0),
        direction: z.enum(["IN", "OUT"]).default("IN"),
      })
      .parse(raw),
  )
  .handler(async ({ data }): Promise<AllocationSuggestion[]> => {
    await connectDB();
    return proposeAllocations(data.partyId, data.amount, data.direction);
  });

/**
 * Oldest bill first — the default every accountant expects, because it is what
 * keeps the ageing buckets meaningful. The biller can still override any row.
 */
export async function proposeAllocations(
  partyId: string,
  amount: number,
  direction: "IN" | "OUT",
): Promise<AllocationSuggestion[]> {
  let remaining = roundMoney(amount);
  const out: AllocationSuggestion[] = [];

  if (direction === "IN") {
    const bills = await SalesDocModel.find({
      partyId,
      docType: "INVOICE",
      status: "POSTED",
      balanceDue: { $gt: 0 },
    })
      .sort({ docDate: 1, docNumber: 1 })
      .lean();

    for (const b of bills) {
      const due = roundMoney(Number(b.balanceDue ?? 0));
      const take = Math.min(due, Math.max(0, remaining));
      remaining = roundMoney(remaining - take);
      out.push({
        docKind: "SALE",
        docId: String(b._id),
        docNumber: String(b.docNumber ?? ""),
        docDate: String(b.docDate ?? ""),
        grandTotal: Number(b.grandTotal ?? 0),
        balanceDue: due,
        amount: take,
      });
      if (remaining <= 0) break;
    }
    return out;
  }

  const party = await PartyModel.findOne({ partyId }).lean();
  const supplierId = String(party?.supplierRefId ?? "");
  if (!supplierId) return out;

  const bills = await PurchaseBill.find({
    supplierId,
    status: { $in: ["UNPAID", "PARTIAL"] },
  })
    .sort({ billDate: 1 })
    .lean();

  for (const b of bills) {
    const due = roundMoney(Number(b.grandTotal ?? 0) - Number(b.amountPaid ?? 0));
    if (due <= 0) continue;
    const take = Math.min(due, Math.max(0, remaining));
    remaining = roundMoney(remaining - take);
    out.push({
      docKind: "PURCHASE",
      docId: String(b._id),
      docNumber: String(b.internalRef ?? ""),
      docDate: String(b.billDate ?? ""),
      grandTotal: Number(b.grandTotal ?? 0),
      balanceDue: due,
      amount: take,
    });
    if (remaining <= 0) break;
  }
  return out;
}

// ─── Create ───────────────────────────────────────────────────────────────────

export const createPaymentFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => CreatePaymentZ.parse(raw))
  .handler(async ({ data }): Promise<PaymentRow> => {
    await connectDB();

    // ── Idempotency: a retried request returns the original receipt ──
    if (data.idempotencyKey) {
      const prior = await PaymentDocModel.findOne({
        idempotencyKey: data.idempotencyKey,
      }).lean();
      if (prior) return toRow(prior as unknown as Record<string, unknown>);
    }

    const totalAmount = roundMoney(data.splits.reduce((s, x) => s + x.amount, 0));

    // ── §6.1 / §6.2 shape rules ──
    const shapeErrors = validatePaymentShape({
      totalAmount,
      splits: data.splits.map((s) => ({
        payMode: s.payMode,
        amount: s.amount,
        ...(s.referenceNo !== undefined ? { referenceNo: s.referenceNo } : {}),
      })),
      allocations: data.allocations.map((a) => ({ amount: a.amount })),
    });
    if (shapeErrors.length) throw new Error(shapeErrors.join(" "));

    // ── §6.10 timing rules ──
    const today = todayIST();
    if (data.docDate > today) {
      throw new Error("A payment cannot be dated in the future.");
    }

    // ── §6.3 per-document allocation validation ──
    const allocations = data.allocations.filter((a) => a.amount > 0);
    const resolved: Array<{
      docKind: "SALE" | "PURCHASE";
      docId: string;
      docNumber: string;
      amount: number;
      docDate: string;
    }> = [];

    for (const a of allocations) {
      if (a.docKind === "SALE") {
        const bill = await SalesDocModel.findById(a.docId).lean();
        if (!bill) throw new Error(`Invoice ${a.docNumber || a.docId} not found.`);
        if (bill.status !== "POSTED") {
          throw new Error(
            `${bill.docNumber || "That invoice"} is ${bill.status}; a payment cannot be applied to it.`,
          );
        }
        if (String(bill.docDate) > data.docDate) {
          throw new Error(
            `Payment dated ${formatDisplayDate(data.docDate)} is before invoice ` +
              `${bill.docNumber} dated ${formatDisplayDate(String(bill.docDate))}.`,
          );
        }
        const due = roundMoney(Number(bill.balanceDue ?? 0));
        if (roundMoney(a.amount) > due + 0.005) {
          throw new Error(
            `Cannot allocate ₹${a.amount.toFixed(2)} to ${bill.docNumber} — only ` +
              `₹${due.toFixed(2)} is outstanding.`,
          );
        }
        resolved.push({
          docKind: "SALE",
          docId: String(bill._id),
          docNumber: String(bill.docNumber ?? ""),
          amount: roundMoney(a.amount),
          docDate: String(bill.docDate ?? ""),
        });
      } else {
        const bill = await PurchaseBill.findById(a.docId).lean();
        if (!bill) throw new Error(`Purchase bill ${a.docNumber || a.docId} not found.`);
        const due = roundMoney(Number(bill.grandTotal ?? 0) - Number(bill.amountPaid ?? 0));
        if (roundMoney(a.amount) > due + 0.005) {
          throw new Error(
            `Cannot allocate ₹${a.amount.toFixed(2)} to ${bill.internalRef} — only ` +
              `₹${due.toFixed(2)} is outstanding.`,
          );
        }
        resolved.push({
          docKind: "PURCHASE",
          docId: String(bill._id),
          docNumber: String(bill.internalRef ?? ""),
          amount: roundMoney(a.amount),
          docDate: String(bill.billDate ?? ""),
        });
      }
    }

    const allocatedAmount = roundMoney(resolved.reduce((s, r) => s + r.amount, 0));
    // §6.4: anything left over is an on-account advance, not an error.
    const unallocatedAmount = roundMoney(totalAmount - allocatedAmount);

    if (allocatedAmount > 0 && !data.partyId) {
      throw new Error("Select a party before allocating a payment to bills.");
    }

    const splits = data.splits.map((s) => ({
      payMode: s.payMode,
      amount: roundMoney(s.amount),
      referenceNo: s.referenceNo ?? "",
      bankName: s.bankName ?? "",
      instrumentDate: s.instrumentDate ?? "",
      // §6.1: cheques and DDs start PENDING — the money is not ours yet.
      clearingStatus: defaultClearingStatus(s.payMode),
    }));

    const seriesCode = data.direction === "IN" ? "PIN" : "POUT";
    let allocatedNumber = "";
    let createdId = "";

    await withTransaction(
      async (ctx) => {
        const { docNumber } = await allocateDocNumber(
          seriesCode,
          data.docDate,
          data.branchId,
          ctx.session,
        );
        allocatedNumber = docNumber;

        const [created] = await PaymentDocModel.create(
          docPayloads([
            {
              docNumber,
              docDate: data.docDate,
              branchId: data.branchId,
              direction: data.direction,
              partyId: data.partyId ?? "",
              partyName: data.partyName,
              totalAmount,
              allocatedAmount,
              unallocatedAmount,
              splits,
              allocations: resolved.map((r) => ({
                docKind: r.docKind,
                docId: r.docId,
                docNumber: r.docNumber,
                amount: r.amount,
              })),
              idempotencyKey: data.idempotencyKey ?? "",
              narration: data.narration ?? "",
              status: "POSTED",
              createdBy: data.createdBy ?? "",
              createdByName: data.createdByName ?? "",
            },
          ]),
          sessionOpt(ctx.session),
        );
        createdId = String(created?._id ?? "");

        // Apply each allocation to its document.
        for (const r of resolved) {
          await applyAllocation(r.docKind, r.docId, r.amount, ctx.session);
        }

        // Party ledger: a receipt credits the customer, a payment debits the
        // supplier. Cleared-only instruments still post — a bounce reverses.
        if (data.partyId) {
          await PartyLedgerModel.create(
            docPayloads([
              {
                partyId: data.partyId,
                entryDate: data.docDate,
                sourceKind: "PAYMENT",
                sourceId: createdId,
                sourceNumber: docNumber,
                narration:
                  data.narration ||
                  (data.direction === "IN" ? `Receipt ${docNumber}` : `Payment ${docNumber}`),
                debit: data.direction === "OUT" ? totalAmount : 0,
                credit: data.direction === "IN" ? totalAmount : 0,
              },
            ]),
            sessionOpt(ctx.session),
          );
        }

        // §6.11 cash position.
        const cashAmount = roundMoney(
          splits.filter((s) => s.payMode === "CASH").reduce((s, x) => s + x.amount, 0),
        );
        await bumpDailySummary(
          data.branchId,
          data.docDate,
          data.direction === "IN"
            ? { received: totalAmount, cashIn: cashAmount }
            : { paidOut: totalAmount, cashOut: cashAmount },
          ctx.session,
        );
      },
      async () => {
        if (!allocatedNumber) return;
        await PartyLedgerModel.deleteMany({ sourceNumber: allocatedNumber });
        await PaymentDocModel.deleteOne({ docNumber: allocatedNumber });
      },
    );

    await AuditLogModel.create(
      docPayload({
        entity: "PaymentDoc",
        entityId: createdId,
        entityRef: allocatedNumber,
        action: "CREATE",
        actorId: data.createdBy ?? "",
        actorName: data.createdByName ?? "",
        afterJson: { totalAmount, allocatedAmount, unallocatedAmount },
      }),
    );

    const saved = await PaymentDocModel.findById(createdId).lean();
    return toRow((saved ?? {}) as unknown as Record<string, unknown>);
  });

/**
 * Move `delta` onto a document's paid amount and re-derive its status.
 * A negative delta unwinds an allocation (cancel or bounce).
 */
async function applyAllocation(
  docKind: "SALE" | "PURCHASE",
  docId: string,
  delta: number,
  session: Parameters<typeof sessionOpt>[0],
): Promise<void> {
  if (docKind === "SALE") {
    const bill = await SalesDocModel.findById(docId).lean();
    if (!bill) return;

    const paidAmount = roundMoney(Number(bill.paidAmount ?? 0) + delta);
    const { paymentStatus, balanceDue } = derivePaymentStatus(
      Number(bill.grandTotal ?? 0),
      paidAmount,
    );

    await SalesDocModel.updateOne(
      { _id: docId },
      { $set: { paidAmount, balanceDue, paymentStatus } },
      sessionOpt(session),
    );

    // Keep the clinical mirror in step; never let it fail the payment.
    if (bill.visitId) {
      await ClinicalVisit.updateOne(
        { visitId: bill.visitId },
        {
          $set: {
            amountPaid: paidAmount,
            balanceDue,
            pendingAmount: balanceDue,
            paymentStatus:
              paymentStatus === "PAID"
                ? "Full"
                : paymentStatus === "PARTIAL"
                  ? "Partial"
                  : "Unpaid",
            status: paymentStatus === "PAID" ? "Paid" : "Billed",
          },
        },
      ).catch(() => {});
    }
    return;
  }

  const bill = await PurchaseBill.findById(docId).lean();
  if (!bill) return;

  const amountPaid = roundMoney(Number(bill.amountPaid ?? 0) + delta);
  const grandTotal = Number(bill.grandTotal ?? 0);
  const status =
    grandTotal - amountPaid <= 0.005 ? "PAID" : amountPaid > 0.005 ? "PARTIAL" : "UNPAID";

  await PurchaseBill.updateOne(
    { _id: docId },
    { $set: { amountPaid, status } },
    sessionOpt(session),
  );
}

// ─── List ─────────────────────────────────────────────────────────────────────

export const listPaymentsFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z
      .object({
        direction: z.enum(["IN", "OUT", "ALL"]).default("ALL"),
        from: z.string().optional(),
        to: z.string().optional(),
        partyId: z.string().optional(),
        status: z.string().optional(),
        pendingOnly: z.boolean().default(false),
        q: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(100),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data }): Promise<PaymentRow[]> => {
    await connectDB();

    const filter: Record<string, unknown> = {};
    if (data.direction !== "ALL") filter["direction"] = data.direction;
    if (data.from || data.to) {
      const range: Record<string, string> = {};
      if (data.from) range["$gte"] = data.from;
      if (data.to) range["$lte"] = data.to;
      filter["docDate"] = range;
    }
    if (data.partyId) filter["partyId"] = data.partyId;
    if (data.status && data.status !== "all") filter["status"] = data.status;
    // The dashboard's cheque/DD alert tab.
    if (data.pendingOnly) filter["splits.clearingStatus"] = "PENDING";
    if (data.q?.trim()) {
      const rx = { $regex: data.q.trim(), $options: "i" };
      filter["$or"] = [
        { docNumber: rx },
        { partyName: rx },
        { narration: rx },
        { "splits.referenceNo": rx },
      ];
    }

    const docs = await PaymentDocModel.find(filter)
      .sort({ docDate: -1, createdAt: -1 })
      .limit(data.limit)
      .lean();

    return docs.map((d) => toRow(d as unknown as Record<string, unknown>));
  });

// ─── Cancel ───────────────────────────────────────────────────────────────────

export const cancelPaymentFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({
        id: z.string().min(1),
        reason: z.string().min(3, "A reason is required"),
        actorId: z.string().optional(),
        actorName: z.string().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; docNumber: string }> => {
    await connectDB();

    const pay = await PaymentDocModel.findById(data.id).lean();
    if (!pay) throw new Error("Payment not found");
    if (pay.status === "CANCELLED") return { ok: true, docNumber: String(pay.docNumber) };

    const docNumber = String(pay.docNumber ?? "");
    const totalAmount = Number(pay.totalAmount ?? 0);

    await withTransaction(async (ctx) => {
      // Payments are never edited — cancelled and re-entered, so the history
      // shows what actually happened.
      await PaymentDocModel.updateOne(
        { _id: pay._id },
        { $set: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: data.reason } },
        sessionOpt(ctx.session),
      );

      for (const a of pay.allocations ?? []) {
        await applyAllocation(
          a.docKind as "SALE" | "PURCHASE",
          String(a.docId),
          -Number(a.amount ?? 0),
          ctx.session,
        );
      }

      if (pay.partyId) {
        await PartyLedgerModel.create(
          docPayloads([
            {
              partyId: pay.partyId,
              entryDate: todayIST(),
              sourceKind: "PAYMENT",
              sourceId: String(pay._id),
              sourceNumber: docNumber,
              narration: `Cancelled ${docNumber}: ${data.reason}`,
              debit: pay.direction === "IN" ? totalAmount : 0,
              credit: pay.direction === "OUT" ? totalAmount : 0,
              isReversal: true,
              reversalOfId: String(pay._id),
            },
          ]),
          sessionOpt(ctx.session),
        );
      }

      const cashAmount = roundMoney(
        (pay.splits ?? [])
          .filter((s) => s.payMode === "CASH")
          .reduce((s, x) => s + Number(x.amount ?? 0), 0),
      );
      await bumpDailySummary(
        String(pay.branchId ?? "MAIN"),
        String(pay.docDate),
        pay.direction === "IN"
          ? { received: -totalAmount, cashIn: -cashAmount }
          : { paidOut: -totalAmount, cashOut: -cashAmount },
        ctx.session,
      );
    });

    await AuditLogModel.create(
      docPayload({
        entity: "PaymentDoc",
        entityId: String(pay._id),
        entityRef: docNumber,
        action: "CANCEL",
        actorId: data.actorId ?? "",
        actorName: data.actorName ?? "",
        reason: data.reason,
      }),
    );

    return { ok: true, docNumber };
  });

// ─── Cheque / DD clearing (§6.8) ──────────────────────────────────────────────

export const updateClearingStatusFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({
        paymentId: z.string().min(1),
        splitIndex: z.number().int().min(0),
        status: z.enum(["CLEARED", "BOUNCED"]),
        reason: z.string().optional(),
        actorId: z.string().optional(),
        actorName: z.string().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }): Promise<PaymentRow> => {
    await connectDB();

    const pay = await PaymentDocModel.findById(data.paymentId).lean();
    if (!pay) throw new Error("Payment not found");
    if (pay.status === "CANCELLED") throw new Error("This payment is cancelled.");

    const splits = pay.splits ?? [];
    const split = splits[data.splitIndex];
    if (!split) throw new Error("Payment line not found");
    if (!MODES_NEEDING_CLEARING.includes(split.payMode)) {
      throw new Error(`${split.payMode} payments do not go through clearing.`);
    }
    if (split.clearingStatus === data.status) {
      return toRow(pay as unknown as Record<string, unknown>);
    }

    const amount = roundMoney(Number(split.amount ?? 0));
    const docNumber = String(pay.docNumber ?? "");

    await withTransaction(async (ctx) => {
      const set: Record<string, unknown> = {
        [`splits.${data.splitIndex}.clearingStatus`]: data.status,
      };
      if (data.status === "CLEARED") {
        set[`splits.${data.splitIndex}.clearedAt`] = new Date();
      } else {
        set[`splits.${data.splitIndex}.bouncedAt`] = new Date();
        set[`splits.${data.splitIndex}.bounceReason`] = data.reason ?? "";
      }

      await PaymentDocModel.updateOne({ _id: pay._id }, { $set: set }, sessionOpt(ctx.session));

      // Clearing confirms what was already posted — nothing to move.
      if (data.status === "CLEARED") return;

      // A bounce takes the money back out: unwind the allocations in
      // proportion, reverse the ledger, and restore the outstanding.
      const total = roundMoney(Number(pay.totalAmount ?? 0));
      const share = total > 0 ? amount / total : 0;

      for (const a of pay.allocations ?? []) {
        const back = roundMoney(Number(a.amount ?? 0) * share);
        if (back > 0) {
          await applyAllocation(
            a.docKind as "SALE" | "PURCHASE",
            String(a.docId),
            -back,
            ctx.session,
          );
        }
      }

      if (pay.partyId) {
        await PartyLedgerModel.create(
          docPayloads([
            {
              partyId: pay.partyId,
              entryDate: todayIST(),
              sourceKind: "PAYMENT",
              sourceId: String(pay._id),
              sourceNumber: docNumber,
              narration: `${split.payMode} bounced on ${docNumber}${
                data.reason ? `: ${data.reason}` : ""
              }`,
              debit: pay.direction === "IN" ? amount : 0,
              credit: pay.direction === "OUT" ? amount : 0,
              isReversal: true,
              reversalOfId: String(pay._id),
            },
          ]),
          sessionOpt(ctx.session),
        );
      }

      await bumpDailySummary(
        String(pay.branchId ?? "MAIN"),
        String(pay.docDate),
        pay.direction === "IN" ? { received: -amount } : { paidOut: -amount },
        ctx.session,
      );
    });

    if (data.status === "BOUNCED") {
      // A bounce needs a human to chase it, so raise a follow-up automatically.
      await ReminderModel.updateOne(
        { autoKey: `BOUNCE:${String(pay._id)}:${data.splitIndex}` },
        {
          $set: {
            remindOn: todayIST(),
            title: `${split.payMode} bounced — ${pay.partyName || "party"} ₹${amount.toFixed(2)}`,
            notes: data.reason ?? "",
            partyId: pay.partyId ?? "",
            partyName: pay.partyName ?? "",
            linkKind: "PAYMENT",
            linkId: String(pay._id),
            linkNumber: docNumber,
            amount,
            channel: "IN_APP",
            status: "OPEN",
            autoKey: `BOUNCE:${String(pay._id)}:${data.splitIndex}`,
          },
        },
        { upsert: true },
      );
    }

    await AuditLogModel.create(
      docPayload({
        entity: "PaymentDoc",
        entityId: String(pay._id),
        entityRef: docNumber,
        action: data.status === "CLEARED" ? "CLEAR" : "BOUNCE",
        actorId: data.actorId ?? "",
        actorName: data.actorName ?? "",
        reason: data.reason ?? "",
        afterJson: { splitIndex: data.splitIndex, amount },
      }),
    );

    const fresh = await PaymentDocModel.findById(data.paymentId).lean();
    return toRow((fresh ?? {}) as unknown as Record<string, unknown>);
  });

// ─── Advances ─────────────────────────────────────────────────────────────────

export const getPartyAdvanceFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => z.object({ partyId: z.string().min(1) }).parse(raw))
  .handler(async ({ data }): Promise<{ advance: number; payments: PaymentRow[] }> => {
    await connectDB();

    const docs = await PaymentDocModel.find({
      partyId: data.partyId,
      status: "POSTED",
      direction: "IN",
      unallocatedAmount: { $gt: 0 },
    })
      .sort({ docDate: 1 })
      .lean();

    const rows = docs.map((d) => toRow(d as unknown as Record<string, unknown>));
    return {
      advance: roundMoney(rows.reduce((s, r) => s + r.unallocatedAmount, 0)),
      payments: rows,
    };
  });

/**
 * Apply an existing advance to a bill without taking new money.
 * Used when a customer paid up front and the invoice is raised later.
 */
export const applyAdvanceFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({
        paymentId: z.string().min(1),
        docKind: z.enum(["SALE", "PURCHASE"]).default("SALE"),
        docId: z.string().min(1),
        amount: z.number().positive(),
      })
      .parse(raw),
  )
  .handler(async ({ data }): Promise<PaymentRow> => {
    await connectDB();

    const pay = await PaymentDocModel.findById(data.paymentId).lean();
    if (!pay) throw new Error("Payment not found");
    if (pay.status !== "POSTED") throw new Error("This payment is not active.");

    const available = roundMoney(Number(pay.unallocatedAmount ?? 0));
    const amount = roundMoney(data.amount);
    if (amount > available + 0.005) {
      throw new Error(`Only ₹${available.toFixed(2)} is unallocated on ${pay.docNumber}.`);
    }

    let docNumber = "";
    if (data.docKind === "SALE") {
      const bill = await SalesDocModel.findById(data.docId).lean();
      if (!bill) throw new Error("Invoice not found");
      if (bill.status !== "POSTED") throw new Error("That invoice is not posted.");
      const due = roundMoney(Number(bill.balanceDue ?? 0));
      if (amount > due + 0.005) {
        throw new Error(`Only ₹${due.toFixed(2)} is outstanding on ${bill.docNumber}.`);
      }
      docNumber = String(bill.docNumber ?? "");
    } else {
      const bill = await PurchaseBill.findById(data.docId).lean();
      if (!bill) throw new Error("Purchase bill not found");
      docNumber = String(bill.internalRef ?? "");
    }

    await withTransaction(async (ctx) => {
      await PaymentDocModel.updateOne(
        { _id: pay._id },
        {
          $push: {
            allocations: {
              docKind: data.docKind,
              docId: data.docId,
              docNumber,
              amount,
            },
          },
          $inc: { allocatedAmount: amount, unallocatedAmount: -amount },
        },
        sessionOpt(ctx.session),
      );
      await applyAllocation(data.docKind, data.docId, amount, ctx.session);
    });

    const fresh = await PaymentDocModel.findById(data.paymentId).lean();
    return toRow((fresh ?? {}) as unknown as Record<string, unknown>);
  });
