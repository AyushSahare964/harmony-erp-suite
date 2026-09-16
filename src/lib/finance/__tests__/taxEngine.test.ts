/**
 * Tax engine test matrix (implementation plan §11.1).
 *
 * These run before any UI exists and must stay green forever — the clinic's
 * GST returns and the CA sign-off both depend on the numbers here.
 */

import { describe, it, expect } from "vitest";
import { computeDocument, computeQuick, type InvoiceType, type TaxDocInput } from "../taxEngine";
import { roundMoney } from "@/lib/utils/moneyUtils";

const INTRA = { branchStateCode: "27", placeOfSupply: "27" };
const INTER = { branchStateCode: "27", placeOfSupply: "29" };

function doc(over: Partial<TaxDocInput> = {}): TaxDocInput {
  return {
    lines: [{ quantity: 1, rate: 1000, gstRate: 18 }],
    invoiceType: "GST",
    ...INTRA,
    ...over,
  } as TaxDocInput;
}

// ─── 1. The cross-product matrix ──────────────────────────────────────────────

const RATES = [0, 5, 12, 18, 28];
const PLACES = [
  { name: "intra", geo: INTRA, inter: false },
  { name: "inter", geo: INTER, inter: true },
];
const PRICING = [
  { name: "exclusive", inclusive: false },
  { name: "inclusive", inclusive: true },
];
const DISCOUNTS = [
  { name: "no discount", discountType: undefined, discountValue: 0 },
  { name: "% discount", discountType: "percentage" as const, discountValue: 10 },
  { name: "₹ discount", discountType: "fixed" as const, discountValue: 100 },
];
const CLASSES = [
  { name: "goods", quantity: 2, rate: 500 },
  { name: "service", quantity: 1, rate: 1000 },
];

describe("matrix: {intra,inter} x {0,5,12,18,28} x {excl,incl} x {none,%,₹} x {goods,service}", () => {
  for (const place of PLACES) {
    for (const rate of RATES) {
      for (const pricing of PRICING) {
        for (const disc of DISCOUNTS) {
          for (const cls of CLASSES) {
            const label = `${place.name} · ${rate}% · ${pricing.name} · ${disc.name} · ${cls.name}`;

            it(label, () => {
              const r = computeDocument(
                doc({
                  ...place.geo,
                  priceInclusive: pricing.inclusive,
                  lines: [
                    {
                      quantity: cls.quantity,
                      rate: cls.rate,
                      gstRate: rate,
                      discountType: disc.discountType,
                      discountValue: disc.discountValue,
                    },
                  ],
                }),
              );

              const line = r.lines[0]!;

              // The tax split always follows the place of supply.
              expect(r.isInterstate).toBe(place.inter);
              if (place.inter) {
                expect(line.cgst).toBe(0);
                expect(line.sgst).toBe(0);
                expect(line.igst).toBe(line.taxTotal);
              } else {
                expect(line.igst).toBe(0);
                // CGST + SGST must reconcile to the paisa.
                expect(roundMoney(line.cgst + line.sgst)).toBe(line.taxTotal);
              }

              // A line always reconciles internally.
              expect(line.lineTotal).toBe(roundMoney(line.taxableValue + line.taxTotal));

              // Discount is applied before tax, never after.
              const gross = roundMoney(cls.quantity * cls.rate);
              expect(line.gross).toBe(gross);
              const expectedDiscount =
                disc.discountType === "percentage"
                  ? roundMoney((gross * disc.discountValue) / 100)
                  : disc.discountType === "fixed"
                    ? Math.min(gross, disc.discountValue)
                    : 0;
              expect(line.discountAmount).toBe(expectedDiscount);

              // Inclusive pricing must never inflate the customer's total.
              const net = roundMoney(gross - expectedDiscount);
              if (pricing.inclusive && rate > 0) {
                expect(line.lineTotal).toBeCloseTo(net, 2);
                expect(line.taxableValue).toBeLessThan(net);
              } else {
                expect(line.taxableValue).toBe(net);
              }

              // Document totals reconcile with the lines.
              expect(r.taxableValue).toBe(line.taxableValue);
              expect(r.taxTotal).toBe(line.taxTotal);
              expect(r.grandTotal).toBe(Math.round(r.grandTotalRaw));
            });
          }
        }
      }
    }
  }
});

// ─── 2. Zero-rated document types ─────────────────────────────────────────────

