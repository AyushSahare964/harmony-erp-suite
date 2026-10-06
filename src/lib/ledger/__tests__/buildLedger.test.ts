import { describe, it, expect } from "vitest";
import { buildLedger, signedOpening } from "../buildLedger";

const ev = (date: string, debit: number, credit: number) => ({
  date,
  voucherNo: "V",
  particulars: "p",
  debit,
  credit,
});

describe("buildLedger", () => {
  it("rolls pre-period events into the opening balance and ignores later ones", () => {
    const r = buildLedger(
      signedOpening(100, "Cr"), // we owe 100
      [ev("2026-03-01", 0, 50), ev("2026-04-10", 30, 0), ev("2026-05-01", 0, 20), ev("2026-12-01", 0, 999)],
      "2026-04-01",
      "2026-06-30",
    );
    expect(r.openingBalance).toBe(-150);
    expect(r.rows.map((x) => x.balance)).toEqual([-120, -140]);
    expect(r.closingBalance).toBe(-140);
    expect(r.totalDebit).toBe(30);
    expect(r.totalCredit).toBe(20);
  });
});
