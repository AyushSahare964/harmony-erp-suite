import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight, Copy, Printer, MoreHorizontal, Save,
  ChevronLeft, ChevronRight as ChevronRightIcon, Tag,
  Paperclip, UserPlus, Share2, Heart, Clock, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/erp/StatusPill";
import { toast } from "sonner";
import { Edit, PlusCircle } from "lucide-react";

import { useInventory, type Medicine, type Batch } from "../useInventoryStore";
import { ItemMasterDialog } from "../ItemMasterDialog";
import { AddStockDialog } from "../AddStockDialog";
import { ItemDetails, type ExtendedFields } from "./tabs/ItemDetails";
import { ItemDashboard } from "./tabs/ItemDashboard";
import { ItemInventory } from "./tabs/ItemInventory";
import { ItemVariants } from "./tabs/ItemVariants";
import { ItemAccounting } from "./tabs/ItemAccounting";
import { ItemPurchasing } from "./tabs/ItemPurchasing";
import { ItemSales } from "./tabs/ItemSales";
import { ItemTax } from "./tabs/ItemTax";
import { ItemQuality } from "./tabs/ItemQuality";
import { ItemManufacturing } from "./tabs/ItemManufacturing";

// ─── Tab definitions ───────────────────────────────────────────────────────────
type TabId =
  | "details" | "dashboard" | "inventory" | "variants"
  | "accounting" | "purchasing" | "sales" | "tax" | "quality" | "manufacturing";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "details",       label: "Details" },
  { id: "dashboard",     label: "Dashboard" },
  { id: "inventory",     label: "Inventory" },
  { id: "variants",      label: "Variants" },
  { id: "accounting",    label: "Accounting" },
  { id: "purchasing",    label: "Purchasing" },
  { id: "sales",         label: "Sales" },
  { id: "tax",           label: "Tax" },
  { id: "quality",       label: "Quality" },
  { id: "manufacturing", label: "Manufacturing" },
];

const CATEGORY_COLORS: Record<string, string> = {
  Medicine:    "bg-primary text-white",
  Food:        "bg-success text-white",
  Accessory:   "bg-warning text-white",
  Consumable:  "bg-destructive text-white",
};

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

const DEFAULT_EXTENDED: ExtendedFields = {
  isZeroRated: false,
  isExempt: false,
  isDisabled: false,
  allowAlternative: false,
  maintainStock: true,
  valuationRate: "0.00",
  isFixedAsset: false,
  overDeliveryAllowance: "0.000",
  overBillingAllowance: "0.000",
  taxCode: "",
  description: "",
  uomConversions: [],
};

interface Props {
  medicine: Medicine;
  batches: Batch[];
  stockQty: number;
  onBack: () => void;
  onNext?: (() => void) | undefined;
  onPrev?: (() => void) | undefined;
}

