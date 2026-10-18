/**
 * Accounts module — Cash Book, Business Book, Payment Received/Paid, Daily
 * Summary, Input/Output Tax, Profit & Loss, Chart of Accounts, Balance Sheet.
 *
 * Every report is derived at read time from the live billing, purchase,
 * payment, expense, staff and stock records (maths in lib/accounts/compute.ts).
 * Nothing is stored or seeded here, so a report can never drift from the
 * documents behind it.
 *
 * `branchId` defaults to MAIN. Legacy models (PurchaseBill, SupplierPayment,
 * Expense, StockBatch) carry no branchId, so they are not branch-filtered —
 * same as the ledgers module.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { SalesDocModel } from "@/lib/mongodb/models/SalesDoc";
import { PurchaseBillModel } from "@/lib/mongodb/models/PurchaseBill";
import { PaymentDocModel } from "@/lib/mongodb/models/PaymentDoc";
import { SupplierPaymentModel } from "@/lib/mongodb/models/SupplierPayment";
import { ExpenseModel } from "@/lib/mongodb/models/Expense";
import { ClinicalVisit } from "@/lib/mongodb/models/ClinicalVisit";
import { PartyModel } from "@/lib/mongodb/models/Party";
import { SupplierModel } from "@/lib/mongodb/models/Supplier";
import { StaffLedgerEntryModel } from "@/lib/mongodb/models/StaffLedgerEntry";
import { StockBatch } from "@/lib/mongodb/models/StockBatch";
import { User } from "@/lib/mongodb/models/User";
import { signedOpening } from "@/lib/ledger/buildLedger";
import { fyBounds, fyCodeFor } from "@/lib/finance/fyUtils";
import { todayIST } from "@/lib/utils/dateUtils";
import { roundMoney } from "@/lib/utils/moneyUtils";
import {
  buildBook,
  buildDailySummary,
  buildPaymentRegister,
  buildPosition,
  buildProfitLoss,
  buildTaxReport,
  type BillFact,
  type BookReport,
  type DailyRow,
  type DailyTotals,
  type ExpenseFact,
  type Movement,
  type PartyBase,
  type PaymentRegister,
  type Position,
  type ProfitLoss,
  type SaleFact,
  type StaffEntryFact,
  type StockFact,
  type TaxReport,
} from "@/lib/accounts/compute";

const BRANCH_DEFAULT = "MAIN";
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const num = (v: unknown) => Number(v ?? 0);
const ts = (d: unknown) => (d ? new Date(d as string).getTime() : 0);

/** Match a date field against an optional lower bound and a required upper bound. */
const within = (field: string, to: string, from?: string) => ({
  [field]: from ? { $gte: from, $lte: to } : { $lte: to },
});

// ─── Loading ─────────────────────────────────────────────────────────────────

/**
 * Where the clinic's bills actually live: every invoice raised from the billing
 * screens is saved on the ClinicalVisit (invoiceNo, items, payments[]). The newer
 * SalesDoc / PaymentDoc collections are read as well, but a visit that has been
 * mirrored onto a SalesDoc (salesDocNo set) is skipped so nothing counts twice.
 */
const VISIT_PAY_MODE: Record<string, string> = {
  Cash: "CASH",
  UPI: "UPI",
  Card: "CARD",
  NetBanking: "BANK_TRANSFER",
  Cheque: "CHEQUE",
};

/** A payment is stamped in UTC; the clinic's day is the Indian one. */
const istDay = (t?: string) => {
  const d = t ? new Date(t) : null;
  return d && !isNaN(d.getTime()) ? d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) : "";
};
const r2 = (n: number) => Math.round(n * 100) / 100;

interface Facts {
  movements: Movement[];
  sales: SaleFact[];
  bills: BillFact[];
  expenses: ExpenseFact[];
}

