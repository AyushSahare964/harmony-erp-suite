import { useState, useEffect } from "react";
import {
  X,
  FileSpreadsheet,
  Plus,
  Trash2,
  Check,
  Calendar,
  Building,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SplitPaymentInput, type PaymentLine, type PaymentAccount } from "@/components/erp/shared/SplitPaymentInput";
import { todayIST } from "@/lib/utils/dateUtils";
import { listSuppliersFn, listPaymentAccountsFn, type SupplierMasterRow } from "@/lib/mongodb/serverFns/masters";
import { getItemsFn, type InventoryItemRow } from "@/lib/mongodb/serverFns/inventory";
import { createPurchaseBillFn } from "@/lib/mongodb/serverFns/purchaseBills";
import { toast } from "sonner";

interface SupplierBillFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialSupplierId?: string;
}

interface BillItemState {
  id: string;
  itemType: "INVENTORY" | "NON_INVENTORY";
  inventoryItemId?: string;
  description: string;
  hsnCode: string;
  batchNo: string;
  expiryDate: string; // YYYY-MM
  qty: number;
  freeQty: number;
  unit: string;
  purchaseRate: number;
  mrp: number;
  discountPct: number;
  gstPct: number;
}

function calculateLine(item: BillItemState) {
  const baseGross = (item.qty || 0) * (item.purchaseRate || 0);
  const discountAmount = (baseGross * (item.discountPct || 0)) / 100;
  const taxableAmount = Math.max(0, baseGross - discountAmount);
  const taxAmount = (taxableAmount * (item.gstPct || 0)) / 100;
  const lineTotal = taxableAmount + taxAmount;
  return { taxableAmount, taxAmount, lineTotal };
}

