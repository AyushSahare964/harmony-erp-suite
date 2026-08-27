import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Boxes, BookOpen, BarChart2, ArrowLeftRight, Link2, Bell, ArrowLeft, ShoppingBag,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Shell } from "@/components/erp/Shell";

import { InventoryProvider } from "./useInventoryStore";
import { MedicineCatalogue } from "./MedicineCatalogue";
import { FoodAccessoriesCatalogue } from "./FoodAccessoriesCatalogue";
import { StockView } from "./StockView";
import { StockMovements } from "./StockMovements";
import { BillingSync } from "./BillingSync";
import { AlertsPanel } from "./AlertsPanel";

// ─── Tab definitions ──────────────────────────────────────────────────────────
type TabId = "catalogue" | "food_accessories" | "stock" | "movements" | "billing" | "alerts";

interface TabDef {
  id: TabId;
  label: string;
  Icon: React.FC<{ className?: string }>;
  badge?: string;
  alertCount?: number;
}

const TABS: TabDef[] = [
  { id: "catalogue",       label: "Medicine Catalogue",      Icon: BookOpen,       badge: "12.4" },
  { id: "food_accessories",label: "Food & Accessories",      Icon: ShoppingBag,    badge: "12.5" },
  { id: "stock",           label: "Real-Time Stock",         Icon: BarChart2,      badge: "12.6" },
  { id: "movements",       label: "Stock Movements",         Icon: ArrowLeftRight, badge: "12.7" },
  { id: "billing",         label: "Billing Sync",            Icon: Link2,          badge: "12.8" },
  { id: "alerts",          label: "Alerts",                  Icon: Bell,           badge: "12.9" },
];

// ─── Inner hub (needs InventoryProvider in scope) ─────────────────────────────
function InventoryHubInner() {
  const [activeTab, setActiveTab] = useState<TabId>("stock");

  return (
    <Shell title="Inventory & Procurement">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto max-w-[1500px] space-y-5"
      >
        {/* Page header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <motion.span
              whileHover={{ rotate: 8, scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary shadow-xs"
            >
              <Boxes className="size-5" />
            </motion.span>
            <div>
              <h1 className="page-title">Inventory &amp; Procurement</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Medicine catalogue · Real-time stock · Add/Remove · Billing sync · Alerts
              </p>
            </div>
          </div>
          <Link
            to="/"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" /> Dashboard
          </Link>
        </div>

        {/* Tab bar */}
        <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-muted/40 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              id={`inv-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/60"
              }`}
            >
              <tab.Icon className="size-3.5" />
              {tab.label}
              {tab.badge && (
                <span
                  className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    activeTab === tab.id
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="invActiveTab"
                  className="absolute inset-0 rounded-lg ring-1 ring-border"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {activeTab === "catalogue"        && <MedicineCatalogue />}
            {activeTab === "food_accessories" && <FoodAccessoriesCatalogue />}
            {activeTab === "stock"            && <StockView />}
            {activeTab === "movements"        && <StockMovements />}
            {activeTab === "billing"          && <BillingSync />}
            {activeTab === "alerts"           && <AlertsPanel />}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </Shell>
  );
}

// ─── Public export — wraps with the shared store provider ─────────────────────
export function InventoryHub() {
  return (
    <InventoryProvider>
      <InventoryHubInner />
    </InventoryProvider>
  );
}