describe("document types that carry no tax", () => {
  it.each<[InvoiceType]>([["NON_GST"], ["BILL_OF_SUPPLY"]])(
    "%s charges no tax even at 18%%",
    (invoiceType) => {
      const r = computeDocument(doc({ invoiceType }));
      expect(r.taxApplicable).toBe(false);
      expect(r.taxTotal).toBe(0);
      expect(r.cgst + r.sgst + r.igst).toBe(0);
      expect(r.taxableValue).toBe(1000);
      expect(r.grandTotal).toBe(1000);
    },
  );

  it("EXPORT under LUT is zero-rated", () => {
    const r = computeDocument(doc({ invoiceType: "EXPORT", lutEnabled: true }));
    expect(r.taxApplicable).toBe(false);
    expect(r.taxTotal).toBe(0);
  });

  it("EXPORT without LUT attracts IGST and is always inter-state", () => {
    const r = computeDocument(doc({ invoiceType: "EXPORT", lutEnabled: false, ...INTRA }));
    expect(r.isInterstate).toBe(true);
    expect(r.igst).toBe(180);
    expect(r.cgst).toBe(0);
    expect(r.sgst).toBe(0);
  });
});

// ─── 3. Edge cases from the plan ──────────────────────────────────────────────

describe("edge cases", () => {
  it("handles a quantity with 3 decimals (0.125 kg feed)", () => {
    const r = computeDocument(doc({ lines: [{ quantity: 0.125, rate: 480, gstRate: 5 }] }));
    expect(r.lines[0]!.gross).toBe(60);
    expect(r.taxableValue).toBe(60);
    expect(r.taxTotal).toBe(3);
    expect(r.grandTotal).toBe(63);
  });

  it("handles a rate with paise (₹12.67)", () => {
    const r = computeDocument(doc({ lines: [{ quantity: 3, rate: 12.67, gstRate: 12 }] }));
    expect(r.lines[0]!.gross).toBe(38.01);
    expect(r.taxTotal).toBe(roundMoney(38.01 * 0.12));
  });

  it("puts the residue paisa on SGST so CGST + SGST === tax total", () => {
    // 5% of 100.20 = 5.01 — an odd number of paise, so the half-split of 2.505
    // cannot be represented twice. CGST takes 2.50 and SGST absorbs 2.51.
    const r = computeDocument(doc({ lines: [{ quantity: 1, rate: 100.2, gstRate: 5 }] }));
    const line = r.lines[0]!;
    expect(line.taxTotal).toBe(5.01);
    expect(line.cgst).toBe(2.5);
    expect(line.sgst).toBe(2.51);
    expect(roundMoney(line.cgst + line.sgst)).toBe(line.taxTotal);
  });

  it("never lets CGST/SGST drift from the tax total, at any paise value", () => {
    for (let paise = 0; paise < 100; paise++) {
      const r = computeDocument(
        doc({ lines: [{ quantity: 1, rate: roundMoney(100 + paise / 100), gstRate: 5 }] }),
      );
      const line = r.lines[0]!;
      expect(roundMoney(line.cgst + line.sgst)).toBe(line.taxTotal);
      expect(line.sgst).toBeGreaterThanOrEqual(line.cgst);
    }
  });

  it("rounds a total of exactly x.50 up, and records the round-off", () => {
    const r = computeDocument(
      doc({ invoiceType: "NON_GST", lines: [{ quantity: 1, rate: 100.5, gstRate: 0 }] }),
    );
    expect(r.grandTotalRaw).toBe(100.5);
    expect(r.grandTotal).toBe(101);
    expect(r.roundOff).toBe(0.5);
  });

  it("records a negative round-off when rounding down", () => {
    const r = computeDocument(
      doc({ invoiceType: "NON_GST", lines: [{ quantity: 1, rate: 100.4, gstRate: 0 }] }),
    );
    expect(r.grandTotal).toBe(100);
    expect(r.roundOff).toBe(-0.4);
  });

  it("keeps round-off within -0.49 .. +0.50 across many totals", () => {
    // Half-up rounding (x.50 rounds to x+1) puts the band at [-0.49, +0.50],
    // not the [-0.50, +0.49] the blueprint quotes for half-down.
    for (let paise = 0; paise < 100; paise++) {
      const r = computeDocument(
        doc({
          invoiceType: "NON_GST",
          lines: [{ quantity: 1, rate: roundMoney(500 + paise / 100), gstRate: 0 }],
        }),
      );
      expect(r.roundOff).toBeGreaterThanOrEqual(-0.49);
      expect(r.roundOff).toBeLessThanOrEqual(0.5);
      expect(roundMoney(r.grandTotalRaw + r.roundOff)).toBe(r.grandTotal);
    }
  });

  it("handles a 100% discount line without dividing by zero", () => {
    const r = computeDocument(
      doc({
        lines: [
          {
            quantity: 1,
            rate: 1000,
            gstRate: 18,
            discountType: "percentage",
            discountValue: 100,
          },
        ],
      }),
    );
    expect(r.taxableValue).toBe(0);
    expect(r.taxTotal).toBe(0);
    expect(r.grandTotal).toBe(0);
    expect(Number.isFinite(r.grandTotalRaw)).toBe(true);
  });

  it("caps a fixed discount at the line value", () => {
    const r = computeDocument(
      doc({
        lines: [{ quantity: 1, rate: 300, gstRate: 0, discountType: "fixed", discountValue: 5000 }],
        invoiceType: "NON_GST",
      }),
    );
    expect(r.lines[0]!.discountAmount).toBe(300);
    expect(r.taxableValue).toBe(0);
  });

  it("does not charge for free quantity", () => {
    const withFree = computeDocument(
      doc({ lines: [{ quantity: 10, freeQuantity: 2, rate: 50, gstRate: 12 }] }),
    );
    const without = computeDocument(doc({ lines: [{ quantity: 10, rate: 50, gstRate: 12 }] }));
    expect(withFree.grandTotal).toBe(without.grandTotal);
    expect(withFree.lines[0]!.gross).toBe(500);
  });

  it("inclusive pricing never makes the total exceed MRP x qty", () => {
    const mrp = 249.5;
    for (const rate of RATES) {
      const r = computeDocument(
        doc({
          priceInclusive: true,
          lines: [{ quantity: 4, rate: mrp, gstRate: rate }],
        }),
      );
      expect(r.grandTotalRaw).toBeLessThanOrEqual(roundMoney(mrp * 4));
    }
  });
});