/** Everything dated up to `to` (and from `from`, when given), as plain facts. */
async function loadFacts(to: string, branchId: string, from?: string): Promise<Facts> {
  await connectDB();
  const [salesDocs, billDocs, payDocs, supPays, expDocs, visitDocs] = await Promise.all([
    SalesDocModel.find({
      branchId,
      status: "POSTED",
      docType: { $in: ["INVOICE", "CREDIT_NOTE"] },
      ...within("docDate", to, from),
    }).lean(),
    PurchaseBillModel.find({ status: { $ne: "VOID" }, ...within("billDate", to, from) }).lean(),
    PaymentDocModel.find({ branchId, status: "POSTED", ...within("docDate", to, from) }).lean(),
    SupplierPaymentModel.find({ status: "ACTIVE", ...within("paymentDate", to, from) }).lean(),
    ExpenseModel.find({
      status: "ACTIVE",
      isRecurringTemplate: { $ne: true },
      ...within("expenseDate", to, from),
    }).lean(),
    ClinicalVisit.find({
      status: { $in: ["Billed", "Paid", "Closed"] },
      invoiceNo: { $nin: ["", null] },
      salesDocNo: { $in: ["", null] },
      ...within("date", to, from),
    }).lean(),
  ]);

  const sales: SaleFact[] = salesDocs.map((d) => ({
    date: String(d.docDate),
    kind: d.docType === "CREDIT_NOTE" ? "CREDIT_NOTE" : "INVOICE",
    partyId: String(d.partyId ?? ""),
    partyName: String(d.partyName ?? ""),
    grandTotal: num(d.grandTotal),
    cgst: num(d.cgst),
    sgst: num(d.sgst),
    igst: num(d.igst),
    cess: num(d.cess),
    lines: (d.lines ?? []).map((l) => ({
      lineType: String(l.lineType || "Service"),
      taxable: num(l.taxableValue),
      rate: num(l.gstRate),
      tax: num(l.cgst) + num(l.sgst) + num(l.igst) + num(l.cess),
    })),
  }));

  // Invoices raised from the billing screens (clinical visits). GST is split evenly into
  // CGST + SGST: the visit stores a single GST figure and the clinic bills local clients.
  for (const v of visitDocs) {
    const gstBill = v.billType === "GST";
    const lines = (v.items ?? []).map((l) => {
      const taxable = l.taxableAmount != null ? num(l.taxableAmount) : num(l.lineTotal);
      const applies = gstBill && l.gstApplicable !== false;
      const rate = applies ? num(l.gstRate) : 0;
      return { lineType: String(l.lineType || "Service"), taxable, rate, tax: applies ? r2((taxable * rate) / 100) : 0 };
    });
    const gst = v.gstAmount != null ? num(v.gstAmount) : r2(lines.reduce((t, l) => t + l.tax, 0));
    // Bills raised from the invoice screen carry the real CGST/SGST/IGST split. Older bills only
    // have a total, so those are split evenly (right for local clients, which is nearly all of them).
    const hasSplit = v.cgstAmount != null || v.sgstAmount != null || v.igstAmount != null;
    const cgst = hasSplit ? num(v.cgstAmount) : r2(gst / 2);
    sales.push({
      date: String(v.date || "").slice(0, 10),
      kind: "INVOICE",
      partyId: String(v.ownerId ?? ""),
      partyName: String(v.ownerName ?? ""),
      grandTotal: num(v.totalAmount),
      cgst,
      sgst: hasSplit ? num(v.sgstAmount) : r2(gst - cgst),
      igst: hasSplit ? num(v.igstAmount) : 0,
      cess: 0,
      lines,
    });
  }

  const bills: BillFact[] = billDocs.map((b) => ({
    date: b.billDate,
    kind: b.docType === "DEBIT_NOTE" ? "DEBIT_NOTE" : "PURCHASE",
    supplierId: String(b.supplierId),
    supplierName: b.supplierName,
    grandTotal: num(b.grandTotal),
    taxable: num(b.taxableTotal),
    cgst: num(b.cgstTotal),
    sgst: num(b.sgstTotal),
    igst: num(b.igstTotal),
    itc: b.itcEligible !== false,
    items: (b.items ?? []).map((i) => ({
      rate: num(i.gstPct),
      taxable: num(i.taxableAmount),
      tax: num(i.taxAmount),
    })),
  }));

  const expenses: ExpenseFact[] = expDocs.map((e) => {
    const gst = num(e.gstAmount);
    return {
      date: e.expenseDate,
      category: e.categoryName,
      business: e.categoryNature !== "PERSONAL",
      total: num(e.totalAmount),
      taxable: e.taxableValue != null ? num(e.taxableValue) : num(e.totalAmount) - gst,
      gst,
      itc: !!e.itcClaimed,
      paidByStaffId: String(e.paidByStaffId ?? ""),
    };
  });

  // Money collected on those invoices. "Account Due" is credit given, not money received.
  const visitReceipts: Movement[] = [];
  for (const v of visitDocs) {
    for (const [i, p] of (v.payments ?? []).entries()) {
      const mode = VISIT_PAY_MODE[String(p.mode)];
      if (!mode || num(p.amount) <= 0 || p.clearingStatus === "BOUNCED") continue;
      visitReceipts.push({
        date: istDay(p.timestamp) || String(v.date || "").slice(0, 10),
        sortKey: ts(p.timestamp) + i,
        voucherNo: String(p.paymentId || p.id || v.invoiceNo),
        kind: "RECEIPT",
        direction: "IN",
        mode,
        amount: num(p.amount),
        partyId: String(v.ownerId ?? ""),
        party: String(v.ownerName ?? ""),
        narration: String(p.notes ?? ""),
        reference: String(p.trxRef ?? ""),
        against: String(v.invoiceNo),
        cleared: p.clearingStatus !== "PENDING",
      });
    }
  }

  // A unified Payment OUT against purchase bills is a supplier payment; attribute it
  // to the supplier id the bills carry so it lands on the same account as the bills.
  const partyToSupplier = new Map(
    billDocs.filter((b) => b.partyId).map((b) => [String(b.partyId), String(b.supplierId)]),
  );

  const movements: Movement[] = [];
  for (const p of payDocs) {
    const isSupplier =
      p.direction === "OUT" && (p.allocations ?? []).some((a) => a.docKind === "PURCHASE");
    const partyId = String(p.partyId ?? "");
    for (const s of p.splits ?? []) {
      if (s.clearingStatus === "BOUNCED") continue;
      movements.push({
        date: String(p.docDate),
        sortKey: ts(p.createdAt),
        voucherNo: String(p.docNumber ?? ""),
        kind: p.direction === "IN" ? "RECEIPT" : isSupplier ? "SUPPLIER_PAYMENT" : "REFUND",
        direction: p.direction === "IN" ? "IN" : "OUT",
        mode: String(s.payMode),
        amount: num(s.amount),
        partyId: isSupplier ? (partyToSupplier.get(partyId) ?? partyId) : partyId,
        party: String(p.partyName ?? ""),
        narration: String(p.narration ?? ""),
        reference: String(s.referenceNo ?? ""),
        against: (p.allocations ?? [])
          .map((a) => a.docNumber)
          .filter(Boolean)
          .join(", "),
        cleared: s.clearingStatus !== "PENDING",
      });
    }
  }
  for (const p of supPays) {
    for (const l of p.paymentLines ?? []) {
      movements.push({
        date: p.paymentDate,
        sortKey: ts(p.createdAt),
        voucherNo: p.voucherNo,
        kind: "SUPPLIER_PAYMENT",
        direction: "OUT",
        mode: l.mode,
        amount: num(l.amount),
        partyId: String(p.supplierId),
        party: p.supplierName,
        narration: p.remarks ?? "",
        reference: l.referenceNo ?? "",
        against: (p.allocations ?? [])
          .map((a) => a.billRef)
          .filter(Boolean)
          .join(", "),
        cleared: l.mode !== "CHEQUE",
      });
    }
  }
  for (const e of expDocs) {
    // Paid out of a staff member's pocket: no clinic money moved — it is a debt to them (see position).
    if (e.paidByStaffId) continue;
    for (const l of e.paymentLines ?? []) {
      movements.push({
        date: e.expenseDate,
        sortKey: ts(e.createdAt),
        voucherNo: e.voucherNo,
        kind: "EXPENSE",
        direction: "OUT",
        mode: l.mode,
        amount: num(l.amount),
        partyId: "",
        party: [e.categoryName, e.paidTo].filter(Boolean).join(" – "),
        narration: e.description ?? "",
        reference: l.referenceNo ?? "",
        against: e.billRefNo ?? "",
        cleared: l.mode !== "CHEQUE",
      });
    }
  }

  return { movements: [...movements, ...visitReceipts].filter((m) => m.amount > 0), sales, bills, expenses };
}

