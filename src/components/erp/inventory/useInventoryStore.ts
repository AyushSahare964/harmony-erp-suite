import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// ─── Data Types ───────────────────────────────────────────────────────────────

export type MedicineCategory = "Medicine" | "Food" | "Accessory" | "Consumable";
export type UnitOfMeasure = "Tablet" | "ml" | "Vial" | "Box" | "Strip" | "Kg" | "Bottle";
export type MedicineStatus = "Active" | "Inactive";

export interface Medicine {
  id: string;
  name: string;
  genericName: string;
  category: MedicineCategory;
  unit: UnitOfMeasure;
  gstRate: number;         // %
  defaultSalePrice: number; // ₹
  reorderLevel: number;
  status: MedicineStatus;
  createdAt: string;
}

export interface Batch {
  id: string;
  medicineId: string;
  batchNo: string;
  expiryDate: string;  // ISO date string YYYY-MM-DD
  purchasePrice: number;
  qty: number;          // running balance
  supplierId?: string;
}

export type MovementType =
  | "purchase_in"
  | "sale_out"
  | "adjustment_in"
  | "adjustment_out"
  | "expiry_writeoff";

export type SourceType =
  | "purchase"
  | "invoice"
  | "manual_bill"
  | "manual_adjustment"
  | "supplier_return";

