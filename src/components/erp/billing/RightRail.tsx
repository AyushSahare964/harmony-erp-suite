import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  Receipt,
  FileText,
  ShoppingBag,
  Wallet,
  UserPlus,
  Bell,
  ArrowDownCircle,
  ArrowUpCircle,
  Calculator,
  Calendar,
  Boxes,
  Pin,
  PinOff,
  Database,
  RefreshCw,
  ExternalLink,
  Layers,
  FileSpreadsheet,
  Building,
  HeartPulse,
  Pill,
  TestTube2,
  FileBarChart,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface RightRailProps {
  onNewInvoice: () => void;
  onNewQuotation: () => void;
  onAddPurchase: () => void;
  onAddExpense: () => void;
  onAddCustomer: () => void;
  onAddReminder: () => void;
  onPaymentIn: () => void;
  onPaymentOut: () => void;
  onOpenDailySummary: () => void;
  onOpenStockSummary: () => void;
  onOpenGstCalc?: () => void;
  className?: string;
}

export function RightRail({
  onNewInvoice,
  onNewQuotation,
  onAddPurchase,
  onAddExpense,
  onAddCustomer,
  onAddReminder,
  onPaymentIn,
  onPaymentOut,
  onOpenDailySummary,
  onOpenStockSummary,
  onOpenGstCalc,
  className,
}: RightRailProps) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    try {
      const isPinned = localStorage.getItem("vetos_billing_rail_pinned") === "true";
      setPinned(isPinned);
    } catch {}
  }, []);

  const togglePin = () => {
    const next = !pinned;
    setPinned(next);
    try {
      localStorage.setItem("vetos_billing_rail_pinned", String(next));
    } catch {}
  };

  const isExpanded = pinned || hovered;

  const createActions = [
    { label: "New Invoice", icon: Receipt, shortcut: "F2", action: onNewInvoice, color: "text-emerald-600 dark:text-emerald-400" },
    { label: "New Quotation", icon: FileText, shortcut: "Alt+Q", action: onNewQuotation, color: "text-indigo-600 dark:text-indigo-400" },
    { label: "Add Purchase", icon: ShoppingBag, shortcut: "Alt+P", action: onAddPurchase, color: "text-blue-600 dark:text-blue-400" },
    { label: "Add Expense", icon: Wallet, shortcut: "Alt+E", action: onAddExpense, color: "text-amber-600 dark:text-amber-400" },
    { label: "Add Client", icon: UserPlus, shortcut: "Alt+C", action: onAddCustomer, color: "text-purple-600 dark:text-purple-400" },
    { label: "Add Reminder", icon: Bell, shortcut: "Alt+R", action: onAddReminder, color: "text-sky-600 dark:text-sky-400" },
    { label: "Payment In", icon: ArrowDownCircle, shortcut: "Alt+I", action: onPaymentIn, color: "text-teal-600 dark:text-teal-400" },
    { label: "Payment Out", icon: ArrowUpCircle, shortcut: "", action: onPaymentOut, color: "text-rose-600 dark:text-rose-400" },
  ];

  const tools = [
    { label: "GST Calculator", icon: Calculator, shortcut: "Alt+G", action: onOpenGstCalc, color: "text-primary" },
    { label: "Daily Summary", icon: Calendar, shortcut: "", action: onOpenDailySummary, color: "text-foreground" },
    { label: "Stock Valuation", icon: Boxes, shortcut: "", action: onOpenStockSummary, color: "text-foreground" },
  ];

  const moduleLinks = [
    { label: "Inventory Hub", icon: Layers, href: "/m/inventory" },
    { label: "Accounting Hub", icon: Building, href: "/m/accounting" },
    { label: "Pet & Owner CRM", icon: HeartPulse, href: "/m/crm-pets" },
    { label: "Pharmacy Retail", icon: Pill, href: "/m/pharmacy" },
    { label: "Laboratory Diagnostics", icon: TestTube2, href: "/m/laboratory" },
    { label: "Clinical Reports", icon: FileBarChart, href: "/m/reports" },
  ];

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          "hidden md:flex flex-col justify-between shrink-0 sticky top-20 self-start z-30 transition-all duration-300 ease-in-out select-none",
          "rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl shadow-xl",
          "h-[calc(100vh-6.5rem)] overflow-hidden",
          isExpanded ? "w-56" : "w-14",
          className
        )}
      >
        {/* Rail Top Header: Pin toggle & Status */}
        <div className="flex items-center justify-between p-2.5 border-b border-border/60 bg-muted/20">
          {isExpanded ? (
            <div className="flex items-center gap-1.5 px-1">
              <span className="text-[11px] font-bold tracking-tight text-foreground uppercase">
                Quick Actions
              </span>
            </div>
          ) : (
            <div className="mx-auto size-2 rounded-full bg-emerald-500 animate-pulse" />
          )}

          <button
            type="button"
            onClick={togglePin}
            title={pinned ? "Unpin side rail" : "Pin side rail open"}
            className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ml-auto"
          >
            {pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
          </button>
        </div>

        {/* Action Items List */}
        <div className="flex-1 overflow-y-auto px-1.5 py-2 space-y-3.5 scrollbar-thin">
          {/* Section: Create Documents */}
          <div className="space-y-0.5">
            {isExpanded && (
              <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Create
              </div>
            )}
            {createActions.map((item) => (
              <Tooltip key={item.label}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={item.action}
                    className={cn(
                      "flex items-center gap-2.5 w-full rounded-xl p-2 text-xs font-semibold transition-all group",
                      "hover:bg-primary/10 hover:text-primary text-foreground"
                    )}
                  >
                    <div className={cn("size-5 shrink-0 flex items-center justify-center transition-transform group-hover:scale-110", item.color)}>
                      <item.icon className="size-4" />
                    </div>
                    {isExpanded && (
                      <div className="flex items-center justify-between flex-1 min-w-0">
                        <span className="truncate text-xs">{item.label}</span>
                        {item.shortcut && (
                          <kbd className="ml-1 text-[10px] font-mono text-muted-foreground/70 bg-muted/60 px-1 py-0.2 rounded">
                            {item.shortcut}
                          </kbd>
                        )}
                      </div>
                    )}
                  </button>
                </TooltipTrigger>
                {!isExpanded && (
                  <TooltipContent side="left" className="text-xs font-semibold">
                    {item.label} {item.shortcut ? `(${item.shortcut})` : ""}
                  </TooltipContent>
                )}
              </Tooltip>
            ))}
          </div>

          <Separator className="bg-border/60" />

          {/* Section: Tools */}
          <div className="space-y-0.5">
            {isExpanded && (
              <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Tools
              </div>
            )}
            {tools.map((item) => (
              <Tooltip key={item.label}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={item.action}
                    className={cn(
                      "flex items-center gap-2.5 w-full rounded-xl p-2 text-xs font-semibold transition-all group",
                      "hover:bg-primary/10 hover:text-primary text-foreground"
                    )}
                  >
                    <div className={cn("size-5 shrink-0 flex items-center justify-center transition-transform group-hover:scale-110", item.color)}>
                      <item.icon className="size-4" />
                    </div>
                    {isExpanded && (
                      <div className="flex items-center justify-between flex-1 min-w-0">
                        <span className="truncate text-xs">{item.label}</span>
                        {item.shortcut && (
                          <kbd className="ml-1 text-[10px] font-mono text-muted-foreground/70 bg-muted/60 px-1 py-0.2 rounded">
                            {item.shortcut}
                          </kbd>
                        )}
                      </div>
                    )}
                  </button>
                </TooltipTrigger>
                {!isExpanded && (
                  <TooltipContent side="left" className="text-xs font-semibold">
                    {item.label} {item.shortcut ? `(${item.shortcut})` : ""}
                  </TooltipContent>
                )}
              </Tooltip>
            ))}
          </div>

          <Separator className="bg-border/60" />

          {/* Section: Jump to Modules */}
          <div className="space-y-0.5">
            {isExpanded && (
              <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Jump To
              </div>
            )}
            {moduleLinks.map((item) => (
              <Tooltip key={item.label}>
                <TooltipTrigger asChild>
                  <Link
                    to={item.href}
                    className={cn(
                      "flex items-center gap-2.5 w-full rounded-xl p-2 text-xs font-semibold transition-all group",
                      "hover:bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <div className="size-5 shrink-0 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-transform group-hover:scale-110">
                      <item.icon className="size-4" />
                    </div>
                    {isExpanded && (
                      <div className="flex items-center justify-between flex-1 min-w-0">
                        <span className="truncate text-xs">{item.label}</span>
                        <ExternalLink className="size-2.5 opacity-40 group-hover:opacity-100" />
                      </div>
                    )}
                  </Link>
                </TooltipTrigger>
                {!isExpanded && (
                  <TooltipContent side="left" className="text-xs font-semibold">
                    {item.label}
                  </TooltipContent>
                )}
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Rail Bottom Footer */}
        <div className="p-2 border-t border-border/60 bg-muted/20 flex flex-col gap-1.5">
          <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1 font-mono">
              <span className="size-2 rounded-full bg-emerald-500 inline-block" />
              {isExpanded && "DB Online"}
            </span>
            {isExpanded && (
              <>
                <span>•</span>
                <span className="font-mono">FY 26-27</span>
              </>
            )}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
