import { useState, useEffect, useMemo } from "react";

import { motion, AnimatePresence } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Home,
  Waves,
  Search,
  Plus,
  RotateCcw,
  Download,
  Clock,
  User,
  Dog,
  CheckCircle2,
  AlertCircle,
  Receipt,
  Calendar,
  Sparkles,
  Phone,
  Trash2,
} from "lucide-react";
import { Shell } from "@/components/erp/Shell";
import { KpiCard } from "@/components/erp/KpiCard";
import { StatusPill } from "@/components/erp/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { BookBoardingModal } from "./BookBoardingModal";
import { BookSwimmingModal } from "./BookSwimmingModal";
import {
  listBoardingBookingsFn,
  createBoardingBookingFn,
  updateBoardingStatusFn,
  deleteBoardingBookingFn,
  listSwimSessionsFn,
  createSwimSessionFn,
  updateSwimStatusFn,
  deleteSwimSessionFn,
} from "@/lib/mongodb/serverFns/facilities";
import { cn } from "@/lib/utils";

const TOTAL_KENNELS = 24;
const TOTAL_POOL_LANES = 4;

export function BoardingSwimmingHub() {
  const [activeTab, setActiveTab] = useState<"boarding" | "swimming">("boarding");
  const [boardings, setBoardings] = useState<any[]>([]);
  const [swimmings, setSwimmings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals state
  const [showBoardingModal, setShowBoardingModal] = useState(false);
  const [showSwimmingModal, setShowSwimmingModal] = useState(false);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [boardingsData, swimmingsData] = await Promise.all([
        listBoardingBookingsFn(),
        listSwimSessionsFn(),
      ]);
      setBoardings(boardingsData || []);
      setSwimmings(swimmingsData || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load facilities data");
    } finally {
      setLoading(false);
    }
  };

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // ─── Dynamic Boarding Metrics ───────────────────────────────────────────────
  const occupiedBoardings = useMemo(() => {
    return boardings.filter((b) => {
      const s = (b.status || "").toLowerCase();
      return s === "checked-in" || s === "occupied" || s === "staying";
    });
  }, [boardings]);
  const occupiedCount = occupiedBoardings.length;
  const occupancyRate = Math.round((occupiedCount / TOTAL_KENNELS) * 100);

  const checkInsToday = useMemo(() => {
    return boardings.filter((b) => (b.checkIn || "").slice(0, 10) === todayStr);
  }, [boardings, todayStr]);
  const arrivedCheckIns = useMemo(() => {
    return checkInsToday.filter((b) => {
      const s = (b.status || "").toLowerCase();
      return s === "checked-in" || s === "occupied" || s === "staying" || s === "checked-out";
    }).length;
  }, [checkInsToday]);

  const checkOutsToday = useMemo(() => {
    return boardings.filter((b) => (b.checkOut || "").slice(0, 10) === todayStr);
  }, [boardings, todayStr]);
  const completedCheckouts = useMemo(() => {
    return checkOutsToday.filter((b) => (b.status || "").toLowerCase().includes("out")).length;
  }, [checkOutsToday]);

  const boardingRevenueMtd = useMemo(() => {
    const now = new Date();
    const yr = now.getFullYear();
    const mo = now.getMonth();
    return boardings
      .filter((b) => {
        if ((b.status || "").toLowerCase() === "cancelled") return false;
        const d = new Date(b.checkIn || b.createdAt || Date.now());
        return !isNaN(d.getTime()) && d.getFullYear() === yr && d.getMonth() === mo;
      })
      .reduce((sum, b) => {
        const inDate = new Date(b.checkIn || Date.now()).getTime();
        const outDate = new Date(b.checkOut || b.checkIn || Date.now()).getTime();
        const days = Math.max(1, Math.round((outDate - inDate) / (1000 * 60 * 60 * 24)) || 1);
        return sum + (Number(b.rate) || 0) * days;
      }, 0);
  }, [boardings]);

  const formattedBoardingRevenue = useMemo(() => {
    if (boardingRevenueMtd >= 100000) {
      return `₹${(boardingRevenueMtd / 100000).toFixed(1)}L`;
    }
    return `₹${boardingRevenueMtd.toLocaleString("en-IN")}`;
  }, [boardingRevenueMtd]);

  // Dynamic 6-month occupancy series from actual system records
  const occupancySeries = useMemo(() => {
    const now = new Date();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const list: { name: string; value: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      const mEnd = new Date(d.getFullYear(), d.getMonth(), daysInMonth, 23, 59, 59).getTime();

      let bookedNights = 0;
      for (const b of boardings) {
        if ((b.status || "").toLowerCase() === "cancelled") continue;
        const start = new Date(b.checkIn || b.createdAt || Date.now()).getTime();
        const end = new Date(b.checkOut || b.checkIn || Date.now()).getTime();
        if (isNaN(start) || isNaN(end)) continue;

        const oStart = Math.max(start, mStart);
        const oEnd = Math.min(end, mEnd);
        if (oEnd >= oStart) {
          const nights = Math.max(1, Math.round((oEnd - oStart) / (1000 * 60 * 60 * 24)));
          bookedNights += nights;
        }
      }

      const capacity = TOTAL_KENNELS * daysInMonth;
      const pct = capacity > 0 ? Math.min(100, Math.round((bookedNights / capacity) * 100)) : 0;
      list.push({
        name: monthNames[d.getMonth()],
        value: pct,
      });
    }
    return list;
  }, [boardings]);

  const peakMonth = useMemo(() => {
    if (!occupancySeries.length) return null;
    const max = occupancySeries.reduce((prev, curr) => (curr.value > prev.value ? curr : prev), occupancySeries[0]);
    return max && max.value > 0 ? max : null;
  }, [occupancySeries]);

  // ─── Dynamic Swimming & Hydrotherapy Metrics ────────────────────────────────
  const todaySwims = useMemo(() => {
    return swimmings.filter((s) => (s.date || s.createdAt || "").slice(0, 10) === todayStr);
  }, [swimmings, todayStr]);

  const inPoolSwims = useMemo(() => {
    return swimmings.filter((s) => (s.status || "").toLowerCase() === "in pool");
  }, [swimmings]);

  const hydroRevenueMtd = useMemo(() => {
    const now = new Date();
    const yr = now.getFullYear();
    const mo = now.getMonth();
    return swimmings
      .filter((s) => {
        if ((s.status || "").toLowerCase() === "cancelled") return false;
        const d = new Date(s.date || s.createdAt || Date.now());
        return !isNaN(d.getTime()) && d.getFullYear() === yr && d.getMonth() === mo;
      })
      .reduce((sum, s) => sum + (Number(s.rate) || 0), 0);
  }, [swimmings]);

  const formattedHydroRevenue = useMemo(() => {
    if (hydroRevenueMtd >= 100000) {
      return `₹${(hydroRevenueMtd / 100000).toFixed(1)}L`;
    }
    return `₹${hydroRevenueMtd.toLocaleString("en-IN")}`;
  }, [hydroRevenueMtd]);

  // Filtered Boarding Stays
  const filteredBoardings = useMemo(() => {
    const q = query.toLowerCase().trim();
    return boardings.filter((b) => {
      const matchQ =
        !q ||
        b.booking?.toLowerCase().includes(q) ||
        b.pet?.toLowerCase().includes(q) ||
        b.petId?.toLowerCase().includes(q) ||
        b.kennel?.toLowerCase().includes(q) ||
        b.owner?.toLowerCase().includes(q);

      const matchS =
        statusFilter === "all" ||
        b.status?.toLowerCase() === statusFilter.toLowerCase();

      return matchQ && matchS;
    });
  }, [boardings, query, statusFilter]);

  // Filtered Swimming Sessions
  const filteredSwimmings = useMemo(() => {
    const q = query.toLowerCase().trim();
    return swimmings.filter((s) => {
      const matchQ =
        !q ||
        s.session?.toLowerCase().includes(q) ||
        s.pet?.toLowerCase().includes(q) ||
        s.petId?.toLowerCase().includes(q) ||
        s.owner?.toLowerCase().includes(q) ||
        s.trainer?.toLowerCase().includes(q) ||
        s.type?.toLowerCase().includes(q);

      const matchS =
        statusFilter === "all" ||
        s.status?.toLowerCase() === statusFilter.toLowerCase();

      return matchQ && matchS;
    });
  }, [swimmings, query, statusFilter]);

  const handleReset = () => {
    void loadData();
    setQuery("");
    setStatusFilter("all");
    toast.success("Facility records reloaded from MongoDB");
  };

  const handleCheckoutBoarding = async (booking: any) => {
    const bId = booking.booking || booking.id;
    try {
      await updateBoardingStatusFn({ data: { id: bId, status: "Checked-out" } });
      setBoardings((prev) =>
        prev.map((b) => ((b.booking || b.id) === bId ? { ...b, status: "Checked-out" } : b))
      );
      toast.success(`${booking.pet} checked out from ${booking.kennel}. Status updated.`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to update status in MongoDB");
    }
  };

  const handleCheckinBoarding = async (booking: any) => {
    const bId = booking.booking || booking.id;
    try {
      await updateBoardingStatusFn({ data: { id: bId, status: "Checked-in" } });
      setBoardings((prev) =>
        prev.map((b) => ((b.booking || b.id) === bId ? { ...b, status: "Checked-in" } : b))
      );
      toast.success(`${booking.pet} checked in!`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to update status in MongoDB");
    }
  };

  const handleDeleteBoarding = async (booking: any) => {
    const bId = booking.booking || booking.id;
    if (!confirm(`Delete boarding record ${bId} for ${booking.pet}?`)) return;
    try {
      await deleteBoardingBookingFn({ data: { id: bId } });
      setBoardings((prev) => prev.filter((b) => (b.booking || b.id) !== bId));
      toast.success("Boarding record deleted");
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete record");
    }
  };

  const handleStartSwim = async (session: any) => {
    const sId = session.session || session.id;
    try {
      await updateSwimStatusFn({ data: { id: sId, status: "In Pool" } });
      setSwimmings((prev) =>
        prev.map((item) => ((item.session || item.id) === sId ? { ...item, status: "In Pool" } : item))
      );
      toast.success(`${session.pet} is now in the pool!`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to update session status");
    }
  };

  const handleCompleteSwim = async (session: any) => {
    const sId = session.session || session.id;
    try {
      await updateSwimStatusFn({ data: { id: sId, status: "Completed" } });
      setSwimmings((prev) =>
        prev.map((item) => ((item.session || item.id) === sId ? { ...item, status: "Completed" } : item))
      );
      toast.success(`${session.pet}'s swim completed and added to bill.`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to update session status");
    }
  };

  const handleDeleteSwim = async (session: any) => {
    const sId = session.session || session.id;
    if (!confirm(`Delete swimming session ${sId} for ${session.pet}?`)) return;
    try {
      await deleteSwimSessionFn({ data: { id: sId } });
      setSwimmings((prev) => prev.filter((s) => (s.session || s.id) !== sId));
      toast.success("Swimming session deleted");
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete record");
    }
  };

  const exportCsv = () => {
    if (activeTab === "boarding") {
      const header = "Booking,Pet,Patient ID,Kennel,Check-In,Check-Out,Rate/Day,Status";
      const body = filteredBoardings
        .map((b) => `"${b.booking}","${b.pet}","${b.petId || ""}","${b.kennel}","${b.checkIn}","${b.checkOut}","${b.rate}","${b.status}"`)
        .join("\n");
      const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `boarding_stays_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const header = "Session,Time,Pet,Patient ID,Owner,Type,Trainer,Rate,Status";
      const body = filteredSwimmings
        .map((s) => `"${s.session}","${s.time}","${s.pet}","${s.petId || ""}","${s.owner}","${s.type}","${s.trainer}","${s.rate}","${s.status}"`)
        .join("\n");
      const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hydrotherapy_sessions_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
    toast.success("CSV exported");
  };

  return (
    <Shell title="Pet Boarding &amp; Swimming">
      <div className="mx-auto max-w-[1500px] space-y-6">
        {/* Top Header Bar matching Screenshot */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary font-bold shadow-xs">
              <Home className="size-6" />
            </span>
            <div>
              <h1 className="page-title text-xl font-bold text-foreground">Boarding &amp; Hydrotherapy</h1>
              <p className="text-xs text-muted-foreground">Bookings, check-in/out, kennel occupancy and pool hydrotherapy</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5 text-xs font-semibold h-9">
              <RotateCcw className="size-3.5" /> Reset
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5 text-xs font-semibold h-9">
              <Download className="size-3.5" /> Export
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowSwimmingModal(true)}
              className="gap-1.5 text-xs font-bold h-9 border-blue-500/30 text-blue-600 hover:bg-blue-500/10"
            >
              <Waves className="size-4" /> + Book Swimming Pool
            </Button>

            <Button
              size="sm"
              onClick={() => setShowBoardingModal(true)}
              className="gap-1.5 text-xs font-bold h-9 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
            >
              <Plus className="size-4" /> + New Boarding Booking
            </Button>
          </div>
        </div>

        {/* Dual Tab Switcher: Kennel Boarding vs Hydrotherapy Swimming */}
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <button
            onClick={() => setActiveTab("boarding")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all",
              activeTab === "boarding"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Home className="size-4" /> Kennel Boarding &amp; Suites
            <span className={cn("text-[10px] px-1.5 py-0.2 rounded-full", activeTab === "boarding" ? "bg-primary-foreground/20 text-white" : "bg-muted text-muted-foreground")}>
              {boardings.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("swimming")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all",
              activeTab === "swimming"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Waves className="size-4" /> Swimming Pool &amp; Hydrotherapy
            <span className={cn("text-[10px] px-1.5 py-0.2 rounded-full", activeTab === "swimming" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground")}>
              {swimmings.length}
            </span>
          </button>
        </div>

        {/* ── TAB 1: KENNEL BOARDING (Exact Screenshot 1 Match) ────────────────── */}
        {activeTab === "boarding" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Top 4 KPI Cards (Dynamic: OCCUPIED KENNELS, CHECK-INS TODAY, CHECK-OUTS TODAY, BOARDING REVENUE MTD) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                kpi={{
                  label: "OCCUPIED KENNELS",
                  value: `${occupiedCount} / ${TOTAL_KENNELS}`,
                  trend: `${occupancyRate}% occupancy`,
                  trendTone: occupiedCount > 0 ? "up" : "flat",
                }}
                index={0}
              />
              <KpiCard
                kpi={{
                  label: "CHECK-INS TODAY",
                  value: String(checkInsToday.length),
                  trend:
                    checkInsToday.length === 0
                      ? "0 scheduled today"
                      : arrivedCheckIns === checkInsToday.length
                      ? `All ${arrivedCheckIns} arrived`
                      : `${arrivedCheckIns} of ${checkInsToday.length} arrived`,
                  trendTone: checkInsToday.length > 0 ? "up" : "flat",
                }}
                index={1}
              />
              <KpiCard
                kpi={{
                  label: "CHECK-OUTS TODAY",
                  value: String(checkOutsToday.length),
                  trend:
                    checkOutsToday.length === 0
                      ? "0 due today"
                      : completedCheckouts === checkOutsToday.length
                      ? `All ${completedCheckouts} departed`
                      : `${completedCheckouts} of ${checkOutsToday.length} completed`,
                  trendTone: checkOutsToday.length > 0 ? "flat" : "flat",
                }}
                index={2}
              />
              <KpiCard
                kpi={{
                  label: "BOARDING REVENUE MTD",
                  value: formattedBoardingRevenue,
                  trend:
                    boardings.length === 0
                      ? "0 bookings recorded"
                      : `${boardings.length} total booking${boardings.length > 1 ? "s" : ""}`,
                  trendTone: boardingRevenueMtd > 0 ? "up" : "flat",
                }}
                index={3}
              />
            </div>

            {/* OCCUPANCY % Monthly Bar Chart (Dynamic last 6 months) */}
            <div className="erp-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">OCCUPANCY %</p>
                  <p className="text-[11px] text-muted-foreground">Monthly kennel suite utilization rates</p>
                </div>
                <Badge variant="outline" className="text-xs font-semibold text-primary bg-primary/10">
                  {peakMonth ? `Peak: ${peakMonth.value}% (${peakMonth.name})` : `${occupancyRate}% Current Occupancy`}
                </Badge>
              </div>

              <div className="h-[210px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={occupancySeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      domain={[0, 100]}
                      tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--color-muted)" }}
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid var(--color-border)",
                        fontSize: 12,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                      }}
                      formatter={(val: any) => [`${val}% occupancy`, "Rate"]}
                    />
                    <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Boarding Stays Table (Screenshot 1: BOOKING, PET, KENNEL, CHECK-IN, CHECK-OUT, RATE/DAY, STATUS) */}
            <div className="erp-card overflow-hidden shadow-xs space-y-0">
              <div className="flex flex-wrap items-center gap-3 border-b border-border p-4 bg-card">
                <div className="relative min-w-[240px] flex-1">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search records by booking ID, pet, kennel, owner..."
                    className="pl-9 text-xs h-9"
                  />
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px] text-xs h-9">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="Checked-in">Checked-in</SelectItem>
                    <SelectItem value="Booked">Booked</SelectItem>
                    <SelectItem value="Checked-out">Checked-out</SelectItem>
                  </SelectContent>
                </Select>

                <span className="text-xs text-muted-foreground font-medium">
                  {filteredBoardings.length} of {boardings.length} records
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 text-muted-foreground border-b border-border text-left font-bold uppercase tracking-wider text-[11px]">
                      <th className="px-4 py-3">BOOKING</th>
                      <th className="px-4 py-3">PET</th>
                      <th className="px-4 py-3">KENNEL</th>
                      <th className="px-4 py-3">CHECK-IN</th>
                      <th className="px-4 py-3">CHECK-OUT</th>
                      <th className="px-4 py-3 text-right">RATE/DAY</th>
                      <th className="px-4 py-3">STATUS</th>
                      <th className="px-4 py-3 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredBoardings.map((b) => (
                      <tr key={b.booking} className="hover:bg-primary-soft/30 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-foreground">
                          <span className="bg-muted px-2 py-0.5 rounded text-xs border border-border">
                            {b.booking}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 font-bold text-foreground">
                            <span>{b.species === "Feline" ? "🐱" : "🐶"}</span>
                            <span>{b.pet}</span>
                            {b.petId && (
                              <Badge variant="outline" className="font-mono text-[9px] py-0 bg-primary/10 text-primary border-primary/20">
                                {b.petId}
                              </Badge>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3 font-medium text-foreground">{b.kennel}</td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">{b.checkIn}</td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">{b.checkOut}</td>

                        <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                          ₹{Number(b.rate).toFixed(2)}
                        </td>

                        <td className="px-4 py-3">
                          <StatusPill value={b.status} />
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {b.status === "Checked-in" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCheckoutBoarding(b)}
                                className="h-7 text-[11px] font-bold text-primary border-primary/30 hover:bg-primary hover:text-primary-foreground gap-1"
                              >
                                <Receipt className="size-3" /> Check-out &amp; Bill
                              </Button>
                            )}
                            {b.status === "Booked" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCheckinBoarding(b)}
                                className="h-7 text-[11px] font-bold text-emerald-600 border-emerald-500/30 hover:bg-emerald-600 hover:text-white"
                              >
                                Check-in Now
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteBoarding(b)}
                              className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              title="Delete booking"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {filteredBoardings.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-xs text-muted-foreground">
                          No boarding records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── TAB 2: SWIMMING & HYDROTHERAPY POOL ─────────────────────────────── */}
        {activeTab === "swimming" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Top 4 KPI Cards for Hydrotherapy (Dynamic) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                kpi={{
                  label: "POOL SESSIONS TODAY",
                  value: String(todaySwims.length),
                  trend:
                    todaySwims.length === 0
                      ? "0 sessions today"
                      : `${inPoolSwims.length} in pool right now`,
                  trendTone: todaySwims.length > 0 ? "up" : "flat",
                }}
                index={0}
              />
              <KpiCard
                kpi={{
                  label: "ACTIVE POOL LANES",
                  value: `${inPoolSwims.length} / ${TOTAL_POOL_LANES}`,
                  trend: `${Math.round((inPoolSwims.length / TOTAL_POOL_LANES) * 100)}% capacity`,
                  trendTone: inPoolSwims.length > 0 ? "up" : "flat",
                }}
                index={1}
              />
              <KpiCard
                kpi={{
                  label: "WATER TEMP",
                  value: "28.5°C",
                  trend: "Optimal Hydro-Rehab",
                  trendTone: "up",
                }}
                index={2}
              />
              <KpiCard
                kpi={{
                  label: "HYDRO REVENUE MTD",
                  value: formattedHydroRevenue,
                  trend:
                    swimmings.length === 0
                      ? "0 sessions recorded"
                      : `${swimmings.length} total session${swimmings.length > 1 ? "s" : ""}`,
                  trendTone: hydroRevenueMtd > 0 ? "up" : "flat",
                }}
                index={3}
              />
            </div>

            {/* Hydrotherapy Sessions Table */}
            <div className="erp-card overflow-hidden shadow-xs space-y-0">
              <div className="flex flex-wrap items-center gap-3 border-b border-border p-4 bg-card">
                <div className="relative min-w-[240px] flex-1">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search pool sessions by pet, owner, session #..."
                    className="pl-9 text-xs h-9"
                  />
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px] text-xs h-9">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="In Pool">In Pool</SelectItem>
                    <SelectItem value="Scheduled">Scheduled</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>

                <span className="text-xs text-muted-foreground font-medium">
                  {filteredSwimmings.length} of {swimmings.length} sessions
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 text-muted-foreground border-b border-border text-left font-bold uppercase tracking-wider text-[11px]">
                      <th className="px-4 py-3">SESSION</th>
                      <th className="px-4 py-3">TIME SLOT</th>
                      <th className="px-4 py-3">PET</th>
                      <th className="px-4 py-3">OWNER</th>
                      <th className="px-4 py-3">TYPE &amp; DURATION</th>
                      <th className="px-4 py-3">TRAINER</th>
                      <th className="px-4 py-3 text-right">FEE (₹)</th>
                      <th className="px-4 py-3">STATUS</th>
                      <th className="px-4 py-3 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredSwimmings.map((s) => (
                      <tr key={s.session} className="hover:bg-blue-50/40 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-foreground">
                          <span className="bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded text-xs border border-blue-500/20">
                            {s.session}
                          </span>
                        </td>

                        <td className="px-4 py-3 font-mono font-semibold text-foreground">{s.time}</td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 font-bold text-foreground">
                            <span>🐶</span>
                            <span>{s.pet}</span>
                            {s.petId && (
                              <Badge variant="outline" className="font-mono text-[9px] py-0 bg-primary/10 text-primary border-primary/20">
                                {s.petId}
                              </Badge>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-foreground font-medium">{s.owner}</td>

                        <td className="px-4 py-3">
                          <p className="font-bold text-foreground">{s.type}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{s.duration}</p>
                        </td>

                        <td className="px-4 py-3 font-medium text-foreground">{s.trainer}</td>

                        <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                          ₹{Number(s.rate).toFixed(2)}
                        </td>

                        <td className="px-4 py-3">
                          <StatusPill value={s.status} />
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {s.status === "Scheduled" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStartSwim(s)}
                                className="h-7 text-[11px] font-bold text-blue-600 border-blue-500/30 hover:bg-blue-600 hover:text-white"
                              >
                                Start Swim
                              </Button>
                            )}
                            {s.status === "In Pool" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCompleteSwim(s)}
                                className="h-7 text-[11px] font-bold text-emerald-600 border-emerald-500/30 hover:bg-emerald-600 hover:text-white"
                              >
                                Complete &amp; Bill
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteSwim(s)}
                              className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              title="Delete session"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {filteredSwimmings.length === 0 && (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-xs text-muted-foreground">
                          No hydrotherapy sessions found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* Modals */}
        <BookBoardingModal
          open={showBoardingModal}
          onClose={() => setShowBoardingModal(false)}
          onBooked={(b) => setBoardings((prev) => [b, ...prev])}
        />

        <BookSwimmingModal
          open={showSwimmingModal}
          onClose={() => setShowSwimmingModal(false)}
          onBooked={(s) => setSwimmings((prev) => [s, ...prev])}
        />
      </div>
    </Shell>
  );
}
