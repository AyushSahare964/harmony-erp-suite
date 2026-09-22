# Detailed Implementation Plan: Inventory Wizard Step 4 Purchase Bill Integration

**Document Version:** 1.0  
**Date:** 22 September 2026  
**Scope:** Inventory Module (`ProductMasterWizardDialog`) & Billing / Accounting Integration (`SupplierBillFormModal` / `createPurchaseBillFn`)  
**Target Flow:** New Product Master Wizard → Step 4: Purchasing (Integrated Purchase Bill) → Automatic Bill Generation in Billing & Payments  

---

## 1. Executive Summary

In the current ERP workflow, adding a new item/medicine to the inventory and recording its inward supplier purchase bill are two disconnected operations:
1. An administrator creates a medicine in **Inventory & Procurement** using the **New Product Master Wizard** (5 steps), entering unit, initial opening stock, and purchase prices.
2. In Step 4 ("Purchasing"), the wizard currently only collects static text (`defaultSupplierName`, `defaultSupplierId`, lead time, and MOQ) without creating any financial purchase document.
3. The clinic staff must then separately navigate to **Billing & Payments**, press `Alt+P` or open **Unsaved Purchase Bill** (`SupplierBillFormModal`), select the supplier, search for the newly created item, re-type the quantity and purchase rate, and manually save the bill.

### Requested Goal
In Step 4 of the Product Master Wizard ("Purchasing"), replace the plain static text fields with the **exact Purchase Bill function** (keeping all fields and functionality identical to `SupplierBillFormModal`). When adding a medicine in inventory, its purchase bill should be **automatically generated in the Billing & Payments section** upon saving the item.

---

## 2. Visual Architecture & Workflow Comparison

### Current Disconnected Flow
```
[Step 1: Specs] ➔ [Step 2: Stock & Opening Qty] ➔ [Step 3: Pricing & Cost] ➔ [Step 4: Plain Text Inputs] ➔ [Step 5: Finish]
                                                                                                                   │
                                                                                                                   ▼ (Item Saved in Inventory only)
                                                                                                        [Switch to Billing & Payments]
                                                                                                                   │
                                                                                                                   ▼
                                                                                                        [Manually Create Purchase Bill]
```

### Proposed Unified Flow
```
[Step 1: Specs] ➔ [Step 2: Stock & Opening Qty] ➔ [Step 3: Pricing & Cost]
                                                          │
                                                          ▼
                                      [Step 4: Integrated Purchase Bill Function]
                                      • Bill Info: Purchase Type, Date, Supplier Picker (+ New), State, PO No, Bill No
                                      • Particulars: Auto-populated with Item Name, Unit, Opening Qty, Purchase Rate
                                      • Particulars Grid: Ability to add lines / adjust amounts
                                      • Shipping & Packaging + Remarks + Sub Total & Grand Total
                                      • Retains Supplier Lead Time & MOQ
                                                          │
                                                          ▼
                                            [Step 5: Accounts & Review]
                                                          │
                                                          ▼
                                                [Save Product Master]
                                                          │
                          ┌───────────────────────────────┴───────────────────────────────┐
                          ▼                                                               ▼
        [1. Medicine Created in MongoDB]                               [2. Purchase Bill Auto-Generated]
          Collection: `medicines`                                        Collection: `purchasebills`
          Inventory ledger updated                                       Appears instantly in Billing & Payments
```

---

## 3. Detailed Component & Data Flow Analysis

### 3.1 Source Components Involved

| Component | File Path | Current Role |
| :--- | :--- | :--- |
| **Product Master Wizard** | `src/components/erp/inventory/ProductMasterWizardDialog.tsx` | 5-step modal for creating medicines, injections, food, accessories. Step 4 currently has 4 simple inputs. |
| **Supplier Bill Form** | `src/components/erp/accounting/SupplierBillFormModal.tsx` | Standalone modal titled "Unsaved Purchase Bill" used in Billing & Payments (`Alt+P`). |
| **New Supplier Modal** | `src/components/erp/accounting/NewSupplierModal.tsx` | Quick modal to register a new supplier on-the-fly. |
| **Purchase Bill Server API** | `src/lib/mongodb/serverFns/purchaseBills.ts` | `createPurchaseBillFn` server function that validates, numbers (`PB/26-27/xxxx`), and inserts into `purchasebills` collection. |
| **Supplier Bills Registry** | `src/components/erp/accounting/SupplierBillsTab.tsx` | Table and analytics view in Billing & Payments displaying all supplier bills. |
| **Inventory Store** | `src/components/erp/inventory/useInventoryStore.ts` | Manages active medicines, ledger entries, and mutations (`addMedicine`). |

---

## 4. Implementation Steps

### Phase 1: State & Types Expansion in `ProductMasterWizardDialog.tsx`
Add state variables to manage the Purchase Bill in the wizard:

