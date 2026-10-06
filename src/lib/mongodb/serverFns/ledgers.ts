/**
 * Unified ledgers — customer, supplier, cash, staff.
 *
 * Each ledger is a read-model: a builder collects events from the source
 * modules and `buildLedger` turns them into rows + running balance.
 * Nothing here stores a balance. Convention: balance = Σdebit − Σcredit
 * (positive Dr, negative Cr).
 *
 * `branchId` is accepted everywhere (multi-tenant ready) and defaults to MAIN;
 * the UI does not expose it yet. Legacy models (PurchaseBill, SupplierPayment,
 * Expense) carry no branchId, so they are not branch-filtered.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { PartyModel } from "@/lib/mongodb/models/Party";
import { SupplierModel } from "@/lib/mongodb/models/Supplier";
import { PurchaseBillModel } from "@/lib/mongodb/models/PurchaseBill";
import { SupplierPaymentModel } from "@/lib/mongodb/models/SupplierPayment";
import { SalesDocModel } from "@/lib/mongodb/models/SalesDoc";
import { PaymentDocModel } from "@/lib/mongodb/models/PaymentDoc";
import { ExpenseModel } from "@/lib/mongodb/models/Expense";
import { User } from "@/lib/mongodb/models/User";
import { StaffLedgerEntryModel } from "@/lib/mongodb/models/StaffLedgerEntry";
import { buildLedger, signedOpening, STAFF_ENTRY_KINDS, type LedgerEvent, type LedgerRow } from "@/lib/ledger/buildLedger";
import { roundMoney } from "@/lib/utils/moneyUtils";
import { todayIST } from "@/lib/utils/dateUtils";

export type LedgerType = "customer" | "supplier" | "cash" | "staff";

export interface LedgerSubject {
  id: string;
  name: string;
  sub: string;
}

export interface LedgerReport {
  type: LedgerType;
  title: string;
  subjectName: string;
  subjectMeta: string;
  openingBalance: number;
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
  rows: LedgerRow[];
}

const BRANCH_DEFAULT = "MAIN";
const ts = (d: unknown) => (d ? new Date(d as string).getTime() : 0);
const num = (v: unknown) => Number(v ?? 0);

/** Net of bounced instruments, optionally restricted to a pay mode. */
function splitTotal(
  splits: Array<{ payMode?: string; amount?: number; clearingStatus?: string }> | undefined,
  mode?: string,
): number {
  return roundMoney(
    (splits ?? [])
      .filter((s) => s.clearingStatus !== "BOUNCED" && (!mode || s.payMode === mode))
      .reduce((a, s) => a + num(s.amount), 0),
  );
}

type Built = { events: LedgerEvent[]; base: number; subjectName: string; subjectMeta: string; title: string };

// ─── Builders ────────────────────────────────────────────────────────────────

async function customerEvents(partyId: string, to: string, branchId: string): Promise<Built> {
  const party = await PartyModel.findOne({ partyId }).lean();
  if (!party) throw new Error("Customer not found");

  const [docs, pays] = await Promise.all([
    SalesDocModel.find({
      partyId,
      branchId,
      status: "POSTED",
      docType: { $in: ["INVOICE", "CREDIT_NOTE"] },
      docDate: { $lte: to },
    }).lean(),
    PaymentDocModel.find({ partyId, branchId, status: "POSTED", docDate: { $lte: to } }).lean(),
  ]);

  const events: LedgerEvent[] = [
    ...docs.map((d) => {
      const cn = d.docType === "CREDIT_NOTE";
      return {
        date: String(d.docDate),
        sortKey: ts(d.createdAt),
        voucherNo: String(d.docNumber ?? ""),
        particulars: `${cn ? "Credit Note" : "Sales Invoice"} (${d.docNumber})`,
        debit: cn ? 0 : num(d.grandTotal),
        credit: cn ? num(d.grandTotal) : 0,
      };
    }),
    ...pays.map((p) => {
      const amt = splitTotal(p.splits);
      const modes = (p.splits ?? []).map((s) => s.payMode).join(" + ");
      const isIn = p.direction === "IN";
      return {
        date: String(p.docDate),
        sortKey: ts(p.createdAt),
        voucherNo: String(p.docNumber ?? ""),
        particulars: `${isIn ? "Receipt" : "Refund"} (${modes})${p.narration ? ` – ${p.narration}` : ""}`,
        debit: isIn ? 0 : amt,
        credit: isIn ? amt : 0,
      };
    }),
  ];

  return {
    events,
    base: signedOpening(num(party.openingBalance), String(party.openingType ?? "DR")),
    subjectName: String(party.displayName),
    subjectMeta: [party.mobile, party.gstin && `GSTIN: ${party.gstin}`].filter(Boolean).join(" • "),
    title: "Customer Ledger Report",
  };
}

