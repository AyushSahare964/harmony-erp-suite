import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Receipt,
  ShoppingBag,
  Boxes,
  Landmark,
  Wallet,
  Users,
  FileSpreadsheet,
  Settings,
  Clock,
  ArrowLeft,
  ChevronRight,
  Search,
  Bell,
  Menu,
  X,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Shell } from "@/components/erp/Shell";
import { formatDisplayDate, formatDisplayTime } from "@/lib/utils/dateUtils";

export type BillingMenuId =
  | "dashboard"
  | "sale"
  | "purchase"
  | "inventory"
  | "accounts"
  | "expense"
  | "customer"
  | "reports"
  | "settings";

interface BillingDeskShellProps {
  activeMenu: BillingMenuId;
  onSelectMenu: (menu: BillingMenuId) => void;
  children: React.ReactNode;
}

const MENU_ITEMS: { id: BillingMenuId; label: string; icon: React.FC<{ className?: string }>; hasSub?: boolean }[] = [
  { id: "dashboard", label: "Dashboard",  icon: LayoutDashboard, hasSub: false },
  { id: "sale",      label: "Sale",       icon: Receipt,         hasSub: true },
  { id: "purchase",  label: "Purchase",   icon: ShoppingBag,     hasSub: true },
  { id: "inventory", label: "Inventory",  icon: Boxes,           hasSub: true },
  { id: "accounts",  label: "Accounts",   icon: Landmark,        hasSub: true },
  { id: "expense",   label: "Expense",    icon: Wallet,          hasSub: false },
  { id: "customer",  label: "Customer",   icon: Users,           hasSub: true },
  { id: "reports",   label: "Reports",    icon: FileSpreadsheet, hasSub: true },
  { id: "settings",  label: "Settings",   icon: Settings,        hasSub: false },
];

export function BillingDeskShell({
  activeMenu,
  onSelectMenu,
  children,
}: BillingDeskShellProps) {
  // Live ticking clock and date for the Hitech sidebar footer
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(formatDisplayTime(now));
      setCurrentDate(formatDisplayDate(now));
    };

    updateTime();
    const interval = setInterval(updateTime, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Shell title="Billing Desk — Real Care Small Animal Clinic">
      <div className="mx-auto max-w-[1600px] flex flex-col md:flex-row min-h-[calc(100vh-130px)] gap-4">
        {/* ── Hitech Left Sidebar ── */}
        <aside className="w-full md:w-60 shrink-0 flex flex-col rounded-2xl bg-[#0f172a] text-slate-200 shadow-xl overflow-hidden border border-slate-800">
          {/* Clinic Brand Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-base font-black tracking-tight text-white flex items-center gap-1.5">
                <span className="text-primary font-mono text-lg font-black">Hitech</span>
                <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold">9.3</span>
              </div>
              <p className="text-[10px] text-slate-400 truncate mt-0.5 max-w-[170px]">
                Real Care Small Animal Clinic
              </p>
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 text-slate-400 hover:text-white"
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>

          {/* Nav List */}
          <nav className={`flex-1 p-2 space-y-0.5 ${mobileMenuOpen ? "block" : "hidden md:block"}`}>
            {MENU_ITEMS.map((item) => {
              const active = activeMenu === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectMenu(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition-all text-left ${
                    active
                      ? "bg-primary text-primary-foreground shadow-md font-bold"
                      : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="size-4 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  {item.hasSub && (
                    <ChevronRight className={`size-3.5 transition-transform ${active ? "opacity-100" : "opacity-40"}`} />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Clock & Date Footer (Identical to Hitech) */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/60 mt-auto">
            <div className="text-lg font-mono font-black text-white tracking-wider">
              {currentTime || "00:00:00"}
            </div>
            <div className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
              {currentDate || "Loading date..."}
            </div>
            <div className="text-[9px] text-primary/70 font-mono mt-2 truncate">
              billing.vetos.internal
            </div>
          </div>
        </aside>

        {/* ── Main Content Area ── */}
        <main className="flex-1 flex flex-col min-w-0 space-y-4">
          {/* Top Bar Navigation & Context */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-2.5 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span className="font-bold text-foreground capitalize">
                Billing Desk / {activeMenu}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="size-3.5" /> Back to Main ERP
              </Link>
            </div>
          </div>

          {/* Active View Render */}
          <div className="flex-1">
            {children}
          </div>
        </main>
      </div>
    </Shell>
  );
}