```typescript
// Purchase Bill State in ProductMasterWizardDialog
const [enablePurchaseBill, setEnablePurchaseBill] = useState(true);
const [purchaseType, setPurchaseType] = useState<"GST" | "Non-GST" | "Bill of Supply">("GST");
const [billDate, setBillDate] = useState(todayIST());
const [purchaseSupplierId, setPurchaseSupplierId] = useState("");
const [placeOfSupply, setPlaceOfSupply] = useState("Maharashtra");
const [poNumber, setPoNumber] = useState("");
const [purchaseBillNo, setPurchaseBillNo] = useState("");

// Particulars Line items state
interface PurchaseParticularLine {
  id: string;
  sNo: number;
  serialNo?: string;
  productName: string;
  quantity: number;
  unit: string;
  purchasePrice: number;
  amount: number;
}
const [purchaseLines, setPurchaseLines] = useState<PurchaseParticularLine[]>([]);

// Particulars entry row state (for adding additional lines if needed)
const [partProductName, setPartProductName] = useState("");
const [partUom, setPartUom] = useState("PCS");
const [partQty, setPartQty] = useState<number>(1);
const [partPrice, setPartPrice] = useState<number>(0);

// Shipping & Remarks
const [addShipping, setAddShipping] = useState(false);
const [shippingCost, setShippingCost] = useState<number>(0);
const [purchaseRemarks, setPurchaseRemarks] = useState("");

// New Supplier Modal state
const [showNewSupplierModal, setShowNewSupplierModal] = useState(false);
const [suppliers, setSuppliers] = useState<SupplierMasterRow[]>([]);
```

---

### Phase 2: Step 4 UI Layout (Matching Reference Screenshot 2)

Step 4 of `ProductMasterWizardDialog.tsx` will be upgraded from basic inputs to the complete Purchase Bill card:

1. **Header Toolbar & Toggle**:
   - Title: **Purchase Bill Details**
   - Switch: `Auto-generate Purchase Bill in Billing (Recommended)`
   - Explanation badge: *"An official purchase bill will be booked under Billing & Payments for this initial inward stock."*

2. **Groupbox 1: Purchase Bill Information**:
   - **Purchase Type**: Dropdown (`GST`, `Non-GST`, `Bill of Supply`).
   - **Date**: Date input / calendar picker (`billDate`).
   - **Supplier Name**: Dropdown list of suppliers from `listSuppliersFn()` + `+` button that opens `NewSupplierModal` without abandoning the wizard.
   - **Place of Supply**: Dropdown / text (`placeOfSupply`, default: `"Maharashtra"`).
   - **P. O. No.**: Text input (`poNumber`).
   - **Purchase Bill No.**: Pre-filled suggested number (`PB-2026-XXXX`), fully editable so the user can enter the vendor's actual tax invoice number.

3. **Groupbox 2: Particulars Entry Row & Table**:
   - Radio buttons: `Tagging` | `Item Code`.
   - Entry inputs:
     - `Product Name`: Pre-filled with `form.name`.
     - `UoM`: Pre-filled with `form.unit`.
     - `Quantity`: Pre-filled with `Number(form.openingStock) || 1`.
     - `Purchase Price`: Pre-filled with `Number(form.defaultPurchasePrice) || 0`.
     - `Amount`: Auto-calculated (`Qty * Purchase Price`).
     - `Serial No.`: Auto-assigned badge (`SR-001`).
     - Green `[+]` button to append extra line items if needed.
   - **Table of Particulars**:
     - Columns: `S. No.` | `Product Name` | `Quantity` | `Unit` | `Purchase Price` | `Amount` | `Action`.
     - Displays the item currently being created plus any added items.
     - Row delete button with automatic sequential renumbering.

4. **Groupbox 3: Shipping, Remarks & Totals**:
   - Checkbox: `Add Shipping and Packaging Costs` (shows shipping input when checked).
   - `Remarks` textarea.
   - Totals summary box:
     - `Sub Total: ₹ X,XXX.XX`
     - `TOTAL AMOUNT: ₹ X,XXX.XX`

5. **Supplier Policy Configuration**:
   - Compact collapsible section or footer row containing the wizard's master parameters:
     - `Supplier Lead Time (Days)`
     - `Minimum Order Quantity (MOQ)`

---

### Phase 3: Auto-Synchronization between Steps

To ensure a seamless user experience, data flows dynamically into Step 4:
- When the user transitions from Step 3 to Step 4:
  - If `purchaseLines` is empty and `form.name` is entered, the initial row is automatically configured:
    - `productName: form.name`
    - `unit: form.unit`
    - `quantity: Math.max(1, Number(form.openingStock) || 1)`
    - `purchasePrice: Number(form.defaultPurchasePrice) || 0`
    - `amount: quantity * purchasePrice`
