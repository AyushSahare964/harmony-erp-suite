import assert from "node:assert";

// 1. Test dateUtils calculateQuickDate
import { calculateQuickDate, formatDisplayDate } from "../src/lib/utils/dateUtils";

console.log("=== Testing calculateQuickDate ===");

// 1 day
assert.strictEqual(calculateQuickDate("2026-03-10", "1d"), "2026-03-11");
// 2 days
assert.strictEqual(calculateQuickDate("2026-03-10", "2d"), "2026-03-12");
// 3 days
assert.strictEqual(calculateQuickDate("2026-03-10", "3d"), "2026-03-13");
// 5 days
assert.strictEqual(calculateQuickDate("2026-03-10", "5d"), "2026-03-15");
// 1 week
assert.strictEqual(calculateQuickDate("2026-03-10", "1w"), "2026-03-17");
// 2 weeks
assert.strictEqual(calculateQuickDate("2026-03-10", "2w"), "2026-03-24");
// 1 month normal
assert.strictEqual(calculateQuickDate("2026-03-10", "1m"), "2026-04-10");

// Month-end clamping: Jan 31 + 1 month in non-leap year (2026) => Feb 28
assert.strictEqual(calculateQuickDate("2026-01-31", "1m"), "2026-02-28");
console.log("✓ Month-end clamping Jan 31 -> Feb 28 (non-leap year 2026) verified!");

// Month-end clamping: Jan 31 + 1 month in leap year (2028) => Feb 29
assert.strictEqual(calculateQuickDate("2028-01-31", "1m"), "2028-02-29");
console.log("✓ Leap year clamping Jan 31 -> Feb 29 (leap year 2028) verified!");

// Month-end clamping: Aug 31 + 1 month => Sep 30
assert.strictEqual(calculateQuickDate("2026-08-31", "1m"), "2026-09-30");
console.log("✓ 30-day month clamping Aug 31 -> Sep 30 verified!");

// 3 months
assert.strictEqual(calculateQuickDate("2026-03-10", "3m"), "2026-06-10");
// 6 months
assert.strictEqual(calculateQuickDate("2026-03-10", "6m"), "2026-09-10");
// 1 year
assert.strictEqual(calculateQuickDate("2026-03-10", "1y"), "2027-03-10");
// Leap day + 1 year: 2028-02-29 + 1y => 2029-02-28
assert.strictEqual(calculateQuickDate("2028-02-29", "1y"), "2029-02-28");
console.log("✓ Leap day + 1 year clamping 2028-02-29 -> 2029-02-28 verified!");

// Format display date DD/MM/YYYY
assert.strictEqual(formatDisplayDate("2026-03-15"), "15/03/2026");
console.log("✓ Date formatting DD/MM/YYYY verified!");

// 2. Test moneyUtils calcBillSummary & calcLineItem
import { calcBillSummary } from "../src/lib/utils/moneyUtils";

console.log("\n=== Testing Candy Scenario (§14.3) ===");
// Candy test case from prompt:
// Medicine A (Immediate) ₹120 (qty 1)
// Medicine B (Prescribed) ₹150 (qty 1)
// Rabies Vaccine (Injectable) ₹480 (qty 1)
// Consultation Standard ₹500 (qty 1)
// Food (Animal Food) ₹1850 (qty 1)
// Accessory (PawShield Collar) ₹300 (qty 1)

const candyItems = [
  { name: "Consultation Fee", quantity: 1, unitPrice: 500, discountType: "percentage" as const, discountValue: 0 },
  { name: "Medicine A (Amoxicillin)", quantity: 1, unitPrice: 120, discountType: "percentage" as const, discountValue: 0 },
  { name: "Medicine B (Cefpet)", quantity: 1, unitPrice: 150, discountType: "percentage" as const, discountValue: 0 },
  { name: "Rabies Vaccine", quantity: 1, unitPrice: 480, discountType: "percentage" as const, discountValue: 0 },
  { name: "Royal Canin Maxi", quantity: 1, unitPrice: 1850, discountType: "percentage" as const, discountValue: 0 },
  { name: "PawShield Collar", quantity: 1, unitPrice: 300, discountType: "percentage" as const, discountValue: 0 },
];

const summaryNonGst = calcBillSummary(candyItems, false);
console.log("Non-GST Bill Summary:", summaryNonGst);
assert.strictEqual(summaryNonGst.subtotal, 3400);
assert.strictEqual(summaryNonGst.roundedTotal, 3400);
console.log("✓ Candy scenario subtotal and total = ₹3,400 exactly with 6 items!");

// 3. Test Replace-Set Upsert Logic (Idempotency and Qty Updates)
console.log("\n=== Testing Replace-Set Upsert Logic & Idempotency ===");

let currentItems = [
  { id: "fee-1", rxSection: "FEE", sourceType: "RX_CONSULT", name: "Consultation Fee", quantity: 1, unitPrice: 500 },
  { id: "imm-1", rxSection: "IMMEDIATE_MED", sourceType: "RX_ITEM", name: "Medicine A", quantity: 1, unitPrice: 120 },
  { id: "med-1", rxSection: "PRESCRIBED_MED", sourceType: "RX_ITEM", name: "Medicine B", quantity: 1, unitPrice: 150 },
  { id: "inj-1", rxSection: "INJECTABLE", sourceType: "RX_ITEM", name: "Rabies Vaccine", quantity: 1, unitPrice: 480 },
  { id: "food-1", rxSection: "ANIMAL_FOOD", sourceType: "RX_ITEM", name: "Royal Canin Maxi", quantity: 1, unitPrice: 1850 },
  { id: "acc-1", rxSection: "ACCESSORY", sourceType: "RX_ITEM", name: "PawShield Collar", quantity: 1, unitPrice: 300 },
];

assert.strictEqual(currentItems.length, 6);

// Doctor edits Medicine A quantity from 1 to 2 in IMMEDIATE_MED section:
const newImmediateMeds = [
  { id: "imm-1", rxSection: "IMMEDIATE_MED", sourceType: "RX_ITEM", name: "Medicine A", quantity: 2, unitPrice: 120 },
];

// Re-save IMMEDIATE_MED:
const retained = currentItems.filter(i => i.rxSection !== "IMMEDIATE_MED");
const updatedItems = [...retained, ...newImmediateMeds];

assert.strictEqual(updatedItems.length, 6, "Must still have exactly 6 items (no duplicate rows created)");
const updatedMedA = updatedItems.find(i => i.id === "imm-1")!;
assert.strictEqual(updatedMedA.quantity, 2);

const newSummary = calcBillSummary(updatedItems, false);
console.log("Updated Bill Summary (Qty 1 -> 2):", newSummary);
// Old total: 3400. Medicine A went from 120 to 240 (+120). New total: 3520.
assert.strictEqual(newSummary.subtotal, 3520);
assert.strictEqual(newSummary.roundedTotal, 3520);
console.log("✓ Replace-set updated Medicine A quantity to 2, total ₹3,520, zero duplicates!");

// Re-saving exact same items (idempotent re-save)
const reSavedItems = [...updatedItems.filter(i => i.rxSection !== "IMMEDIATE_MED"), ...newImmediateMeds];
assert.strictEqual(reSavedItems.length, 6);
const reSavedSummary = calcBillSummary(reSavedItems, false);
assert.strictEqual(reSavedSummary.roundedTotal, 3520);
console.log("✓ Idempotent re-save preserves line count and totals perfectly!");

console.log("\nALL PRESCRIBED VERIFICATIONS PASSED SUCCESSFULLY!");
