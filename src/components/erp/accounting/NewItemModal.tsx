import { useState, useEffect, useMemo, type ReactNode } from "react";
import { X, PackagePlus, Save, Pill, Syringe, Bone, Tag, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addItemFn, peekItemCodeFn, type InventoryItemRow } from "@/lib/mongodb/serverFns/inventory";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ProductType = InventoryItemRow["productType"];

interface NewItemModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (created: InventoryItemRow) => void;
  initialName?: string | undefined;
  defaultType?: ProductType | undefined;
  supplierId?: string | undefined;
  supplierName?: string | undefined;
}

const GST_RATES = [0, 5, 12, 18, 28];
const DOSAGE_FORMS = ["Tablet", "Capsule", "Syrup", "Suspension", "Drops", "Ointment", "Cream", "Powder"];
const UNIT_SUGGESTIONS = ["Tablet", "Capsule", "Strip", "Box", "Vial", "Bottle", "Tube", "Pack", "Bag", "Piece", "ml", "Gm", "Kg"];
const r2 = (n: number) => Math.round(n * 100) / 100;

const CATEGORIES: { type: ProductType; label: string; category: string; Icon: LucideIcon; tint: string }[] = [
  { type: "MEDICINE", label: "Medicine", category: "Medicine", Icon: Pill, tint: "text-emerald-600 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40" },
  { type: "INJECTION", label: "Injection", category: "Injection", Icon: Syringe, tint: "text-rose-600 border-rose-500 bg-rose-50 dark:bg-rose-950/40" },
  { type: "FOOD", label: "Animal Food", category: "Animal Food", Icon: Bone, tint: "text-amber-600 border-amber-500 bg-amber-50 dark:bg-amber-950/40" },
  { type: "ACCESSORY", label: "Accessories", category: "Animal Accessories", Icon: Tag, tint: "text-blue-600 border-blue-500 bg-blue-50 dark:bg-blue-950/40" },
];

/** Auto HSN + GST from category and keywords in name / sub-group. Always overridable by the user. */
export function suggestHsn(type: ProductType, text: string): { hsn: string; gst: number } {
  const t = text.toLowerCase();
  if (type === "INJECTION") return /vaccine|serum|rabies|dhpp/.test(t) ? { hsn: "3002", gst: 5 } : { hsn: "3004", gst: 12 };
  if (type === "MEDICINE") {
    if (/vaccine/.test(t)) return { hsn: "3002", gst: 5 };
    if (/vitamin|mineral|supplement|calcium/.test(t)) return { hsn: "2936", gst: 12 };
    if (/shampoo|soap/.test(t)) return { hsn: "3305", gst: 18 };
    return { hsn: "3004", gst: 12 };
  }
  if (type === "FOOD") return /treat|biscuit|chew/.test(t) ? { hsn: "2309", gst: 18 } : { hsn: "2309", gst: 5 };
  if (/bowl|feeder/.test(t)) return { hsn: "3924", gst: 18 };
  if (/bed|mattress|cushion/.test(t)) return { hsn: "9404", gst: 18 };
  if (/toy|ball/.test(t)) return { hsn: "9503", gst: 12 };
  return { hsn: "4201", gst: 18 }; // collar / leash / harness
}

interface Pkg { baseUnit: string; interUnit: string; basePerInter: string; purchaseUnit: string; perPurchase: string; hasInter: boolean }

function presetPkg(type: ProductType, dosageForm: string): Pkg {
  const p = (baseUnit: string, purchaseUnit: string, perPurchase: string): Pkg =>
    ({ baseUnit, purchaseUnit, perPurchase, hasInter: false, interUnit: "", basePerInter: "" });
  if (type === "INJECTION") return p("Vial", "Box", "5");
  if (type === "FOOD") return p("Kg", "Bag", "4");
  if (type === "ACCESSORY") return p("Piece", "Pack", "1");
  if (/syrup|suspension|drops/i.test(dosageForm)) return p("ml", "Bottle", "100");
  if (/ointment|cream/i.test(dosageForm)) return p("Gm", "Tube", "30");
  if (/powder/i.test(dosageForm)) return p("Gm", "Pack", "100");
  return { baseUnit: dosageForm === "Capsule" ? "Capsule" : "Tablet", interUnit: "Strip", basePerInter: "10", purchaseUnit: "Box", perPurchase: "10", hasInter: true };
}

