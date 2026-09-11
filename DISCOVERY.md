# Phase 0 — Discovery Report (`DISCOVERY.md`)

*Completed as required by `impl_prescription.md` §3 & §17.*
*Read-only inspection of the active codebase. No source code has been altered.*

---

## 1. Discovery Checklist Answers

| # | Area | Codebase Findings & File Paths / Line Numbers | Implications for Implementation |
|---|------|-----------------------------------------------|----------------------------------|
| 1 | **Prescription Page** | • Modal container: [`VisitWorkspaceModal.tsx`](file:///c:/Users/HP%20pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/src/components/erp/clinical/VisitWorkspaceModal.tsx#L1027-L1146)<br>• Prescription Workflow Component: [`PrescriptionWorkflow.tsx`](file:///c:/Users/HP%20pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/src/components/erp/clinical/prescription/PrescriptionWorkflow.tsx#L124)<br>• State: React component state (`useState`, `useMemo`), props callbacks (`onSavePrescription`, `onProceedToBilling`). | We will introduce a modular `usePrescriptionState` hook and structured components (`SectionCard`, `InventoryItemSection`, `SectionJumpBar`) into `PrescriptionWorkflow.tsx`. |
| 2 | **Symptoms Default** | Found in 5 specific locations:<br>1. [`VisitWorkspaceModal.tsx`](file:///c:/Users/HP%20pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/src/components/erp/clinical/VisitWorkspaceModal.tsx#L101) line 101 & 698: `visit?.vitals?.complaint \|\| "Routine consultation and health review"`<br>2. [`ReceptionistDashboardView.tsx`](file:///c:/Users/HP%20pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/src/components/erp/dashboards/ReceptionistDashboardView.tsx#L95) line 95 & 218: `"Routine consultation & health checkup"`<br>3. [`BookAppointmentModal.tsx`](file:///c:/Users/HP%20pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/src/components/erp/appointments/BookAppointmentModal.tsx#L154) line 154: `complaint.trim() \|\| "Routine Consultation"`<br>4. [`AdmitPatientPickerModal.tsx`](file:///c:/Users/HP%20pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/src/components/erp/clinical/AdmitPatientPickerModal.tsx#L415) line 415: `apt.reason \|\| "Routine Consultation"`<br>5. [`clinical.ts`](file:///c:/Users/HP%20pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/src/lib/mongodb/serverFns/clinical.ts#L708) line 708: `visit.vitals?.complaint \|\| "Routine Clinical Consultation"`<br>• *Note: DB schema (`ClinicalVisit.ts` line 256) has NO default value for complaint.* | Replace all hardcoded fallbacks with empty string `""` or placeholder text so newly created visits start with a clean, blank symptoms field. Existing visits with saved text remain untouched. |
| 3 | **Medicine Search** | • Server function: `getItemsFn` in [`inventory.ts`](file:///c:/Users/HP%20pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/src/lib/mongodb/serverFns/inventory.ts#L260) line 260.<br>• Component: [`CatalogueSearch.tsx`](file:///c:/Users/HP%20pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/src/components/erp/clinical/prescription/CatalogueSearch.tsx) searches `name`, `brand`, `genericName`, `itemCode`, and filters by category using `filterByCatalogueType`. | Fully reusable. We will extend with optional `dosageForm?: string[]` parameter for injectable filtering. |
| 4 | **Food & Accessory Search** | • Handled by same `getItemsFn` with `productType: "FOOD"` and `"ACCESSORY"`.<br>• Strict separation guaranteed by `filterByCatalogueType` in [`CatalogueSearch.tsx`](file:///c:/Users/HP%20pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/src/components/erp/clinical/prescription/CatalogueSearch.tsx#L26-L76). | Reused unchanged for Animal Food, Prescribed Food, and Accessories. |
| 5 | **Inventory Schema (Injectables)** | • Model: [`InventoryItem.ts`](file:///c:/Users/HP%20pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/src/lib/mongodb/models/InventoryItem.ts#L41).<br>• Already contains `medicineDetails.dosageForm` (line 41, 149), `medicineType`, `strength`.<br>• Heuristic tagging: Names containing `inj`, `injection`, `vaccine`, `vial`. | Injectables can be identified by checking `medicineDetails.dosageForm` or the heuristic regex, with a "Show all medicines" fallback toggle. |
| 6 | **Prescription Item Storage** | • Model: [`ClinicalVisit.ts`](file:///c:/Users/HP%20pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/src/lib/mongodb/models/ClinicalVisit.ts#L120-L200).<br>• Contains `prescriptionData` (structured clinical entries) and `items: IPrescriptionLine[]` (billable items).<br>• Primary key: `id` (client-generated UUID on add).<br>• Indexing: Header unique on `visitId` (line 229). Items will carry `sourceType` and `sourceId` for idempotency. | Add `sourceType`, `sourceId`, and `rxSection` to `IPrescriptionLine` to enable idempotent upserts on every section save. |
| 7 | **Consultation Fee** | • Currently lives in [`VisitWorkspaceModal.tsx`](file:///c:/Users/HP%20pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/src/components/erp/clinical/VisitWorkspaceModal.tsx#L126-L135,L793-L813) as a default line item with `lineType: "Consultation"`, unitPrice ₹500.<br>• Handled in billing calculations. | Move to dedicated Consultation Fee section in Prescription header (`prescriptionData.consultationFee`), with preset chips (₹0, ₹300, ₹500, ₹800, ₹1200), synced transactionally to `items` as `sourceType = "RX_CONSULT"`. |
| 8 | **Billing System** | • Invoices are stored in `ClinicalVisit` documents.<br>• Calculation: [`moneyUtils.ts`](file:///c:/Users/HP%20pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/src/lib/utils/moneyUtils.ts#L99-L137) `calcBillSummary` handles subtotal, taxable, GST (GST vs Non-GST), roundOff, and totalAmount.<br>• Bills cannot be duplicated (keyed to `visitId`).<br>• Billing screens: [`PatientBillingHub.tsx`](file:///c:/Users/HP%20pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/src/components/erp/billing/PatientBillingHub.tsx), [`InvoiceDetailModal.tsx`](file:///c:/Users/HP%20pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/src/components/erp/billing/InvoiceDetailModal.tsx). | Prescription sync code calls `calcBillSummary` directly, ensuring exact match between prescription panel and billing record. |
| 9 | **Stock Deduction Sites** | • ONLY ONE place: [`clinical.ts`](file:///c:/Users/HP%20pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/src/lib/mongodb/serverFns/clinical.ts#L520-L585) inside `finalizeVisitAndBillFn` when payment is settled.<br>• `savePrescriptionFn` does NOT decrement stock.<br>• StockBatch is updated and ledger entry created in `ErpRow` (`moduleId: "inventory_ledger"`). | Maintain this exact behavior. Ensure settlement is guarded so re-saving a settled visit never double-deducts. |
| 10 | **Laboratory Module** | • Models: `ErpRow` with `moduleId: "lab_orders"` and [`BloodTest.ts`](file:///c:/Users/HP%20pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/src/lib/mongodb/models/BloodTest.ts).<br>• Server functions: [`laboratory.ts`](file:///c:/Users/HP%20pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/src/lib/mongodb/serverFns/laboratory.ts) (`listLabOrdersFn`, `createLabOrderFn`, `updateLabResultsFn`).<br>• Statuses: `"Ordered" \| "Sample Collected" \| "Processing" \| "Completed" \| "Cancelled"`. | Follow-up Blood Test saves sync directly to lab orders with `sourceType: "RX_FOLLOWUP_TEST"`. Removing test sets order to `Cancelled` if still `Ordered`, or blocks if sample collected. |
| 11 | **Follow-ups & Reminders** | • Models: [`FollowUp.ts`](file:///c:/Users/HP%20pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/src/lib/mongodb/models/FollowUp.ts), `Vaccination.ts`, `DewormingRecord.ts`.<br>• Auto-sync to appointments: `clinical.ts` line 408 & 720. | Consolidate follow-up state in `prescriptionData.followUp` with quick-date support (DD/MM/YYYY) across 5 categories. |
| 12 | **Save Draft** | • Currently: `handleSaveDraft` in `PrescriptionWorkflow.tsx` builds payload and saves whole prescription via `savePrescriptionFn`. | Upgrade to section-level save + atomic full draft save with optimistic versioning. |
| 13 | **Date Formatting & Pickers** | • Utilities: [`dateUtils.ts`](file:///c:/Users/HP%20pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/src/lib/utils/dateUtils.ts) (`formatDisplayDate` produces DD/MM/YYYY, `toISODate` produces YYYY-MM-DD local date).<br>• Quick-dates: `date-fns` `addDays`, `addMonths`, `addYears`. | Enforce DD/MM/YYYY for display, YYYY-MM-DD for storage, never use `toISOString()` in browser to prevent UTC day shifts. |
| 14 | **Right-side Panel** | • In [`VisitWorkspaceModal.tsx`](file:///c:/Users/HP%20pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/src/components/erp/clinical/VisitWorkspaceModal.tsx#L1149-L1240). Currently derives from modal `lines` state. | Modernize into live derived view showing item grouping, subtotals, grand total, and "Unsaved changes" indicator when local edits differ from last saved state. |
| 15 | **Test Setup** | • Test file exists: [`catalogueFilter.test.ts`](file:///c:/Users/HP%20pavilion/Videos/Screenshots/OneDrive/Desktop/Vetarnary_Hospital_ERP_System/harmony-erp-suite/src/components/erp/clinical/prescription/__tests__/catalogueFilter.test.ts).<br>• Tests can be executed using Node or Vitest. | Add unit test suites for `calcLineItem`, `quickDate`, and section diffing. |

---

## 2. Exact Schemas in Current System

### A. Prescription Header & Structured Prescription (`ClinicalVisit`)
```typescript
interface IClinicalVisit {
  visitId: string;           // Unique index
  invoiceNo: string;         // Unique index
  prescriptionNo: string;    // Index
  date: string;              // YYYY-MM-DD
  status: "Admitted" | "In Consultation" | "Diagnosed" | "Billed" | "Paid" | "Closed";
  petId: string; petName: string; species: string; breed: string;
  ownerId: string; ownerName: string; ownerPhone: string;
  doctorName: string;
  vitals?: { weightKg?: number; tempC?: number; heartRate?: number; complaint?: string; weight?: number; weightUnit?: string; temp?: number; tempUnit?: string };
  diagnosis?: string;
  clinicalNotes?: string;
  nextVisitDate?: string; nextVaccineDate?: string; nextDewormingDate?: string;
  prescriptionData?: IPrescriptionData;
  items: IPrescriptionLine[];
  subtotal: number; billDiscount: number; taxableAmount: number; gstAmount: number; roundOff: number; totalAmount: number;
  amountPaid: number; balanceDue: number; pendingAmount?: number; paymentStatus?: "Full" | "Partial" | "Unpaid";
  payments: IPaymentRecord[];
  inventoryDeducted: boolean;
  accountingPosted: boolean;
}
```

### B. Billing Line Item Schema (`IPrescriptionLine`)
```typescript
interface IPrescriptionLine {
  id?: string;               // Stable client-generated UUID
  lineType: "Vaccine" | "Consultation" | "Pharmacy" | "Procedure" | "Diagnostic" | "Service" | "Food" | "Accessory";
  itemCode?: string;
  batchNo?: string;
  name: string;
  dosageInstructions?: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountType?: "percentage" | "fixed";
  discountValue?: number;
  discountAmount?: number;
  taxableAmount?: number;
  gstRate: number;
  lineTotal: number;
  sourceType?: "RX_ITEM" | "RX_CONSULT" | "RX_LAB" | null;
  sourceId?: string;
  rxSection?: string;
}
```

### C. Inventory Item Schema (`IInventoryItem`)
```typescript
interface IInventoryItem {
  itemCode: string;          // M-0001, F-0001, A-0001
  productType: "MEDICINE" | "FOOD" | "ACCESSORY";
  name: string;
  genericName: string;
  brand: string;
  category: "Medicine" | "Food" | "Accessory" | "Consumable" | "Animal Food" | "Animal Accessories";
  subGroup: string;
  medicineDetails?: {
    medicineType?: string;
    genericComposition?: string;
    strength?: string;
    dosageForm?: string;     // INJECTION, TABLET, SYRUP, etc.
    packSize?: string;
    batchNumber?: string;
    expiryDate?: string;
  };
  unit: string;
  defaultSalePrice: number;
  mrp: number;
  currentStock: number;
  gstRate: number;
  status: "Active" | "Inactive";
}
```

### D. Lab Order Schema (`ErpRow` with `moduleId: "lab_orders"`)
```typescript
interface ILabOrder {
  orderId: string;
  pet: string; petId: string; species: string; breed: string;
  owner: string; phone: string;
  testName: string; profile: string; sampleType: string; barcode: string;
  tat: string; priority: string; doctor: string;
  date: string; time: string;
  status: "Ordered" | "Sample Collected" | "Processing" | "Completed" | "Cancelled";
  sourceType?: "RX_FOLLOWUP_TEST";
  sourceId?: string;
  parameters: Array<{ name: string; value: string; unit: string; refInterval: string; flag: string }>;
}
```

---

## 3. Baseline Data Check (Pre-Migration Sanity)
- Seed invoices `V-0905` (₹3,500), `V-0906` (₹750), and `V-0894` (₹750) recorded.
- Schema changes in Phase 1 are strictly additive (no drops, no renames).
- Ready for Phase 1 execution upon approval.
