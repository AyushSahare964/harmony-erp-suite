/**
 * GST tax engine — pure, dependency-free, deterministic.
 *
 * This module imports nothing but `moneyUtils`. No mongoose, no server fns,
 * no framework types. That is deliberate: the invoice editor, the posting
 * server function, the GST calculator popover and the GSTR builders all call
 * the SAME functions here, so their numbers can never drift apart.
 *
 * The order of operations below is canonical (blueprint §6.2). Do not reorder
 * it — the whole test matrix and the clinic's CA sign-off depend on it.
 *
 *   1. gross          = quantity × rate            (free quantity is NOT charged)
 *   2. discountAmount = % of gross, or a capped fixed amount
 *   3. net            = gross − discountAmount
 *   4. apportion the invoice-level discount, then taxable shipping, by net
 *   5. inclusive → back out tax from net; exclusive → add tax on top
 *   6. split into CGST+SGST (intra) or IGST (inter); residue paisa → SGST
 *   7. lineTotal      = taxable + tax
 *   8. grandTotal     = round(Σ lineTotal + untaxed shipping); store the round-off
 */

import { roundMoney } from "@/lib/utils/moneyUtils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type InvoiceType = "GST" | "NON_GST" | "BILL_OF_SUPPLY" | "EXPORT";
export type DiscountType = "percentage" | "fixed";

export interface TaxLineInput {
  quantity: number;
  /** Billed at zero — moves stock, never charged. */
  freeQuantity?: number | undefined;
  rate: number;
  discountType?: DiscountType | undefined;
  discountValue?: number | undefined;
  gstRate: number;
  cessRate?: number | undefined;
}

export interface TaxDocInput {
  lines: TaxLineInput[];
  invoiceType: InvoiceType;
  /** The clinic's own state code, from OrgBranch. */
  branchStateCode: string;
  /** Place of supply on the document. */
  placeOfSupply: string;
  /** When true, `rate` already includes GST (MRP-style pricing). */
  priceInclusive?: boolean | undefined;
  /** Bill-level discount in rupees, apportioned across lines by taxable value. */
  invoiceDiscount?: number | undefined;
  shippingAmount?: number | undefined;
  /** Taxable shipping is apportioned into the lines; untaxed shipping is added after tax. */
  shippingTaxable?: boolean | undefined;
  /** Export under a Letter of Undertaking is zero-rated. */
  lutEnabled?: boolean | undefined;
}

export interface TaxLineResult {
  lineNo: number;
  gross: number;
  discountAmount: number;
  /** Share of the bill-level discount assigned to this line. */
  invoiceDiscountShare: number;
  /** Share of taxable shipping assigned to this line. */
  shippingShare: number;
  taxableValue: number;
  gstRate: number;
  cessRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  taxTotal: number;
  lineTotal: number;
}

export interface HsnSummaryRow {
  gstRate: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
}

export interface TaxDocResult {
  lines: TaxLineResult[];
  isInterstate: boolean;
  taxApplicable: boolean;
  /** Σ gross, before any discount. */
  subTotal: number;
  /** Σ line discounts + the bill-level discount. */
  discountTotal: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  taxTotal: number;
  /** Shipping that was NOT taxed and is added after tax. */
  shippingAmount: number;
  /** Σ lineTotal + untaxed shipping, before rounding. */
  grandTotalRaw: number;
  roundOff: number;
  grandTotal: number;
  /** Rate-wise rollup, used by GSTR-1 and the printed bill. */
  rateSummary: HsnSummaryRow[];
}

// ─── Internals ────────────────────────────────────────────────────────────────

/**
 * Split `total` across `weights` in proportion, to 2dp, so the parts sum back to
 * `total` exactly. Any rounding residue lands on the heaviest weight — that is
 * the line best able to absorb a paisa without looking wrong on the bill.
 */
function apportion(total: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const amount = roundMoney(total);
  if (amount === 0) return new Array(n).fill(0);

  const weightSum = weights.reduce((s, w) => s + w, 0);

  // Nothing to weigh by (e.g. every line fully discounted) — spread evenly.
  const shares =
    weightSum > 0
      ? weights.map((w) => roundMoney((amount * w) / weightSum))
      : new Array(n).fill(roundMoney(amount / n));

  const assigned = shares.reduce((s, v) => roundMoney(s + v), 0);
  const residue = roundMoney(amount - assigned);

  if (residue !== 0) {
    let heaviest = 0;
    for (let i = 1; i < n; i++) {
      if ((weights[i] ?? 0) > (weights[heaviest] ?? 0)) heaviest = i;
    }
    shares[heaviest] = roundMoney((shares[heaviest] ?? 0) + residue);
  }

  return shares;
}

