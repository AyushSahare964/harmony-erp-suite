import { useState, useEffect, useMemo, type ReactNode } from "react";
import { X, PackagePlus, Save, Pill, Syringe, Bone, Tag, type LucideIcon, Layers, IndianRupee, Calendar, PackageCheck, Sparkles, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
import { DatePicker } from "@/components/ui/date-picker";
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

const GST_RATES = [
  { label: "0% (Exempt / Nil)", value: "0" },
  { label: "5%", value: "5" },
  { label: "12%", value: "12" },
  { label: "18%", value: "18" },
  { label: "28%", value: "28" },
];
const DOSAGE_FORMS = ["Tablet", "Capsule", "Syrup", "Suspension", "Drops", "Ointment", "Cream", "Powder"];
const UNIT_SUGGESTIONS = [
  "Tablet", "Capsule", "Strip", "Blister", "Box", "Carton", "Case", "Vial", "Ampoule", "Bottle", "Tube", "Sachet", "Pouch",
  "Pack", "Packet", "Bag", "Sack", "Jar", "Can", "Tin", "Tray", "Roll", "Set", "Kit", "Dozen", "Pair", "Piece", "Unit",
  "Syringe", "Dose", "Pellet", "Drop", "ml", "Ltr", "Gm", "Kg", "Mg",
];
const SUB_GROUPS = [
  "Antibiotics",
  "Antifungal",
  "Antiparasitic / Dewormer",
  "NSAID",
  "Antisteroids",
  "Antihistamine",
  "Liver Supplement",
  "Kidney Supplement",
  "Gut Support",
  "Multivitamin",
  "Calcium Supplement",
  "Supplement",
  "Medicated Shampoo",
  "Shampoo",
];
const r2 = (n: number) => Math.round(n * 100) / 100;

const CATEGORIES: { type: ProductType; label: string; category: string; Icon: LucideIcon; activeClass: string }[] = [
  { type: "MEDICINE", label: "Medicine", category: "Medicine", Icon: Pill, activeClass: "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-600 shadow-xs ring-1 ring-emerald-500/20" },
  { type: "INJECTION", label: "Injection", category: "Injection", Icon: Syringe, activeClass: "border-rose-500 bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-600 shadow-xs ring-1 ring-rose-500/20" },
  { type: "FOOD", label: "Animal Food", category: "Animal Food", Icon: Bone, activeClass: "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-600 shadow-xs ring-1 ring-amber-500/20" },
  { type: "ACCESSORY", label: "Accessories", category: "Animal Accessories", Icon: Tag, activeClass: "border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-600 shadow-xs ring-1 ring-blue-500/20" },
];

/** Auto HSN + GST suggestion */
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
  return { hsn: "4201", gst: 18 };
}

interface Pkg { baseUnit: string; interUnit: string; basePerInter: string; purchaseUnit: string; perPurchase: string; hasInter: boolean }

const emptyPkg = (): Pkg => ({
  baseUnit: "",
  interUnit: "",
  basePerInter: "",
  purchaseUnit: "",
  perPurchase: "",
  hasInter: false,
});