async function supplierEvents(supplierId: string, to: string): Promise<Built> {
  const sup = await SupplierModel.findById(supplierId).lean();
  if (!sup) throw new Error("Supplier not found");

  const [bills, pays] = await Promise.all([
    PurchaseBillModel.find({ supplierId, status: { $ne: "VOID" }, billDate: { $lte: to } }).lean(),
    SupplierPaymentModel.find({ supplierId, status: "ACTIVE", paymentDate: { $lte: to } }).lean(),
  ]);

  const events: LedgerEvent[] = [
    ...bills.map((b) => {
      const dn = b.docType === "DEBIT_NOTE";
      return {
        date: b.billDate,
        sortKey: ts(b.createdAt),
        voucherNo: b.internalRef,
        particulars: `${dn ? "Debit Note" : "Purchase Bill"} (ID : ${b.internalRef}, Bill No. : ${b.billNumber})`,
        debit: dn ? num(b.grandTotal) : 0,
        credit: dn ? 0 : num(b.grandTotal),
      };
    }),
    ...pays.map((p) => ({
      date: p.paymentDate,
      sortKey: ts(p.createdAt),
      voucherNo: p.voucherNo,
      particulars: `Payment (${(p.paymentLines ?? []).map((l) => l.mode).join(" + ")})`,
      debit: num(p.totalAmount),
      credit: 0,
    })),
  ];

  return {
    events,
    base: signedOpening(num(sup.openingBalance), String(sup.openingBalanceType ?? "Debit")),
    subjectName: sup.name,
    subjectMeta: [sup.phone || sup.mobileNo, sup.gstin && `GSTIN: ${sup.gstin}`].filter(Boolean).join(" • "),
    title: "Supplier Ledger Report",
  };
}

/** Cash in hand: debit = cash received, credit = cash paid out. */
async function cashEvents(to: string, branchId: string): Promise<Built> {
  const [pays, supPays, exps] = await Promise.all([
    PaymentDocModel.find({ branchId, status: "POSTED", docDate: { $lte: to }, "splits.payMode": "CASH" }).lean(),
    SupplierPaymentModel.find({ status: "ACTIVE", paymentDate: { $lte: to }, "paymentLines.mode": "CASH" }).lean(),
    ExpenseModel.find({ status: "ACTIVE", expenseDate: { $lte: to }, "paymentLines.mode": "CASH" }).lean(),
  ]);
  const cashLines = (lines: Array<{ mode?: string; amount?: number }> | undefined) =>
    roundMoney((lines ?? []).filter((l) => l.mode === "CASH").reduce((a, l) => a + num(l.amount), 0));

  const events: LedgerEvent[] = [
    ...pays.map((p) => {
      const amt = splitTotal(p.splits, "CASH");
      const isIn = p.direction === "IN";
      return {
        date: String(p.docDate),
        sortKey: ts(p.createdAt),
        voucherNo: String(p.docNumber ?? ""),
        particulars: `${isIn ? "Receipt from" : "Payment to"} ${p.partyName || "party"}`,
        debit: isIn ? amt : 0,
        credit: isIn ? 0 : amt,
      };
    }),
    ...supPays.map((p) => ({
      date: p.paymentDate,
      sortKey: ts(p.createdAt),
      voucherNo: p.voucherNo,
      particulars: `Payment to ${p.supplierName}`,
      debit: 0,
      credit: cashLines(p.paymentLines),
    })),
    ...exps.map((e) => ({
      date: e.expenseDate,
      sortKey: ts(e.createdAt),
      voucherNo: e.voucherNo,
      particulars: `Expense – ${e.categoryName}${e.paidTo ? ` (${e.paidTo})` : ""}`,
      debit: 0,
      credit: cashLines(e.paymentLines),
    })),
  ].filter((e) => e.debit > 0 || e.credit > 0);

  return { events, base: 0, subjectName: "Cash in Hand", subjectMeta: "", title: "Cash Book" };
}

