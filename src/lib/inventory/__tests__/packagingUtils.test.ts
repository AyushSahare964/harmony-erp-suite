import { describe, it, expect } from "vitest";
import {
  convertToBase,
  convertFromBase,
  getAvailableUnits,
  stockDisplayLabel,
  resolveUnitPrice,
  getDefaultHierarchy,
  computePrescriptionQty,
  type PackagingHierarchy,
} from "../packagingUtils";

describe("packagingUtils - Unit Hierarchy & Conversion Engine", () => {
  const tabletHierarchy: PackagingHierarchy = {
    baseUnit: "Tablet",
    purchaseUnit: "Box",
    baseUnitsPerPurchase: 100,
    hasIntermediateUnit: true,
    intermediateUnit: "Strip",
    intermediateUnitsPerPurchase: 10,
    baseUnitsPerIntermediate: 10,
  };

  const liquidHierarchy: PackagingHierarchy = {
    baseUnit: "ml",
    purchaseUnit: "Bottle",
    baseUnitsPerPurchase: 200,
    hasIntermediateUnit: false,
  };

  const injectionHierarchy: PackagingHierarchy = {
    baseUnit: "Vial",
    purchaseUnit: "Box",
    baseUnitsPerPurchase: 5,
    hasIntermediateUnit: false,
  };

  describe("getDefaultHierarchy", () => {
    it("should infer 3-tier hierarchy for Tablets & Capsules", () => {
      const hTab = getDefaultHierarchy("Tablet");
      expect(hTab.baseUnit).toBe("Tablet");
      expect(hTab.purchaseUnit).toBe("Box");
      expect(hTab.hasIntermediateUnit).toBe(true);
      expect(hTab.intermediateUnit).toBe("Strip");
      expect(hTab.baseUnitsPerPurchase).toBe(100);

      const hCap = getDefaultHierarchy("Capsule");
      expect(hCap.baseUnit).toBe("Capsule");
      expect(hCap.hasIntermediateUnit).toBe(true);
    });

    it("should infer 2-tier hierarchy for ml/liquids", () => {
      const hMl = getDefaultHierarchy("ml");
      expect(hMl.baseUnit).toBe("ml");
      expect(hMl.purchaseUnit).toBe("Bottle");
      expect(hMl.hasIntermediateUnit).toBe(false);
      expect(hMl.baseUnitsPerPurchase).toBe(200);
    });

    it("should infer 2-tier hierarchy for Vials", () => {
      const hVial = getDefaultHierarchy("Vial");
      expect(hVial.baseUnit).toBe("Vial");
      expect(hVial.purchaseUnit).toBe("Box");
      expect(hVial.baseUnitsPerPurchase).toBe(5);
    });
  });

  describe("convertToBase", () => {
    it("should convert purchase units to base units", () => {
      expect(convertToBase(2, "Box", tabletHierarchy)).toBe(200);
      expect(convertToBase(3, "Bottle", liquidHierarchy)).toBe(600);
      expect(convertToBase(4, "Box", injectionHierarchy)).toBe(20);
    });

    it("should convert intermediate units to base units", () => {
      expect(convertToBase(3, "Strip", tabletHierarchy)).toBe(30);
      expect(convertToBase(1.5, "Strip", tabletHierarchy)).toBe(15);
    });

    it("should keep base units unchanged", () => {
      expect(convertToBase(25, "Tablet", tabletHierarchy)).toBe(25);
      expect(convertToBase(150, "ml", liquidHierarchy)).toBe(150);
    });
  });

  describe("convertFromBase", () => {
    it("should convert base units to purchase units", () => {
      expect(convertFromBase(200, "Box", tabletHierarchy)).toBe(2);
      expect(convertFromBase(600, "Bottle", liquidHierarchy)).toBe(3);
    });

    it("should convert base units to intermediate units", () => {
      expect(convertFromBase(30, "Strip", tabletHierarchy)).toBe(3);
      expect(convertFromBase(15, "Strip", tabletHierarchy)).toBe(1.5);
    });

    it("should keep base unit unchanged", () => {
      expect(convertFromBase(40, "Tablet", tabletHierarchy)).toBe(40);
    });
  });

  describe("getAvailableUnits", () => {
    it("should return base, intermediate, and purchase units for 3-tier items", () => {
      const units = getAvailableUnits(tabletHierarchy);
      expect(units).toEqual(["Tablet", "Strip", "Box"]);
    });

    it("should return base and purchase units for 2-tier items", () => {
      const units = getAvailableUnits(liquidHierarchy);
      expect(units).toEqual(["ml", "Bottle"]);
    });
  });

  describe("stockDisplayLabel", () => {
    it("should format multi-tier stock cleanly", () => {
      // 105 tablets = 1 Box (100) + 0 Strips + 5 Tablets (105 Tablets)
      expect(stockDisplayLabel(105, tabletHierarchy)).toBe("1 Box + 5 Tablets (105 Tablets)");

      // 125 tablets = 1 Box (100) + 2 Strips (20) + 5 Tablets (125 Tablets)
      expect(stockDisplayLabel(125, tabletHierarchy)).toBe("1 Box + 2 Strips + 5 Tablets (125 Tablets)");

      // 200 tablets = 2 Boxes (200 Tablets)
      expect(stockDisplayLabel(200, tabletHierarchy)).toBe("2 Boxes (200 Tablets)");

      // 7 tablets
      expect(stockDisplayLabel(7, tabletHierarchy)).toBe("7 Tablets");
    });

    it("should format 2-tier stock cleanly", () => {
      expect(stockDisplayLabel(450, liquidHierarchy)).toBe("2 Bottles + 50 ml");
      expect(stockDisplayLabel(200, liquidHierarchy)).toBe("1 Bottle (200 ml)");
      expect(stockDisplayLabel(50, liquidHierarchy)).toBe("50 ml");
    });
  });

  describe("resolveUnitPrice", () => {
    it("should calculate proportional unit price from purchase unit MRP", () => {
      const boxMrp = 500; // 1 box (100 tablets, 10 strips) = ₹500
      expect(resolveUnitPrice(boxMrp, "Box", tabletHierarchy)).toBe(500);
      expect(resolveUnitPrice(boxMrp, "Strip", tabletHierarchy)).toBe(50);
      expect(resolveUnitPrice(boxMrp, "Tablet", tabletHierarchy)).toBe(5);
    });

    it("should correctly derive prices for 300 tablets/box at ₹195 MRP (e.g. ₹0.65/tablet, 5 tablets = ₹3.25)", () => {
      const userHierarchy: PackagingHierarchy = {
        baseUnit: "Tablet",
        purchaseUnit: "Box",
        baseUnitsPerPurchase: 300,
        hasIntermediateUnit: true,
        intermediateUnit: "Strip",
        intermediateUnitsPerPurchase: 10,
        baseUnitsPerIntermediate: 30,
      };
      const boxMrp = 195;
      expect(resolveUnitPrice(boxMrp, "Box", userHierarchy)).toBe(195);
      expect(resolveUnitPrice(boxMrp, "Strip", userHierarchy)).toBe(19.5);
      expect(resolveUnitPrice(boxMrp, "Tablet", userHierarchy)).toBe(0.65);

      const tabletPrice = resolveUnitPrice(boxMrp, "Tablet", userHierarchy);
      const fiveTabletsCost = 5 * tabletPrice;
      expect(fiveTabletsCost).toBe(3.25);
    });
  });

  describe("computePrescriptionQty", () => {
    it("should calculate base and display quantities for tablets", () => {
      // 1 tab BID for 5 days = 10 tabs
      const result = computePrescriptionQty(1, "Twice daily (BID)", "5 days", {
        dispensingUnit: "Tablet",
        hierarchy: tabletHierarchy,
      });
      expect(result.baseQty).toBe(10);
      expect(result.displayQty).toBe(10);
    });

    it("should convert display quantity when doctor dispenses in Strips", () => {
      // 1 tab BID for 10 days = 20 tabs = 2 Strips
      const result = computePrescriptionQty(1, "Twice daily (BID)", "10 days", {
        dispensingUnit: "Strip",
        hierarchy: tabletHierarchy,
      });
      expect(result.baseQty).toBe(20);
      expect(result.displayQty).toBe(2);
    });
  });
});
