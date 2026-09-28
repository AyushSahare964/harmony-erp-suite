/**
 * packagingUtils — Unit Hierarchy & Conversion Engine for Harmony ERP Inventory
 *
 * Core rule: `currentStock` in MongoDB is ALWAYS stored in `baseUnit`
 * (e.g. Tablets, ml, Vials). All display, prescription, and billing logic
 * converts to/from base units using the `PackagingHierarchy`.
 *
 * Hierarchy examples:
 *   Medicine (Tablet): Box → Strip (10/box) → Tablet (10/strip)  → base = Tablet
 *   Syrup (Liquid):    Bottle (200ml)        → ml                 → base = ml
 *   Injection:         Box (5 vials)         → Vial               → base = Vial
 *   Food:              Bag (4 kg)            → Kg                 → base = Kg
 *   Accessory:         Pack (1 piece)        → Piece              → base = Piece
 */

// ─── Core Interfaces ──────────────────────────────────────────────────────────

export interface PackagingHierarchy {
  /** Smallest unit used for ALL stock tracking (e.g. "Tablet", "ml", "Vial", "Kg", "Piece") */
  baseUnit: string;

  /** The unit in which the clinic typically purchases/receives the product (e.g. "Box", "Bottle", "Bag") */
  purchaseUnit: string;

  /** Total number of baseUnits contained in one purchaseUnit (e.g. 100 tablets per box) */
  baseUnitsPerPurchase: number;

  /** Whether there is an intermediate packaging layer between purchaseUnit and baseUnit */
  hasIntermediateUnit: boolean;

  /** Middle packaging unit, e.g. "Strip", "Sachet", "Ampoule" */
  intermediateUnit?: string;

  /** How many intermediateUnits fit in one purchaseUnit (e.g. 10 strips per box) */
  intermediateUnitsPerPurchase?: number;

  /** How many baseUnits fit in one intermediateUnit (e.g. 10 tablets per strip) */
  baseUnitsPerIntermediate?: number;
}

// ─── Smart Defaults by Product/Form Type ──────────────────────────────────────

/**
 * Returns a sensible default PackagingHierarchy based on the item's
 * current `unit` field value. Used for migration and new-item defaults.
 */
export function getDefaultHierarchy(unit: string): PackagingHierarchy {
  const u = unit?.toLowerCase() ?? "";

  if (u === "tablet" || u === "capsule") {
    return {
      baseUnit: unit || "Tablet",
      purchaseUnit: "Box",
      baseUnitsPerPurchase: 100,
      hasIntermediateUnit: true,
      intermediateUnit: "Strip",
      intermediateUnitsPerPurchase: 10,
      baseUnitsPerIntermediate: 10,
    };
  }

  if (u === "ml") {
    return {
      baseUnit: "ml",
      purchaseUnit: "Bottle",
      baseUnitsPerPurchase: 200,
      hasIntermediateUnit: false,
    };
  }

  if (u === "vial") {
    return {
      baseUnit: "Vial",
      purchaseUnit: "Box",
      baseUnitsPerPurchase: 5,
      hasIntermediateUnit: false,
    };
  }

  if (u === "kg" || u === "gm" || u === "litre") {
    return {
      baseUnit: unit || "Kg",
      purchaseUnit: "Bag",
      baseUnitsPerPurchase: 4,
      hasIntermediateUnit: false,
    };
  }

  if (u === "bottle") {
    return {
      baseUnit: "Bottle",
      purchaseUnit: "Box",
      baseUnitsPerPurchase: 12,
      hasIntermediateUnit: false,
    };
  }

  // Strip, Sachet, Box, Piece, Unit — treat as atomic (no sub-division)
  return {
    baseUnit: unit || "Piece",
    purchaseUnit: unit || "Piece",
    baseUnitsPerPurchase: 1,
    hasIntermediateUnit: false,
  };
}

// ─── Conversion Functions ──────────────────────────────────────────────────────

/**
 * Convert a quantity from any display unit to the base unit count.
 *
 * @example
 *   convertToBase(2, "Strip", hierarchy) → 20  (if 10 tablets/strip)
 *   convertToBase(1, "Box",   hierarchy) → 100 (if 100 tablets/box)
 *   convertToBase(5, "Tablet",hierarchy) → 5
 */
