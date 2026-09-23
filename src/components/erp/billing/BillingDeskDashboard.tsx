import { useState, useMemo, useEffect, useRef } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  EyeOff,
  RefreshCw,
  Plus,
  Receipt,
  FileText,
  ShoppingBag,
  CreditCard,
  UserPlus,
  Bell,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  Search,
  CheckCircle2,
  Clock,
  ChevronRight,
  Filter,
  Download,
  Globe,
  Fingerprint,
  Shield,
  Database,
  AtSign,
  Mail,
  Cloud,
  ToggleRight,
  FileSpreadsheet,
  Calendar,
  Boxes,
  Building2,
  Banknote,
  QrCode,
  Sparkles,
  Package,
  Tag,
  User,
  X,
  AlertTriangle,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { useInventory } from "@/components/erp/inventory/useInventoryStore";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { Distribution3DChart } from "./Distribution3DChart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DateRangeFilter,
  defaultDateRange,
  type DateRange,
} from "@/components/erp/shared/DateRangeFilter";
import { StatusPill } from "@/components/erp/StatusPill";
import { formatDisplayDate } from "@/lib/utils/dateUtils";
import { DailySummaryModal } from "./DailySummaryModal";
import { StockSummaryModal } from "./StockSummaryModal";
import { QuotationsRegisterView } from "../reports/QuotationsRegisterView";
import { GstCalculatorPopover } from "./GstCalculatorPopover";
import { listExpensesFn, type ExpenseRow } from "@/lib/mongodb/serverFns/expenses";
import { listQuotationsFn } from "@/lib/mongodb/serverFns/quotations";
import {
  listPurchaseBillsFn,
  markPurchaseBillPaidFn,
  deletePurchaseBillFn,
  type PurchaseBillRow,
} from "@/lib/mongodb/serverFns/purchaseBills";
import { PurchaseBillPrintView } from "./PurchaseBillPrintView";
import { cn } from "@/lib/utils";

interface BillingDeskDashboardProps {
  invoices: any[];
  loading?: boolean;
  /** Deep link from Global Search — filter the invoice register to this patient and highlight it. */
  deepLinkPet?: { petId: string; petName: string } | null;
  onRefresh: () => void;
  onNewInvoice: () => void;
  onNewQuotation: () => void;
  onAddPurchase: () => void;
  onAddExpense: () => void;
  onPaymentIn: (invoiceNo?: string) => void;
  onPaymentOut: () => void;
  onAddCustomer: () => void;
  onAddSupplier?: () => void;
  onAddReminder: () => void;
  onViewInvoice: (invoice: any) => void;
  onConvertToInvoice?: (quotation: any) => void;
  /** Bumped by the parent after a purchase bill is saved: reloads registers and shows the Purchases tab. */
  purchasesRefreshKey?: number;
}