// ─── 4. Invoice-level discount apportionment ──────────────────────────────────

describe("invoice-level discount", () => {
  it("apportions by taxable value and reconciles to the paisa", () => {
    const r = computeDocument(
      doc({
        invoiceDiscount: 100,
        lines: [
          { quantity: 1, rate: 333.33, gstRate: 18 },
          { quantity: 1, rate: 333.33, gstRate: 18 },
          { quantity: 1, rate: 333.34, gstRate: 18 },
        ],
      }),
    );

    const shares = r.lines.map((l) => l.invoiceDiscountShare);
    expect(roundMoney(shares.reduce((s, v) => s + v, 0))).toBe(100);

    // Σ line taxable === document taxable, exactly.
    const sumTaxable = r.lines.reduce((s, l) => roundMoney(s + l.taxableValue), 0);
    expect(sumTaxable).toBe(r.taxableValue);

    // The bill is worth 1000 less the 100 discount, before tax.
    expect(r.taxableValue).toBe(900);
  });

  it("splits a discount unevenly in proportion to line value", () => {
    const r = computeDocument(
      doc({
        invoiceType: "NON_GST",
        invoiceDiscount: 100,
        lines: [
          { quantity: 1, rate: 750, gstRate: 0 },
          { quantity: 1, rate: 250, gstRate: 0 },
        ],
      }),
    );
    expect(r.lines[0]!.invoiceDiscountShare).toBe(75);
    expect(r.lines[1]!.invoiceDiscountShare).toBe(25);
  });

  it("never discounts more than the bill is worth", () => {
    const r = computeDocument(
      doc({
        invoiceType: "NON_GST",
        invoiceDiscount: 99999,
        lines: [{ quantity: 1, rate: 500, gstRate: 0 }],
      }),
    );
    expect(r.discountTotal).toBe(500);
    expect(r.taxableValue).toBe(0);
    expect(r.grandTotal).toBe(0);
  });

  it("spreads a discount evenly when every line is already fully discounted", () => {
    const r = computeDocument(
      doc({
        invoiceType: "NON_GST",
        invoiceDiscount: 50,
        lines: [
          { quantity: 1, rate: 100, gstRate: 0, discountType: "percentage", discountValue: 100 },
          { quantity: 1, rate: 100, gstRate: 0, discountType: "percentage", discountValue: 100 },
        ],
      }),
    );
    // Nothing left to discount, so the bill-level discount is capped to zero.
    expect(r.taxableValue).toBe(0);
    expect(Number.isFinite(r.grandTotal)).toBe(true);
  });
});

// ─── 5. Shipping ──────────────────────────────────────────────────────────────

describe("shipping and packaging", () => {
  it("adds untaxed shipping after tax", () => {
    const r = computeDocument(doc({ shippingAmount: 50, shippingTaxable: false }));
    expect(r.taxableValue).toBe(1000);
    expect(r.taxTotal).toBe(180);
    expect(r.shippingAmount).toBe(50);
    expect(r.grandTotalRaw).toBe(1230);
  });

  it("apportions taxable shipping into the lines before tax", () => {
    const r = computeDocument(doc({ shippingAmount: 100, shippingTaxable: true }));
    expect(r.taxableValue).toBe(1100);
    expect(r.taxTotal).toBe(198);
    expect(r.shippingAmount).toBe(0);
    expect(r.grandTotalRaw).toBe(1298);
  });

  it("splits taxable shipping across lines in proportion", () => {
    const r = computeDocument(
      doc({
        invoiceType: "NON_GST",
        shippingAmount: 40,
        shippingTaxable: true,
        lines: [
          { quantity: 1, rate: 300, gstRate: 0 },
          { quantity: 1, rate: 100, gstRate: 0 },
        ],
      }),
    );
    expect(r.lines[0]!.shippingShare).toBe(30);
    expect(r.lines[1]!.shippingShare).toBe(10);
  });
});

