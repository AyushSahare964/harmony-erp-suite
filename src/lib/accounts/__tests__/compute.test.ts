import { describe, it, expect } from "vitest";
import {
  buildBook,
  buildDailySummary,
  buildPosition,
  buildProfitLoss,
  buildTaxReport,
  type BillFact,
  type ExpenseFact,
  type Movement,
  type SaleFact,
} from "../compute";

const mv = (p: Partial<Movement>): Movement => ({
  date: "2026-04-10",
  sortKey: 0,
  voucherNo: "V",
  kind: "RECEIPT",
  direction: "IN",
  mode: "CASH",
  amount: 0,
  partyId: "",
  party: "",
  narration: "",
  reference: "",
  against: "",
  cleared: true,
  ...p,
});

const sale = (p: Partial<SaleFact> = {}): SaleFact => ({
  date: "2026-04-10",
  kind: "INVOICE",
  partyId: "P1",
  partyName: "Asha",
  grandTotal: 1180,
  cgst: 90,
  sgst: 90,
  igst: 0,
  cess: 0,
  lines: [{ lineType: "Pharmacy", taxable: 1000, rate: 18, tax: 180 }],
  ...p,
});

const bill = (p: Partial<BillFact> = {}): BillFact => ({
  date: "2026-04-11",
  kind: "PURCHASE",
  supplierId: "S1",
  supplierName: "Mesko",
  grandTotal: 590,
  taxable: 500,
  cgst: 45,
  sgst: 45,
  igst: 0,
  itc: true,
  items: [{ rate: 18, taxable: 500, tax: 90 }],
  ...p,
});

const expense = (p: Partial<ExpenseFact> = {}): ExpenseFact => ({
  date: "2026-04-12",
  category: "Rent",
  business: true,
  total: 100,
  taxable: 100,
  gst: 0,
  itc: false,
  paidByStaffId: "",
  ...p,
});

describe("buildBook", () => {
  const moves = [
    mv({ date: "2026-03-30", amount: 500 }),
    mv({ date: "2026-04-10", amount: 300, voucherNo: "R1" }),
    mv({ date: "2026-04-11", direction: "OUT", kind: "EXPENSE", amount: 120 }),
    mv({ date: "2026-04-11", mode: "UPI", amount: 999 }),
    mv({ date: "2026-04-12", mode: "CHEQUE", amount: 700, cleared: false }),
  ];

  it("cash book keeps cash only, rolling earlier days into the opening balance", () => {
    const b = buildBook(moves, "CASH", "2026-04-01", "2026-04-30");
    expect(b.openingBalance).toBe(500);
    expect(b.totalReceived).toBe(300);
    expect(b.totalPaid).toBe(120);
    expect(b.closingBalance).toBe(680);
  });

  it("business book covers every mode but a pending cheque is not in the balance", () => {
    const b = buildBook(moves, "BUSINESS", "2026-04-01", "2026-04-30");
    expect(b.closingBalance).toBe(1679);
    expect(b.pendingReceived).toBe(700);
    expect(b.rows.at(-1)?.pending).toBe(true);
  });
});

describe("tax, profit and loss", () => {
  it("nets credit notes and splits input from output tax", () => {
    const cn = sale({
      kind: "CREDIT_NOTE",
      grandTotal: 118,
      cgst: 9,
      sgst: 9,
      lines: [{ lineType: "Pharmacy", taxable: 100, rate: 18, tax: 18 }],
    });
    const t = buildTaxReport([sale(), cn], [bill()], [], "2026-04-01", "2026-04-30");
    expect(t.output.totals.total).toBe(162);
    expect(t.input.totals.total).toBe(90);
    expect(t.netPayable).toBe(72);
  });

  it("P&L is ex-GST; non-claimable input tax is a cost", () => {
    const p = buildProfitLoss(
      [sale()],
      [bill(), bill({ itc: false })],
      [expense()],
      "2026-04-01",
      "2026-04-30",
    );
    expect(p.totalIncome).toBe(1000);
    expect(p.purchases).toBe(500 + 590);
    expect(p.netProfit).toBe(1000 - 1090 - 100);
  });
});

describe("daily summary", () => {
  it("groups by day", () => {
    const d = buildDailySummary(
      [sale()],
      [bill()],
      [expense()],
      [mv({ amount: 300 })],
      "2026-04-01",
      "2026-04-30",
    );
    expect(d.rows).toHaveLength(3);
    expect(d.totals.saleTotal).toBe(1180);
    expect(d.totals.cashIn).toBe(300);
  });
});

describe("buildPosition", () => {
  it("assets − liabilities = net worth, and net worth is fully explained", () => {
    const pos = buildPosition({
      asOf: "2026-04-30",
      movements: [
        mv({ amount: 400, partyId: "P1" }),
        mv({
          direction: "OUT",
          kind: "SUPPLIER_PAYMENT",
          amount: 200,
          partyId: "S1",
          party: "Mesko",
          mode: "UPI",
        }),
      ],
      sales: [sale()],
      bills: [bill()],
      expenses: [],
      customers: [{ id: "P1", name: "Asha", opening: 0 }],
      suppliers: [{ id: "S1", name: "Mesko", opening: 0 }],
      staff: [],
      staffEntries: [],
      stock: { value: 300, expiredValue: 0, batches: 1 },
    });
    expect(pos.receivablesTotal).toBe(780); // 1180 − 400
    expect(pos.payablesTotal).toBe(390); // 590 − 200
    expect(pos.cash).toBe(400);
    expect(pos.bankTotal).toBe(-200);
    expect(pos.gstPayable).toBe(90); // 180 out − 90 in
    expect(pos.netWorth).toBe(pos.totalAssets - pos.totalLiabilities);
    expect(pos.profitToDate + pos.stockNotExpensed + pos.capitalAndOther).toBeCloseTo(
      pos.netWorth,
      2,
    );
  });
});
