/**
 * VetOS Shared Money Math Utilities
 * ────────────────────────────────────
 * All billing/payment calculations must use these helpers.
 * Never use raw binary floating-point arithmetic for currency.
 *
 * Strategy: round intermediate results to 2 decimal places at each step.
 * This prevents 0.1 + 0.2 = 0.30000000000000004 style errors.
 */

/** Round to 2 decimal places (half-up). */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Multiply and round to 2dp. */
export function mulMoney(a: number, b: number): number {
  return roundMoney(a * b);
}

/** Add two money values and round. */
export function addMoney(a: number, b: number): number {
  return roundMoney(a + b);
}

/** Subtract two money values and round. */
export function subMoney(a: number, b: number): number {
  return roundMoney(a - b);
}

/**
 * Calculate line item totals given the billing inputs.
 * Applies discount BEFORE tax (per REQ-DISC-04).
 *
 * @returns Object with all intermediate and final values
 */
export function calcLineItem(params: {
  quantity: number;
  unitPrice: number;
  discountType?: "percentage" | "fixed" | "%" | "₹" | undefined;
  discountValue?: number | undefined;
  gstRate: number;
  applyGst: boolean; // false for Non-GST bills
}): {
  baseAmount: number;       // qty × unitPrice
  discountAmount: number;   // monetary discount
  taxableAmount: number;    // baseAmount − discountAmount
  gstAmount: number;        // taxableAmount × gstRate/100 (0 if Non-GST)
  lineTotal: number;        // taxableAmount + gstAmount
} {
  const baseAmount = roundMoney(params.quantity * params.unitPrice);
  const isPct = params.discountType === "percentage" || params.discountType === "%";
  const discVal = params.discountValue ?? 0;

  let discountAmount = 0;
  if (isPct) {
    const pct = Math.min(100, Math.max(0, discVal));
    discountAmount = roundMoney((baseAmount * pct) / 100);
  } else {
    discountAmount = roundMoney(Math.min(baseAmount, Math.max(0, discVal)));
  }

  const taxableAmount = roundMoney(baseAmount - discountAmount);

  let gstAmount = 0;
  if (params.applyGst && params.gstRate > 0) {
    gstAmount = roundMoney((taxableAmount * params.gstRate) / 100);
  }

  const lineTotal = roundMoney(taxableAmount + gstAmount);

  return { baseAmount, discountAmount, taxableAmount, gstAmount, lineTotal };
}

/**
 * Validate a discount value before accepting it.
 * Returns an error string or null if valid.
 */
export function validateDiscount(
  discountType: "percentage" | "fixed" | "%" | "₹" | undefined,
  discountValue: number,
  baseAmount: number
): string | null {
  if (isNaN(discountValue)) return "Discount must be a number";
  if (discountValue < 0) return "Discount cannot be negative";
  const isPct = discountType === "percentage" || discountType === "%";
  if (isPct && discountValue > 100) {
    return "Percentage discount cannot exceed 100%";
  }
  if (!isPct && discountValue > baseAmount) {
    return `Fixed discount (₹${discountValue}) cannot exceed line amount (₹${baseAmount})`;
  }
  return null;
}

/**
 * Calculate the full bill summary from an array of line items.
 */
export function calcBillSummary(
  lines: Array<{
    quantity: number;
    unitPrice: number;
    discountType?: "percentage" | "fixed" | "%" | "₹" | undefined;
    discountValue?: number | undefined;
    gstRate: number;
  }>,
  applyGst: boolean
): {
  subtotal: number;        // sum of taxable amounts (post-discount, pre-GST)
  totalGst: number;        // sum of all GST amounts
  exactTotal: number;      // subtotal + totalGst
  roundedTotal: number;    // Math.round(exactTotal)
  roundOff: number;        // roundedTotal - exactTotal
} {
  let subtotal = 0;
  let totalGst = 0;

  for (const line of lines) {
    const calc = calcLineItem({
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountType: line.discountType,
      discountValue: line.discountValue,
      gstRate: line.gstRate,
      applyGst,
    });
    subtotal = addMoney(subtotal, calc.taxableAmount);
    totalGst = addMoney(totalGst, calc.gstAmount);
  }

  const exactTotal = addMoney(subtotal, totalGst);
  const roundedTotal = Math.round(exactTotal);
  const roundOff = roundMoney(roundedTotal - exactTotal);

  return { subtotal, totalGst, exactTotal, roundedTotal, roundOff };
}