// ─── Books ───────────────────────────────────────────────────────────────────

const rangeInput = z.object({
  from: isoDate,
  to: isoDate,
  branchId: z.string().default(BRANCH_DEFAULT),
});

export const getBookFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    rangeInput.extend({ scope: z.enum(["CASH", "BUSINESS"]) }).parse(raw),
  )
  .handler(async ({ data }): Promise<BookReport> => {
    // Opening balance needs all history, so no lower bound here.
    const { movements } = await loadFacts(data.to, data.branchId);
    return buildBook(movements, data.scope, data.from, data.to);
  });

export const getPaymentRegisterFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => rangeInput.extend({ direction: z.enum(["IN", "OUT"]) }).parse(raw))
  .handler(async ({ data }): Promise<PaymentRegister> => {
    const { movements } = await loadFacts(data.to, data.branchId, data.from);
    return buildPaymentRegister(movements, data.direction, data.from, data.to);
  });

export const getDailySummaryFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => rangeInput.parse(raw))
  .handler(async ({ data }): Promise<{ rows: DailyRow[]; totals: DailyTotals }> => {
    const f = await loadFacts(data.to, data.branchId, data.from);
    return buildDailySummary(f.sales, f.bills, f.expenses, f.movements, data.from, data.to);
  });

export const getTaxReportFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => rangeInput.parse(raw))
  .handler(async ({ data }): Promise<TaxReport> => {
    const f = await loadFacts(data.to, data.branchId, data.from);
    return buildTaxReport(f.sales, f.bills, f.expenses, data.from, data.to);
  });