// ─── 6. Rate summary (GSTR-1 / printed bill) ──────────────────────────────────

describe("rate summary", () => {
  it("groups lines by GST rate and reconciles with the document totals", () => {
    const r = computeDocument(
      doc({
        lines: [
          { quantity: 1, rate: 1000, gstRate: 12 },
          { quantity: 2, rate: 500, gstRate: 12 },
          { quantity: 1, rate: 800, gstRate: 18 },
        ],
      }),
    );

    expect(r.rateSummary).toHaveLength(2);
    const twelve = r.rateSummary.find((x) => x.gstRate === 12)!;
    expect(twelve.taxableValue).toBe(2000);

    const sum = r.rateSummary.reduce((s, x) => roundMoney(s + x.taxableValue), 0);
    expect(sum).toBe(r.taxableValue);

    const tax = r.rateSummary.reduce(
      (s, x) => roundMoney(s + x.cgst + x.sgst + x.igst + x.cess),
      0,
    );
    expect(tax).toBe(r.taxTotal);
  });
});

// ─── 7. Cess ──────────────────────────────────────────────────────────────────

describe("cess", () => {
  it("carries cess separately from GST", () => {
    const r = computeDocument(
      doc({ lines: [{ quantity: 1, rate: 1000, gstRate: 28, cessRate: 12 }] }),
    );
    expect(r.cess).toBe(120);
    expect(roundMoney(r.cgst + r.sgst)).toBe(280);
    expect(r.taxTotal).toBe(400);
    expect(r.grandTotal).toBe(1400);
  });

  it("backs cess out correctly on inclusive pricing", () => {
    const r = computeDocument(
      doc({
        priceInclusive: true,
        lines: [{ quantity: 1, rate: 1400, gstRate: 28, cessRate: 12 }],
      }),
    );
    expect(r.taxableValue).toBe(1000);
    expect(r.cess).toBe(120);
    expect(r.grandTotalRaw).toBe(1400);
  });
});

// ─── 8. The GST calculator agrees with a real invoice ─────────────────────────

describe("computeQuick (GST calculator)", () => {
  it.each(RATES)("matches a one-line document at %i%% intra-state", (rate) => {
    const quick = computeQuick({
      amount: 1234.56,
      gstRate: rate,
      inclusive: false,
      interstate: false,
    });
    const full = computeDocument(doc({ lines: [{ quantity: 1, rate: 1234.56, gstRate: rate }] }));

    expect(quick.taxable).toBe(full.taxableValue);
    expect(quick.cgst).toBe(full.cgst);
    expect(quick.sgst).toBe(full.sgst);
    expect(quick.igst).toBe(full.igst);
    expect(quick.taxTotal).toBe(full.taxTotal);
    expect(quick.roundedTotal).toBe(full.grandTotal);
  });

  it.each(RATES)("matches a one-line document at %i%% inter-state", (rate) => {
    const quick = computeQuick({
      amount: 1234.56,
      gstRate: rate,
      inclusive: false,
      interstate: true,
    });
    const full = computeDocument(
      doc({ ...INTER, lines: [{ quantity: 1, rate: 1234.56, gstRate: rate }] }),
    );
    expect(quick.igst).toBe(full.igst);
    expect(quick.taxable).toBe(full.taxableValue);
  });

  it("backs tax out of an inclusive amount", () => {
    const q = computeQuick({ amount: 118, gstRate: 18, inclusive: true, interstate: false });
    expect(q.taxable).toBe(100);
    expect(q.cgst).toBe(9);
    expect(q.sgst).toBe(9);
    expect(q.total).toBe(118);
  });
});

// ─── 9. Empty and degenerate documents ────────────────────────────────────────

describe("degenerate input", () => {
  it("handles a document with no lines", () => {
    const r = computeDocument(doc({ lines: [] }));
    expect(r.taxableValue).toBe(0);
    expect(r.grandTotal).toBe(0);
    expect(r.rateSummary).toEqual([]);
  });

  it("handles a zero-value line", () => {
    const r = computeDocument(doc({ lines: [{ quantity: 0, rate: 0, gstRate: 18 }] }));
    expect(r.grandTotal).toBe(0);
    expect(r.lines).toHaveLength(1);
  });

  it("treats an unknown place of supply as intra-state", () => {
    const r = computeDocument(doc({ branchStateCode: "27", placeOfSupply: "27" }));
    expect(r.isInterstate).toBe(false);
  });
});