export interface LedgerEntry {
  id: string;
  medicineId: string;
  medicineName: string;
  batchId: string;
  batchNo: string;
  movementType: MovementType;
  quantity: number;
  sourceType: SourceType;
  sourceRef: string;   // e.g. INV-20481 or ADJ-001
  balanceAfter: number;
  actorName: string;
  createdAt: string;  // ISO datetime
  reason?: string;
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const SEED_MEDICINES: Medicine[] = [
  { id: "M001", name: "Amoxicillin 250mg", genericName: "Amoxicillin", category: "Medicine", unit: "Tablet", gstRate: 12, defaultSalePrice: 24, reorderLevel: 50, status: "Active", createdAt: "2025-01-10" },
  { id: "M002", name: "Rabies Vaccine 1ml", genericName: "Rabies glycoprotein vaccine", category: "Medicine", unit: "Vial", gstRate: 5, defaultSalePrice: 480, reorderLevel: 20, status: "Active", createdAt: "2025-01-10" },
  { id: "M003", name: "IV Fluid RL 500ml", genericName: "Ringer's Lactate", category: "Medicine", unit: "Bottle", gstRate: 5, defaultSalePrice: 65, reorderLevel: 30, status: "Active", createdAt: "2025-01-10" },
  { id: "M004", name: "Dexamethasone 4mg", genericName: "Dexamethasone", category: "Medicine", unit: "Vial", gstRate: 12, defaultSalePrice: 95, reorderLevel: 15, status: "Active", createdAt: "2025-02-05" },
  { id: "M005", name: "Royal Canin Maxi 4kg", genericName: "Canine adult maintenance diet", category: "Food", unit: "Box", gstRate: 5, defaultSalePrice: 1850, reorderLevel: 10, status: "Active", createdAt: "2025-02-05" },
  { id: "M006", name: "Tick & Flea Collar (L)", genericName: "Permethrin collar", category: "Accessory", unit: "Box", gstRate: 18, defaultSalePrice: 320, reorderLevel: 10, status: "Active", createdAt: "2025-03-01" },
  { id: "M007", name: "Deworming Syrup 30ml", genericName: "Pyrantel pamoate", category: "Medicine", unit: "Bottle", gstRate: 12, defaultSalePrice: 95, reorderLevel: 20, status: "Active", createdAt: "2025-03-01" },
  { id: "M008", name: "IV Catheter 20G", genericName: "Peripheral IV catheter", category: "Consumable", unit: "Box", gstRate: 12, defaultSalePrice: 45, reorderLevel: 40, status: "Active", createdAt: "2025-03-15" },
  { id: "M009", name: "Metronidazole 200mg", genericName: "Metronidazole", category: "Medicine", unit: "Tablet", gstRate: 12, defaultSalePrice: 8, reorderLevel: 100, status: "Active", createdAt: "2025-04-01" },
  { id: "M010", name: "Grooming Shampoo 500ml", genericName: "Medicated pet shampoo", category: "Accessory", unit: "Bottle", gstRate: 18, defaultSalePrice: 390, reorderLevel: 8, status: "Inactive", createdAt: "2025-04-01" },
];

const SEED_BATCHES: Batch[] = [
  // Amoxicillin 250mg
  { id: "B001", medicineId: "M001", batchNo: "AMX-2024-01", expiryDate: "2026-11-30", purchasePrice: 16, qty: 42, supplierId: "SUP-01" },
  { id: "B002", medicineId: "M001", batchNo: "AMX-2024-02", expiryDate: "2026-08-20", purchasePrice: 16, qty: 8, supplierId: "SUP-01" },
  // Rabies Vaccine — low stock
  { id: "B003", medicineId: "M002", batchNo: "RBV-2025-01", expiryDate: "2026-09-15", purchasePrice: 340, qty: 12, supplierId: "SUP-02" },
  // IV Fluid RL — critically low
  { id: "B004", medicineId: "M003", batchNo: "IVF-2025-03", expiryDate: "2027-03-01", purchasePrice: 42, qty: 6, supplierId: "SUP-03" },
  // Dexamethasone
  { id: "B005", medicineId: "M004", batchNo: "DEX-2025-01", expiryDate: "2026-12-31", purchasePrice: 68, qty: 28, supplierId: "SUP-02" },
  // Royal Canin
  { id: "B006", medicineId: "M005", batchNo: "RC-2025-08", expiryDate: "2027-06-30", purchasePrice: 1400, qty: 18, supplierId: "SUP-04" },
  // Tick collar — expiring soon (7 days)
  { id: "B007", medicineId: "M006", batchNo: "TFC-2024-06", expiryDate: "2026-08-23", purchasePrice: 220, qty: 7, supplierId: "SUP-05" },
  // Deworming syrup
  { id: "B008", medicineId: "M007", batchNo: "DWS-2025-04", expiryDate: "2027-01-15", purchasePrice: 62, qty: 25, supplierId: "SUP-02" },
  // IV Catheter — out of stock
  { id: "B009", medicineId: "M008", batchNo: "IVC-2025-02", expiryDate: "2028-01-01", purchasePrice: 30, qty: 0, supplierId: "SUP-03" },
  // Metronidazole
  { id: "B010", medicineId: "M009", batchNo: "MTZ-2025-01", expiryDate: "2027-05-31", purchasePrice: 5, qty: 180, supplierId: "SUP-01" },
  // expiring very soon (3 days) — already low
  { id: "B011", medicineId: "M009", batchNo: "MTZ-2024-12", expiryDate: "2026-08-19", purchasePrice: 5, qty: 40, supplierId: "SUP-01" },
];

const now = () => new Date().toISOString().replace("T", " ").slice(0, 16);

const SEED_LEDGER: LedgerEntry[] = [
  { id: "L001", medicineId: "M001", medicineName: "Amoxicillin 250mg", batchId: "B001", batchNo: "AMX-2024-01", movementType: "purchase_in", quantity: 100, sourceType: "purchase", sourceRef: "PO-2024-001", balanceAfter: 100, actorName: "Dr. Ananya Rao", createdAt: "2025-01-12 10:00" },
  { id: "L002", medicineId: "M001", medicineName: "Amoxicillin 250mg", batchId: "B001", batchNo: "AMX-2024-01", movementType: "sale_out", quantity: 58, sourceType: "invoice", sourceRef: "INV-20440", balanceAfter: 42, actorName: "Receptionist", createdAt: "2025-06-10 14:23" },
  { id: "L003", medicineId: "M002", medicineName: "Rabies Vaccine 1ml", batchId: "B003", batchNo: "RBV-2025-01", movementType: "purchase_in", quantity: 30, sourceType: "purchase", sourceRef: "PO-2025-004", balanceAfter: 30, actorName: "Dr. Ananya Rao", createdAt: "2025-04-02 09:00" },
  { id: "L004", medicineId: "M002", medicineName: "Rabies Vaccine 1ml", batchId: "B003", batchNo: "RBV-2025-01", movementType: "sale_out", quantity: 18, sourceType: "manual_bill", sourceRef: "MB-2025-112", balanceAfter: 12, actorName: "Receptionist", createdAt: "2026-07-15 11:30" },
  { id: "L005", medicineId: "M003", medicineName: "IV Fluid RL 500ml", batchId: "B004", batchNo: "IVF-2025-03", movementType: "purchase_in", quantity: 48, sourceType: "purchase", sourceRef: "PO-2025-009", balanceAfter: 48, actorName: "Dr. Ananya Rao", createdAt: "2025-05-20 09:00" },
  { id: "L006", medicineId: "M003", medicineName: "IV Fluid RL 500ml", batchId: "B004", batchNo: "IVF-2025-03", movementType: "adjustment_out", quantity: 42, sourceType: "manual_adjustment", sourceRef: "ADJ-001", balanceAfter: 6, actorName: "Dr. Ananya Rao", createdAt: "2026-08-01 16:00", reason: "Wastage — broken during handling" },
  { id: "L007", medicineId: "M008", medicineName: "IV Catheter 20G", batchId: "B009", batchNo: "IVC-2025-02", movementType: "purchase_in", quantity: 50, sourceType: "purchase", sourceRef: "PO-2025-011", balanceAfter: 50, actorName: "Dr. Ananya Rao", createdAt: "2025-06-01 10:00" },
  { id: "L008", medicineId: "M008", medicineName: "IV Catheter 20G", batchId: "B009", batchNo: "IVC-2025-02", movementType: "sale_out", quantity: 50, sourceType: "invoice", sourceRef: "INV-20460", balanceAfter: 0, actorName: "Receptionist", createdAt: "2026-08-14 13:45" },
];

// ─── Context ──────────────────────────────────────────────────────────────────

interface InventoryContextValue {
  medicines: Medicine[];
  batches: Batch[];
  ledger: LedgerEntry[];
  addMedicine: (m: Omit<Medicine, "id" | "createdAt" | "status">) => void;
  updateMedicine: (id: string, patch: Partial<Medicine>) => void;
  deactivateMedicine: (id: string) => void;
  addStock: (batchData: {
    medicineId: string;
    batchNo: string;
    expiryDate: string;
    purchasePrice: number;
    qty: number;
    supplierId?: string;
    actor: string;
  }) => void;
  removeStock: (data: {
    medicineId: string;
    batchId: string;
    qty: number;
    reason: string;
    actor: string;
  }) => void;
  recordSale: (data: {
    medicineId: string;
    qty: number;
    sourceRef: string;
    actor: string;
  }) => { ok: boolean; error?: string };
  getTotalQty: (medicineId: string) => number;
  getBatches: (medicineId: string) => Batch[];
  getStockStatus: (medicineId: string) => "OK" | "Low" | "Out of Stock";
  getExpiryStatus: (expiryDate: string) => "safe" | "expiring-soon" | "critical" | "expired";
}

const InventoryContext = createContext<InventoryContextValue | null>(null);

let _nextId = 1;
function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${_nextId++}`;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [medicines, setMedicines] = useState<Medicine[]>(SEED_MEDICINES);
  const [batches, setBatches] = useState<Batch[]>(SEED_BATCHES);
  const [ledger, setLedger] = useState<LedgerEntry[]>(SEED_LEDGER);

  const getTotalQty = useCallback(
    (medicineId: string) =>
      batches.filter((b) => b.medicineId === medicineId).reduce((s, b) => s + b.qty, 0),
    [batches]
  );

  const getBatches = useCallback(
    (medicineId: string) =>
      batches
        .filter((b) => b.medicineId === medicineId)
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)),
    [batches]
  );

  const getStockStatus = useCallback(
    (medicineId: string): "OK" | "Low" | "Out of Stock" => {
      const med = medicines.find((m) => m.id === medicineId);
      const qty = getTotalQty(medicineId);
      if (qty === 0) return "Out of Stock";
      if (med && qty <= med.reorderLevel) return "Low";
      return "OK";
    },
    [medicines, getTotalQty]
  );

  const getExpiryStatus = useCallback(
    (expiryDate: string): "safe" | "expiring-soon" | "critical" | "expired" => {
      const today = new Date();
      const expiry = new Date(expiryDate);
      const diffDays = Math.floor((expiry.getTime() - today.getTime()) / 86400000);
      if (diffDays < 0) return "expired";
      if (diffDays <= 7) return "critical";
      if (diffDays <= 30) return "expiring-soon";
      return "safe";
    },
    []
  );

  const addMedicine = useCallback(
    (m: Omit<Medicine, "id" | "createdAt" | "status">) => {
      const newMed: Medicine = {
        ...m,
        id: uid("M"),
        status: "Active",
        createdAt: new Date().toISOString().slice(0, 10),
      };
      setMedicines((prev) => [newMed, ...prev]);
    },
    []
  );

  const updateMedicine = useCallback(
    (id: string, patch: Partial<Medicine>) => {
      setMedicines((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
      );
    },
    []
  );

  const deactivateMedicine = useCallback((id: string) => {
    setMedicines((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: "Inactive" } : m))
    );
  }, []);

  const addStock = useCallback(
    (batchData: {
      medicineId: string;
      batchNo: string;
      expiryDate: string;
      purchasePrice: number;
      qty: number;
      supplierId?: string;
      actor: string;
    }) => {
      const { actor, qty, medicineId, ...rest } = batchData;

      // Check if batch with same batchNo already exists for this medicine
      const existing = batches.find(
        (b) => b.medicineId === medicineId && b.batchNo === batchData.batchNo
      );

      let batchId: string;
      let newQty: number;

      if (existing) {
        batchId = existing.id;
        newQty = existing.qty + qty;
        setBatches((prev) =>
          prev.map((b) =>
            b.id === existing.id ? { ...b, qty: b.qty + qty } : b
          )
        );
      } else {
        batchId = uid("B");
        newQty = qty;
        const newBatch: Batch = { id: batchId, medicineId, qty, ...rest };
        setBatches((prev) => [...prev, newBatch]);
      }

      const med = medicines.find((m) => m.id === medicineId);
      const entry: LedgerEntry = {
        id: uid("L"),
        medicineId,
        medicineName: med?.name ?? "Unknown",
        batchId,
        batchNo: batchData.batchNo,
        movementType: "purchase_in",
        quantity: qty,
        sourceType: "purchase",
        sourceRef: `PO-${Date.now()}`,
        balanceAfter: newQty,
        actorName: actor,
        createdAt: now(),
      };
      setLedger((prev) => [entry, ...prev]);
    },
    [batches, medicines]
  );

  const removeStock = useCallback(
    (data: { medicineId: string; batchId: string; qty: number; reason: string; actor: string }) => {
      const { medicineId, batchId, qty, reason, actor } = data;
      const batch = batches.find((b) => b.id === batchId);
      if (!batch) return;

      const newQty = Math.max(0, batch.qty - qty);
      setBatches((prev) =>
        prev.map((b) => (b.id === batchId ? { ...b, qty: newQty } : b))
      );

      const med = medicines.find((m) => m.id === medicineId);
      const entry: LedgerEntry = {
        id: uid("L"),
        medicineId,
        medicineName: med?.name ?? "Unknown",
        batchId,
        batchNo: batch.batchNo,
        movementType: "adjustment_out",
        quantity: qty,
        sourceType: "manual_adjustment",
        sourceRef: `ADJ-${Date.now()}`,
        balanceAfter: newQty,
        actorName: actor,
        createdAt: now(),
        reason,
      };
      setLedger((prev) => [entry, ...prev]);
    },
    [batches, medicines]
  );

  // FEFO: pick earliest-expiry batch with available stock
  const recordSale = useCallback(
    (data: { medicineId: string; qty: number; sourceRef: string; actor: string }): { ok: boolean; error?: string } => {
      const { medicineId, qty, sourceRef, actor } = data;
      const available = batches
        .filter((b) => b.medicineId === medicineId && b.qty > 0)
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

      const totalAvail = available.reduce((s, b) => s + b.qty, 0);
      if (totalAvail < qty) {
        return { ok: false, error: `Only ${totalAvail} units available` };
      }

      const med = medicines.find((m) => m.id === medicineId);
      let remaining = qty;
      const newBatches = batches.map((b) => ({ ...b }));
      const entries: LedgerEntry[] = [];

      for (const ab of available) {
        if (remaining <= 0) break;
        const take = Math.min(ab.qty, remaining);
        const batchRef = newBatches.find((b) => b.id === ab.id)!;
        batchRef.qty -= take;
        remaining -= take;

        entries.push({
          id: uid("L"),
          medicineId,
          medicineName: med?.name ?? "Unknown",
          batchId: ab.id,
          batchNo: ab.batchNo,
          movementType: "sale_out",
          quantity: take,
          sourceType: "manual_bill",
          sourceRef,
          balanceAfter: batchRef.qty,
          actorName: actor,
          createdAt: now(),
        });
      }

      setBatches(newBatches);
      setLedger((prev) => [...entries, ...prev]);
      return { ok: true };
    },
    [batches, medicines]
  );

  const value = useMemo<InventoryContextValue>(
    () => ({
      medicines,
      batches,
      ledger,
      addMedicine,
      updateMedicine,
      deactivateMedicine,
      addStock,
      removeStock,
      recordSale,
      getTotalQty,
      getBatches,
      getStockStatus,
      getExpiryStatus,
    }),
    [medicines, batches, ledger, addMedicine, updateMedicine, deactivateMedicine, addStock, removeStock, recordSale, getTotalQty, getBatches, getStockStatus, getExpiryStatus]
  );

  return React.createElement(InventoryContext.Provider, { value }, children);
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error("useInventory must be used inside InventoryProvider");
  return ctx;
}