function Box({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative rounded border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-3.5 pt-4 shadow-xs", className)}>
      <span className="absolute -top-2.5 left-3 bg-white dark:bg-slate-900 px-1 text-xs font-semibold text-slate-700 dark:text-slate-300">{title}</span>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function Row({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="grid grid-cols-12 gap-2 items-center">
      <Label className="col-span-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
        {label} {required && <span className="text-rose-500">*</span>}
      </Label>
      <div className="col-span-8">{children}</div>
    </div>
  );
}

const inputCls = "h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700";
const triggerCls = inputCls;

function Money({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center">
      <div className="flex h-7 items-center justify-center px-2.5 bg-[#1976d2] text-white text-xs font-bold rounded-l">₹</div>
      <Input type="number" min="0" step="any" value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputCls, "rounded-l-none font-mono font-semibold")} />
    </div>
  );
}

export function NewItemModal({ open, onClose, onSuccess, initialName, defaultType = "MEDICINE", supplierId, supplierName }: NewItemModalProps) {
  const [type, setType] = useState<ProductType>("MEDICINE");
  const [itemCode, setItemCode] = useState("");
  const [name, setName] = useState("");
  const [genericName, setGenericName] = useState("");
  const [brand, setBrand] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [subGroup, setSubGroup] = useState("");
  // category specifics
  const [strength, setStrength] = useState("");
  const [dosageForm, setDosageForm] = useState("Tablet");
  const [route, setRoute] = useState("Oral");
  const [schedule, setSchedule] = useState("Schedule H");
  const [species, setSpecies] = useState("Dog");
  const [lifeStage, setLifeStage] = useState("Adult");
  const [accessoryType, setAccessoryType] = useState("");
  const [petSize, setPetSize] = useState("Medium");
  // packaging hierarchy
  const [pkg, setPkg] = useState<Pkg>(() => presetPkg("MEDICINE", "Tablet"));
  // stock
  const [reorderLevel, setReorderLevel] = useState("200");
  const [batchTracking, setBatchTracking] = useState(true);
  const [storageLocation, setStorageLocation] = useState("");
  // pricing (all per purchase unit)
  const [purchasePrice, setPurchasePrice] = useState("");
  const [mrp, setMrp] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [gst, setGst] = useState("12");
  const [hsn, setHsn] = useState("3004");
  const [hsnTouched, setHsnTouched] = useState(false);
  const [leadTimeDays, setLeadTimeDays] = useState("7");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  const isRx = type === "MEDICINE" || type === "INJECTION";
  const setP = (patch: Partial<Pkg>) => setPkg((p) => ({ ...p, ...patch }));

  // Reset on open
  useEffect(() => {
    if (!open) return;
    switchType(defaultType);
    setName(initialName || "");
    setGenericName(""); setBrand(""); setManufacturer(""); setSubGroup(""); setStrength("");
    setSchedule("Schedule H"); setSpecies("Dog");
    setLifeStage("Adult"); setAccessoryType(""); setPetSize("Medium"); setStorageLocation("");
    setPurchasePrice(""); setMrp(""); setSalePrice(""); setLeadTimeDays("7"); setRemarks("");
    setHsnTouched(false);
  }, [open, initialName, defaultType]);

  // Peek the auto item ID for the chosen category
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    peekItemCodeFn({ data: { type } }).then((c) => !cancelled && setItemCode(c || "")).catch(() => {});
    return () => { cancelled = true; };
  }, [open, type]);

  // Category switch → repack, tracking defaults
  const switchType = (t: ProductType) => {
    setType(t);
    const form = t === "MEDICINE" ? "Tablet" : "";
    setDosageForm(form);
    setRoute(t === "INJECTION" ? "IM" : "Oral");
    setPkg(presetPkg(t, form));
    setBatchTracking(t === "MEDICINE" || t === "INJECTION");
    setReorderLevel(t === "MEDICINE" ? "200" : t === "INJECTION" ? "10" : "5");
    setHsnTouched(false);
  };

  const switchDosageForm = (f: string) => {
    setDosageForm(f);
    setPkg(presetPkg(type, f));
  };

  // Auto HSN/GST until the user types their own HSN
  useEffect(() => {
    if (hsnTouched) return;
    const s = suggestHsn(type, `${name} ${subGroup} ${genericName}`);
    setHsn(s.hsn);
    setGst(String(s.gst));
  }, [type, name, subGroup, genericName, hsnTouched]);

  // Units contained in one purchase unit
  const baseUnitsPerPurchase = pkg.hasInter
    ? (Number(pkg.perPurchase) || 1) * (Number(pkg.basePerInter) || 1)
    : Number(pkg.perPurchase) || 1;

  const hierarchyText = pkg.hasInter
    ? `1 ${pkg.purchaseUnit} = ${Number(pkg.perPurchase) || 1} ${pkg.interUnit} = ${baseUnitsPerPurchase} ${pkg.baseUnit}  •  1 ${pkg.interUnit} = ${Number(pkg.basePerInter) || 1} ${pkg.baseUnit}`
    : `1 ${pkg.purchaseUnit} = ${baseUnitsPerPurchase} ${pkg.baseUnit}`;

  const perBase = useMemo(() => (p: string) => (Number(p) > 0 ? r2(Number(p) / baseUnitsPerPurchase) : 0), [baseUnitsPerPurchase]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Item Name is required."); return; }
    if (!pkg.baseUnit.trim() || !pkg.purchaseUnit.trim()) { toast.error("Base unit and purchase unit are required."); return; }
    if (pkg.hasInter && !pkg.interUnit.trim()) { toast.error("Enter the middle unit (e.g. Strip) or untick it."); return; }

    const cat = CATEGORIES.find((c) => c.type === type)!;
    const sale = Number(salePrice) || Number(mrp) || 0;
    const details = { storageCondition: type === "INJECTION" ? "Cold Chain (2-8°C)" : "Room Temperature (15-25°C)" };

    setSaving(true);
    try {
      const created = await addItemFn({
        data: {
          productType: type,
          category: cat.category,
          name: name.trim(),
          genericName: genericName.trim(),
          brand: brand.trim(),
          manufacturer: manufacturer.trim(),
          subGroup: subGroup.trim(),
          description: remarks.trim(),
          unit: pkg.baseUnit.trim(),
          purchaseUom: pkg.purchaseUnit.trim(),
          salesUom: pkg.baseUnit.trim(),
          packagingHierarchy: {
            baseUnit: pkg.baseUnit.trim(),
            purchaseUnit: pkg.purchaseUnit.trim(),
            baseUnitsPerPurchase,
            hasIntermediateUnit: pkg.hasInter,
            intermediateUnit: pkg.hasInter ? pkg.interUnit.trim() : undefined,
            intermediateUnitsPerPurchase: pkg.hasInter ? Number(pkg.perPurchase) || 1 : undefined,
            baseUnitsPerIntermediate: pkg.hasInter ? Number(pkg.basePerInter) || 1 : undefined,
          },
          valuationMethod: isRx ? "FEFO" : "FIFO",
          reorderLevel: Number(reorderLevel) || 0,
          minStockLevel: Number(reorderLevel) || 0,
          batchTracking,
          storageLocation: storageLocation.trim(),
          defaultPurchasePrice: Number(purchasePrice) || 0,
          defaultSalePrice: sale,
          mrp: Number(mrp) || sale,
          valuationRate: Number(purchasePrice) || 0,
          gstRate: Number(gst) || 0,
          hsnCode: hsn.trim(),
          taxCategory: "Standard",
          defaultSupplierId: supplierId || "",
          defaultSupplierName: supplierName || "",
          leadTimeDays: Number(leadTimeDays) || 0,
          costCenter: isRx ? "Pharmacy" : "Retail Store",
          medicineDetails: type === "MEDICINE" ? { strength, dosageForm, route, schedule, ...details } : undefined,
          injectionDetails: type === "INJECTION" ? { strength, route, schedule, coldChainRequired: true, ...details } : undefined,
          foodDetails: type === "FOOD" ? { targetSpecies: species, lifeStage } : undefined,
          accessoryDetails: type === "ACCESSORY" ? { accessoryType, petSize } : undefined,
        } as any,
      });
      toast.success(`${created.name} added (${created.itemCode}).`);
      onSuccess?.(created);
      onClose();
    } catch (err: any) {
      console.error("[NewItemModal] Save error:", err);
      toast.error(err.message || "Failed to save item.");
    } finally {
      setSaving(false);
    }
  };

  const sel = (v: string, on: (v: string) => void, opts: string[]) => (
    <Select value={v} onValueChange={on}>
      <SelectTrigger className={triggerCls}><SelectValue /></SelectTrigger>
      <SelectContent>{opts.map((o) => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}</SelectContent>
    </Select>
  );
  const txt = (v: string, on: (v: string) => void, ph = "") => (
    <Input value={v} onChange={(e) => on(e.target.value)} placeholder={ph} className={inputCls} />
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-5xl max-h-[95vh] overflow-y-auto p-0 gap-0 border border-slate-300 dark:border-slate-800 bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-2xl rounded-lg"
        aria-describedby="new-item-desc"
      >
        <div className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 select-none">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-xs">
              <PackagePlus className="size-3.5" />
            </div>
            <DialogTitle className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">New Item Information</DialogTitle>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <p id="new-item-desc" className="sr-only">Add a medicine, injection, animal food or accessory item with packaging, pricing and tax details.</p>

        <div className="px-5 pt-3 pb-1 flex items-center justify-between bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="px-3 py-1 bg-[#f8fafc] dark:bg-slate-950 border-t-2 border-primary border-x border-slate-300 dark:border-slate-700 rounded-t text-xs font-bold text-slate-800 dark:text-slate-200 shadow-xs -mb-[5px]">Item Master</div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">Item ID</span>
            <span className="font-bold font-mono tracking-wider text-blue-700 dark:text-blue-400">{itemCode || "AUTO"}</span>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Category tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {CATEGORIES.map(({ type: t, label, Icon, tint }) => (
              <button
                key={t}
                type="button"
                onClick={() => switchType(t)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded border px-3 py-2 text-xs font-bold transition-colors",
                  type === t ? tint : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                )}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {/* LEFT: Item details + specs + packaging */}
            <div className="space-y-4">
              <Box title="Item Details">
                <Row label="Item Name" required>
                  <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amoxicillin 250mg" className={cn(inputCls, "font-medium")} />
                </Row>
                <Row label={isRx ? "Generic Name" : "Description"}>{txt(genericName, setGenericName)}</Row>
                <Row label="Brand">{txt(brand, setBrand)}</Row>
                <Row label="Manufacturer">{txt(manufacturer, setManufacturer)}</Row>
                <Row label="Sub Group">{txt(subGroup, setSubGroup, isRx ? "e.g. Antibiotics, Vaccines" : "e.g. Dog Food, Gear")}</Row>
                {type === "MEDICINE" && (
                  <>
                    <Row label="Strength">{txt(strength, setStrength, "e.g. 250mg")}</Row>
                    <Row label="Dosage Form">{sel(dosageForm, switchDosageForm, DOSAGE_FORMS)}</Row>
                    <Row label="Schedule">{sel(schedule, setSchedule, ["Schedule H", "Schedule H1", "Schedule X", "OTC"])}</Row>
                  </>
                )}
                {type === "INJECTION" && (
                  <>
                    <Row label="Strength">{txt(strength, setStrength, "e.g. 20mg/ml")}</Row>
                    <Row label="Route">{sel(route, setRoute, ["IM", "IV", "SC", "IP"])}</Row>
                    <Row label="Schedule">{sel(schedule, setSchedule, ["Schedule H", "Schedule H1", "Schedule X", "OTC"])}</Row>
                  </>
                )}
                {type === "FOOD" && (
                  <>
                    <Row label="Target Species">{sel(species, setSpecies, ["Dog", "Cat", "Bird", "Rabbit", "Other"])}</Row>
                    <Row label="Life Stage">{sel(lifeStage, setLifeStage, ["Puppy / Kitten", "Adult", "Senior", "All"])}</Row>
                  </>
                )}
                {type === "ACCESSORY" && (
                  <>
                    <Row label="Accessory Type">{txt(accessoryType, setAccessoryType, "e.g. Collar, Leash, Bowl")}</Row>
                    <Row label="Pet Size">{sel(petSize, setPetSize, ["Small", "Medium", "Large", "XL"])}</Row>
                  </>
                )}
              </Box>

              <Box title="Packaging Hierarchy (Purchase → Single Unit)">
                <datalist id="pkg-units">{UNIT_SUGGESTIONS.map((u) => <option key={u} value={u} />)}</datalist>
                <Row label="Single (Base) Unit" required>
                  <Input list="pkg-units" value={pkg.baseUnit} onChange={(e) => setP({ baseUnit: e.target.value })} className={inputCls} />
                </Row>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={pkg.hasInter} onChange={(e) => setP({ hasInter: e.target.checked, interUnit: e.target.checked ? pkg.interUnit || "Strip" : "", basePerInter: e.target.checked ? pkg.basePerInter || "10" : "" })} />
                  Has a middle unit (e.g. Strip)
                </label>
                {pkg.hasInter && (
                  <>
                    <Row label="Middle Unit">
                      <Input list="pkg-units" value={pkg.interUnit} onChange={(e) => setP({ interUnit: e.target.value })} className={inputCls} />
                    </Row>
                    <Row label={`${pkg.baseUnit || "Base"} per ${pkg.interUnit || "middle"}`}>
                      <Input type="number" min="1" value={pkg.basePerInter} onChange={(e) => setP({ basePerInter: e.target.value })} className={cn(inputCls, "font-mono")} />
                    </Row>
                  </>
                )}
                <Row label="Purchase Unit" required>
                  <Input list="pkg-units" value={pkg.purchaseUnit} onChange={(e) => setP({ purchaseUnit: e.target.value })} className={inputCls} />
                </Row>
                <Row label={`${pkg.hasInter ? pkg.interUnit || "Middle" : pkg.baseUnit || "Base"} per ${pkg.purchaseUnit || "purchase unit"}`}>
                  <Input type="number" min="1" value={pkg.perPurchase} onChange={(e) => setP({ perPurchase: e.target.value })} className={cn(inputCls, "font-mono")} />
                </Row>
                <div className="rounded bg-[#fff9c4] dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 px-2.5 py-1.5 text-[11px] font-mono font-bold text-amber-900 dark:text-amber-200">
                  {hierarchyText}
                </div>
              </Box>
            </div>

            {/* RIGHT: Pricing + Tax + Stock + Purchasing */}
            <div className="space-y-4">
              <Box title="Pricing Info">
                <p className="text-[11px] text-slate-500">Prices are per 1 {pkg.purchaseUnit || "purchase unit"}.</p>
                <Row label="Purchase Price"><Money value={purchasePrice} onChange={setPurchasePrice} /></Row>
                <Row label="MRP"><Money value={mrp} onChange={setMrp} /></Row>
                <Row label="Selling Price"><Money value={salePrice} onChange={setSalePrice} /></Row>
                {baseUnitsPerPurchase > 1 && (Number(purchasePrice) > 0 || Number(salePrice) > 0 || Number(mrp) > 0) && (
                  <div className="rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-[11px] font-mono text-slate-700 dark:text-slate-300 space-y-0.5">
                    <div>Per {pkg.baseUnit}: buy ₹{perBase(purchasePrice)} • MRP ₹{perBase(mrp)} • sell ₹{perBase(salePrice || mrp)}</div>
                    {pkg.hasInter && Number(pkg.basePerInter) > 0 && (
                      <div>Per {pkg.interUnit}: buy ₹{r2(perBase(purchasePrice) * Number(pkg.basePerInter))} • sell ₹{r2(perBase(salePrice || mrp) * Number(pkg.basePerInter))}</div>
                    )}
                  </div>
                )}
              </Box>

              <Box title="Tax Details">
                <Row label="HSN / SAC Code">
                  <div className="flex items-center gap-2">
                    <Input value={hsn} onChange={(e) => { setHsn(e.target.value); setHsnTouched(true); }} className={cn(inputCls, "font-mono")} />
                    {!hsnTouched && <span className="text-[10px] font-bold text-emerald-600 whitespace-nowrap">AUTO</span>}
                  </div>
                </Row>
                <Row label="GST %">{sel(gst, setGst, GST_RATES.map(String))}</Row>
              </Box>

              <Box title="Stock Details">
                <Row label="Reorder Level">
                  <Input type="number" min="0" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} className={cn(inputCls, "font-mono")} />
                </Row>
                <Row label="Storage Location">{txt(storageLocation, setStorageLocation, isRx ? "e.g. Pharmacy Shelf A1" : "e.g. Retail Floor")}</Row>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={batchTracking} onChange={(e) => setBatchTracking(e.target.checked)} />
                  Track batch &amp; expiry
                </label>
              </Box>

              <Box title="Other Details">
                <Row label="Lead Time (days)">
                  <Input type="number" min="0" value={leadTimeDays} onChange={(e) => setLeadTimeDays(e.target.value)} className={cn(inputCls, "font-mono")} />
                </Row>
                <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} placeholder="Remark / Note" className="text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 min-h-[48px]" />
              </Box>
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-3 flex items-center justify-end">
            <Button type="button" onClick={handleSave} disabled={saving} className="h-9 px-6 gap-2 bg-[#1976d2] hover:bg-[#1565c0] text-white font-bold text-xs shadow-sm">
              <Save className="size-3.5" />
              <span>{saving ? "Saving..." : "Save"}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
