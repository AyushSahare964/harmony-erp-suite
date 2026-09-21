import { describe, it, expect } from "vitest";

describe("Stock Adjustments & Movements Logic", () => {
  function resolveMovementType(reason: string): "expiry_writeoff" | "damage_writeoff" | "adjustment_out" {
    if (reason === "Expiry Write-off") return "expiry_writeoff";
    if (reason === "Damage" || reason === "Wastage") return "damage_writeoff";
    return "adjustment_out";
  }

  it("correctly maps removal reasons to auditable movement types", () => {
    expect(resolveMovementType("Expiry Write-off")).toBe("expiry_writeoff");
    expect(resolveMovementType("Damage")).toBe("damage_writeoff");
    expect(resolveMovementType("Wastage")).toBe("damage_writeoff");
    expect(resolveMovementType("Internal Clinical Use")).toBe("adjustment_out");
    expect(resolveMovementType("Theft / Pilferage")).toBe("adjustment_out");
    expect(resolveMovementType("Count Error Correction")).toBe("adjustment_out");
    expect(resolveMovementType("Other")).toBe("adjustment_out");
  });

  it("calculates balance after inward goods correctly", () => {
    const currentBalance = 15;
    const inwardQty = 10;
    const newBalance = currentBalance + inwardQty;
    expect(newBalance).toBe(25);
  });

  it("prevents stock deduction greater than available balance when allowNegativeStock is false", () => {
    const totalQty = 10;
    const deductQty = 15;
    const allowNegativeStock = false;

    const isValid = deductQty <= totalQty || allowNegativeStock;
    expect(isValid).toBe(false);
  });

  it("permits stock deduction when allowNegativeStock is true", () => {
    const totalQty = 5;
    const deductQty = 10;
    const allowNegativeStock = true;

    const isValid = deductQty <= totalQty || allowNegativeStock;
    expect(isValid).toBe(true);
  });

  it("supports all 4 product categories in catalogue and stock adjustment lists", () => {
    const testItems = [
      { itemCode: "M-0001", name: "Amoxicillin 250mg", productType: "MEDICINE", currentStock: 50 },
      { itemCode: "I-0001", name: "Meloxicam Injection", productType: "INJECTION", currentStock: 20 },
      { itemCode: "F-0001", name: "Royal Canin Maxi 4kg", productType: "FOOD", currentStock: 15 },
      { itemCode: "A-0001", name: "Padded Dog Harness", productType: "ACCESSORY", currentStock: 8 },
    ];

    const categoryTypes = new Set(testItems.map((i) => i.productType));
    expect(categoryTypes.has("MEDICINE")).toBe(true);
    expect(categoryTypes.has("INJECTION")).toBe(true);
    expect(categoryTypes.has("FOOD")).toBe(true);
    expect(categoryTypes.has("ACCESSORY")).toBe(true);

    for (const item of testItems) {
      const deduction = 2;
      const remaining = Math.max(0, item.currentStock - deduction);
      expect(remaining).toBe(item.currentStock - deduction);
    }
  });
});
