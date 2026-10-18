/**
 * Accounts reports — pure maths over plain facts.
 *
 * Nothing here touches the database and nothing is stored: every report is a
 * read-model derived from the sales, purchase, payment and expense records
 * (loaded by serverFns/accounts.ts). Convention for party balances matches the
 * ledgers module: balance = Σdebit − Σcredit (positive = they owe us).
 */
import { roundMoney } from "@/lib/utils/moneyUtils";

const r2 = roundMoney;

// ─── Facts ───────────────────────────────────────────────────────────────────

export type MovementKind = "RECEIPT" | "REFUND" | "SUPPLIER_PAYMENT" | "EXPENSE";

/** One tender of one voucher. */
export interface Movement {
  date: string;
  sortKey: number;
  voucherNo: string;
  kind: MovementKind;
  direction: "IN" | "OUT";
  mode: string;
  amount: number;
  /** Customer partyId, or the supplier id for SUPPLIER_PAYMENT. */
  partyId: string;
  party: string;
  narration: string;
  reference: string;
  /** Bills/invoices this voucher was allocated against. */
  against: string;
  /** False for a cheque/DD that has not cleared — not yet money in the bank. */
  cleared: boolean;
}

export interface SaleFact {
  date: string;
  kind: "INVOICE" | "CREDIT_NOTE";
  partyId: string;
  partyName: string;
  grandTotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  lines: { lineType: string; taxable: number; rate: number; tax: number }[];
}

export interface BillFact {
  date: string;
  kind: "PURCHASE" | "DEBIT_NOTE";
  supplierId: string;
  supplierName: string;
  grandTotal: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  /** Input tax credit can be claimed. When false the tax is part of the cost. */
  itc: boolean;
  items: { rate: number; taxable: number; tax: number }[];
}

export interface ExpenseFact {
  date: string;
  category: string;
  business: boolean;
  total: number;
  taxable: number;
  gst: number;
  itc: boolean;
  paidByStaffId: string;
}

export interface PartyBase {
  id: string;
  name: string;
  /** Signed opening balance, Dr positive. */
  opening: number;
}

export interface StaffEntryFact {
  staffId: string;
  date: string;
  debit: number;
  credit: number;
}

const inRange = (d: string, from: string, to: string) => d >= from && d <= to;
const saleSign = (s: SaleFact) => (s.kind === "INVOICE" ? 1 : -1);
const billSign = (b: BillFact) => (b.kind === "PURCHASE" ? 1 : -1);
const saleTax = (s: SaleFact) => s.cgst + s.sgst + s.igst + s.cess;
const billTax = (b: BillFact) => b.cgst + b.sgst + b.igst;
/** Sales value excluding GST (shipping and round-off included, so it ties to the receivable). */
const saleRevenue = (s: SaleFact) => s.grandTotal - saleTax(s);
/** Purchase cost: what the bill adds to cost once recoverable input tax is set aside. */
const billCost = (b: BillFact) => b.grandTotal - (b.itc ? billTax(b) : 0);
const expenseCost = (e: ExpenseFact) => (e.itc ? e.taxable : e.total);
const expenseItc = (e: ExpenseFact) => (e.itc ? e.gst : 0);

// ─── Cash Book / Business Book ───────────────────────────────────────────────

export type BookScope = "CASH" | "BUSINESS";

export interface BookRow {
  date: string;
  voucherNo: string;
  particulars: string;
  mode: string;
  kind: MovementKind;
  received: number;
  paid: number;
  /** Running balance — cleared money only. */
  balance: number;
  /** Cheque/DD not yet cleared: listed, but not in the balance. */
  pending: boolean;
}

export interface BookReport {
  scope: BookScope;
  openingBalance: number;
  closingBalance: number;
  totalReceived: number;
  totalPaid: number;
  pendingReceived: number;
  pendingPaid: number;
  byMode: { mode: string; received: number; paid: number }[];
  rows: BookRow[];
}

const describe = (m: Movement) => {
  const who = m.party || "party";
  const base =
    m.kind === "RECEIPT"
      ? `Receipt from ${who}`
      : m.kind === "REFUND"
        ? `Refund to ${who}`
        : m.kind === "SUPPLIER_PAYMENT"
          ? `Payment to ${who}`
          : `Expense – ${who}`;
  return m.narration ? `${base} – ${m.narration}` : base;
};