export function convertToBase(
  qty: number,
  unit: string,
  hierarchy: PackagingHierarchy
): number {
  if (!hierarchy) return qty;

  const normalised = unit?.trim();

  if (normalised === hierarchy.baseUnit) return qty;

  if (normalised === hierarchy.purchaseUnit) {
    return qty * hierarchy.baseUnitsPerPurchase;
  }

  if (
    hierarchy.hasIntermediateUnit &&
    hierarchy.intermediateUnit &&
    normalised === hierarchy.intermediateUnit
  ) {
    return qty * (hierarchy.baseUnitsPerIntermediate ?? 1);
  }

  // Unknown unit — treat as base to avoid silent errors
  console.warn(`[packagingUtils] Unknown unit "${unit}" for hierarchy — treating as base unit.`);
  return qty;
}

/**
 * Convert a quantity in base units to any display unit.
 *
 * @example
 *   convertFromBase(20, "Strip",  hierarchy) → 2  (if 10 tablets/strip)
 *   convertFromBase(100,"Box",    hierarchy) → 1  (if 100 tablets/box)
 *   convertFromBase(5,  "Tablet", hierarchy) → 5
 */
export function convertFromBase(
  baseQty: number,
  targetUnit: string,
  hierarchy: PackagingHierarchy
): number {
  if (!hierarchy) return baseQty;

  const normalised = targetUnit?.trim();

  if (normalised === hierarchy.baseUnit) return baseQty;

  if (normalised === hierarchy.purchaseUnit) {
    return hierarchy.baseUnitsPerPurchase > 0
      ? baseQty / hierarchy.baseUnitsPerPurchase
      : baseQty;
  }

  if (
    hierarchy.hasIntermediateUnit &&
    hierarchy.intermediateUnit &&
    normalised === hierarchy.intermediateUnit
  ) {
    const bpi = hierarchy.baseUnitsPerIntermediate ?? 1;
    return bpi > 0 ? baseQty / bpi : baseQty;
  }

  console.warn(`[packagingUtils] Unknown target unit "${targetUnit}" — returning base qty.`);
  return baseQty;
}

// ─── Available Units ───────────────────────────────────────────────────────────

/**
 * Returns all selectable dispensing units for a product, ordered from
 * smallest (base) to largest (purchase unit).
 *
 * @example
 *   getAvailableUnits(tabletHierarchy) → ["Tablet", "Strip", "Box"]
 *   getAvailableUnits(mlHierarchy)     → ["ml", "Bottle"]
 */
export function getAvailableUnits(hierarchy: PackagingHierarchy | undefined): string[] {
  if (!hierarchy) return [];

  const units: string[] = [hierarchy.baseUnit];

  if (hierarchy.hasIntermediateUnit && hierarchy.intermediateUnit) {
    units.push(hierarchy.intermediateUnit);
  }

  // Only add purchase unit if it's different from base (avoids duplicate for atomic items)
  if (hierarchy.purchaseUnit !== hierarchy.baseUnit) {
    units.push(hierarchy.purchaseUnit);
  }

  return units;
}

// ─── Stock Display Label ───────────────────────────────────────────────────────

/**
 * Convert a raw base-unit stock count to a human-readable label.
 *
 * @example
 *   stockDisplayLabel(105, tabletHierarchy)
 *   → "1 Box + 0 Strips + 5 Tablets"  (with breakdown=true)
 *   → "105 Tablets"                    (with breakdown=false)
 *
 *   stockDisplayLabel(300, tabletHierarchy)
 *   → "3 Boxes (300 Tablets)"
 */