async function staffEvents(staffId: string, to: string, branchId: string): Promise<Built> {
  const user = await User.findById(staffId).lean();
  if (!user) throw new Error("Staff member not found");

  const [entries, exps] = await Promise.all([
    StaffLedgerEntryModel.find({ staffId, branchId, entryDate: { $lte: to } }).lean(),
    // Staff paid out of pocket → the clinic owes them back.
    ExpenseModel.find({ paidByStaffId: staffId, status: "ACTIVE", expenseDate: { $lte: to } }).lean(),
  ]);

  const events: LedgerEvent[] = [
    ...entries.map((e) => ({
      date: e.entryDate,
      sortKey: ts(e.createdAt),
      voucherNo: e.voucherNo ?? "",
      particulars: `${e.kind[0]}${e.kind.slice(1).toLowerCase()}${e.narration ? ` – ${e.narration}` : ""}`,
      debit: num(e.debit),
      credit: num(e.credit),
    })),
    ...exps.map((e) => ({
      date: e.expenseDate,
      sortKey: ts(e.createdAt),
      voucherNo: e.voucherNo,
      particulars: `Reimbursable expense – ${e.categoryName}`,
      debit: 0,
      credit: num(e.totalAmount),
    })),
  ];

  return {
    events,
    base: 0,
    subjectName: String(user.fullName),
    subjectMeta: [user.roleName, user.phone].filter(Boolean).join(" • "),
    title: "Staff Ledger Report",
  };
}

// ─── Server functions ────────────────────────────────────────────────────────

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const getLedgerFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z
      .object({
        type: z.enum(["customer", "supplier", "cash", "staff"]),
        subjectId: z.string().optional(),
        from: isoDate,
        to: isoDate,
        branchId: z.string().default(BRANCH_DEFAULT),
      })
      .refine((v) => v.type === "cash" || !!v.subjectId, "Select a party first")
      .parse(raw),
  )
  .handler(async ({ data }): Promise<LedgerReport> => {
    await connectDB();
    const id = data.subjectId ?? "";
    const b =
      data.type === "customer"
        ? await customerEvents(id, data.to, data.branchId)
        : data.type === "supplier"
          ? await supplierEvents(id, data.to)
          : data.type === "staff"
            ? await staffEvents(id, data.to, data.branchId)
            : await cashEvents(data.to, data.branchId);

    const built = buildLedger(b.base, b.events, data.from, data.to);
    return {
      type: data.type,
      title: b.title,
      subjectName: b.subjectName,
      subjectMeta: b.subjectMeta,
      openingBalance: built.openingBalance,
      closingBalance: built.closingBalance,
      totalDebit: built.totalDebit,
      totalCredit: built.totalCredit,
      rows: built.rows,
    };
  });

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Picker data: who can I open a ledger for? */
export const listLedgerSubjectsFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z.object({ type: z.enum(["customer", "supplier", "staff"]), q: z.string().default("") }).parse(raw),
  )
  .handler(async ({ data }): Promise<LedgerSubject[]> => {
    await connectDB();
    const rx = data.q.trim() ? { $regex: esc(data.q.trim()), $options: "i" } : undefined;

    if (data.type === "customer") {
      const docs = await PartyModel.find({
        partyType: { $in: ["CLIENT", "BOTH"] },
        isActive: true,
        ...(rx ? { $or: [{ displayName: rx }, { mobile: rx }] } : {}),
      })
        .sort({ displayName: 1 })
        .limit(40)
        .lean();
      return docs.map((d) => ({ id: String(d.partyId), name: String(d.displayName), sub: String(d.mobile ?? "") }));
    }
    if (data.type === "supplier") {
      const docs = await SupplierModel.find({ isActive: true, ...(rx ? { name: rx } : {}) })
        .sort({ name: 1 })
        .limit(40)
        .lean();
      return docs.map((d) => ({ id: String(d._id), name: d.name, sub: d.phone || d.mobileNo || "" }));
    }
    const docs = await User.find({
      isActive: true,
      isSystemAccount: { $ne: true },
      approvalStatus: "approved",
      ...(rx ? { fullName: rx } : {}),
    })
      .sort({ fullName: 1 })
      .limit(40)
      .lean();
    return docs.map((d) => ({ id: String(d._id), name: String(d.fullName), sub: String(d.roleName ?? "") }));
  });

export const addStaffLedgerEntryFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({
        staffId: z.string().min(1),
        entryDate: isoDate.default(() => todayIST()),
        kind: z.enum(STAFF_ENTRY_KINDS),
        amount: z.number().positive(),
        narration: z.string().max(200).default(""),
        branchId: z.string().default(BRANCH_DEFAULT),
      })
      .parse(raw),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    await connectDB();
    // Credit: SALARY accrued, REPAYMENT received. Debit: ADVANCE / PAYMENT / ADJUSTMENT.
    const accrues = data.kind === "SALARY" || data.kind === "REPAYMENT";
    await StaffLedgerEntryModel.create({
      branchId: data.branchId,
      staffId: data.staffId,
      entryDate: data.entryDate,
      kind: data.kind,
      narration: data.narration,
      debit: accrues ? 0 : data.amount,
      credit: accrues ? data.amount : 0,
    });
    return { ok: true };
  });