export function SupplierBillFormModal({
  open,
  onClose,
  onSuccess,
  initialSupplierId,
}: SupplierBillFormModalProps) {
  const [suppliers, setSuppliers] = useState<SupplierMasterRow[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemRow[]>([]);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form Header State
  const [supplierId, setSupplierId] = useState(initialSupplierId || "");
  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState(todayIST());
  const [dueDate, setDueDate] = useState("");
  const [taxType, setTaxType] = useState<"INTRA" | "INTER">("INTRA");
  const [remarks, setRemarks] = useState("");
  const [otherCharges, setOtherCharges] = useState<number | "">("");

  // Items state
  const [items, setItems] = useState<BillItemState[]>([
    {
      id: "item_1",
      itemType: "INVENTORY",
      description: "",
      hsnCode: "3004",
      batchNo: "",
      expiryDate: "",
      qty: 1,
      freeQty: 0,
      unit: "Vials",
      purchaseRate: 0,
      mrp: 0,
      discountPct: 0,
      gstPct: 12,
    },
  ]);

  // Payment section state
  const [payNow, setPayNow] = useState(false);
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([
    {
      id: "pay_1",
      mode: "BANK_TRANSFER",
      accountId: "",
      amount: 0,
      referenceNo: "",
      chequeDate: "",
    },
  ]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      listSuppliersFn(),
      getItemsFn({ status: "Active" }),
      listPaymentAccountsFn(),
    ])
      .then(([sups, invItems, accs]) => {
        setSuppliers(sups);
        setInventoryItems(invItems);
        setAccounts(accs);
        if (sups.length > 0 && !supplierId) {
          setSupplierId(sups[0]._id);
        }
      })
      .catch((err) => {
        console.error("Failed to load bill masters:", err);
        toast.error("Failed to load suppliers or items");
      })
      .finally(() => setLoading(false));
  }, [open]);

  // Auto calculate due date from creditDays when supplier or billDate changes
  useEffect(() => {
    const s = suppliers.find((sup) => sup._id === supplierId);
    if (s && billDate) {
      const d = new Date(billDate);
      d.setDate(d.getDate() + (s.creditDays || 30));
      setDueDate(d.toISOString().slice(0, 10));
    }
  }, [supplierId, billDate, suppliers]);

  // Calculations
  let subtotal = 0;
  let discountTotal = 0;
  let taxableTotal = 0;
  let taxTotal = 0;

  for (const it of items) {
    const baseGross = (it.qty || 0) * (it.purchaseRate || 0);
    const disc = (baseGross * (it.discountPct || 0)) / 100;
    const taxable = Math.max(0, baseGross - disc);
    const tax = (taxable * (it.gstPct || 0)) / 100;
    subtotal += baseGross;
    discountTotal += disc;
    taxableTotal += taxable;
    taxTotal += tax;
  }

  const numericOtherCharges = typeof otherCharges === "number" ? otherCharges : 0;
  const rawTotal = taxableTotal + taxTotal + numericOtherCharges;
  const grandTotal = Math.round(rawTotal);
  const roundOff = +(grandTotal - rawTotal).toFixed(2);

  const cgstTotal = taxType === "INTRA" ? +(taxTotal / 2).toFixed(2) : 0;
  const sgstTotal = taxType === "INTRA" ? +(taxTotal / 2).toFixed(2) : 0;
  const igstTotal = taxType === "INTER" ? +taxTotal.toFixed(2) : 0;

  // Auto-fill payment line amount if payNow is toggled
  const handlePayNowToggle = (checked: boolean) => {
    setPayNow(checked);
    if (checked && paymentLines.length === 1) {
      const defaultBank = accounts.find((a) => a.type === "BANK" && a.isDefault) || accounts.find((a) => a.type === "BANK");
      setPaymentLines([
        {
          ...paymentLines[0],
          amount: grandTotal,
          accountId: defaultBank?._id || accounts[0]?._id || "cash",
        },
      ]);
    }
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: Math.random().toString(36).slice(2),
        itemType: "INVENTORY",
        description: "",
        hsnCode: "3004",
        batchNo: "",
        expiryDate: "",
        qty: 1,
        freeQty: 0,
        unit: "Pcs",
        purchaseRate: 0,
        mrp: 0,
        discountPct: 0,
        gstPct: 12,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSelectInventoryItem = (index: number, itemId: string) => {
    const inv = inventoryItems.find((i) => String(i._id) === itemId);
    if (!inv) return;
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      inventoryItemId: String(inv._id),
      description: inv.name,
      hsnCode: (inv as any).hsnCode || "3004",
      unit: (inv as any).dispensingUnit || "Vials",
      purchaseRate: (inv as any).purchaseRate || 0,
      mrp: (inv as any).mrp || 0,
      gstPct: (inv as any).gstRate || 12,
    };
    setItems(updated);
  };

  const handleSave = async (saveAndNew = false) => {
    if (!supplierId) {
      toast.error("Please select a supplier");
      return;
    }
    if (!billNumber.trim()) {
      toast.error("Please enter the supplier's bill/invoice number");
      return;
    }
    if (items.length === 0 || items.some((it) => !it.description.trim() || it.qty <= 0)) {
      toast.error("Please complete all line items with description and quantity");
      return;
    }

    if (payNow) {
      const paySum = paymentLines.reduce((s, l) => s + (l.amount || 0), 0);
      if (paySum <= 0) {
        toast.error("Payment amount must be greater than 0");
        return;
      }
      if (paySum > grandTotal + 0.01) {
        toast.error("Payment amount exceeds bill grand total");
        return;
      }
    }

    const sup = suppliers.find((s) => s._id === supplierId);

    setSubmitting(true);
    try {
      const res = await createPurchaseBillFn({
        data: {
          supplierId,
          supplierName: sup?.name,
          billNumber: billNumber.trim(),
          billDate,
          dueDate: dueDate || undefined,
          taxType,
          subtotal,
          discountTotal,
          taxableTotal,
          cgstTotal,
          sgstTotal,
          igstTotal,
          otherCharges: numericOtherCharges,
          roundOff,
          grandTotal,
          remarks: remarks.trim() || undefined,
          paymentNow: payNow,
          paymentLines: payNow
            ? paymentLines.map((l) => {
                const acc = accounts.find((a) => a._id === l.accountId);
                return {
                  mode: l.mode,
                  accountId: l.accountId,
                  accountName: l.mode === "CASH" ? "Cash" : acc?.name || "Bank",
                  amount: l.amount,
                  referenceNo: l.referenceNo || undefined,
                  chequeDate: l.chequeDate || undefined,
                };
              })
            : undefined,
          items: items.map((it, idx) => {
            const line = calculateLine(it);
            return {
              lineNo: idx + 1,
              itemType: it.itemType,
              inventoryItemId: it.inventoryItemId,
              description: it.description,
              hsnCode: it.hsnCode || undefined,
              batchNo: it.batchNo || undefined,
              expiryDate: it.expiryDate || undefined,
              qty: it.qty,
              freeQty: it.freeQty || 0,
              unit: it.unit || undefined,
              purchaseRate: it.purchaseRate,
              mrp: it.mrp || undefined,
              discountPct: it.discountPct,
              gstPct: it.gstPct,
              taxableAmount: line.taxableAmount,
              taxAmount: line.taxAmount,
              lineTotal: line.lineTotal,
            };
          }),
        },
      });

      toast.success(`Purchase Bill recorded! Ref: ${res.internalRef}`);
      onSuccess?.();

      if (saveAndNew) {
        setBillNumber("");
        setRemarks("");
        setOtherCharges("");
        setPayNow(false);
        setItems([
          {
            id: Math.random().toString(36).slice(2),
            itemType: "INVENTORY",
            description: "",
            hsnCode: "3004",
            batchNo: "",
            expiryDate: "",
            qty: 1,
            freeQty: 0,
            unit: "Vials",
            purchaseRate: 0,
            mrp: 0,
            discountPct: 0,
            gstPct: 12,
          },
        ]);
      } else {
        onClose();
      }
    } catch (err: any) {
      console.error("Save purchase bill failed:", err);
      toast.error(err.message || "Failed to save purchase bill");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSup = suppliers.find((s) => s._id === supplierId);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-xs animate-in fade-in">
      <div className="relative flex max-h-[95vh] w-full max-w-5xl flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Record Supplier Bill</h2>
              <p className="text-xs text-muted-foreground">
                Inward medicine &amp; clinical supplies, update stock, and establish payables
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Bill Top Fields */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 rounded-xl border border-border/80 bg-muted/10 p-4">
            <div className="sm:col-span-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="bill-sup">Supplier *</Label>
                {selectedSup && (
                  <span className="text-[11px] text-muted-foreground">
                    Credit: {selectedSup.creditDays}d | Bal: ₹{selectedSup.openingBalance.toLocaleString("en-IN")} {selectedSup.openingBalanceType}
                  </span>
                )}
              </div>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger id="bill-sup">
                  <SelectValue placeholder="Select Supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bill-num">Supplier Bill No. *</Label>
              <Input
                id="bill-num"
                placeholder="e.g. INV-88219"
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
                className="font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tax-type">Tax Type</Label>
              <Select value={taxType} onValueChange={(v) => setTaxType(v as any)}>
                <SelectTrigger id="tax-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INTRA">Intra-state (CGST + SGST)</SelectItem>
                  <SelectItem value="INTER">Inter-state (IGST)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bill-date">Bill Date</Label>
              <Input
                id="bill-date"
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="due-date">Due Date</Label>
              <Input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="bill-remarks">Remarks / Notes</Label>
              <Input
                id="bill-remarks"
                placeholder="Internal notes or PO reference..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Item Details ({items.length})
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                className="h-7 gap-1 text-xs"
              >
                <Plus className="size-3.5" /> Add Row
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto max-h-[300px]">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 border-b border-border bg-muted/60 font-medium text-muted-foreground z-10">
                    <tr>
                      <th className="px-3 py-2 w-8">#</th>
                      <th className="px-3 py-2 min-w-[200px]">Item / Description *</th>
                      <th className="px-3 py-2 w-24">Batch #</th>
                      <th className="px-3 py-2 w-24">Expiry (MM/YY)</th>
                      <th className="px-3 py-2 w-16 text-right">Qty</th>
                      <th className="px-3 py-2 w-16 text-right">Free</th>
                      <th className="px-3 py-2 w-20 text-right">Rate (₹)</th>
                      <th className="px-3 py-2 w-16 text-right">Disc%</th>
                      <th className="px-3 py-2 w-16 text-right">GST%</th>
                      <th className="px-3 py-2 w-24 text-right">Total (₹)</th>
                      <th className="px-2 py-2 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.map((it, idx) => {
                      const line = calculateLine(it);
                      return (
                        <tr key={it.id} className="hover:bg-muted/30">
                          <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <div className="space-y-1">
                              <Select
                                value={it.inventoryItemId || "CUSTOM"}
                                onValueChange={(val) => {
                                  if (val !== "CUSTOM") handleSelectInventoryItem(idx, val);
                                }}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue placeholder="Select Inventory Item" />
                                </SelectTrigger>
                                <SelectContent className="max-h-56">
                                  <SelectItem value="CUSTOM">Custom item name...</SelectItem>
                                  {inventoryItems.map((inv) => (
                                    <SelectItem key={String(inv._id)} value={String(inv._id)}>
                                      {inv.name} (Code: {inv.itemCode})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                placeholder="Description / Medicine name"
                                value={it.description}
                                onChange={(e) => {
                                  const updated = [...items];
                                  updated[idx].description = e.target.value;
                                  setItems(updated);
                                }}
                                className="h-7 text-xs"
                              />
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              placeholder="Batch"
                              value={it.batchNo}
                              onChange={(e) => {
                                const updated = [...items];
                                updated[idx].batchNo = e.target.value;
                                setItems(updated);
                              }}
                              className="h-7 text-xs font-mono uppercase"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              placeholder="MM/YY"
                              value={it.expiryDate}
                              onChange={(e) => {
                                const updated = [...items];
                                updated[idx].expiryDate = e.target.value;
                                setItems(updated);
                              }}
                              className="h-7 text-xs"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              min="1"
                              value={it.qty}
                              onChange={(e) => {
                                const updated = [...items];
                                updated[idx].qty = parseFloat(e.target.value) || 0;
                                setItems(updated);
                              }}
                              className="h-7 text-xs text-right font-semibold"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              min="0"
                              value={it.freeQty}
                              onChange={(e) => {
                                const updated = [...items];
                                updated[idx].freeQty = parseFloat(e.target.value) || 0;
                                setItems(updated);
                              }}
                              className="h-7 text-xs text-right"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={it.purchaseRate}
                              onChange={(e) => {
                                const updated = [...items];
                                updated[idx].purchaseRate = parseFloat(e.target.value) || 0;
                                setItems(updated);
                              }}
                              className="h-7 text-xs text-right font-medium"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={it.discountPct}
                              onChange={(e) => {
                                const updated = [...items];
                                updated[idx].discountPct = parseFloat(e.target.value) || 0;
                                setItems(updated);
                              }}
                              className="h-7 text-xs text-right"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Select
                              value={String(it.gstPct)}
                              onValueChange={(v) => {
                                const updated = [...items];
                                updated[idx].gstPct = parseFloat(v);
                                setItems(updated);
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs px-2">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0">0%</SelectItem>
                                <SelectItem value="5">5%</SelectItem>
                                <SelectItem value="12">12%</SelectItem>
                                <SelectItem value="18">18%</SelectItem>
                                <SelectItem value="28">28%</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-foreground">
                            ₹{line.lineTotal.toFixed(2)}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveItem(idx)}
                              disabled={items.length <= 1}
                              className="size-6 text-muted-foreground hover:text-rose-600"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Bottom Grid: Bill Totals & Immediate Payment Option */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Pay Now Section */}
            <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="bill-pay-now"
                    checked={payNow}
                    onChange={(e) => handlePayNowToggle(e.target.checked)}
                    className="size-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <Label htmlFor="bill-pay-now" className="cursor-pointer font-semibold text-foreground">
                    Record Immediate Payment (Pay Now)
                  </Label>
                </div>
                {payNow && (
                  <span className="text-[10px] font-bold text-emerald-600 uppercase bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                )}
              </div>

              {payNow && (
                <div className="pt-2 animate-in fade-in space-y-2">
                  <SplitPaymentInput
                    total={grandTotal}
                    lines={paymentLines}
                    onChange={setPaymentLines}
                    accounts={accounts}
                    requireExactMatch={false}
                    defaultMode="BANK_TRANSFER"
                  />
                </div>
              )}
            </div>

            {/* Totals Summary Card */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Subtotal (Gross)</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              {discountTotal > 0 && (
                <div className="flex justify-between text-xs text-emerald-600">
                  <span>Total Discount</span>
                  <span>-₹{discountTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Taxable Amount</span>
                <span>₹{taxableTotal.toFixed(2)}</span>
              </div>
              {taxType === "INTRA" ? (
                <>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>CGST</span>
                    <span>₹{cgstTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>SGST</span>
                    <span>₹{sgstTotal.toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>IGST</span>
                  <span>₹{igstTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Other Charges / Freight</span>
                <Input
                  type="number"
                  min="0"
                  placeholder="0.00"
                  value={otherCharges}
                  onChange={(e) => setOtherCharges(e.target.value === "" ? "" : parseFloat(e.target.value))}
                  className="h-6 w-24 text-right text-xs"
                />
              </div>
              {roundOff !== 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Round Off</span>
                  <span>{roundOff > 0 ? `+₹${roundOff}` : `-₹${Math.abs(roundOff)}`}</span>
                </div>
              )}
              <div className="border-t border-border pt-2 flex justify-between text-base font-bold text-foreground">
                <span>Grand Total</span>
                <span className="text-primary font-mono">₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-muted/20">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleSave(true)}
              disabled={submitting || loading || grandTotal <= 0}
            >
              Save &amp; New
            </Button>
            <Button
              size="sm"
              onClick={() => handleSave(false)}
              disabled={submitting || loading || grandTotal <= 0}
              className="gap-1.5"
            >
              <Check className="size-4" /> Save Purchase Bill
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