export const getProfitLossFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => rangeInput.parse(raw))
  .handler(async ({ data }): Promise<ProfitLoss> => {
    const f = await loadFacts(data.to, data.branchId, data.from);
    return buildProfitLoss(f.sales, f.bills, f.expenses, data.from, data.to);
  });

// ─── Balance Sheet / Chart of Accounts ───────────────────────────────────────

async function loadPosition(asOf: string, branchId: string): Promise<Position> {
  const f = await loadFacts(asOf, branchId);
  const today = todayIST();

  const [parties, suppliers, staffEntries, batches] = await Promise.all([
    PartyModel.find({ partyType: { $in: ["CLIENT", "BOTH"] }, openingBalance: { $ne: 0 } }).lean(),
    SupplierModel.find({ openingBalance: { $ne: 0 } }).lean(),
    StaffLedgerEntryModel.find({ branchId, entryDate: { $lte: asOf } }).lean(),
    StockBatch.find({ qty: { $gt: 0 }, status: { $in: ["Active", "Expired"] } }).lean(),
  ]);

  const customers: PartyBase[] = parties.map((p) => ({
    id: String(p.partyId),
    name: String(p.displayName),
    opening: signedOpening(num(p.openingBalance), String(p.openingType ?? "DR")),
  }));
  const supplierBases: PartyBase[] = suppliers.map((s) => ({
    id: String(s._id),
    name: s.name,
    opening: signedOpening(num(s.openingBalance), String(s.openingBalanceType ?? "Debit")),
  }));
  const entries: StaffEntryFact[] = staffEntries.map((e) => ({
    staffId: e.staffId,
    date: e.entryDate,
    debit: num(e.debit),
    credit: num(e.credit),
  }));

  const staffIds = [
    ...new Set([
      ...entries.map((e) => e.staffId),
      ...f.expenses.map((e) => e.paidByStaffId).filter(Boolean),
    ]),
  ];
  const users = staffIds.length
    ? await User.find({ _id: { $in: staffIds } })
        .select("fullName")
        .lean()
    : [];
  const staff: PartyBase[] = users.map((u) => ({
    id: String(u._id),
    name: String(u.fullName),
    opening: 0,
  }));

  const stock: StockFact = { value: 0, expiredValue: 0, batches: 0 };
  for (const b of batches) {
    const value = num(b.qty) * (num(b.purchasePricePerUnit) + num(b.landingCostPerUnit));
    const expired = b.status === "Expired" || (!!b.expiryDate && b.expiryDate < today);
    if (expired) stock.expiredValue += value;
    else stock.value += value;
    stock.batches += 1;
  }
  stock.value = roundMoney(stock.value);
  stock.expiredValue = roundMoney(stock.expiredValue);

  return buildPosition({
    asOf,
    movements: f.movements,
    sales: f.sales,
    bills: f.bills,
    expenses: f.expenses,
    customers,
    suppliers: supplierBases,
    staff,
    staffEntries: entries,
    stock,
  });
}

export const getBalanceSheetFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z.object({ asOf: isoDate, branchId: z.string().default(BRANCH_DEFAULT) }).parse(raw),
  )
  .handler(async ({ data }): Promise<Position & { stockIsCurrent: boolean }> => {
    const position = await loadPosition(data.asOf, data.branchId);
    // Stock quantities are live, so a past date still shows today's stock.
    return { ...position, stockIsCurrent: data.asOf < todayIST() };
  });

export interface ChartOfAccounts {
  position: Position;
  /** Income and expense accounts cover the financial year up to `asOf`. */
  fyFrom: string;
  pnl: ProfitLoss;
  stockIsCurrent: boolean;
}

export const getChartOfAccountsFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z.object({ asOf: isoDate, branchId: z.string().default(BRANCH_DEFAULT) }).parse(raw),
  )
  .handler(async ({ data }): Promise<ChartOfAccounts> => {
    const fyFrom = fyBounds(fyCodeFor(data.asOf)).from;
    const [position, f] = await Promise.all([
      loadPosition(data.asOf, data.branchId),
      loadFacts(data.asOf, data.branchId, fyFrom),
    ]);
    return {
      position,
      fyFrom,
      pnl: buildProfitLoss(f.sales, f.bills, f.expenses, fyFrom, data.asOf),
      stockIsCurrent: data.asOf < todayIST(),
    };
  });