/** Free-text input with a searchable dropdown that allows typing custom values */
function Combo({
  value,
  onChange,
  options,
  className,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  className?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const q = value.trim().toLowerCase();
  const list = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  const isExactMatch = options.some((o) => o.toLowerCase() === q);
  const showCustomOption = q.length > 0 && !isExactMatch;

  return (
    <div className="relative w-full">
      <div className="relative flex items-center">
        <Input
          value={value}
          placeholder={placeholder}
          className={cn(className, "pr-7")}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (q) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              setOpen(false);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          onBlur={() => {
            setTimeout(() => setOpen(false), 200);
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setOpen((prev) => !prev)}
          title="Toggle options"
          className="absolute right-1.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          <ChevronDown className="size-3.5" />
        </button>
      </div>

      {open && (list.length > 0 || showCustomOption) && (
        <ul className="absolute left-0 top-full z-[80] mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1 shadow-xl text-xs">
          {showCustomOption && (
            <li
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(value.trim());
                setOpen(false);
              }}
              className="cursor-pointer px-2.5 py-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 font-semibold border-b border-slate-100 dark:border-slate-800 flex items-center justify-between transition-colors"
            >
              <span>Use &ldquo;{value.trim()}&rdquo;</span>
              <span className="text-[10px] text-blue-500 bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded font-normal">custom</span>
            </li>
          )}
          {list.map((o) => (
            <li
              key={o}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(o);
                setOpen(false);
              }}
              className={cn(
                "cursor-pointer px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium transition-colors",
                o.toLowerCase() === q && "bg-blue-50/60 dark:bg-slate-800/60 font-semibold text-blue-700 dark:text-blue-300"
              )}
            >
              {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, className }: { title: string; icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs relative flex flex-col", className)}>
      <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 rounded-t-lg flex items-center justify-between shrink-0">
        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
          {Icon && <Icon className="size-3.5 text-slate-500" />}
          {title}
        </span>
      </div>
      <div className="p-3 space-y-2.5 flex-1">{children}</div>
    </div>
  );
}

function FormField({ label, required, children, className }: { label: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-0.5 leading-tight">
        <span>{label}</span>
        {required && <span className="text-rose-500 font-bold">*</span>}
      </Label>
      {children}
    </div>
  );
}

const inputCls = "h-8 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 rounded-md focus-visible:ring-1 focus-visible:ring-blue-500 placeholder:text-slate-400";
const triggerCls = inputCls;

function MoneyInput({ value, onChange, placeholder = "0" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex items-center w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 overflow-hidden shadow-2xs">
      <span className="flex h-8 items-center justify-center px-2.5 bg-slate-100/90 dark:bg-slate-800/90 text-slate-500 dark:text-slate-400 text-xs font-semibold border-r border-slate-200 dark:border-slate-700 select-none">₹</span>
      <Input
        type="number"
        min="0"
        step="any"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 border-0 rounded-none bg-transparent font-mono text-xs font-medium focus-visible:ring-0 shadow-none px-2.5 placeholder:text-slate-400"
      />
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

  // Category specifics — default empty
  const [strength, setStrength] = useState("");
  const [dosageForm, setDosageForm] = useState("");
  const [route, setRoute] = useState("");
  const [schedule, setSchedule] = useState("");
  const [species, setSpecies] = useState("");
  const [lifeStage, setLifeStage] = useState("");
  const [accessoryType, setAccessoryType] = useState("");
  const [petSize, setPetSize] = useState("");

  // Packaging hierarchy — default empty
  const [pkg, setPkg] = useState<Pkg>(emptyPkg);

  // Stock — defaults to 0
  const [reorderLevel, setReorderLevel] = useState("0");
  const [batchTracking, setBatchTracking] = useState(true);
  const [storageLocation, setStorageLocation] = useState("");

  // Opening stock & batch/expiry — default 0 / empty
  const [currentStock, setCurrentStock] = useState("0");
  const [batchNo, setBatchNo] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [manufacturingDate, setManufacturingDate] = useState("");

  // Pricing — default empty (0 in db)
  const [purchasePrice, setPurchasePrice] = useState("");
  const [mrp, setMrp] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [gst, setGst] = useState("0");
  const [hsn, setHsn] = useState("");
  const [saving, setSaving] = useState(false);

  const isRx = type === "MEDICINE" || type === "INJECTION";
  const setP = (patch: Partial<Pkg>) => setPkg((p) => ({ ...p, ...patch }));

  // Reset to empty / 0 on open
  useEffect(() => {
    if (!open) return;
    setType(defaultType || "MEDICINE");
    setName(initialName || "");
    setGenericName(""); setBrand(""); setManufacturer(""); setSubGroup(""); setStrength("");
    setDosageForm(""); setRoute(""); setSchedule(""); setSpecies(""); setLifeStage("");
    setAccessoryType(""); setPetSize(""); setStorageLocation("");
    setPkg(emptyPkg());
    setPurchasePrice(""); setMrp(""); setSalePrice("");
    setCurrentStock("0"); setReorderLevel("0");
    setBatchNo(""); setExpiryDate(""); setManufacturingDate("");
    setHsn(""); setGst("0");
  }, [open, initialName, defaultType]);

  // Peek the auto item ID for the chosen category
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    peekItemCodeFn({ data: { type } }).then((c) => !cancelled && setItemCode(c || "")).catch(() => {});
    return () => { cancelled = true; };
  }, [open, type]);

  // Category switch
  const switchType = (t: ProductType) => {
    setType(t);
    setDosageForm("");
    setRoute("");
    setSchedule("");
    setSpecies("");
    setLifeStage("");
    setAccessoryType("");
    setPetSize("");
    setBatchTracking(t === "MEDICINE" || t === "INJECTION");
  };

  const handleAutoSuggestHsn = () => {
    const s = suggestHsn(type, `${name} ${subGroup} ${genericName}`);
    setHsn(s.hsn);
    setGst(String(s.gst));
    toast.info(`Suggested HSN: ${s.hsn}, GST: ${s.gst}%`);
  };

  // Units contained in one purchase unit
  const baseUnitsPerPurchase = pkg.hasInter
    ? (Number(pkg.perPurchase) || 1) * (Number(pkg.basePerInter) || 1)
    : Number(pkg.perPurchase) || 1;

  const hierarchyFormula = useMemo(() => {
    if (!pkg.baseUnit.trim() || !pkg.purchaseUnit.trim()) return null;
    if (pkg.hasInter && pkg.interUnit.trim()) {
      return `1 ${pkg.purchaseUnit} = ${Number(pkg.perPurchase) || 1} ${pkg.interUnit} = ${baseUnitsPerPurchase} ${pkg.baseUnit}`;
    }
    return `1 ${pkg.purchaseUnit} = ${baseUnitsPerPurchase} ${pkg.baseUnit}`;
  }, [pkg, baseUnitsPerPurchase]);

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
          description: "",
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
          leadTimeDays: 0,
          costCenter: isRx ? "Pharmacy" : "Retail Store",
          currentStock: Number(currentStock) || 0,
          batchNo: batchNo.trim(),
          expiryDate: expiryDate.trim(),
          manufacturingDate: manufacturingDate.trim(),
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

  const sel = (
    v: string,
    on: (v: string) => void,
    opts: { label: string; value: string }[] | string[],
    placeholder = "Select..."
  ) => {
    const list = opts.map((o) => (typeof o === "string" ? { label: o, value: o } : o));
    return (
      <Select value={v} onValueChange={on}>
        <SelectTrigger className={triggerCls}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {list.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-6xl w-[96vw] max-h-[96vh] overflow-y-auto p-0 gap-0 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-2xl rounded-xl"
        aria-describedby="new-item-desc"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 select-none">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
              <PackagePlus className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                New Item Information
              </DialogTitle>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-flex items-center text-[10px] font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-200/80 dark:border-blue-900">
                  Item Master
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs text-slate-500 font-medium">Item Code:</span>
                <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{itemCode || "AUTO"}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <p id="new-item-desc" className="sr-only">Add a medicine, injection, animal food or accessory item with packaging, pricing and stock.</p>

        {/* Content Container */}
        <div className="p-4 space-y-3">
          {/* Category Selector Tabs */}
          <div className="grid grid-cols-4 gap-2.5">
            {CATEGORIES.map(({ type: t, label, Icon, activeClass }) => (
              <button
                key={t}
                type="button"
                onClick={() => switchType(t)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg border py-2 px-3 text-xs font-semibold transition-all",
                  type === t
                    ? activeClass
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100/60 dark:hover:bg-slate-800/60"
                )}
              >
                <Icon className="size-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* 3-Column Ergonomic Form Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-start">

            {/* ─── COLUMN 1: Item Details ─── */}
            <SectionCard title="Item Details" icon={Pill}>
              <div className="grid grid-cols-2 gap-2.5">
                <FormField label="Item Name" required className="col-span-2">
                  <Input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Amoxicillin 250mg"
                    className={cn(inputCls, "font-medium")}
                  />
                </FormField>
                <FormField label={isRx ? "Generic Name" : "Description"} className="col-span-2">
                  <Input
                    value={genericName}
                    onChange={(e) => setGenericName(e.target.value)}
                    placeholder={isRx ? "e.g. Amoxicillin Trihydrate" : "e.g. High protein food"}
                    className={inputCls}
                  />
                </FormField>
                <FormField label="Brand">
                  <Input
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="e.g. Moxikind"
                    className={inputCls}
                  />
                </FormField>
                <FormField label="Manufacturer">
                  <Input
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    placeholder="e.g. Mankind Pharma"
                    className={inputCls}
                  />
                </FormField>
                <FormField label="Sub Group" className="col-span-2">
                  <Combo
                    value={subGroup}
                    onChange={setSubGroup}
                    options={SUB_GROUPS}
                    className={inputCls}
                    placeholder={isRx ? "e.g. Antibiotics" : "e.g. Dog Food"}
                  />
                </FormField>

                {type === "MEDICINE" && (
                  <>
                    <FormField label="Strength">
                      <Input
                        value={strength}
                        onChange={(e) => setStrength(e.target.value)}
                        placeholder="e.g. 250mg"
                        className={inputCls}
                      />
                    </FormField>
                    <FormField label="Dosage Form">
                      <Combo
                        value={dosageForm}
                        onChange={setDosageForm}
                        options={DOSAGE_FORMS}
                        className={inputCls}
                        placeholder="e.g. Tablet, Syrup, Ointment"
                      />
                    </FormField>
                    <FormField label="Schedule" className="col-span-2">
                      {sel(schedule, setSchedule, ["Schedule H", "Schedule H1", "Schedule X", "OTC"], "Select schedule...")}
                    </FormField>
                  </>
                )}

                {type === "INJECTION" && (
                  <>
                    <FormField label="Strength">
                      <Input
                        value={strength}
                        onChange={(e) => setStrength(e.target.value)}
                        placeholder="e.g. 20mg/ml"
                        className={inputCls}
                      />
                    </FormField>
                    <FormField label="Route">
                      {sel(route, setRoute, ["IM", "IV", "SC", "IP"], "Select route...")}
                    </FormField>
                    <FormField label="Schedule" className="col-span-2">
                      {sel(schedule, setSchedule, ["Schedule H", "Schedule H1", "Schedule X", "OTC"], "Select schedule...")}
                    </FormField>
                  </>
                )}

                {type === "FOOD" && (
                  <>
                    <FormField label="Target Species">
                      {sel(species, setSpecies, ["Dog", "Cat", "Bird", "Rabbit", "Other"], "Select species...")}
                    </FormField>
                    <FormField label="Life Stage">
                      {sel(lifeStage, setLifeStage, ["Puppy / Kitten", "Adult", "Senior", "All"], "Select life stage...")}
                    </FormField>
                  </>
                )}

                {type === "ACCESSORY" && (
                  <>
                    <FormField label="Accessory Type">
                      <Input
                        value={accessoryType}
                        onChange={(e) => setAccessoryType(e.target.value)}
                        placeholder="e.g. Collar, Leash"
                        className={inputCls}
                      />
                    </FormField>
                    <FormField label="Pet Size">
                      {sel(petSize, setPetSize, ["Small", "Medium", "Large", "XL"], "Select pet size...")}
                    </FormField>
                  </>
                )}
              </div>
            </SectionCard>

            {/* ─── COLUMN 2: Packaging & Stock ─── */}
            <div className="space-y-3.5">
              <SectionCard title="Packaging Hierarchy" icon={Layers}>
                <div className="grid grid-cols-2 gap-2.5">
                  <FormField label="Single (Base) Unit" required className="col-span-2">
                    <Combo
                      value={pkg.baseUnit}
                      onChange={(v) => setP({ baseUnit: v })}
                      options={UNIT_SUGGESTIONS}
                      className={inputCls}
                      placeholder="e.g. Tablet, Vial, Piece"
                    />
                  </FormField>

                  <div className="col-span-2 flex items-center gap-2 py-0.5">
                    <input
                      type="checkbox"
                      id="hasInterUnit"
                      checked={pkg.hasInter}
                      onChange={(e) => setP({ hasInter: e.target.checked, interUnit: "", basePerInter: "" })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 size-3.5 cursor-pointer"
                    />
                    <label htmlFor="hasInterUnit" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                      Has a middle unit (e.g. Strip)
                    </label>
                  </div>

                  {pkg.hasInter && (
                    <>
                      <FormField label="Middle Unit">
                        <Combo
                          value={pkg.interUnit}
                          onChange={(v) => setP({ interUnit: v })}
                          options={UNIT_SUGGESTIONS}
                          className={inputCls}
                          placeholder="e.g. Strip"
                        />
                      </FormField>
                      <FormField label={pkg.baseUnit.trim() ? `${pkg.baseUnit}s in Strip` : "Units in Strip"}>
                        <Input
                          type="number"
                          min="1"
                          placeholder="0"
                          value={pkg.basePerInter}
                          onChange={(e) => setP({ basePerInter: e.target.value })}
                          className={cn(inputCls, "font-mono")}
                        />
                      </FormField>
                    </>
                  )}

                  <FormField label="Purchase Unit" required>
                    <Combo
                      value={pkg.purchaseUnit}
                      onChange={(v) => setP({ purchaseUnit: v })}
                      options={UNIT_SUGGESTIONS}
                      className={inputCls}
                      placeholder="e.g. Box, Pack"
                    />
                  </FormField>
                  <FormField
                    label={
                      pkg.hasInter
                        ? (pkg.interUnit.trim() ? `${pkg.interUnit}s in Pack` : "Strips in Pack")
                        : (pkg.baseUnit.trim() ? `${pkg.baseUnit}s in Pack` : "Units in Pack")
                    }
                  >
                    <Input
                      type="number"
                      min="1"
                      placeholder="0"
                      value={pkg.perPurchase}
                      onChange={(e) => setP({ perPurchase: e.target.value })}
                      className={cn(inputCls, "font-mono")}
                    />
                  </FormField>

                  {hierarchyFormula ? (
                    <div className="col-span-2 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 px-3 py-1.5 text-[11px] font-mono font-semibold text-amber-900 dark:text-amber-200 text-center shadow-2xs">
                      {hierarchyFormula}
                    </div>
                  ) : (
                    <div className="col-span-2 rounded-md bg-slate-100/60 dark:bg-slate-900/60 border border-dashed border-slate-200 dark:border-slate-800 px-3 py-1.5 text-[10px] text-slate-400 text-center">
                      Set base &amp; purchase units to preview hierarchy
                    </div>
                  )}
                </div>
              </SectionCard>

              <SectionCard title="Stock & Storage" icon={PackageCheck}>
                <div className="grid grid-cols-2 gap-2.5">
                  <FormField label="Opening Stock">
                    <Input
                      type="number"
                      min="0"
                      value={currentStock}
                      onChange={(e) => setCurrentStock(e.target.value)}
                      placeholder="0"
                      className={cn(inputCls, "font-mono font-semibold")}
                    />
                  </FormField>
                  <FormField label="Reorder Level">
                    <Input
                      type="number"
                      min="0"
                      value={reorderLevel}
                      onChange={(e) => setReorderLevel(e.target.value)}
                      placeholder="0"
                      className={cn(inputCls, "font-mono")}
                    />
                  </FormField>
                  <FormField label="Storage Shelf / Location" className="col-span-2">
                    <Input
                      value={storageLocation}
                      onChange={(e) => setStorageLocation(e.target.value)}
                      placeholder={isRx ? "e.g. Rack A-1, Pharmacy" : "e.g. Retail Floor"}
                      className={inputCls}
                    />
                  </FormField>
                  <div className="col-span-2 flex items-center gap-2 pt-0.5">
                    <input
                      type="checkbox"
                      id="trackBatch"
                      checked={batchTracking}
                      onChange={(e) => setBatchTracking(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 size-3.5 cursor-pointer"
                    />
                    <label htmlFor="trackBatch" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                      Track batch &amp; expiry in inventory ledger
                    </label>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* ─── COLUMN 3: Pricing, Tax & Batch ─── */}
            <div className="space-y-3.5">
              <SectionCard title="Pricing & Tax" icon={IndianRupee}>
                <div className="text-[10px] text-slate-500 -mt-1 mb-1 font-medium">
                  {pkg.purchaseUnit ? `Prices per 1 ${pkg.purchaseUnit}` : "Prices per purchase unit"}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <FormField label="Buy Price">
                    <MoneyInput value={purchasePrice} onChange={setPurchasePrice} placeholder="0" />
                  </FormField>
                  <FormField label="MRP">
                    <MoneyInput value={mrp} onChange={setMrp} placeholder="0" />
                  </FormField>
                  <FormField label="Selling Price" className="col-span-2">
                    <MoneyInput value={salePrice} onChange={setSalePrice} placeholder="0" />
                  </FormField>

                  {baseUnitsPerPurchase > 1 && (Number(purchasePrice) > 0 || Number(salePrice) > 0 || Number(mrp) > 0) && (
                    <div className="col-span-2 rounded-md bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 p-2 text-[10px] font-mono text-slate-600 dark:text-slate-300 space-y-0.5 shadow-2xs">
                      <div>Per {pkg.baseUnit || "unit"}: Buy ₹{perBase(purchasePrice)} • MRP ₹{perBase(mrp)} • Sell ₹{perBase(salePrice || mrp)}</div>
                      {pkg.hasInter && Number(pkg.basePerInter) > 0 && (
                        <div>Per {pkg.interUnit || "middle"}: Buy ₹{r2(perBase(purchasePrice) * Number(pkg.basePerInter))} • Sell ₹{r2(perBase(salePrice || mrp) * Number(pkg.basePerInter))}</div>
                      )}
                    </div>
                  )}

                  <FormField label="HSN / SAC Code">
                    <div className="relative">
                      <Input
                        value={hsn}
                        onChange={(e) => setHsn(e.target.value)}
                        placeholder="e.g. 3004"
                        className={cn(inputCls, "font-mono pr-14")}
                      />
                      <button
                        type="button"
                        onClick={handleAutoSuggestHsn}
                        title="Auto-suggest HSN and GST rate based on name"
                        className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 hover:bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200 transition-colors"
                      >
                        <Sparkles className="size-2.5" />
                        AUTO
                      </button>
                    </div>
                  </FormField>
                  <FormField label="GST Rate">
                    {sel(gst, setGst, GST_RATES)}
                  </FormField>
                </div>
              </SectionCard>

              <SectionCard title="Batch & Expiry Date" icon={Calendar}>
                <div className="grid grid-cols-2 gap-2.5">
                  <FormField label="Batch Number" className="col-span-2">
                    <Input
                      value={batchNo}
                      onChange={(e) => setBatchNo(e.target.value)}
                      placeholder="e.g. BT-2024-001"
                      className={inputCls}
                    />
                  </FormField>
                  <FormField label="Manufacturing Date">
                    <DatePicker
                      value={manufacturingDate}
                      onChange={setManufacturingDate}
                      placeholder="Select mfg date"
                      className={inputCls}
                    />
                  </FormField>
                  <FormField label="Expiry Date">
                    <DatePicker
                      value={expiryDate}
                      onChange={setExpiryDate}
                      placeholder="Select expiry date"
                      className={cn(inputCls, expiryDate && new Date(expiryDate) < new Date() ? "border-rose-500 text-rose-600 font-semibold" : "")}
                      showPresets={true}
                    />
                  </FormField>
                  {expiryDate && new Date(expiryDate) < new Date() && (
                    <div className="col-span-2 text-[10px] text-rose-600 font-medium bg-rose-50 dark:bg-rose-950/40 p-1.5 rounded border border-rose-200 text-center">
                      ⚠ Expiry date is in the past
                    </div>
                  )}
                </div>
              </SectionCard>
            </div>
          </div>

          {/* Dialog Action Buttons */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-3 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">
              <span className="text-rose-500 font-bold">*</span> Required fields
            </span>
            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={saving}
                className="h-8 px-4 text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="h-8 px-6 gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs"
              >
                <Save className="size-3.5" />
                <span>{saving ? "Saving..." : "Save Item"}</span>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
