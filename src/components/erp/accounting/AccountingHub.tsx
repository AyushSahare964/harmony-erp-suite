import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet,
  LayoutDashboard,
  ListTree,
  HandCoins,
  Landmark,
  ReceiptText,
  PieChart,
  ArrowLeft,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Shell } from "@/components/erp/Shell";

import { FinancialDashboard } from "./FinancialDashboard";
import { ChartOfAccounts } from "./ChartOfAccounts";
import { ReceivablesPayables } from "./ReceivablesPayables";
import { BankingReconciliation } from "./BankingReconciliation";
import { TaxationCompliance } from "./TaxationCompliance";
import { BudgetingCostCenters } from "./BudgetingCostCenters";
import { FinancialReports } from "./FinancialReports";
import { FileSpreadsheet } from "lucide-react";

// ─── Tab definitions ──────────────────────────────────────────────────────────
type TabId = "dashboard" | "coa" | "ar" | "banking" | "tax" | "budget" | "reports";

interface TabDef {
  id: TabId;
  label: string;
  Icon: React.FC<{ className?: string }>;
  badge: string;
}

const TABS: TabDef[] = [
  { id: "dashboard", label: "Financial Dashboard",      Icon: LayoutDashboard, badge: "18.1" },
  { id: "coa",       label: "Chart of Accounts & GL",  Icon: ListTree,         badge: "18.2" },
  { id: "ar",        label: "Receivables & Payables",  Icon: HandCoins,        badge: "18.3" },
  { id: "banking",   label: "Banking & Reconciliation", Icon: Landmark,         badge: "18.4" },
  { id: "tax",       label: "Taxation & Compliance",   Icon: ReceiptText,      badge: "18.5" },
  { id: "budget",    label: "Budgeting & Cost Centers", Icon: PieChart,         badge: "18.6" },
  { id: "reports",   label: "Financial Statements",    Icon: FileSpreadsheet,   badge: "18.7" },
];

// ─── AccountingHub ────────────────────────────────────────────────────────────
export function AccountingHub() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");

  const goToTab = (id: string) => {
    if (TABS.find((t) => t.id === id)) setActiveTab(id as TabId);
  };

  return (
    <Shell title="Accounting & Finance">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto max-w-[1500px] space-y-5"
      >
        {/* ── Page header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <motion.span
              whileHover={{ rotate: 8, scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary shadow-xs"
            >
              <Wallet className="size-5" />
            </motion.span>
            <div>
              <h1 className="page-title">Accounting &amp; Finance</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Ledgers · Receivables &amp; Payables · Bank Reconciliation · GST/TDS · Budgets
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

        {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-muted/40 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              id={`acc-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/60"
              }`}
            >
              <tab.Icon className="size-3.5" />
              {tab.label}
              <span
                className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  activeTab === tab.id
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {tab.badge}
              </span>
              {activeTab === tab.id && (
                <motion.div
                  layoutId="accActiveTab"
                  className="absolute inset-0 rounded-lg ring-1 ring-border"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* ── Tab content ─────────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {activeTab === "dashboard" && <FinancialDashboard onGoToTab={goToTab} />}
            {activeTab === "coa"       && <ChartOfAccounts />}
            {activeTab === "ar"        && <ReceivablesPayables />}
            {activeTab === "banking"   && <BankingReconciliation />}
            {activeTab === "tax"       && <TaxationCompliance />}
            {activeTab === "budget"    && <BudgetingCostCenters />}
            {activeTab === "reports"   && <FinancialReports />}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </Shell>
  );
}