export function ItemDetailView({ medicine, batches, stockQty, onBack, onNext, onPrev }: Props) {
  const { updateMedicine } = useInventory();
  const [activeTab, setActiveTab] = useState<TabId>("details");
  const [extended, setExtended] = useState<ExtendedFields>({ ...DEFAULT_EXTENDED, maintainStock: true });
  const [saved, setSaved] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [grnOpen, setGrnOpen] = useState(false);

  const handleSave = async () => {
    try {
      await updateMedicine(medicine.id, {
        maintainStock: extended.maintainStock,
        valuationRate: Number(extended.valuationRate) || 0,
        isZeroRated: extended.isZeroRated,
        isExempt: extended.isExempt,
        allowAlternativeItem: extended.allowAlternative,
        description: extended.description || medicine.description,
      });
      setSaved(true);
      toast.success(`${medicine.name} updated in MongoDB`);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      toast.error("Failed to save changes");
    }
  };

  // Status label
  const statusLabel = medicine.status === "Active" ? "enabled" : "inactive";

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-full"
    >
      {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <button onClick={onBack} className="hover:text-foreground transition-colors">Inventory</button>
        <ChevronRight className="size-3" />
        <button onClick={onBack} className="hover:text-foreground transition-colors">Item</button>
        <ChevronRight className="size-3" />
        <span className="font-medium text-foreground truncate max-w-[240px]">{medicine.name}</span>
      </div>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-navy">{medicine.name}</h1>
          <StatusPill value={statusLabel} />
          {medicine.genericName && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {medicine.genericName}
            </span>
          )}
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditOpen(true)}
            className="text-xs h-8"
          >
            <Edit className="size-3.5 mr-1" /> Edit Master
          </Button>
          <Button
            size="sm"
            onClick={() => setGrnOpen(true)}
            className="text-xs h-8 bg-success hover:bg-success/90 text-success-foreground"
          >
            <PlusCircle className="size-3.5 mr-1" /> Receive Stock (GRN)
          </Button>
          <div className="flex items-center rounded-lg border border-border">
            <button
              onClick={onPrev}
              className="border-r border-border px-2 py-1.5 hover:bg-muted/50 transition-colors disabled:opacity-30"
              disabled={!onPrev}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={onNext}
              className="px-2 py-1.5 hover:bg-muted/50 transition-colors disabled:opacity-30"
              disabled={!onNext}
            >
              <ChevronRightIcon className="size-4" />
            </button>
          </div>
          <button
            className="rounded-lg border border-border p-1.5 hover:bg-muted/50 transition-colors"
            title="Print Item Master Sheet"
            onClick={() => {
              toast.info(`Preparing print sheet for ${medicine.name}...`);
              window.print();
            }}
          >
            <Printer className="size-4" />
          </button>
          <Button
            onClick={handleSave}
            className={`min-w-[64px] transition-all ${saved ? "bg-success hover:bg-success/90" : ""}`}
          >
            {saved
              ? <><Check className="mr-1.5 size-4" />Saved</>
              : <><Save className="mr-1.5 size-4" />Save</>
            }
          </Button>
        </div>
      </div>

      {/* ── Main layout: left sidebar + form ──────────────────────────── */}
      <div className="flex gap-5">

        {/* ── Left sidebar ─────────────────────────────────────────────── */}
        <aside className="w-48 shrink-0 space-y-4">
          {/* Avatar */}
          <div className="erp-card flex flex-col items-center gap-3 p-4">
            <div className={`flex size-20 items-center justify-center rounded-2xl text-2xl font-bold shadow-sm ${CATEGORY_COLORS[medicine.category] || "bg-primary text-white"}`}>
              {getInitials(medicine.name)}
            </div>
            <span className="text-center text-xs font-semibold text-muted-foreground">{medicine.category}</span>
          </div>

          {/* Meta actions */}
          <div className="erp-card divide-y divide-border overflow-hidden p-0">
            <button
              onClick={() => toast.success(`Assigned to Dr. Ananya Rao`)}
              className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-xs font-medium text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors"
            >
              <UserPlus className="size-3.5 shrink-0" />
              Assigned To
              <span className="ml-auto text-xs text-primary font-semibold">Dr. Rao</span>
            </button>
            <button
              onClick={() => toast.info("Attach documents: MSDS / COA / Drug License")}
              className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-xs font-medium text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors"
            >
              <Paperclip className="size-3.5 shrink-0" />
              Attachments
              <span className="ml-auto text-muted-foreground/60">+</span>
            </button>
            <button
              onClick={() => toast.info(`Tags: [${medicine.category}, Rx-Only, Active]`)}
              className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-xs font-medium text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors"
            >
              <Tag className="size-3.5 shrink-0" />
              Tags
              <span className="ml-auto text-muted-foreground/60">+</span>
            </button>
            <button
              onClick={() => {
                navigator.clipboard?.writeText?.(window.location.href);
                toast.success(`Link to ${medicine.name} copied to clipboard.`);
              }}
              className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-xs font-medium text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors"
            >
              <Share2 className="size-3.5 shrink-0" />
              Share Link
            </button>
          </div>

          {/* Activity */}
          <div className="erp-card p-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Heart className="size-3 text-primary fill-primary" /> 1
              <span className="mx-1">·</span>
              <span>Stock Active</span>
            </div>
            <button
              onClick={() => toast.success(`Item bookmarked in quick favorites.`)}
              className="mt-3 w-full rounded-lg border border-primary/40 bg-primary-soft/30 py-1.5 text-xs font-semibold text-primary hover:bg-primary-soft/60 transition-colors"
            >
              BOOKMARK ITEM
            </button>
            <div className="mt-3 space-y-1.5 text-[11px] text-muted-foreground">
              <p className="flex items-center gap-1">
                <Clock className="size-3 shrink-0" />
                Status · {medicine.status}
              </p>
              <p className="flex items-center gap-1">
                <Clock className="size-3 shrink-0" />
                Created · {medicine.createdAt}
              </p>
            </div>
          </div>

          {/* Item details mini-card */}
          <div className="erp-card p-4 text-xs space-y-2">
            <p className="section-label">Item Code</p>
            <p className="font-mono font-semibold text-primary">{medicine.id}</p>
            <p className="section-label mt-2">GST Rate</p>
            <p className="font-medium">{medicine.gstRate}%</p>
            <p className="section-label mt-2">Sale Price</p>
            <p className="font-bold text-primary">₹{medicine.defaultSalePrice.toLocaleString("en-IN")}</p>
          </div>
        </aside>

        {/* ── Right: Tab bar + content ──────────────────────────────────── */}
        <div className="min-w-0 flex-1">
          {/* Tab bar — horizontal scroll on small screens */}
          <div className="mb-5 overflow-x-auto">
            <div className="flex min-w-max border-b border-border">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  id={`item-tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="itemDetailTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {activeTab === "details"       && <ItemDetails medicine={medicine} extended={extended} onExtended={setExtended} />}
              {activeTab === "dashboard"     && <ItemDashboard medicine={medicine} stockQty={stockQty} />}
              {activeTab === "inventory"     && <ItemInventory medicine={medicine} batches={batches} stockQty={stockQty} />}
              {activeTab === "variants"      && <ItemVariants medicine={medicine} />}
              {activeTab === "accounting"    && <ItemAccounting />}
              {activeTab === "purchasing"    && <ItemPurchasing medicine={medicine} />}
              {activeTab === "sales"         && <ItemSales medicine={medicine} />}
              {activeTab === "tax"           && <ItemTax medicine={medicine} />}
              {activeTab === "quality"       && <ItemQuality />}
              {activeTab === "manufacturing" && <ItemManufacturing />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      {/* Edit & GRN Dialogs */}
      <ItemMasterDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        editing={medicine}
      />
      <AddStockDialog
        open={grnOpen}
        onClose={() => setGrnOpen(false)}
        preselectedItem={medicine}
      />
    </motion.div>
  );
}