export function buildBook(all: Movement[], scope: BookScope, from: string, to: string): BookReport {
  const sorted = all
    .filter((m) => m.date <= to && (scope === "BUSINESS" || m.mode === "CASH"))
    .sort((a, b) => a.date.localeCompare(b.date) || a.sortKey - b.sortKey);

  let running = 0;
  let opening = 0;
  let totalReceived = 0;
  let totalPaid = 0;
  let pendingReceived = 0;
  let pendingPaid = 0;
  const rows: BookRow[] = [];
  const modes = new Map<string, { received: number; paid: number }>();

  for (const m of sorted) {
    const isIn = m.direction === "IN";
    if (m.cleared) running = r2(running + (isIn ? m.amount : -m.amount));
    if (m.date < from) {
      opening = running;
      continue;
    }
    if (m.cleared) {
      if (isIn) totalReceived += m.amount;
      else totalPaid += m.amount;
      const t = modes.get(m.mode) ?? { received: 0, paid: 0 };
      if (isIn) t.received += m.amount;
      else t.paid += m.amount;
      modes.set(m.mode, t);
    } else if (isIn) pendingReceived += m.amount;
    else pendingPaid += m.amount;

    rows.push({
      date: m.date,
      voucherNo: m.voucherNo,
      particulars: m.cleared ? describe(m) : `${describe(m)} (pending clearance)`,
      mode: m.mode,
      kind: m.kind,
      received: isIn ? m.amount : 0,
      paid: isIn ? 0 : m.amount,
      balance: running,
      pending: !m.cleared,
    });
  }

  return {
    scope,
    openingBalance: r2(opening),
    closingBalance: r2(running),
    totalReceived: r2(totalReceived),
    totalPaid: r2(totalPaid),
    pendingReceived: r2(pendingReceived),
    pendingPaid: r2(pendingPaid),
    byMode: [...modes].map(([mode, v]) => ({ mode, received: r2(v.received), paid: r2(v.paid) })),
    rows,
  };
}

// ─── Payment Received / Payment Paid ─────────────────────────────────────────

export interface PaymentRegisterRow {
  date: string;
  voucherNo: string;
  kind: MovementKind;
  party: string;
  modes: string;
  reference: string;
  against: string;
  narration: string;
  amount: number;
  pendingAmount: number;
}

export interface PaymentRegister {
  direction: "IN" | "OUT";
  total: number;
  pending: number;
  byMode: { mode: string; amount: number }[];
  byKind: { kind: MovementKind; amount: number }[];
  rows: PaymentRegisterRow[];
}

export function buildPaymentRegister(
  all: Movement[],
  direction: "IN" | "OUT",
  from: string,
  to: string,
): PaymentRegister {
  const vouchers = new Map<
    string,
    PaymentRegisterRow & { sortKey: number; modeSet: Set<string>; refs: Set<string> }
  >();
  const byMode = new Map<string, number>();
  const byKind = new Map<MovementKind, number>();
  let total = 0;
  let pending = 0;

  for (const m of all) {
    if (m.direction !== direction || !inRange(m.date, from, to)) continue;
    const key = `${m.kind}|${m.voucherNo}`;
    const v = vouchers.get(key) ?? {
      date: m.date,
      voucherNo: m.voucherNo,
      kind: m.kind,
      party: m.party,
      modes: "",
      reference: "",
      against: m.against,
      narration: m.narration,
      amount: 0,
      pendingAmount: 0,
      sortKey: m.sortKey,
      modeSet: new Set<string>(),
      refs: new Set<string>(),
    };
    v.modeSet.add(m.mode);
    if (m.reference) v.refs.add(m.reference);
    if (m.cleared) {
      v.amount += m.amount;
      total += m.amount;
      byMode.set(m.mode, (byMode.get(m.mode) ?? 0) + m.amount);
      byKind.set(m.kind, (byKind.get(m.kind) ?? 0) + m.amount);
    } else {
      v.pendingAmount += m.amount;
      pending += m.amount;
    }
    vouchers.set(key, v);
  }

  const rows = [...vouchers.values()]
    .sort((a, b) => b.date.localeCompare(a.date) || b.sortKey - a.sortKey)
    .map(({ sortKey: _s, modeSet, refs, ...v }) => ({
      ...v,
      modes: [...modeSet].join(" + "),
      reference: [...refs].join(", "),
      amount: r2(v.amount),
      pendingAmount: r2(v.pendingAmount),
    }));

  return {
    direction,
    total: r2(total),
    pending: r2(pending),
    byMode: [...byMode].map(([mode, amount]) => ({ mode, amount: r2(amount) })),
    byKind: [...byKind].map(([kind, amount]) => ({ kind, amount: r2(amount) })),
    rows,
  };
}