export function BillingDeskDashboard({
  invoices,
  loading = false,
  deepLinkPet,
  onRefresh,
  onNewInvoice,
  onNewQuotation,
  onAddPurchase,
  onAddExpense,
  onPaymentIn,
  onPaymentOut,
  onAddCustomer,
  onAddSupplier,
  onAddReminder,
  onViewInvoice,
  onConvertToInvoice,
  purchasesRefreshKey = 0,
}: BillingDeskDashboardProps) {
  const [masked, setMasked] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>(defaultDateRange());

  // Hitech Right Column Activity Tabs
  const [activeActivityTab, setActiveActivityTab] = useState<
    "recentSales" | "clientDue" | "amountReceived" | "chequeAlert"
  >("recentSales");

  // Live inventory store hook for dynamic stock/batch search
  const { medicines = [], batches = [] } = useInventory();

  // Hitech Search Card State
  const [searchScope, setSearchScope] = useState<"Stock" | "SerialNo" | "Invoice" | "Client">("Stock");
  const [quickSearchQuery, setQuickSearchQuery] = useState("");
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null);

  // Big Documents Register Tab State
  const [registerTab, setRegisterTab] = useState<
    "invoices" | "quotations" | "creditNotes" | "payments" | "purchases" | "expenses"
  >("invoices");

  // Document Collections for Registers
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseBillRow[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);

  const loadExtraRegisters = async () => {
    try {
      const [expData, purData, qtnData] = await Promise.all([
        listExpensesFn({ data: { status: "ALL", from: "2020-01-01", to: "2030-12-31" } }).catch(() => []),
        listPurchaseBillsFn({ data: { from: "2020-01-01", to: "2030-12-31" } }).catch(() => []),
        listQuotationsFn({ data: { query: "" } }).catch(() => []),
      ]);
      setExpenses(expData || []);
      setPurchases(purData || []);
      setQuotations(qtnData || []);
    } catch (err) {
      console.error("Failed to load extra register data:", err);
    }
  };

  useEffect(() => {
    void loadExtraRegisters();
    if (purchasesRefreshKey > 0) {
      setRegisterTab("purchases");
      setSearchQuery("");
      document.getElementById("billing-documents-register")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [purchasesRefreshKey]);

  // Invoices table search and filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Deep link from Global Search: filter the invoice register to that patient and highlight
  // it if they have records, or tell the user plainly that they don't — instead of silently
  // showing the whole, unfiltered register.
  const [highlightRegister, setHighlightRegister] = useState(false);
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (loading || !deepLinkPet || deepLinkHandled.current) return;
    deepLinkHandled.current = true;

    const hasRecords = invoices.some((inv) => inv.petId === deepLinkPet.petId);
    if (!hasRecords) {
      toast.error(`No billing records found for ${deepLinkPet.petName}.`);
      return;
    }
    setRegisterTab("invoices");
    // The invoice register's own search only matches invoiceNo/ownerName/ownerPhone/
    // petName/doctorName (not petId) — filter by petName to actually narrow the table.
    setSearchQuery(deepLinkPet.petName);
    setHighlightRegister(true);
    document.getElementById("billing-invoice-register")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => setHighlightRegister(false), 3000);
  }, [loading, deepLinkPet, invoices]);

  // Modals
  const [dailySummaryOpen, setDailySummaryOpen] = useState(false);
  const [stockSummaryOpen, setStockSummaryOpen] = useState(false);
  const [selectedPurchaseBill, setSelectedPurchaseBill] = useState<PurchaseBillRow | null>(null);
  const [showPurchaseBillPrintView, setShowPurchaseBillPrintView] = useState(false);

  const handleOpenPurchaseBill = (pur: PurchaseBillRow) => {
    setSelectedPurchaseBill(pur);
    setShowPurchaseBillPrintView(true);
  };

  const handleMarkPurchaseBillPaid = async (billId: string) => {
    try {
      await markPurchaseBillPaidFn({ data: { id: billId, mode: "BANK_TRANSFER" } });
      toast.success("Purchase bill marked as PAID!");
      await loadExtraRegisters();
      if (selectedPurchaseBill && selectedPurchaseBill._id === billId) {
        setSelectedPurchaseBill({
          ...selectedPurchaseBill,
          amountPaid: selectedPurchaseBill.grandTotal,
          status: "PAID",
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to mark bill as paid");
    }
  };

  const handleDeletePurchaseBill = async (billId: string, refName?: string) => {
    const billLabel = refName || "this purchase bill";
    const confirmed = window.confirm(`Are you sure you want to permanently delete purchase bill ${billLabel}? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await deletePurchaseBillFn({ data: { id: billId } });
      toast.success(`Purchase bill ${billLabel} deleted successfully.`);
      if (selectedPurchaseBill?._id === billId) {
        setShowPurchaseBillPrintView(false);
        setSelectedPurchaseBill(null);
      }
      await loadExtraRegisters();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete purchase bill");
    }
  };

  // Live system clock for bottom bar (matching Image 5 clock)
  const [currentTime, setCurrentTime] = useState("");
  const [currentDateString, setCurrentDateString] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-GB", { hour12: false });
      const dateStr = now.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      setCurrentTime(timeStr);
      setCurrentDateString(dateStr);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter invoices for selected date range
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const d = inv.date || inv.createdAt?.slice(0, 10);
      if (!d) return true;
      if (dateRange.from && d < dateRange.from) return false;
      if (dateRange.to && d > dateRange.to) return false;
      return true;
    });
  }, [invoices, dateRange]);

  // Balance helper
  function invBalance(inv: any) {
    if (typeof inv.balanceDue === "number") return inv.balanceDue;
    return Math.max(0, (inv.totalAmount || 0) - (inv.amountPaid || 0));
  }

  // Compute Primary Hitech Metrics (Matches Quick Info in Screenshot)
  const totalSale = filteredInvoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const amountReceived = filteredInvoices.reduce((s, i) => s + (i.amountPaid || 0), 0);
  const amountDue = filteredInvoices.reduce((s, i) => s + invBalance(i), 0);

  // Masking format helper
  const fmtMoney = (amount: number) => {
    if (masked) return "₹ ••••";
    return `₹ ${amount.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  // Payment mode distribution from filtered invoices
  const paymentModeData = useMemo(() => {
    let cash = 0;
    let upi = 0;
    let card = 0;
    let bank = 0;

    filteredInvoices.forEach((inv) => {
      if (inv.payments && Array.isArray(inv.payments) && inv.payments.length > 0) {
        inv.payments.forEach((p: any) => {
          const raw = (p.mode || "").toUpperCase();
          const amt = Number(p.amount) || 0;
          if (raw.includes("CASH")) cash += amt;
          else if (raw.includes("UPI") || raw.includes("QR") || raw.includes("GPAY") || raw.includes("PAYTM")) upi += amt;
          else if (raw.includes("CARD") || raw.includes("POS") || raw.includes("DEBIT") || raw.includes("CREDIT")) card += amt;
          else bank += amt;
        });
      } else if (inv.amountPaid > 0) {
        const raw = (inv.paymentMode || "").toUpperCase();
        const amt = Number(inv.amountPaid) || 0;
        if (raw.includes("CASH")) cash += amt;
        else if (raw.includes("UPI") || raw.includes("QR") || raw.includes("GPAY") || raw.includes("PAYTM")) upi += amt;
        else if (raw.includes("CARD") || raw.includes("POS") || raw.includes("DEBIT") || raw.includes("CREDIT")) card += amt;
        else bank += amt;
      }
    });

    const total = cash + upi + card + bank;

    return {
      total,
      breakdown: [
        { name: "Cash", value: cash, color: "#10b981", rawMode: "CASH" },
        { name: "UPI / QR", value: upi, color: "#8b5cf6", rawMode: "UPI" },
        { name: "Card / POS", value: card, color: "#3b82f6", rawMode: "CARD" },
        { name: "Bank / Transfer", value: bank, color: "#f59e0b", rawMode: "BANK" },
      ],
      activeSlices: [
        { name: "Cash", value: cash, color: "#10b981" },
        { name: "UPI / QR", value: upi, color: "#8b5cf6" },
        { name: "Card / POS", value: card, color: "#3b82f6" },
        { name: "Bank / Transfer", value: bank, color: "#f59e0b" },
      ].filter((d) => d.value > 0),
    };
  }, [filteredInvoices]);

  // 15-Day Recent Sales Bar Chart Data (Truthful real-time data across last 15 days)
  const salesChartData = useMemo(() => {
    // End date defaults to dateRange.to or current date
    const endDate = dateRange.to ? new Date(dateRange.to + "T23:59:59") : new Date();

    // Generate last 15 days keyed by ISO date YYYY-MM-DD
    const isoDays: { iso: string; dayLabel: string }[] = [];
    const daysMap: Record<string, number> = {};

    for (let i = 14; i >= 0; i--) {
      const d = new Date(endDate);
      d.setDate(d.getDate() - i);
      const iso = d.toLocaleDateString("en-CA"); // YYYY-MM-DD
      const dayLabel = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }); // e.g. "03 Sep"
      isoDays.push({ iso, dayLabel });
      daysMap[iso] = 0;
    }

    // Sum from all active invoices in the workspace
    (invoices || []).forEach((inv) => {
      if (inv.status === "CANCELLED" || inv.status === "VOID") return;
      const rawDate = inv.date || inv.createdAt;
      if (!rawDate) return;
      const invIso = typeof rawDate === "string" ? rawDate.slice(0, 10) : new Date(rawDate).toLocaleDateString("en-CA");
      if (invIso && daysMap[invIso] !== undefined) {
        daysMap[invIso] += Number(inv.totalAmount || 0);
      }
    });

    return isoDays.map(({ iso, dayLabel }) => {
      const amount = Math.round(daysMap[iso] || 0);
      return {
        day: dayLabel,
        amount,
        amountK: amount > 0 ? (amount / 1000).toFixed(1) + " k" : "0",
      };
    });
  }, [invoices, dateRange.to]);

  // 30-Day Distribution Totals (Sale vs Purchase)
  const { last30DaysSales, last30DaysPurchases } = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffIso = cutoff.toLocaleDateString("en-CA");

    const saleTotal = (invoices || []).reduce((sum, inv) => {
      if (inv.status === "CANCELLED" || inv.status === "VOID") return sum;
      const dStr = (typeof inv.date === "string" ? inv.date : (inv.createdAt || "")).slice(0, 10);
      if (dStr && dStr >= cutoffIso) {
        return sum + (Number(inv.totalAmount) || 0);
      }
      return sum;
    }, 0);

    const purchaseTotal = (purchases || []).reduce((sum, p) => {
      if (p.status === "VOID") return sum;
      const dStr = (p.billDate || p.createdAt || "").slice(0, 10);
      if (dStr && dStr >= cutoffIso) {
        return sum + (Number(p.grandTotal) || 0);
      }
      return sum;
    }, 0);

    return {
      last30DaysSales: Math.round(saleTotal),
      last30DaysPurchases: Math.round(purchaseTotal),
    };
  }, [invoices, purchases]);

  // Derived Payment Receipts from Invoices
  const paymentList = useMemo(() => {
    const list: any[] = [];
    invoices.forEach((inv) => {
      if (inv.payments && Array.isArray(inv.payments) && inv.payments.length > 0) {
        inv.payments.forEach((p: any, idx: number) => {
          list.push({
            receiptNo: p.paymentId && p.paymentId.startsWith("RCP")
              ? p.paymentId
              : `RCP-2026-${inv.invoiceNo?.replace(/[^0-9]/g, "").slice(-4) || String(idx + 1).padStart(4, "0")}`,
            invoiceNo: inv.invoiceNo,
            date: p.date || inv.date || inv.createdAt?.slice(0, 10),
            ownerName: inv.ownerName || "Walk-in Client",
            petName: inv.petName || "General OTC",
            mode: p.mode || inv.paymentMode || "Cash",
            amount: p.amount || 0,
            trxRef: p.reference || p.trxRef || "—",
            recordedBy: p.recordedBy || inv.doctorName || "Billing Counter",
            status: "Cleared",
          });
        });
      } else if (inv.amountPaid > 0) {
        list.push({
          receiptNo: `RCP-2026-${inv.invoiceNo?.replace(/[^0-9]/g, "").slice(-4) || "0001"}`,
          invoiceNo: inv.invoiceNo,
          date: inv.date || inv.createdAt?.slice(0, 10),
          ownerName: inv.ownerName || "Walk-in Client",
          petName: inv.petName || "General OTC",
          mode: inv.paymentMode || "Cash",
          amount: inv.amountPaid,
          trxRef: inv.trxRef || "—",
          recordedBy: inv.doctorName || "Billing Counter",
          status: "Cleared",
        });
      }
    });
    return list;
  }, [invoices]);

  // Derived Credit Notes from Invoices
  const creditNotesList = useMemo(() => {
    const list: any[] = [];
    invoices.forEach((inv, idx) => {
      if (inv.status === "Cancelled" || inv.refundAmount || inv.creditNoteNo) {
        list.push({
          creditNoteNo: inv.creditNoteNo || `CRN-2026-${String(idx + 1).padStart(4, "0")}`,
          originalInvoiceNo: inv.invoiceNo,
          date: inv.date || inv.createdAt?.slice(0, 10),
          ownerName: inv.ownerName || "Walk-in Client",
          petName: inv.petName || "General OTC",
          amount: inv.refundAmount || inv.totalAmount || 0,
          reason: inv.cancelReason || "Billing Adjustment / Cancellation",
          status: "Adjusted",
        });
      }
    });
    return list;
  }, [invoices]);

  // Filtered Expenses for Register
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const d = e.expenseDate || e.createdAt?.slice(0, 10);
      if (dateRange.from && d && d < dateRange.from) return false;
      if (dateRange.to && d && d > dateRange.to) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          e.voucherNo?.toLowerCase().includes(q) ||
          e.categoryName?.toLowerCase().includes(q) ||
          e.paidTo?.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [expenses, dateRange, searchQuery]);

  // Cancels (voids) the bill rather than hard-deleting it, so linked payments are voided too.
  const handleDeletePurchase = async (pur: PurchaseBillRow) => {
    const ref = pur.internalRef || pur.billNumber;
    const reason = window.prompt(`Delete purchase bill ${ref}? Enter a reason:`);
    if (reason === null) return;
    if (reason.trim().length < 3) {
      toast.error("A reason of at least 3 characters is required");
      return;
    }
    try {
      await voidPurchaseBillFn({ data: { id: pur._id, reason: reason.trim() } });
      setPurchases((prev) => prev.filter((p) => p._id !== pur._id));
      toast.success(`Purchase bill ${ref} deleted`);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete purchase bill");
    }
  };

  // Filtered Purchases for Register
  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      const d = p.billDate || p.createdAt?.slice(0, 10);
      if (dateRange.from && d && d < dateRange.from) return false;
      if (dateRange.to && d && d > dateRange.to) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          p.internalRef?.toLowerCase().includes(q) ||
          p.billNumber?.toLowerCase().includes(q) ||
          p.supplierName?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [purchases, dateRange, searchQuery]);

  // Filtered Payments for Register
  const filteredPayments = useMemo(() => {
    return paymentList.filter((p) => {
      if (dateRange.from && p.date && p.date < dateRange.from) return false;
      if (dateRange.to && p.date && p.date > dateRange.to) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          p.receiptNo?.toLowerCase().includes(q) ||
          p.invoiceNo?.toLowerCase().includes(q) ||
          p.ownerName?.toLowerCase().includes(q) ||
          p.petName?.toLowerCase().includes(q) ||
          p.trxRef?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [paymentList, dateRange, searchQuery]);

  // Filtered Credit Notes for Register
  const filteredCreditNotes = useMemo(() => {
    return creditNotesList.filter((cn) => {
      if (dateRange.from && cn.date && cn.date < dateRange.from) return false;
      if (dateRange.to && cn.date && cn.date > dateRange.to) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          cn.creditNoteNo?.toLowerCase().includes(q) ||
          cn.originalInvoiceNo?.toLowerCase().includes(q) ||
          cn.ownerName?.toLowerCase().includes(q) ||
          cn.reason?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [creditNotesList, dateRange, searchQuery]);

  // Derived Client Directory from Invoices
  const clientList = useMemo(() => {
    const map = new Map<
      string,
      {
        ownerName: string;
        ownerPhone: string;
        pets: Set<string>;
        totalBilled: number;
        totalPaid: number;
        balanceDue: number;
        invoiceCount: number;
        lastInvoiceNo: string;
        lastDate: string;
      }
    >();

    (invoices || []).forEach((inv) => {
      const key = (inv.ownerPhone || inv.ownerName || "Walk-in").trim().toLowerCase();
      if (!key) return;
      const existing = map.get(key) || {
        ownerName: inv.ownerName || "Walk-in Client",
        ownerPhone: inv.ownerPhone || "—",
        pets: new Set<string>(),
        totalBilled: 0,
        totalPaid: 0,
        balanceDue: 0,
        invoiceCount: 0,
        lastInvoiceNo: inv.invoiceNo || "—",
        lastDate: inv.date || inv.createdAt?.slice(0, 10) || "",
      };
      if (inv.petName) existing.pets.add(inv.petName);
      existing.totalBilled += Number(inv.totalAmount) || 0;
      existing.totalPaid += Number(inv.amountPaid) || 0;
      existing.balanceDue += invBalance(inv);
      existing.invoiceCount += 1;
      if (inv.date && (!existing.lastDate || inv.date > existing.lastDate)) {
        existing.lastDate = inv.date;
        existing.lastInvoiceNo = inv.invoiceNo;
      }
      map.set(key, existing);
    });

    return Array.from(map.values()).map((c) => ({
      ...c,
      petsList: Array.from(c.pets).join(", "),
    }));
  }, [invoices]);

  // Real-time dynamic search results across the selected scope
  const dynamicSearchResults = useMemo(() => {
    const q = quickSearchQuery.trim().toLowerCase();

    if (searchScope === "Stock") {
      const all = medicines || [];
      if (!q) {
        return {
          isDefault: true,
          label: "Popular / In-Stock Clinic Items",
          items: all.slice(0, 5),
          totalCount: all.length,
        };
      }
      const matched = all.filter((m) => {
        return (
          m.name?.toLowerCase().includes(q) ||
          m.itemCode?.toLowerCase().includes(q) ||
          m.genericName?.toLowerCase().includes(q) ||
          m.brand?.toLowerCase().includes(q) ||
          m.category?.toLowerCase().includes(q) ||
          m.subGroup?.toLowerCase().includes(q)
        );
      });
      return {
        isDefault: false,
        label: `Found ${matched.length} Item${matched.length === 1 ? "" : "s"}`,
        items: matched.slice(0, 12),
        totalCount: matched.length,
      };
    }

    if (searchScope === "SerialNo") {
      const all = batches || [];
      if (!q) {
        return {
          isDefault: true,
          label: "Active Stock Batches / Serials",
          items: all.slice(0, 5),
          totalCount: all.length,
        };
      }
      const matched = all.filter((b) => {
        return (
          b.batchNumber?.toLowerCase().includes(q) ||
          b.itemCode?.toLowerCase().includes(q) ||
          b.itemName?.toLowerCase().includes(q)
        );
      });
      return {
        isDefault: false,
        label: `Found ${matched.length} Batch${matched.length === 1 ? "" : "es"}`,
        items: matched.slice(0, 12),
        totalCount: matched.length,
      };
    }

    if (searchScope === "Invoice") {
      const all = invoices || [];
      if (!q) {
        return {
          isDefault: true,
          label: "Recent Clinic Invoices",
          items: all.slice(0, 5),
          totalCount: all.length,
        };
      }
      const matched = all.filter((inv) => {
        return (
          inv.invoiceNo?.toLowerCase().includes(q) ||
          inv.ownerName?.toLowerCase().includes(q) ||
          inv.ownerPhone?.toLowerCase().includes(q) ||
          inv.petName?.toLowerCase().includes(q) ||
          inv.doctorName?.toLowerCase().includes(q)
        );
      });
      return {
        isDefault: false,
        label: `Found ${matched.length} Invoice${matched.length === 1 ? "" : "s"}`,
        items: matched.slice(0, 12),
        totalCount: matched.length,
      };
    }

    if (searchScope === "Client") {
      const all = clientList;
      if (!q) {
        return {
          isDefault: true,
          label: "Recent Registered Clients",
          items: all.slice(0, 5),
          totalCount: all.length,
        };
      }
      const matched = all.filter((c) => {
        return (
          c.ownerName.toLowerCase().includes(q) ||
          c.ownerPhone.includes(q) ||
          c.petsList.toLowerCase().includes(q)
        );
      });
      return {
        isDefault: false,
        label: `Found ${matched.length} Client${matched.length === 1 ? "" : "s"}`,
        items: matched.slice(0, 12),
        totalCount: matched.length,
      };
    }

    return { isDefault: true, label: "", items: [], totalCount: 0 };
  }, [quickSearchQuery, searchScope, medicines, batches, invoices, clientList]);

  // Search Execute
  const handleExecuteQuickSearch = () => {
    if (!quickSearchQuery.trim()) {
      setSearchFeedback(null);
      return;
    }
    const q = quickSearchQuery.toLowerCase();
    if (searchScope === "Invoice") {
      const match = invoices.find((i) => i.invoiceNo?.toLowerCase().includes(q));
      if (match) {
        onViewInvoice(match);
        setSearchFeedback(`Found & opened invoice ${match.invoiceNo}`);
      } else {
        setSearchFeedback(`No exact invoice number found for "${quickSearchQuery}"`);
      }
    } else if (searchScope === "Client") {
      const match = invoices.find(
        (i) => i.ownerName?.toLowerCase().includes(q) || i.ownerPhone?.includes(q)
      );
      if (match) {
        setSearchQuery(match.ownerName || "");
        document.getElementById("billing-invoice-register")?.scrollIntoView({ behavior: "smooth" });
        setSearchFeedback(`Filtered invoices register for ${match.ownerName}`);
      } else {
        setSearchFeedback(`No client found for "${quickSearchQuery}"`);
      }
    } else if (searchScope === "Stock") {
      const match = (medicines || []).find(
        (m) => m.name.toLowerCase().includes(q) || m.itemCode.toLowerCase().includes(q)
      );
      if (match) {
        setSearchFeedback(`Showing details for ${match.name} (${match.currentStock ?? 0} in stock)`);
      } else {
        setSearchFeedback(`No item found matching "${quickSearchQuery}"`);
      }
    }
  };

  // Filtered invoices for table
  const tableInvoices = useMemo(() => {
    return filteredInvoices.filter((inv) => {
      if (statusFilter !== "all") {
        if (statusFilter === "Paid" && inv.status !== "Paid") return false;
        if (statusFilter === "Unpaid" && inv.status !== "Unpaid") return false;
        if (statusFilter === "Partially Paid" && inv.status !== "Partially Paid") return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          inv.invoiceNo?.toLowerCase().includes(q) ||
          inv.ownerName?.toLowerCase().includes(q) ||
          inv.ownerPhone?.toLowerCase().includes(q) ||
          inv.petName?.toLowerCase().includes(q) ||
          inv.doctorName?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [filteredInvoices, statusFilter, searchQuery]);

  const dueInvoices = useMemo(() => {
    return filteredInvoices.filter((i) => invBalance(i) > 0);
  }, [filteredInvoices]);

  const receivedInvoices = useMemo(() => {
    return filteredInvoices.filter((i) => (i.amountPaid || 0) > 0);
  }, [filteredInvoices]);

  const chequeInvoices = useMemo(() => {
    return filteredInvoices.filter((i) => i.paymentMode === "Cheque" || i.paymentMode === "Demand Draft");
  }, [filteredInvoices]);

  // Export CSV based on active register tab
  const handleExportCSV = () => {
    let headers = "";
    let rows = "";
    if (registerTab === "expenses") {
      headers = "VoucherNo,Date,Category,PaidTo,Mode,Amount,Status\n";
      rows = filteredExpenses.map((e) =>
        `"${e.voucherNo}","${e.expenseDate}","${e.categoryName}","${e.paidTo || ""}","${e.paymentLines?.[0]?.mode || "CASH"}",${e.totalAmount},"${e.status}"`
      ).join("\n");
    } else if (registerTab === "purchases") {
      headers = "PurchaseRef,BillNumber,Date,Supplier,TotalAmount,PaidAmount,Status\n";
      rows = filteredPurchases.map((p) =>
        `"${p.internalRef}","${p.billNumber}","${p.billDate}","${p.supplierName}",${p.grandTotal},${p.amountPaid},"${p.status}"`
      ).join("\n");
    } else if (registerTab === "payments") {
      headers = "ReceiptNo,InvoiceNo,Date,ClientName,PetName,Mode,Amount,TrxRef,Status\n";
      rows = filteredPayments.map((p) =>
        `"${p.receiptNo}","${p.invoiceNo}","${p.date}","${p.ownerName}","${p.petName}","${p.mode}",${p.amount},"${p.trxRef}","${p.status}"`
      ).join("\n");
    } else {
      headers = "InvoiceNo,Date,ClientName,Phone,PetName,Doctor,TotalAmount,PaidAmount,BalanceDue,Status\n";
      rows = tableInvoices.map((i) =>
        `"${i.invoiceNo}","${i.date || ""}","${i.ownerName || ""}","${i.ownerPhone || ""}","${i.petName || ""}","${i.doctorName || ""}",${i.totalAmount || 0},${i.amountPaid || 0},${invBalance(i)},"${i.status || ""}"`
      ).join("\n");
    }

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${registerTab.toUpperCase()}_Register_${dateRange.from || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 animate-in fade-in pb-12">
      {/* ── TOP HEADER STRIP (Glassmorphism & Utilities) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3.5 rounded-2xl border border-border bg-card/80 p-4 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-sm">
            <Receipt className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black tracking-tight text-foreground">
                Billing Desk — Real Care Small Animal Clinic
              </h1>
              <button
                type="button"
                onClick={() => setMasked(!masked)}
                title={masked ? "Show figures" : "Hide figures for client counter privacy"}
                suppressHydrationWarning
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                {masked ? <EyeOff className="size-4 text-rose-500" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Counter POS, GST billing, quick client receipts &amp; financial registers
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter value={dateRange} onChange={setDateRange} />

          {/* GST Calculator Popover (Plan §7) */}
          <GstCalculatorPopover />

          <Button
            variant="outline"
            size="icon"
            onClick={onRefresh}
            title="Refresh billing data"
            className="size-8 text-muted-foreground hover:text-foreground bg-background/50"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onAddCustomer}
            className="gap-1.5 text-xs font-semibold bg-background/60 hover:bg-background border-border"
          >
            <UserPlus className="size-3.5 text-blue-600" />
            <span>+ Client</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onAddSupplier}
            className="gap-1.5 text-xs font-semibold bg-background/60 hover:bg-background border-border"
          >
            <Building2 className="size-3.5 text-blue-600" />
            <span>+ Supplier</span>
          </Button>

          <Button
            onClick={onNewInvoice}
            className="gap-1.5 text-xs font-bold shadow-md bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="size-3.5 stroke-[3]" /> New Invoice (F2)
          </Button>
        </div>
      </div>

      {/* ── MAIN DASHBOARD: 2 COLUMNS (Faithful Layout to Image 1 & Image 5) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ════════ LEFT COLUMN (5 cols on lg): Quick Info, 6 Buttons Grid, 30-Day Donut ════════ */}
        <div className="lg:col-span-5 space-y-4">
          {/* 1. QUICK INFO CARD (Matches Image 1 & 5) */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#005bb5] via-[#004f9f] to-[#003875] text-white p-4 shadow-md border border-blue-600/30">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-100">
                QUICK INFO
              </span>
              <span className="rounded-md bg-[#ffe600] px-2.5 py-0.5 text-[11px] font-black text-black shadow-xs tracking-wider">
                TODAY
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-left pt-1">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-200">
                  TOTAL SALE
                </div>
                <div className="text-base sm:text-lg font-black font-mono mt-0.5 tracking-tight">
                  {fmtMoney(totalSale)}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-200">
                  AMOUNT RECEIVED
                </div>
                <div className="text-base sm:text-lg font-black font-mono mt-0.5 tracking-tight text-emerald-300">
                  {fmtMoney(amountReceived)}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-200">
                  AMOUNT DUE
                </div>
                <div className="text-base sm:text-lg font-black font-mono mt-0.5 tracking-tight text-amber-300">
                  {fmtMoney(amountDue)}
                </div>
              </div>
            </div>
          </div>

          {/* 2. COLLECTIONS BY PAYMENT MODE & REAL-TIME RECOVERY GRAPH */}
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/80 bg-muted/30 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <div className="flex size-6 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600">
                  <Wallet className="size-3.5" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Collections by Mode
                  </span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                {totalSale > 0 ? `${Math.round((amountReceived / totalSale) * 100)}% Settled` : "100% Balanced"}
              </span>
            </div>

            <div className="p-4 space-y-3.5">
              {paymentModeData.total > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  {/* Donut Chart (5 cols) */}
                  <div className="sm:col-span-5 relative h-36 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={paymentModeData.activeSlices}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={36}
                          outerRadius={55}
                          paddingAngle={3}
                          strokeWidth={2}
                          stroke="hsl(var(--card))"
                        >
                          {paymentModeData.activeSlices.map((entry, idx) => (
                            <Cell key={`slice-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(val: any) => fmtMoney(Number(val))}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            borderColor: "hsl(var(--border))",
                            borderRadius: "0.5rem",
                            fontSize: "11px",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground">Received</span>
                      <span className="text-xs font-bold font-mono text-foreground">{fmtMoney(paymentModeData.total)}</span>
                    </div>
                  </div>

                  {/* Channel Breakdown Cards (7 cols) */}
                  <div className="sm:col-span-7 grid grid-cols-2 gap-2">
                    {paymentModeData.breakdown.map((item) => {
                      const pct = paymentModeData.total > 0 ? Math.round((item.value / paymentModeData.total) * 100) : 0;
                      return (
                        <div
                          key={item.name}
                          className="rounded-xl border border-border/60 bg-muted/20 p-2 text-left transition-all hover:bg-muted/40"
                        >
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="text-[10px] font-semibold truncate">{item.name}</span>
                          </div>
                          <div className="mt-1 font-mono text-xs font-bold text-foreground truncate">
                            {fmtMoney(item.value)}
                          </div>
                          <div className="text-[9px] text-muted-foreground font-mono">{pct}% share</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Sleek Empty State with Quick Guidance */
                <div className="flex flex-col items-center justify-center py-4 px-2 text-center rounded-xl bg-muted/20 border border-dashed border-border/80">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
                    <CreditCard className="size-5" />
                  </div>
                  <p className="text-xs font-bold text-foreground">No Collection Split in Date Range</p>
                  <p className="text-[11px] text-muted-foreground max-w-[260px] mt-0.5">
                    Counter bills and receipts recorded via F2 will automatically populate payment channels here.
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-[10px] font-medium text-primary">
                    <span>Use Right Sidebar</span>
                    <span>•</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono font-bold">F2 New Invoice</kbd>
                  </div>
                </div>
              )}

              {/* Settlement Progress Bar */}
              <div className="pt-1 border-t border-border/50">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Recovery Ratio (Inflow vs Due)</span>
                  <span className="font-mono font-bold text-foreground">
                    {totalSale > 0 ? `${Math.round((amountReceived / totalSale) * 100)}%` : "100%"}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                    style={{
                      width: `${totalSale > 0 ? Math.min(100, Math.round((amountReceived / totalSale) * 100)) : 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3. DISTRIBUTION IN LAST 30 DAYS (3D Isometric Tilted Donut Chart matching Screenshot) */}
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="bg-[#06213d] text-white px-4 py-2 text-xs font-bold uppercase tracking-wider">
              DISTRIBUTION IN LAST 30 DAYS
            </div>
            <div className="p-4 flex flex-col items-center justify-center relative min-h-[220px]">
              {/* Top-Right Legend matching Image 2 */}
              <div className="w-full flex justify-end gap-3.5 pb-1 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="size-3.5 rounded-xs bg-[#2563eb] inline-block shadow-2xs" />
                  <span className="text-foreground">Sale</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-3.5 rounded-xs bg-[#f59e0b] inline-block shadow-2xs" />
                  <span className="text-foreground">Purchase</span>
                </div>
              </div>

              {/* 3D Tilted Donut */}
              <Distribution3DChart
                saleAmount={last30DaysSales}
                purchaseAmount={last30DaysPurchases}
                className="py-1"
              />
            </div>
          </div>
        </div>

        {/* ════════ RIGHT COLUMN (7 cols on lg): 4 Tabs, 15-Day Bars, SEARCH Card ════════ */}
        <div className="lg:col-span-7 space-y-4">
          {/* 1. 4 ACTIVITY TABS & 15-DAY BAR CHART (Matches Image 1 & 5) */}
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            {/* Tabs Header */}
            <div className="flex flex-wrap items-center border-b border-border bg-muted/30 px-3 pt-2 gap-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveActivityTab("recentSales")}
                className={cn(
                  "px-3.5 py-2 rounded-t-lg font-bold transition-all border-b-2",
                  activeActivityTab === "recentSales"
                    ? "border-primary text-primary bg-card"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Recent Sales
              </button>

              <button
                type="button"
                onClick={() => setActiveActivityTab("clientDue")}
                className={cn(
                  "px-3.5 py-2 rounded-t-lg font-bold transition-all border-b-2 flex items-center gap-1.5",
                  activeActivityTab === "clientDue"
                    ? "border-primary text-primary bg-card"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <span>Client Amount Due</span>
                {dueInvoices.length > 0 && (
                  <span className="rounded-full bg-amber-500/20 text-amber-600 px-1.5 py-0.2 text-[10px] font-mono">
                    {dueInvoices.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveActivityTab("amountReceived")}
                className={cn(
                  "px-3.5 py-2 rounded-t-lg font-bold transition-all border-b-2 flex items-center gap-1.5",
                  activeActivityTab === "amountReceived"
                    ? "border-primary text-primary bg-card"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <span>Amount Received</span>
                <span className="rounded-full bg-emerald-500/20 text-emerald-600 px-1.5 py-0.2 text-[10px] font-mono">
                  {receivedInvoices.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveActivityTab("chequeAlert")}
                className={cn(
                  "px-3.5 py-2 rounded-t-lg font-bold transition-all border-b-2 flex items-center gap-1.5",
                  activeActivityTab === "chequeAlert"
                    ? "border-primary text-primary bg-card"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <span>Client Cash / Cheque Alert</span>
                {chequeInvoices.length > 0 && (
                  <span className="rounded-full bg-sky-500/20 text-sky-600 px-1.5 py-0.2 text-[10px] font-mono">
                    {chequeInvoices.length}
                  </span>
                )}
              </button>
            </div>

            {/* Tab Body */}
            <div className="p-4">
              {activeActivityTab === "recentSales" && (
                <div className="space-y-1">
                  <div className="flex justify-end pr-2 text-[11px] font-mono font-semibold text-muted-foreground">
                    1k = 1000
                  </div>
                  <div className="w-full h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={salesChartData} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                        <XAxis
                          dataKey="day"
                          tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                          tickFormatter={(v) => `${v / 1000}k`}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          cursor={{ fill: "rgba(37, 99, 235, 0.08)", radius: 4 }}
                          formatter={(v: any) => [`₹${Number(v).toLocaleString("en-IN")}`, "Sales"]}
                          contentStyle={{
                            backgroundColor: "var(--color-card)",
                            borderColor: "var(--color-border)",
                            borderRadius: "0.5rem",
                            fontSize: "12px",
                          }}
                        />
                        <Bar
                          dataKey="amount"
                          fill="#1976d2"
                          radius={[4, 4, 0, 0]}
                          label={{
                            position: "top",
                            formatter: (v: any) => (v > 0 ? `${(v / 1000).toFixed(1)} k` : ""),
                            fontSize: 10,
                            fill: "var(--color-foreground)",
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {activeActivityTab === "clientDue" && (
                <div className="max-h-56 overflow-y-auto divide-y divide-border">
                  {dueInvoices.length === 0 ? (
                    <div className="py-12 text-center text-xs text-muted-foreground">
                      No outstanding client dues for the selected period!
                    </div>
                  ) : (
                    dueInvoices.map((inv) => (
                      <div
                        key={inv.invoiceNo}
                        className="flex items-center justify-between py-2 px-1 hover:bg-muted/20 transition-colors"
                      >
                        <div>
                          <div className="text-xs font-bold text-foreground">{inv.ownerName} ({inv.petName})</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{inv.invoiceNo} • {inv.ownerPhone}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono font-bold text-rose-600">
                            ₹{invBalance(inv).toLocaleString("en-IN")}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onPaymentIn(inv.invoiceNo)}
                            className="h-6 px-2 text-[11px] text-emerald-600 border-emerald-500/30"
                          >
                            Pay
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeActivityTab === "amountReceived" && (
                <div className="max-h-56 overflow-y-auto divide-y divide-border">
                  {receivedInvoices.length === 0 ? (
                    <div className="py-12 text-center text-xs text-muted-foreground">
                      No receipts recorded for this period.
                    </div>
                  ) : (
                    receivedInvoices.map((inv) => (
                      <div
                        key={inv.invoiceNo}
                        className="flex items-center justify-between py-2 px-1 hover:bg-muted/20 transition-colors"
                      >
                        <div>
                          <div className="text-xs font-bold text-foreground">{inv.ownerName} ({inv.petName})</div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {inv.invoiceNo} • {inv.paymentMode || "Cash"}
                          </div>
                        </div>
                        <span className="text-xs font-mono font-bold text-emerald-600">
                          ₹{(inv.amountPaid || 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeActivityTab === "chequeAlert" && (
                <div className="max-h-56 overflow-y-auto divide-y divide-border">
                  {chequeInvoices.length === 0 ? (
                    <div className="py-12 text-center text-xs text-muted-foreground">
                      No pending cheque or bank clearance alerts.
                    </div>
                  ) : (
                    chequeInvoices.map((inv) => (
                      <div
                        key={inv.invoiceNo}
                        className="flex items-center justify-between py-2 px-1 hover:bg-muted/20 transition-colors"
                      >
                        <div>
                          <div className="text-xs font-bold text-foreground">{inv.ownerName} ({inv.petName})</div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {inv.invoiceNo} • Cheque Ref: {inv.trxRef || "Pending Clearance"}
                          </div>
                        </div>
                        <span className="text-xs font-mono font-bold text-foreground">
                          ₹{(inv.totalAmount || 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 2. SEARCH CARD (Matches Image 1 & 5 Search Card, now 100% Dynamic & In-Place) */}
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
            {/* Header with Live Indicator & Active Scope */}
            <div className="bg-[#0a192f] text-white px-4 py-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Search className="size-3.5 text-emerald-400" />
                <span className="font-bold uppercase tracking-wider">SEARCH</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-white/80 uppercase font-semibold">
                  {searchScope === "SerialNo" ? "Serial / Batch" : searchScope}
                </span>
                <span className="text-white/40">•</span>
                <span className="text-emerald-400 font-bold">
                  {dynamicSearchResults.totalCount}{" "}
                  {searchScope === "Stock"
                    ? "items"
                    : searchScope === "Invoice"
                    ? "invoices"
                    : searchScope === "Client"
                    ? "clients"
                    : "batches"}
                </span>
              </div>
            </div>

            <div className="p-4 space-y-3.5">
              {/* Radio Buttons: Stock, Serial No, Invoice, Client */}
              <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
                {(
                  [
                    { key: "Stock", label: "Stock", icon: Package },
                    { key: "SerialNo", label: "Serial No", icon: Tag },
                    { key: "Invoice", label: "Invoice", icon: Receipt },
                    { key: "Client", label: "Client", icon: User },
                  ] as const
                ).map(({ key, label, icon: Icon }) => {
                  const isSelected = searchScope === key;
                  return (
                    <label
                      key={key}
                      onClick={() => setSearchScope(key as any)}
                      className={cn(
                        "flex items-center gap-1.5 cursor-pointer px-2.5 py-1 rounded-lg transition-all select-none border",
                        isSelected
                          ? "bg-primary/10 text-primary border-primary/30 font-bold shadow-xs"
                          : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <input
                        type="radio"
                        name="searchScope"
                        checked={isSelected}
                        onChange={() => setSearchScope(key as any)}
                        className="size-3.5 text-primary accent-primary cursor-pointer"
                      />
                      <Icon className="size-3.5" />
                      <span>{label}</span>
                    </label>
                  );
                })}
              </div>

              {/* Search input with integrated clear (X) and green search button */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={quickSearchQuery}
                    onChange={(e) => setQuickSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleExecuteQuickSearch()}
                    placeholder={
                      searchScope === "Stock"
                        ? "Search item name, code (e.g. M-0001), brand..."
                        : searchScope === "Invoice"
                        ? "Search invoice # (e.g. INV-905), client, pet..."
                        : searchScope === "Client"
                        ? "Search pet parent name, phone, pet..."
                        : "Search batch number or serial code..."
                    }
                    className="h-9.5 pl-9 pr-8 text-xs bg-background rounded-xl border-border/80 focus-visible:ring-primary shadow-xs"
                  />
                  {quickSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuickSearchQuery("");
                        setSearchFeedback(null);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                      title="Clear search"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>

                <Button
                  type="button"
                  onClick={handleExecuteQuickSearch}
                  className="h-9.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-transform active:scale-95 flex items-center gap-1.5"
                  title="Search (Enter)"
                >
                  <Search className="size-4" />
                  <span className="hidden sm:inline text-xs font-semibold">Search</span>
                </Button>
              </div>

              {/* Feedback toast line if present */}
              {searchFeedback && (
                <div className="text-[11px] text-primary bg-primary/10 border border-primary/20 rounded-lg px-2.5 py-1 font-medium animate-in fade-in flex items-center justify-between">
                  <span>{searchFeedback}</span>
                  <button
                    type="button"
                    onClick={() => setSearchFeedback(null)}
                    className="text-primary hover:underline text-[10px]"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* ── DYNAMIC LIVE RESULTS CONTAINER ("able to see here very easily") ── */}
              <div className="space-y-2 pt-1 border-t border-border/60">
                {/* Result header line */}
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                    {dynamicSearchResults.isDefault ? (
                      <>
                        <Sparkles className="size-3 text-amber-500" />
                        <span>{dynamicSearchResults.label}</span>
                      </>
                    ) : (
                      <>
                        <span className="size-2 rounded-full bg-emerald-500" />
                        <span className="font-semibold text-foreground">{dynamicSearchResults.label}</span>
                      </>
                    )}
                  </div>
                  {quickSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setQuickSearchQuery("")}
                      className="text-[10px] text-primary hover:underline"
                    >
                      Reset View
                    </button>
                  )}
                </div>

                {/* Result Items List */}
                <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin rounded-xl border border-border/70 bg-muted/20 p-2">
                  {dynamicSearchResults.items.length === 0 ? (
                    <div className="py-8 text-center space-y-1.5">
                      <div className="mx-auto flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Search className="size-4" />
                      </div>
                      <p className="text-xs font-semibold text-foreground">
                        No {searchScope.toLowerCase()} found matching "{quickSearchQuery}"
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Try switching the search tab above or clearing your keywords.
                      </p>
                    </div>
                  ) : (
                    dynamicSearchResults.items.map((item: any, idx: number) => {
                      if (searchScope === "Stock") {
                        const stock = Number(item.currentStock ?? 0);
                        const isLow = stock > 0 && stock <= (item.reorderLevel || 5);
                        const isOut = stock <= 0;
                        return (
                          <div
                            key={item.id || item.itemCode || idx}
                            className="group flex items-center justify-between gap-3 p-2 rounded-lg bg-card/70 hover:bg-card border border-border/50 hover:border-primary/40 transition-all shadow-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-foreground truncate">{item.name}</span>
                                <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border/60">
                                  {item.itemCode}
                                </span>
                                {item.category && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-medium">
                                    {item.category}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                                {item.brand && `Brand: ${item.brand} • `}
                                {item.genericName && `Generic: ${item.genericName} • `}
                                UoM: {item.unit || "Unit"}
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0">
                              {/* Stock Pill */}
                              {isOut ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                                  Out of Stock
                                </span>
                              ) : isLow ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                  Low: {stock}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                  {stock} in stock
                                </span>
                              )}

                              {/* Price */}
                              <span className="font-mono text-xs font-bold text-foreground">
                                ₹{(item.defaultSalePrice || item.mrp || 0).toLocaleString("en-IN")}
                              </span>

                              {/* Action: Quick Bill */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onNewInvoice()}
                                className="h-6 px-2 text-[10px] font-semibold text-primary border-primary/30 hover:bg-primary hover:text-primary-foreground transition-colors"
                              >
                                + Bill
                              </Button>
                            </div>
                          </div>
                        );
                      }

                      if (searchScope === "SerialNo") {
                        return (
                          <div
                            key={item.batchNumber || idx}
                            className="group flex items-center justify-between gap-3 p-2 rounded-lg bg-card/70 hover:bg-card border border-border/50 hover:border-primary/40 transition-all shadow-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold text-primary">
                                  {item.batchNumber || "SN-UNKNOWN"}
                                </span>
                                <span className="text-xs font-medium text-foreground truncate">
                                  {item.itemName || item.itemCode}
                                </span>
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                Exp: {item.expiryDate ? item.expiryDate.slice(0, 10) : "N/A"} • Item Code: {item.itemCode || "—"}
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-foreground border border-border">
                                {item.quantity ?? 0} units
                              </span>
                              <span className="font-mono text-xs font-bold text-foreground">
                                ₹{(item.salePrice || item.mrp || 0).toLocaleString("en-IN")}
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onNewInvoice()}
                                className="h-6 px-2 text-[10px] font-semibold text-primary border-primary/30 hover:bg-primary hover:text-primary-foreground transition-colors"
                              >
                                + Bill
                              </Button>
                            </div>
                          </div>
                        );
                      }

                      if (searchScope === "Invoice") {
                        const due = invBalance(item);
                        return (
                          <div
                            key={item.invoiceNo || idx}
                            className="group flex items-center justify-between gap-3 p-2 rounded-lg bg-card/70 hover:bg-card border border-border/50 hover:border-primary/40 transition-all shadow-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold text-primary">
                                  {item.invoiceNo}
                                </span>
                                <span className="text-xs font-semibold text-foreground truncate">
                                  {item.ownerName} ({item.petName || "General"})
                                </span>
                                <span
                                  className={cn(
                                    "text-[9px] font-bold px-1.5 py-0.2 rounded-full",
                                    item.status === "Paid"
                                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                      : item.status === "Partially Paid"
                                      ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                                      : "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                                  )}
                                >
                                  {item.status || (due === 0 ? "Paid" : "Unpaid")}
                                </span>
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                Date: {item.date || item.createdAt?.slice(0, 10)} • Phone: {item.ownerPhone || "—"}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <div className="text-right">
                                <div className="font-mono text-xs font-bold text-foreground">
                                  ₹{(item.totalAmount || 0).toLocaleString("en-IN")}
                                </div>
                                {due > 0 && (
                                  <div className="font-mono text-[10px] font-bold text-rose-600">
                                    Due: ₹{due.toLocaleString("en-IN")}
                                  </div>
                                )}
                              </div>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onViewInvoice(item)}
                                className="h-6 px-2 text-[10px] font-semibold text-foreground hover:text-primary hover:border-primary/40"
                                title="View Bill"
                              >
                                <Eye className="size-3 mr-1" />
                                View
                              </Button>

                              {due > 0 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => onPaymentIn(item.invoiceNo)}
                                  className="h-6 px-2 text-[10px] font-semibold text-emerald-600 border-emerald-500/30 hover:bg-emerald-600 hover:text-white"
                                  title="Collect Payment"
                                >
                                  Pay
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      }

                      if (searchScope === "Client") {
                        return (
                          <div
                            key={item.ownerPhone || item.ownerName || idx}
                            className="group flex items-center justify-between gap-3 p-2 rounded-lg bg-card/70 hover:bg-card border border-border/50 hover:border-primary/40 transition-all shadow-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-foreground">{item.ownerName}</span>
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  {item.ownerPhone}
                                </span>
                                {item.balanceDue > 0 ? (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20">
                                    Due: ₹{item.balanceDue.toLocaleString("en-IN")}
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                    Clear
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                Pets: {item.petsList || "Walk-in OTC"} • {item.invoiceCount} Bills (₹{item.totalBilled.toLocaleString("en-IN")})
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSearchQuery(item.ownerName);
                                  document.getElementById("billing-invoice-register")?.scrollIntoView({ behavior: "smooth" });
                                  toast.info(`Filtered invoice register for ${item.ownerName}`);
                                }}
                                className="h-6 px-2 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
                              >
                                History
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onNewInvoice()}
                                className="h-6 px-2 text-[10px] font-semibold text-primary border-primary/30 hover:bg-primary hover:text-primary-foreground"
                              >
                                + Bill
                              </Button>
                            </div>
                          </div>
                        );
                      }

                      return null;
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── FOOTER STATUS BAR (Matches Image 1 & 5 Bottom Icons & Clock) ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-muted/30 px-4 py-2 text-xs">
        {/* Left Icons: Web, Fingerprint, Shield, DB, Sync, @, Mail, Cloud, Toggle */}
        <div className="flex items-center gap-3 text-muted-foreground">
          <span title="Web Server: Online"><Globe className="size-4 text-emerald-600" /></span>
          <span title="Biometrics / Auth: Enabled"><Fingerprint className="size-4" /></span>
          <span title="Security & SSL: Verified"><Shield className="size-4 text-emerald-600" /></span>
          <span title="MongoDB Atlas: Connected"><Database className="size-4 text-emerald-600" /></span>
          <span title="Auto-Sync: Active"><RefreshCw className="size-4 text-emerald-600" /></span>
          <span title="Messaging Queue: Ready"><AtSign className="size-4" /></span>
          <span title="Email Invoicing: Configured"><Mail className="size-4" /></span>
          <span title="Cloud Backup: Synced"><Cloud className="size-4" /></span>
          <span title="Till Active"><ToggleRight className="size-4 text-emerald-600" /></span>
        </div>

        {/* Right Info: Live System Clock & Version */}
        <div className="flex items-center gap-4 text-muted-foreground font-mono text-[11px]">
          <span className="text-primary font-bold">FY 2026-27 (Active)</span>
          <span>•</span>
          <span>{currentTime || "14:45:00"}</span>
          <span>•</span>
          <span>{currentDateString || "Wednesday, September 16, 2026"}</span>
        </div>
      </div>

      {/* ── BLOCK ④: FULL DOCUMENTS REGISTER (Plan §5.6) ── */}
      <div id="billing-documents-register" className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Register Tabs: Invoices, Quotations, Credit Notes, Payments, Purchases, Expenses */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setRegisterTab("invoices")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                registerTab === "invoices"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-card text-muted-foreground hover:bg-muted border border-border"
              )}
            >
              <Receipt className="size-3.5" />
              <span>Invoices</span>
              <span className="rounded-full px-1.5 py-0.2 text-[10px] font-mono bg-white/20">
                {tableInvoices.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setRegisterTab("quotations")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                registerTab === "quotations"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-card text-muted-foreground hover:bg-muted border border-border"
              )}
            >
              <FileText className="size-3.5" />
              <span>Quotations</span>
              <span className="rounded-full px-1.5 py-0.2 text-[10px] font-mono bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                {quotations.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setRegisterTab("creditNotes")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                registerTab === "creditNotes"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "bg-card text-muted-foreground hover:bg-muted border border-border"
              )}
            >
              <Receipt className="size-3.5" />
              <span>Credit Notes</span>
              <span className="rounded-full px-1.5 py-0.2 text-[10px] font-mono bg-purple-500/20 text-purple-700 dark:text-purple-300">
                {filteredCreditNotes.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setRegisterTab("payments")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                registerTab === "payments"
                  ? "bg-teal-600 text-white shadow-xs"
                  : "bg-card text-muted-foreground hover:bg-muted border border-border"
              )}
            >
              <CreditCard className="size-3.5" />
              <span>Payments</span>
              <span className="rounded-full px-1.5 py-0.2 text-[10px] font-mono bg-teal-500/20 text-teal-700 dark:text-teal-300">
                {filteredPayments.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setRegisterTab("purchases")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                registerTab === "purchases"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "bg-card text-muted-foreground hover:bg-muted border border-border"
              )}
            >
              <ShoppingBag className="size-3.5" />
              <span>Purchases</span>
              <span className="rounded-full px-1.5 py-0.2 text-[10px] font-mono bg-sky-500/20 text-sky-700 dark:text-sky-300">
                {filteredPurchases.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setRegisterTab("expenses")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                registerTab === "expenses"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-card text-muted-foreground hover:bg-muted border border-border"
              )}
            >
              <Wallet className="size-3.5" />
              <span>Expenses</span>
              <span className="rounded-full px-1.5 py-0.2 text-[10px] font-mono bg-amber-500/20 text-amber-700 dark:text-amber-300">
                {filteredExpenses.length}
              </span>
            </button>
          </div>

          {/* Export CSV & PDF Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Download className="size-3.5" />
              <span>Export CSV</span>
            </Button>
          </div>
        </div>

        {/* ═══ VIEW COMPONENT BASED ON SELECTED REGISTER TAB ═══ */}
        {registerTab === "quotations" ? (
          <QuotationsRegisterView
            onNewQuotation={onNewQuotation}
            onConvertToInvoice={onConvertToInvoice}
          />
        ) : registerTab === "expenses" ? (
          /* ═══ 1. EXPENSES REGISTER TABLE ═══ */
          <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
            <div className="p-3.5 border-b border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3">
              <div className="relative min-w-[260px] flex-1">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search expense voucher #, category, paid to, notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs bg-card"
                />
              </div>
              <Button
                size="sm"
                onClick={onAddExpense}
                className="h-8 text-xs font-bold bg-[#0066cc] hover:bg-[#0055b3] text-white gap-1.5"
              >
                <Plus className="size-3.5" />
                <span>+ Add Expense</span>
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Expense Voucher #</th>
                    <th className="px-4 py-3">Category &amp; Nature</th>
                    <th className="px-4 py-3">Paid To</th>
                    <th className="px-4 py-3">Payment Mode</th>
                    <th className="px-4 py-3 text-right">Total Amount (₹)</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground">
                        <Wallet className="size-8 mx-auto text-muted-foreground/40 mb-2" />
                        <p className="font-semibold text-foreground">No expenses recorded</p>
                        <p className="text-xs">No clinic expense vouchers matched your filters.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((exp) => (
                      <tr key={exp._id} className="transition-colors hover:bg-muted/30">
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {formatDisplayDate(exp.expenseDate)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                            <span className="px-1 py-0.2 rounded text-[9px] font-black bg-amber-600 text-white">EXP</span>
                            <span>{exp.voucherNo || `EXP-2026-${exp._id.slice(-4)}`}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground">{exp.categoryName}</div>
                          <span className="text-[10px] text-muted-foreground uppercase">{exp.categoryNature}</span>
                        </td>
                        <td className="px-4 py-3 text-foreground font-medium">
                          {exp.paidTo || "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-mono uppercase">
                          {exp.paymentLines?.[0]?.mode || "CASH"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                          ₹{exp.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <StatusPill value={exp.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : registerTab === "purchases" ? (
          /* ═══ 2. PURCHASES REGISTER TABLE ═══ */
          <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
            <div className="p-3.5 border-b border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3">
              <div className="relative min-w-[260px] flex-1">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search purchase bill #, supplier, invoice ref..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs bg-card"
                />
              </div>
              <Button
                size="sm"
                onClick={onAddPurchase}
                className="h-8 text-xs font-bold bg-[#0066cc] hover:bg-[#0055b3] text-white gap-1.5"
              >
                <Plus className="size-3.5" />
                <span>+ Add Purchase Bill</span>
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Purchase Bill #</th>
                    <th className="px-4 py-3">Supplier (Vendor)</th>
                    <th className="px-4 py-3">Vendor Bill No</th>
                    <th className="px-4 py-3 text-right">Total (₹)</th>
                    <th className="px-4 py-3 text-right">Paid (₹)</th>
                    <th className="px-4 py-3 text-right">Balance Due (₹)</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-muted-foreground">
                        <ShoppingBag className="size-8 mx-auto text-muted-foreground/40 mb-2" />
                        <p className="font-semibold text-foreground">No purchase bills recorded</p>
                        <p className="text-xs">No vendor invoices matched your filters.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredPurchases.map((pur) => {
                      const due = Math.max(0, pur.grandTotal - pur.amountPaid);
                      return (
                        <tr
                          key={pur._id}
                          onClick={() => handleOpenPurchaseBill(pur)}
                          className="transition-colors hover:bg-muted/40 cursor-pointer"
                        >
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {formatDisplayDate(pur.billDate)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800 hover:bg-sky-100 transition-colors">
                              <span className="px-1 py-0.2 rounded text-[9px] font-black bg-sky-600 text-white">PUR</span>
                              <span>{pur.internalRef || pur.billNumber || `PUR-${pur._id.slice(-4)}`}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">
                            {pur.supplierName}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground font-mono">
                            {pur.billNumber || "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-foreground whitespace-nowrap">
                            ₹{pur.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-600 whitespace-nowrap">
                            ₹{pur.amountPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className={cn(
                            "px-4 py-3 text-right font-mono font-bold whitespace-nowrap",
                            due > 0 ? "text-rose-600" : "text-muted-foreground"
                          )}>
                            ₹{due.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <StatusPill value={pur.status} />
                          </td>
                          <td
                            className="px-4 py-3 text-center whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-center gap-1">
                              {due > 0 && pur.status !== "PAID" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleMarkPurchaseBillPaid(pur._id)}
                                  className="h-6 px-2 text-[10px] font-bold text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 gap-1 shadow-2xs"
                                  title="Mark as Paid"
                                >
                                  <CreditCard className="size-3" />
                                  <span>Pay</span>
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenPurchaseBill(pur)}
                                className="h-7 px-2 text-xs text-sky-600 hover:text-sky-700 hover:bg-sky-50 dark:hover:bg-sky-950/50 gap-1 font-semibold"
                                title="View Purchase Bill"
                              >
                                <Eye className="size-3.5" />
                                <span>View</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenPurchaseBill(pur)}
                                className="h-7 w-7 p-0 text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800"
                                title="Download PDF / Print"
                              >
                                <Download className="size-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeletePurchaseBill(pur._id, pur.internalRef || pur.billNumber)}
                                className="h-7 w-7 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                                title="Delete Purchase Bill"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : registerTab === "payments" ? (
          /* ═══ 3. PAYMENTS IN (RECEIPTS) REGISTER TABLE ═══ */
          <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
            <div className="p-3.5 border-b border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3">
              <div className="relative min-w-[260px] flex-1">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search receipt #, invoice #, client, pet, trx ref..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs bg-card"
                />
              </div>
              <Button
                size="sm"
                onClick={() => onPaymentIn()}
                className="h-8 text-xs font-bold bg-[#0066cc] hover:bg-[#0055b3] text-white gap-1.5"
              >
                <Plus className="size-3.5" />
                <span>+ Record Payment In</span>
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Receipt / Trx #</th>
                    <th className="px-4 py-3">Settled Invoice #</th>
                    <th className="px-4 py-3">Client (Party)</th>
                    <th className="px-4 py-3">Patient / Pet</th>
                    <th className="px-4 py-3">Payment Mode</th>
                    <th className="px-4 py-3 text-right">Amount (₹)</th>
                    <th className="px-4 py-3">Trx / Cheque Ref</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-muted-foreground">
                        <CreditCard className="size-8 mx-auto text-muted-foreground/40 mb-2" />
                        <p className="font-semibold text-foreground">No payment receipts found</p>
                        <p className="text-xs">No client receipt records matched your filters.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((pay, idx) => (
                      <tr key={pay.receiptNo + idx} className="transition-colors hover:bg-muted/30">
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {formatDisplayDate(pay.date)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800">
                            <span className="px-1 py-0.2 rounded text-[9px] font-black bg-teal-600 text-white">RCP</span>
                            <span>{pay.receiptNo}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-xs text-blue-600 bg-blue-50 dark:bg-blue-950/40">
                            <span className="text-[9px] font-black bg-blue-600 text-white px-0.5 rounded">INV</span>
                            <span>{pay.invoiceNo}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-foreground">
                          {pay.ownerName}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {pay.petName}
                        </td>
                        <td className="px-4 py-3 font-mono font-medium text-teal-700 dark:text-teal-400 uppercase">
                          {pay.mode}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600 whitespace-nowrap">
                          ₹{pay.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-[11px]">
                          {pay.trxRef}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 rounded">
                            {pay.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : registerTab === "creditNotes" ? (
          /* ═══ 4. CREDIT NOTES REGISTER TABLE ═══ */
          <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
            <div className="p-3.5 border-b border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3">
              <div className="relative min-w-[260px] flex-1">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search credit note #, original invoice, client..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs bg-card"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Credit Note #</th>
                    <th className="px-4 py-3">Original Invoice #</th>
                    <th className="px-4 py-3">Client (Party)</th>
                    <th className="px-4 py-3">Patient / Pet</th>
                    <th className="px-4 py-3">Adjustment Reason</th>
                    <th className="px-4 py-3 text-right">Amount (₹)</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCreditNotes.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted-foreground">
                        <Receipt className="size-8 mx-auto text-muted-foreground/40 mb-2" />
                        <p className="font-semibold text-foreground">No credit notes found</p>
                        <p className="text-xs">No billing refunds or credit notes recorded.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredCreditNotes.map((cn) => (
                      <tr key={cn.creditNoteNo} className="transition-colors hover:bg-muted/30">
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {formatDisplayDate(cn.date)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800">
                            <span className="px-1 py-0.2 rounded text-[9px] font-black bg-purple-600 text-white">CRN</span>
                            <span>{cn.creditNoteNo}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-xs text-blue-600 bg-blue-50 dark:bg-blue-950/40">
                            <span className="text-[9px] font-black bg-blue-600 text-white px-0.5 rounded">INV</span>
                            <span>{cn.originalInvoiceNo}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-foreground">
                          {cn.ownerName}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {cn.petName}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {cn.reason}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-purple-600 whitespace-nowrap">
                          ₹{cn.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 rounded">
                            {cn.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ═══ 5. INVOICES REGISTER TABLE (DEFAULT) ═══ */
          <div
            id="billing-invoice-register"
            className={cn(
              "rounded-2xl border bg-card shadow-xs overflow-hidden transition-shadow duration-300",
              highlightRegister ? "ring-4 ring-primary/40 border-primary" : "border-border"
            )}
          >
            {/* Table Search & Status Filters */}
            <div className="p-3.5 border-b border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3">
              <div className="relative min-w-[260px] flex-1">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search invoice #, client name, pet, mobile, or doctor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs bg-card"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-36 text-xs bg-card">
                  <SelectValue placeholder="Status: All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                  <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                  <SelectItem value="Unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Invoices Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Invoice #</th>
                    <th className="px-4 py-3">Customer (Party)</th>
                    <th className="px-4 py-3">Patient / Pet</th>
                    <th className="px-4 py-3">Attending Staff</th>
                    <th className="px-4 py-3 text-right">Total (₹)</th>
                    <th className="px-4 py-3 text-right">Paid (₹)</th>
                    <th className="px-4 py-3 text-right">Due (₹)</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <RefreshCw className="size-5 animate-spin text-primary" />
                          <span>Loading invoice register...</span>
                        </div>
                      </td>
                    </tr>
                  ) : tableInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-muted-foreground">
                        <Receipt className="size-8 mx-auto text-muted-foreground/40 mb-2" />
                        <p className="font-semibold text-foreground">No invoices found</p>
                        <p className="text-xs">No records matched your date range and search filters.</p>
                      </td>
                    </tr>
                  ) : (
                    tableInvoices.map((inv) => {
                      const bal = invBalance(inv);
                      return (
                        <tr
                          key={inv.invoiceNo || inv._id}
                          onClick={() => onViewInvoice(inv)}
                          className="cursor-pointer transition-colors hover:bg-muted/30 group"
                        >
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {formatDisplayDate(inv.date || inv.createdAt?.slice(0, 10))}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
                              <span className="px-1 py-0.2 rounded text-[9px] font-black bg-blue-600 text-white">INV</span>
                              <span>{inv.invoiceNo}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">{inv.ownerName || "Walk-in Customer"}</div>
                            {inv.ownerPhone && (
                              <div className="text-[10px] text-muted-foreground font-mono">{inv.ownerPhone}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">{inv.petName || "General OTC"}</div>
                            {inv.breed && <div className="text-[10px] text-muted-foreground">{inv.breed}</div>}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {inv.doctorName || "Attending Vet"}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap font-mono">
                            {fmtMoney(inv.totalAmount || 0)}
                          </td>
                          <td className="px-4 py-3 text-right text-emerald-600 font-medium whitespace-nowrap font-mono">
                            {fmtMoney(inv.amountPaid || 0)}
                          </td>
                          <td
                            className={cn(
                              "px-4 py-3 text-right font-bold whitespace-nowrap font-mono",
                              bal > 0 ? "text-rose-600" : "text-muted-foreground"
                            )}
                          >
                            {fmtMoney(bal)}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <StatusPill value={inv.status} />
                          </td>
                          <td
                            className="px-4 py-3 text-center whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onViewInvoice(inv)}
                                className="h-7 px-2 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary gap-1"
                              >
                                <Eye className="size-3.5" />
                                <span>View</span>
                              </Button>

                              {bal > 0 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => onPaymentIn(inv.invoiceNo)}
                                  className="h-7 px-2 text-[11px] font-semibold text-emerald-600 border-emerald-600/30 hover:bg-emerald-500/10 gap-1"
                                >
                                  <CreditCard className="size-3" />
                                  <span>Pay</span>
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── DAY-END & STOCK VALUATION MODALS ── */}
      <DailySummaryModal
        open={dailySummaryOpen}
        onClose={() => setDailySummaryOpen(false)}
        invoices={invoices}
      />

      {/* ── PURCHASE BILL VIEW & PRINT MODAL ── */}
      <PurchaseBillPrintView
        bill={selectedPurchaseBill}
        open={showPurchaseBillPrintView}
        onClose={() => setShowPurchaseBillPrintView(false)}
        onMarkPaid={handleMarkPurchaseBillPaid}
        onDelete={handleDeletePurchaseBill}
      />
    </div>
  );
}