/** Is tax charged at all on this document? */
function isTaxApplicable(invoiceType: InvoiceType, lutEnabled: boolean): boolean {
  if (invoiceType === "NON_GST" || invoiceType === "BILL_OF_SUPPLY") return false;
  // Export under LUT is zero-rated; export without LUT attracts IGST.
  if (invoiceType === "EXPORT" && lutEnabled) return false;
  return true;
}

/** Normalise a state code for comparison ("27", "7" and "Maharashtra" all differ). */
function normCode(v: string | null | undefined): string {
  return String(v ?? "")
    .trim()
    .padStart(2, "0");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute a whole document: every line, the tax split, and the totals.
 * This is the only place document tax is ever calculated.
 */
export function computeDocument(input: TaxDocInput): TaxDocResult {
  const lutEnabled = input.lutEnabled ?? false;
  const taxApplicable = isTaxApplicable(input.invoiceType, lutEnabled);
  const priceInclusive = input.priceInclusive ?? false;

  // Exports are always treated as inter-state supply.
  const interstate =
    input.invoiceType === "EXPORT" ||
    normCode(input.branchStateCode) !== normCode(input.placeOfSupply);

  // ── Steps 1–3: per-line gross, discount, net ──
  const gross: number[] = [];
  const lineDiscount: number[] = [];
  const net: number[] = [];

  for (const line of input.lines) {
    const g = roundMoney((line.quantity || 0) * (line.rate || 0));

    const discVal = line.discountValue ?? 0;
    let d = 0;
    if (discVal > 0) {
      if (line.discountType === "percentage") {
        d = roundMoney((g * Math.min(100, Math.max(0, discVal))) / 100);
      } else {
        d = roundMoney(Math.min(g, Math.max(0, discVal)));
      }
    }

    gross.push(g);
    lineDiscount.push(d);
    net.push(roundMoney(g - d));
  }

  // ── Step 4: apportion the bill-level discount, then taxable shipping ──
  const netSum = net.reduce((s, v) => roundMoney(s + v), 0);
  const requestedInvoiceDiscount = roundMoney(Math.max(0, input.invoiceDiscount ?? 0));
  // Never discount more than the bill is worth.
  const invoiceDiscount = Math.min(requestedInvoiceDiscount, netSum);
  const invoiceDiscountShares = apportion(invoiceDiscount, net);

  const shipping = roundMoney(Math.max(0, input.shippingAmount ?? 0));
  const shippingTaxable = (input.shippingTaxable ?? false) && shipping > 0;
  const netAfterDiscount = net.map((v, i) => roundMoney(v - (invoiceDiscountShares[i] ?? 0)));
  const shippingShares = shippingTaxable
    ? apportion(shipping, netAfterDiscount)
    : new Array(input.lines.length).fill(0);

  // ── Steps 5–7: tax each line ──
  const lines: TaxLineResult[] = [];
  let taxableTotal = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;
  let cessTotal = 0;
  let lineTotalSum = 0;

  for (let i = 0; i < input.lines.length; i++) {
    const src = input.lines[i]!;
    const gstRate = taxApplicable ? Math.max(0, src.gstRate || 0) : 0;
    const cessRate = taxApplicable ? Math.max(0, src.cessRate ?? 0) : 0;

    const lineNet = roundMoney((netAfterDiscount[i] ?? 0) + (shippingShares[i] ?? 0));

    let taxable: number;
    let taxTotal: number;

    if (priceInclusive && gstRate + cessRate > 0) {
      // The rate already contains the tax — back it out.
      taxable = roundMoney((lineNet * 100) / (100 + gstRate + cessRate));
      taxTotal = roundMoney(lineNet - taxable);
    } else {
      taxable = lineNet;
      taxTotal = roundMoney((taxable * (gstRate + cessRate)) / 100);
    }

    // Cess is carried separately from GST.
    const cess = cessRate > 0 ? roundMoney((taxTotal * cessRate) / (gstRate + cessRate)) : 0;
    const gstPortion = roundMoney(taxTotal - cess);

    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    if (interstate) {
      igst = gstPortion;
    } else {
      // Split in integer paise, not floats: rounding half of an odd paise value
      // can land either way in binary floating point, which would sometimes put
      // the residue on CGST. Flooring guarantees the residue is always SGST's,
      // and that cgst + sgst === gstPortion exactly.
      const paise = Math.round(gstPortion * 100);
      const cgstPaise = Math.floor(paise / 2);
      cgst = cgstPaise / 100;
      sgst = (paise - cgstPaise) / 100;
    }

    const lineTotal = roundMoney(taxable + taxTotal);

    lines.push({
      lineNo: i + 1,
      gross: gross[i] ?? 0,
      discountAmount: lineDiscount[i] ?? 0,
      invoiceDiscountShare: invoiceDiscountShares[i] ?? 0,
      shippingShare: shippingShares[i] ?? 0,
      taxableValue: taxable,
      gstRate,
      cessRate,
      cgst,
      sgst,
      igst,
      cess,
      taxTotal,
      lineTotal,
    });

    taxableTotal = roundMoney(taxableTotal + taxable);
    cgstTotal = roundMoney(cgstTotal + cgst);
    sgstTotal = roundMoney(sgstTotal + sgst);
    igstTotal = roundMoney(igstTotal + igst);
    cessTotal = roundMoney(cessTotal + cess);
    lineTotalSum = roundMoney(lineTotalSum + lineTotal);
  }

  // ── Step 8: document totals and round-off ──
  const untaxedShipping = shippingTaxable ? 0 : shipping;
  const grandTotalRaw = roundMoney(lineTotalSum + untaxedShipping);
  const grandTotal = Math.round(grandTotalRaw);
  const roundOff = roundMoney(grandTotal - grandTotalRaw);

  const subTotal = gross.reduce((s, v) => roundMoney(s + v), 0);
  const discountTotal = roundMoney(
    lineDiscount.reduce((s, v) => roundMoney(s + v), 0) + invoiceDiscount,
  );
  const taxTotal = roundMoney(cgstTotal + sgstTotal + igstTotal + cessTotal);

  return {
    lines,
    isInterstate: interstate,
    taxApplicable,
    subTotal,
    discountTotal,
    taxableValue: taxableTotal,
    cgst: cgstTotal,
    sgst: sgstTotal,
    igst: igstTotal,
    cess: cessTotal,
    taxTotal,
    shippingAmount: untaxedShipping,
    grandTotalRaw,
    roundOff,
    grandTotal,
    rateSummary: buildRateSummary(lines),
  };
}

/** Roll lines up by GST rate — what GSTR-1 and the printed bill both need. */
export function buildRateSummary(lines: TaxLineResult[]): HsnSummaryRow[] {
  const byRate = new Map<number, HsnSummaryRow>();

  for (const l of lines) {
    const row = byRate.get(l.gstRate) ?? {
      gstRate: l.gstRate,
      taxableValue: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      cess: 0,
    };
    row.taxableValue = roundMoney(row.taxableValue + l.taxableValue);
    row.cgst = roundMoney(row.cgst + l.cgst);
    row.sgst = roundMoney(row.sgst + l.sgst);
    row.igst = roundMoney(row.igst + l.igst);
    row.cess = roundMoney(row.cess + l.cess);
    byRate.set(l.gstRate, row);
  }

  return Array.from(byRate.values()).sort((a, b) => a.gstRate - b.gstRate);
}

// ─── Quick calculator ─────────────────────────────────────────────────────────

export interface QuickTaxInput {
  amount: number;
  gstRate: number;
  cessRate?: number | undefined;
  /** true → `amount` already includes tax. */
  inclusive: boolean;
  interstate: boolean;
}

export interface QuickTaxResult {
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  taxTotal: number;
  /** taxable + taxTotal, unrounded. */
  total: number;
  roundOff: number;
  /** The rupee-rounded total, matching what an invoice would print. */
  roundedTotal: number;
}

/**
 * Single-amount GST breakup for the calculator popover.
 *
 * Implemented as a one-line document so it can never disagree with a real
 * invoice — §11.1 has a test asserting exactly that.
 */
export function computeQuick(input: QuickTaxInput): QuickTaxResult {
  const doc = computeDocument({
    lines: [
      {
        quantity: 1,
        rate: input.amount,
        gstRate: input.gstRate,
        cessRate: input.cessRate ?? 0,
      },
    ],
    invoiceType: "GST",
    // Synthetic codes: equal → intra-state, different → inter-state.
    branchStateCode: "27",
    placeOfSupply: input.interstate ? "29" : "27",
    priceInclusive: input.inclusive,
  });

  return {
    taxable: doc.taxableValue,
    cgst: doc.cgst,
    sgst: doc.sgst,
    igst: doc.igst,
    cess: doc.cess,
    taxTotal: doc.taxTotal,
    total: doc.grandTotalRaw,
    roundOff: doc.roundOff,
    roundedTotal: doc.grandTotal,
  };
}