export function stockDisplayLabel(
  baseQty: number,
  hierarchy: PackagingHierarchy | undefined,
  opts?: { showBreakdown?: boolean }
): string {
  if (!hierarchy) return `${baseQty}`;

  const showBreakdown = opts?.showBreakdown ?? true;
  const rounded = Math.max(0, Math.round(baseQty * 100) / 100);

  if (!showBreakdown || hierarchy.baseUnitsPerPurchase <= 1) {
    return `${rounded} ${pluralise(rounded, hierarchy.baseUnit)}`;
  }

  if (!hierarchy.hasIntermediateUnit) {
    const purchaseQty = Math.floor(rounded / hierarchy.baseUnitsPerPurchase);
    const remainder = Math.round(rounded % hierarchy.baseUnitsPerPurchase * 100) / 100;

    if (purchaseQty > 0 && remainder > 0) {
      return `${purchaseQty} ${pluralise(purchaseQty, hierarchy.purchaseUnit)} + ${remainder} ${pluralise(remainder, hierarchy.baseUnit)}`;
    }
    if (purchaseQty > 0) {
      return `${purchaseQty} ${pluralise(purchaseQty, hierarchy.purchaseUnit)} (${rounded} ${pluralise(rounded, hierarchy.baseUnit)})`;
    }
    return `${remainder} ${pluralise(remainder, hierarchy.baseUnit)}`;
  }

  // Three-level hierarchy (e.g. Box → Strip → Tablet)
  const bpi = hierarchy.baseUnitsPerIntermediate ?? 1;
  const ipu = hierarchy.intermediateUnitsPerPurchase ?? 1;
  const basePerBox = bpi * ipu;

  const boxes = Math.floor(rounded / basePerBox);
  const remAfterBoxes = rounded % basePerBox;
  const strips = Math.floor(remAfterBoxes / bpi);
  const tablets = Math.round(remAfterBoxes % bpi * 100) / 100;

  const parts: string[] = [];
  if (boxes > 0) parts.push(`${boxes} ${pluralise(boxes, hierarchy.purchaseUnit)}`);
  if (strips > 0) parts.push(`${strips} ${pluralise(strips, hierarchy.intermediateUnit ?? "")}`);
  if (tablets > 0) parts.push(`${tablets} ${pluralise(tablets, hierarchy.baseUnit)}`);

  if (parts.length === 0) return `0 ${pluralise(0, hierarchy.baseUnit)}`;

  // Append total base-unit count when display is > 1 level
  const totalLabel = `${rounded} ${pluralise(rounded, hierarchy.baseUnit)}`;
  if (parts.length > 1 || boxes > 0) {
    return `${parts.join(" + ")} (${totalLabel})`;
  }
  return totalLabel;
}

// ─── Unit-Based Price Resolution ──────────────────────────────────────────────

/**
 * Calculate the price for selling 1 unit of `dispensingUnit` given the
 * MRP is defined for 1 `purchaseUnit`.
 *
 * @example
 *   resolveUnitPrice(500, "Strip",  tabletHierarchy)  → 50   (₹500 / 10 strips)
 *   resolveUnitPrice(500, "Tablet", tabletHierarchy)  → 5    (₹500 / 100 tablets)
 *   resolveUnitPrice(500, "Box",    tabletHierarchy)  → 500
 */
export function resolveUnitPrice(
  purchaseUnitMrp: number,
  dispensingUnit: string,
  hierarchy: PackagingHierarchy
): number {
  if (!hierarchy || hierarchy.baseUnitsPerPurchase <= 0) return purchaseUnitMrp;

  const baseUnitsInDispensingUnit = convertToBase(1, dispensingUnit, hierarchy);
  const pricePerBase = purchaseUnitMrp / hierarchy.baseUnitsPerPurchase;
  const price = pricePerBase * baseUnitsInDispensingUnit;

  // Round to 2 decimal places
  return Math.round(price * 100) / 100;
}

// ─── Prescription Quantity Calculator ─────────────────────────────────────────

/**
 * Compute the total quantity to dispense from a prescription.
 *
 * Returns BOTH a `baseQty` (for stock deduction) and a `displayQty`
 * (in the chosen dispensingUnit for the prescription label).
 *
 * @example
 *   computeRxQty({dose:1, frequency:"Twice daily (BID)", duration:"5 days",
 *                 dispensingUnit:"Strip", hierarchy: tabletHierarchy})
 *   → { baseQty: 10, displayQty: 1 }   // 10 tablets = 1 strip
 */
export function computeRxQty(opts: {
  dose: number | string | undefined;
  frequency: string | undefined;
  duration: string | number | undefined;
  timesPerDay?: number;
  dispensingUnit?: string;
  hierarchy?: PackagingHierarchy;
}): { baseQty: number; displayQty: number } {
  const dNum = Math.max(0.25, parseFloat(String(opts.dose ?? 1)) || 1);
  const durMatch = String(opts.duration ?? "5").match(/\d+(\.\d+)?/);
  const days = durMatch ? Math.max(1, parseFloat(durMatch[0])) : 5;

  const tpd = opts.timesPerDay ?? resolveTimesPerDay(opts.frequency);
  const baseQty = Math.max(1, Math.ceil(dNum * tpd * days));

  if (!opts.dispensingUnit || !opts.hierarchy) {
    return { baseQty, displayQty: baseQty };
  }

  const displayQty = Math.max(
    1,
    Math.ceil(convertFromBase(baseQty, opts.dispensingUnit, opts.hierarchy))
  );

  return { baseQty, displayQty };
}