- If the user changes the Supplier dropdown in Step 4, it automatically syncs into `form.defaultSupplierId` and `form.defaultSupplierName`.

---

### Phase 4: Atomic Save & Purchase Bill Generation

When the user finishes the wizard and clicks **Save Product Master** (`handleSaveProduct`):

```typescript
// 1. Create the inventory medicine master record
const created = await addMedicine(payload as any);

// 2. If Purchase Bill generation is enabled and lines exist
if (enablePurchaseBill && purchaseLines.length > 0) {
  const subTotal = purchaseLines.reduce((s, l) => s + (l.amount || 0), 0);
  const shipping = addShipping ? Math.max(0, shippingCost || 0) : 0;
  const grandTotal = Math.round((subTotal + shipping) * 100) / 100;
  
  const supplierObj = suppliers.find((s) => s._id === purchaseSupplierId);
  const supplierName = supplierObj?.name || form.defaultSupplierName || "Supplier";

  await createPurchaseBillFn({
    data: {
      supplierId: purchaseSupplierId || "GENERIC_SUPPLIER",
      supplierName: supplierName,
      billNumber: purchaseBillNo.trim() || `PB-${Date.now()}`,
      billDate: billDate,
      taxType: "INTRA",
      subtotal: subTotal,
      discountTotal: 0,
      taxableTotal: subTotal,
      cgstTotal: 0,
      sgstTotal: 0,
      igstTotal: 0,
      otherCharges: shipping,
      roundOff: 0,
      grandTotal: grandTotal > 0 ? grandTotal : 1,
      remarks: purchaseRemarks.trim() || undefined,
      items: purchaseLines.map((l, idx) => ({
        lineNo: idx + 1,
        itemType: "INVENTORY",
        inventoryItemId: created ? (created as any)._id || created.itemCode : undefined,
        description: l.productName,
        hsnCode: form.hsnCode || "3004",
        qty: l.quantity,
        freeQty: 0,
        unit: l.unit,
        purchaseRate: l.purchasePrice,
        mrp: Number(form.mrp) || l.purchasePrice * 1.25,
        discountPct: 0,
        gstPct: Number(form.gstRate) || 0,
        taxableAmount: l.amount,
        taxAmount: 0,
        lineTotal: l.amount,
      })),
    },
  });

  toast.success(`Created ${form.name} and generated Purchase Bill (${purchaseBillNo}) in Billing!`);
} else {
  toast.success(`Created ${form.name} successfully`);
}
```

---

## 5. Verification & Acceptance Criteria

### Test Scenario 1: New Medicine Inward with Purchase Bill
1. Open **Inventory & Procurement** → **Medicine Catalogue**.
2. Click **+ Add Medicine / Product Master**.
3. **Step 1 (Identity)**: Enter Name `"Amoxicillin 500mg"`, Strength `"500mg"`.
4. **Step 2 (Stock)**: Set Unit `"Strip"`, Initial Opening Stock `"50"`.
5. **Step 3 (Pricing)**: Set Default Purchase Cost `"₹80"`, Selling Price `"₹120"`, GST `"12%"`.
6. **Step 4 (Purchasing)**:
   - Verify Purchase Bill view is active.
   - Verify Supplier dropdown is loaded with active suppliers.
   - Verify table already has 1 row: `"Amoxicillin 500mg"`, Qty `50`, Unit `Strip`, Purchase Price `₹80`, Amount `₹4,000`.
   - Verify Bill No is auto-suggested (e.g. `PB-2026-XXXX`).
7. **Step 5 (Sales & Accounts)**: Click **Save Product Master**.
8. **Check Billing Module**:
   - Navigate to **Billing & Payments** → **Supplier Bills / Purchase Register**.
   - Verify the bill is present with the exact supplier name, bill number, and amount ₹4,000.

### Test Scenario 2: Quick Supplier Creation inside Step 4
1. In Step 4, click the `+` button next to Supplier Name.
2. The `NewSupplierModal` opens.
3. Fill in a new supplier `"Apex Pharma Labs"` and submit.
4. Verify the modal closes, the supplier list updates automatically, and `"Apex Pharma Labs"` is immediately selected in Step 4.

### Test Scenario 3: Opt-Out / Master Only Creation
1. If the user unchecks the `Auto-generate Purchase Bill` toggle in Step 4, the medicine is saved purely to inventory without creating an unneeded bill document in accounting.

---

## 6. Implementation Readiness

All underlying MongoDB models (`PurchaseBillModel`, `MedicineModel`), server functions (`createPurchaseBillFn`, `addItemFn`, `listSuppliersFn`), and modal components (`NewSupplierModal`, `SupplierBillFormModal`) already exist and are fully functional in the codebase. This integration coordinates these existing systems directly within Step 4 of the Product Master Wizard.