// ─── Daily Summary ───────────────────────────────────────────────────────────

export interface DailyRow {
  date: string;
  invoiceCount: number;
  saleTotal: number;
  creditNoteTotal: number;
  purchaseTotal: number;
  expenseTotal: number;
  received: number;
  paidOut: number;
  cashIn: number;
  cashOut: number;
}

export type DailyTotals = Omit<DailyRow, "date">;

export function buildDailySummary(
  sales: SaleFact[],
  bills: BillFact[],
  expenses: ExpenseFact[],
  movements: Movement[],
  from: string,
  to: string,
): { rows: DailyRow[]; totals: DailyTotals } {
  const days = new Map<string, DailyRow>();
  const day = (date: string) => {
    let d = days.get(date);
    if (!d) {
      d = {
        date,
        invoiceCount: 0,
        saleTotal: 0,
        creditNoteTotal: 0,
        purchaseTotal: 0,
        expenseTotal: 0,
        received: 0,
        paidOut: 0,
        cashIn: 0,
        cashOut: 0,
      };
      days.set(date, d);
    }
    return d;
  };

  for (const s of sales) {
    if (!inRange(s.date, from, to)) continue;
    const d = day(s.date);
    if (s.kind === "INVOICE") {
      d.invoiceCount += 1;
      d.saleTotal += s.grandTotal;
    } else d.creditNoteTotal += s.grandTotal;
  }
  for (const b of bills) {
    if (inRange(b.date, from, to)) day(b.date).purchaseTotal += billSign(b) * b.grandTotal;
  }
  for (const e of expenses) {
    if (inRange(e.date, from, to)) day(e.date).expenseTotal += e.total;
  }
  for (const m of movements) {
    if (!m.cleared || !inRange(m.date, from, to)) continue;
    const d = day(m.date);
    if (m.direction === "IN") {
      d.received += m.amount;
      if (m.mode === "CASH") d.cashIn += m.amount;
    } else {
      d.paidOut += m.amount;
      if (m.mode === "CASH") d.cashOut += m.amount;
    }
  }

  const rows = [...days.values()]
    .map((d) => ({
      ...d,
      saleTotal: r2(d.saleTotal),
      creditNoteTotal: r2(d.creditNoteTotal),
      purchaseTotal: r2(d.purchaseTotal),
      expenseTotal: r2(d.expenseTotal),
      received: r2(d.received),
      paidOut: r2(d.paidOut),
      cashIn: r2(d.cashIn),
      cashOut: r2(d.cashOut),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const totals = rows.reduce<DailyTotals>(
    (t, d) => ({
      invoiceCount: t.invoiceCount + d.invoiceCount,
      saleTotal: r2(t.saleTotal + d.saleTotal),
      creditNoteTotal: r2(t.creditNoteTotal + d.creditNoteTotal),
      purchaseTotal: r2(t.purchaseTotal + d.purchaseTotal),
      expenseTotal: r2(t.expenseTotal + d.expenseTotal),
      received: r2(t.received + d.received),
      paidOut: r2(t.paidOut + d.paidOut),
      cashIn: r2(t.cashIn + d.cashIn),
      cashOut: r2(t.cashOut + d.cashOut),
    }),
    {
      invoiceCount: 0,
      saleTotal: 0,
      creditNoteTotal: 0,
      purchaseTotal: 0,
      expenseTotal: 0,
      received: 0,
      paidOut: 0,
      cashIn: 0,
      cashOut: 0,
    },
  );
  return { rows, totals };
}

// ─── Input / Output Tax ──────────────────────────────────────────────────────

export interface TaxBucket {
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  /** GST on expenses — no CGST/SGST/IGST split is recorded for those. */
  other: number;
  total: number;
}

export interface TaxSection {
  totals: TaxBucket;
  /** Rate is null for expense ITC, where the rate is not recorded. */
  byRate: { rate: number | null; taxable: number; tax: number }[];
  byMonth: { month: string; taxable: number; tax: number }[];
}

export interface TaxReport {
  output: TaxSection;
  input: TaxSection;
  /** Output − input. Positive = payable, negative = credit carried forward. */
  netPayable: number;
}

const emptyBucket = (): TaxBucket => ({
  taxable: 0,
  cgst: 0,
  sgst: 0,
  igst: 0,
  cess: 0,
  other: 0,
  total: 0,
});

function finishSection(
  totals: TaxBucket,
  rates: Map<number | null, { taxable: number; tax: number }>,
  months: Map<string, { taxable: number; tax: number }>,
): TaxSection {
  const t = (Object.keys(totals) as (keyof TaxBucket)[]).reduce(
    (o, k) => ({ ...o, [k]: r2(totals[k]) }),
    emptyBucket(),
  );
  return {
    totals: t,
    byRate: [...rates]
      .map(([rate, v]) => ({ rate, taxable: r2(v.taxable), tax: r2(v.tax) }))
      .sort((a, b) => (a.rate ?? -1) - (b.rate ?? -1)),
    byMonth: [...months]
      .map(([month, v]) => ({ month, taxable: r2(v.taxable), tax: r2(v.tax) }))
      .sort((a, b) => a.month.localeCompare(b.month)),
  };
}

function bump<K>(
  map: Map<K, { taxable: number; tax: number }>,
  key: K,
  taxable: number,
  tax: number,
) {
  const v = map.get(key) ?? { taxable: 0, tax: 0 };
  v.taxable += taxable;
  v.tax += tax;
  map.set(key, v);
}

export function buildTaxReport(
  sales: SaleFact[],
  bills: BillFact[],
  expenses: ExpenseFact[],
  from: string,
  to: string,
): TaxReport {
  const out = emptyBucket();
  const outRates = new Map<number | null, { taxable: number; tax: number }>();
  const outMonths = new Map<string, { taxable: number; tax: number }>();
  for (const s of sales) {
    if (!inRange(s.date, from, to)) continue;
    const g = saleSign(s);
    const taxable = g * saleRevenue(s);
    out.taxable += taxable;
    out.cgst += g * s.cgst;
    out.sgst += g * s.sgst;
    out.igst += g * s.igst;
    out.cess += g * s.cess;
    out.total += g * saleTax(s);
    bump(outMonths, s.date.slice(0, 7), taxable, g * saleTax(s));
    for (const l of s.lines) bump(outRates, l.rate, g * l.taxable, g * l.tax);
  }

  const inn = emptyBucket();
  const inRates = new Map<number | null, { taxable: number; tax: number }>();
  const inMonths = new Map<string, { taxable: number; tax: number }>();
  for (const b of bills) {
    if (!inRange(b.date, from, to) || !b.itc) continue;
    const g = billSign(b);
    inn.taxable += g * b.taxable;
    inn.cgst += g * b.cgst;
    inn.sgst += g * b.sgst;
    inn.igst += g * b.igst;
    inn.total += g * billTax(b);
    bump(inMonths, b.date.slice(0, 7), g * b.taxable, g * billTax(b));
    for (const i of b.items) bump(inRates, i.rate, g * i.taxable, g * i.tax);
  }
  for (const e of expenses) {
    if (!inRange(e.date, from, to) || !e.itc) continue;
    inn.taxable += e.taxable;
    inn.other += e.gst;
    inn.total += e.gst;
    bump(inMonths, e.date.slice(0, 7), e.taxable, e.gst);
    bump(inRates, null, e.taxable, e.gst);
  }

  const output = finishSection(out, outRates, outMonths);
  const input = finishSection(inn, inRates, inMonths);
  return { output, input, netPayable: r2(output.totals.total - input.totals.total) };
}

// ─── Profit & Loss ───────────────────────────────────────────────────────────

export interface ProfitLoss {
  income: { label: string; amount: number }[];
  totalIncome: number;
  purchases: number;
  grossProfit: number;
  expenses: { label: string; amount: number }[];
  totalExpenses: number;
  netProfit: number;
  /** Personal-nature expenses are excluded from profit. */
  excludedPersonal: number;
}

/**
 * Purchase basis: stock bought is expensed when billed and closing stock is not
 * deducted, so profit reads low while the clinic is building stock. Revenue and
 * costs are net of GST (recoverable input tax is not a cost).
 */
export function buildProfitLoss(
  sales: SaleFact[],
  bills: BillFact[],
  expenses: ExpenseFact[],
  from: string,
  to: string,
): ProfitLoss {
  const income = new Map<string, number>();
  let revenue = 0;
  let lineSum = 0;
  for (const s of sales) {
    if (!inRange(s.date, from, to)) continue;
    const g = saleSign(s);
    revenue += g * saleRevenue(s);
    for (const l of s.lines) {
      income.set(l.lineType, (income.get(l.lineType) ?? 0) + g * l.taxable);
      lineSum += g * l.taxable;
    }
  }
  const other = r2(revenue - lineSum);
  const incomeRows = [...income]
    .map(([label, amount]) => ({ label, amount: r2(amount) }))
    .sort((a, b) => b.amount - a.amount);
  if (Math.abs(other) >= 0.005)
    incomeRows.push({ label: "Shipping, round-off & other", amount: other });

  let purchases = 0;
  for (const b of bills) if (inRange(b.date, from, to)) purchases += billSign(b) * billCost(b);

  const exp = new Map<string, number>();
  let personal = 0;
  for (const e of expenses) {
    if (!inRange(e.date, from, to)) continue;
    if (!e.business) personal += e.total;
    else exp.set(e.category, (exp.get(e.category) ?? 0) + expenseCost(e));
  }
  const expenseRows = [...exp]
    .map(([label, amount]) => ({ label, amount: r2(amount) }))
    .sort((a, b) => b.amount - a.amount);
  const totalExpenses = r2(expenseRows.reduce((t, e) => t + e.amount, 0));

  const totalIncome = r2(revenue);
  const grossProfit = r2(totalIncome - purchases);
  return {
    income: incomeRows,
    totalIncome,
    purchases: r2(purchases),
    grossProfit,
    expenses: expenseRows,
    totalExpenses,
    netProfit: r2(grossProfit - totalExpenses),
    excludedPersonal: r2(personal),
  };
}

// ─── Financial position (Balance Sheet + Chart of Accounts) ──────────────────

export interface PartyBalance {
  id: string;
  name: string;
  amount: number;
}

export interface StockFact {
  /** Active batches at cost (rate + landing). */
  value: number;
  /** Expired batches still on hand — a write-off candidate, not counted as an asset. */
  expiredValue: number;
  batches: number;
}

export interface Position {
  asOf: string;
  cash: number;
  bank: { mode: string; amount: number }[];
  bankTotal: number;
  /** Cheques/DD received (or issued, negative) that have not cleared. */
  pendingInstruments: number;
  receivables: PartyBalance[];
  receivablesTotal: number;
  supplierAdvances: PartyBalance[];
  supplierAdvancesTotal: number;
  staffAdvances: PartyBalance[];
  staffAdvancesTotal: number;
  stock: StockFact;
  gstCredit: number;
  payables: PartyBalance[];
  payablesTotal: number;
  customerAdvances: PartyBalance[];
  customerAdvancesTotal: number;
  staffDue: PartyBalance[];
  staffDueTotal: number;
  gstPayable: number;
  inputGst: number;
  outputGst: number;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  /** Net worth, explained: cumulative profit + stock not yet expensed + the rest. */
  profitToDate: number;
  stockNotExpensed: number;
  capitalAndOther: number;
}

const WALK_IN = "__walkin__";

function settle(map: Map<string, PartyBalance>) {
  const dr: PartyBalance[] = [];
  const cr: PartyBalance[] = [];
  for (const p of map.values()) {
    const amount = r2(p.amount);
    if (amount > 0.005) dr.push({ ...p, amount });
    else if (amount < -0.005) cr.push({ ...p, amount: -amount });
  }
  const byAmount = (a: PartyBalance, b: PartyBalance) => b.amount - a.amount;
  return { dr: dr.sort(byAmount), cr: cr.sort(byAmount) };
}

const sum = (xs: { amount: number }[]) => r2(xs.reduce((t, x) => t + x.amount, 0));

export function buildPosition(input: {
  asOf: string;
  movements: Movement[];
  sales: SaleFact[];
  bills: BillFact[];
  expenses: ExpenseFact[];
  customers: PartyBase[];
  suppliers: PartyBase[];
  staff: PartyBase[];
  staffEntries: StaffEntryFact[];
  stock: StockFact;
}): Position {
  const { asOf } = input;
  const movements = input.movements.filter((m) => m.date <= asOf);
  const sales = input.sales.filter((s) => s.date <= asOf);
  const bills = input.bills.filter((b) => b.date <= asOf);
  const expenses = input.expenses.filter((e) => e.date <= asOf);

  // Money actually held: cash, then each non-cash mode (cleared only).
  let cash = 0;
  const bankModes = new Map<string, number>();
  let pendingInstruments = 0;
  for (const m of movements) {
    const signed = m.direction === "IN" ? m.amount : -m.amount;
    if (!m.cleared) pendingInstruments += signed;
    else if (m.mode === "CASH") cash += signed;
    else bankModes.set(m.mode, (bankModes.get(m.mode) ?? 0) + signed);
  }
  const bank = [...bankModes].map(([mode, amount]) => ({ mode, amount: r2(amount) }));

  // Customers: invoices − credit notes − receipts + refunds.
  const cust = new Map<string, PartyBalance>();
  const custRow = (id: string, name: string) => {
    let p = cust.get(id);
    if (!p) cust.set(id, (p = { id, name, amount: 0 }));
    return p;
  };
  for (const c of input.customers) custRow(c.id, c.name).amount += c.opening;
  for (const s of sales) {
    const id = s.partyId || WALK_IN;
    custRow(id, s.partyName || "Walk-in customers").amount += saleSign(s) * s.grandTotal;
  }
  for (const m of movements) {
    if (m.kind !== "RECEIPT" && m.kind !== "REFUND") continue;
    const id = m.partyId || WALK_IN;
    custRow(id, m.party || "Walk-in customers").amount +=
      m.kind === "RECEIPT" ? -m.amount : m.amount;
  }

  // Suppliers: payments + debit notes − bills.
  const sup = new Map<string, PartyBalance>();
  const supRow = (id: string, name: string) => {
    let p = sup.get(id);
    if (!p) sup.set(id, (p = { id, name, amount: 0 }));
    return p;
  };
  for (const s of input.suppliers) supRow(s.id, s.name).amount += s.opening;
  for (const b of bills) supRow(b.supplierId, b.supplierName).amount -= billSign(b) * b.grandTotal;
  for (const m of movements) {
    if (m.kind === "SUPPLIER_PAYMENT") supRow(m.partyId, m.party).amount += m.amount;
  }

  // Staff: ledger entries, less expenses they paid personally (clinic owes them back).
  const staffMap = new Map<string, PartyBalance>();
  const staffRow = (id: string, name: string) => {
    let p = staffMap.get(id);
    if (!p) staffMap.set(id, (p = { id, name, amount: 0 }));
    return p;
  };
  const staffName = new Map(input.staff.map((s) => [s.id, s.name]));
  for (const e of input.staffEntries) {
    if (e.date <= asOf)
      staffRow(e.staffId, staffName.get(e.staffId) ?? "Staff").amount += e.debit - e.credit;
  }
  for (const e of expenses) {
    if (e.paidByStaffId)
      staffRow(e.paidByStaffId, staffName.get(e.paidByStaffId) ?? "Staff").amount -= e.total;
  }

  const c = settle(cust);
  const s = settle(sup);
  const st = settle(staffMap);

  // GST: cumulative output vs input credit (payments to the government are not recorded).
  let outputGst = 0;
  let inputGst = 0;
  for (const x of sales) outputGst += saleSign(x) * saleTax(x);
  for (const b of bills) if (b.itc) inputGst += billSign(b) * billTax(b);
  for (const e of expenses) inputGst += expenseItc(e);
  outputGst = r2(outputGst);
  inputGst = r2(inputGst);
  const gstNet = r2(outputGst - inputGst);

  const bankTotal = sum(bank);
  const totalAssets = r2(
    cash +
      bankTotal +
      pendingInstruments +
      sum(c.dr) +
      sum(s.dr) +
      sum(st.dr) +
      input.stock.value +
      Math.max(0, -gstNet),
  );
  const totalLiabilities = r2(sum(s.cr) + sum(c.cr) + sum(st.cr) + Math.max(0, gstNet));
  const netWorth = r2(totalAssets - totalLiabilities);

  const profitToDate = buildProfitLoss(sales, bills, expenses, "0000-00-00", asOf).netProfit;
  const stockNotExpensed = r2(input.stock.value);

  return {
    asOf,
    cash: r2(cash),
    bank,
    bankTotal,
    pendingInstruments: r2(pendingInstruments),
    receivables: c.dr,
    receivablesTotal: sum(c.dr),
    supplierAdvances: s.dr,
    supplierAdvancesTotal: sum(s.dr),
    staffAdvances: st.dr,
    staffAdvancesTotal: sum(st.dr),
    stock: input.stock,
    gstCredit: Math.max(0, -gstNet),
    payables: s.cr,
    payablesTotal: sum(s.cr),
    customerAdvances: c.cr,
    customerAdvancesTotal: sum(c.cr),
    staffDue: st.cr,
    staffDueTotal: sum(st.cr),
    gstPayable: Math.max(0, gstNet),
    inputGst,
    outputGst,
    totalAssets,
    totalLiabilities,
    netWorth,
    profitToDate,
    stockNotExpensed,
    capitalAndOther: r2(netWorth - profitToDate - stockNotExpensed),
  };
}