// ─── Hierarchy Validation ──────────────────────────────────────────────────────

/**
 * Returns true if the hierarchy is structurally valid.
 */
export function isValidHierarchy(h: PackagingHierarchy | undefined): boolean {
  if (!h) return false;
  if (!h.baseUnit || !h.purchaseUnit) return false;
  if (h.baseUnitsPerPurchase <= 0) return false;
  if (h.hasIntermediateUnit) {
    if (!h.intermediateUnit) return false;
    if (!h.intermediateUnitsPerPurchase || h.intermediateUnitsPerPurchase <= 0) return false;
    if (!h.baseUnitsPerIntermediate || h.baseUnitsPerIntermediate <= 0) return false;
  }
  return true;
}

/**
 * Derives `baseUnitsPerPurchase` from intermediate factors for a 3-level hierarchy.
 * Call this whenever intermediateUnitsPerPurchase or baseUnitsPerIntermediate changes.
 */
export function deriveBaseUnitsPerPurchase(h: Partial<PackagingHierarchy>): number {
  if (h.hasIntermediateUnit && h.intermediateUnitsPerPurchase && h.baseUnitsPerIntermediate) {
    return h.intermediateUnitsPerPurchase * h.baseUnitsPerIntermediate;
  }
  return h.baseUnitsPerPurchase ?? 1;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pluralise(qty: number, unit: string): string {
  if (!unit) return "";
  if (qty === 1) return unit;
  if (["ml", "kg", "gm", "g", "mg", "l", "ltr"].includes(unit.toLowerCase())) return unit;
  if (unit.endsWith("s")) return unit; // Drops, Strips, Tablets
  if (unit.toLowerCase() === "box") return "Boxes";
  if (unit.toLowerCase() === "vial") return "Vials";
  if (unit.toLowerCase() === "bottle") return "Bottles";
  if (unit.toLowerCase() === "bag") return "Bags";
  return `${unit}s`;
}

function resolveTimesPerDay(frequency: string | undefined): number {
  const f = (frequency ?? "").toLowerCase();
  if (/bid|twice/.test(f)) return 2;
  if (/tid|thrice/.test(f)) return 3;
  if (/qid|four/.test(f)) return 4;
  if (/od|once daily/.test(f)) return 1;
  if (/q12|every 12/.test(f)) return 2;
  if (/q8|every 8/.test(f)) return 3;
  if (/q6|every 6/.test(f)) return 4;
  if (/alternate|qod/.test(f)) return 0.5;
  if (/weekly/.test(f)) return 1 / 7;
  return 2; // BID default
}

/**
 * Compute total prescription quantity factoring in dosing, frequency, duration,
 * and packaging hierarchy dispensing unit.
 */
export function computePrescriptionQty(
  dose: string | number | undefined,
  frequency: string | undefined,
  duration: string | number | undefined,
  opts?: {
    dispensingUnit?: string;
    hierarchy?: PackagingHierarchy;
  }
): { baseQty: number; displayQty: number } {
  const dNum = Math.max(0.25, parseFloat(String(dose ?? 1)) || 1);
  const durMatch = String(duration ?? "5").match(/\d+(\.\d+)?/);
  const days = durMatch ? Math.max(1, parseFloat(durMatch[0])) : 5;
  const timesPerDay = resolveTimesPerDay(frequency);

  // baseQty = units in the base (stock tracking) unit
  const baseQty = Math.max(1, Math.ceil(dNum * timesPerDay * days));

  if (!opts?.dispensingUnit || !opts?.hierarchy) {
    return { baseQty, displayQty: baseQty };
  }

  // displayQty = what the vet sees / writes on the prescription
  const displayQty = Math.max(
    1,
    Math.ceil(convertFromBase(baseQty, opts.dispensingUnit, opts.hierarchy))
  );
  return { baseQty, displayQty };
}
