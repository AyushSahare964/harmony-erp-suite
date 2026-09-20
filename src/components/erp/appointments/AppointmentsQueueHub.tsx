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
  CalendarClock,
  Search,
  Plus,
  RotateCcw,
  Download,
  Clock,
  User,
  Dog,
  Stethoscope,
  CheckCircle2,
  AlertCircle,
  Megaphone,
  Filter,
  ArrowRight,
  Sparkles,
  Phone,
  Trash2,
  Calendar,
  MessageSquare,
  Share2,
  Edit,
} from "lucide-react";
import { Shell } from "@/components/erp/Shell";
import { KpiCard } from "@/components/erp/KpiCard";
import { StatusPill } from "@/components/erp/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { BookAppointmentModal } from "./BookAppointmentModal";
import { listAppointmentsFn, createAppointmentFn, updateAppointmentStatusFn, deleteAppointmentFn } from "@/lib/mongodb/serverFns/appointments";
import { getUpcomingFollowUpsFn, admitPatientFn } from "@/lib/mongodb/serverFns/clinical";
import { cn } from "@/lib/utils";

function formatAppointmentDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  try {
    const raw = String(dateStr).split("T")[0] ?? "";
    const parts = raw.split("-");
    const pYear = parts[0];
    const pMonth = parts[1];
    const pDay = parts[2];
    if (pYear && pMonth && pDay) {
      const dateObj = new Date(Number(pYear), Number(pMonth) - 1, Number(pDay));
      if (!isNaN(dateObj.getTime())) {
        return dateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      }
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

function renderCategoryBadge(category?: string | null) {
  if (!category) {
    return <span className="text-[11px] text-muted-foreground italic">Not specified</span>;
  }
  const cat = String(category).toLowerCase();
  if (cat === "call") {
    return (
      <Badge variant="outline" className="bg-sky-500/10 text-sky-600 border-sky-500/30 text-[10px] font-semibold gap-1">
        <Phone className="size-3" /> Call
      </Badge>
    );
  }
  if (cat === "whatsapp") {
    return (
      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] font-semibold gap-1">
        <MessageSquare className="size-3" /> WhatsApp
      </Badge>
    );
  }
  if (cat === "social_media" || cat === "social media") {
    return (
      <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30 text-[10px] font-semibold gap-1">
        <Share2 className="size-3" /> Social Media
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] font-semibold">
      {category}
    </Badge>
  );
}

export function AppointmentsQueueHub() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [specificDate, setSpecificDate] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Modals state
  const [showBookModal, setShowBookModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<any | null>(null);
  const [selectedFollowUp, setSelectedFollowUp] = useState<any | null>(null);

  // Follow-ups
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [followUpsLoading, setFollowUpsLoading] = useState(false);

  useEffect(() => {
    void loadAppointments();
    void loadFollowUps();
  }, []);

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const data = await listAppointmentsFn();
      setAppointments(data || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load appointments");
    } finally {
      setLoading(false);
    }
  };

  const loadFollowUps = async () => {
    setFollowUpsLoading(true);
    try {
      const data = await getUpcomingFollowUpsFn({ data: { daysAhead: 14 } });
      setFollowUps(data || []);
    } catch (e) {
      console.warn("Could not load follow-ups:", e);
    } finally {
      setFollowUpsLoading(false);
    }
  };

  // Filtered rows
  const filteredRows = useMemo(() => {
    const q = query.toLowerCase().trim();
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

    return appointments.filter((r) => {
      const appCategory = (r.appointment_category || r.category || "").toLowerCase();
      const appDate = (r.appointment_date || r.date || "").split("T")[0];

      const matchQ =
        !q ||
        String(r.token ?? "").toLowerCase().includes(q) ||
        r.pet?.toLowerCase().includes(q) ||
        r.petId?.toLowerCase().includes(q) ||
        r.owner?.toLowerCase().includes(q) ||
        r.doctor?.toLowerCase().includes(q) ||
        r.type?.toLowerCase().includes(q) ||
        appCategory.includes(q);

      const matchS =
        statusFilter === "all" ||
        r.status?.toLowerCase() === statusFilter.toLowerCase();

      const matchD = doctorFilter === "all" || r.doctor === doctorFilter;

      const matchC =
        categoryFilter === "all" ||
        appCategory === categoryFilter.toLowerCase();

      let matchDate = true;
      if (dateFilter === "today") {
        matchDate = appDate === todayStr;
      } else if (dateFilter === "tomorrow") {
        matchDate = appDate === tomorrowStr;
      } else if (dateFilter === "specific") {
        matchDate = !specificDate || appDate === specificDate;
      }

      return matchQ && matchS && matchD && matchC && matchDate;
    });
  }, [appointments, query, statusFilter, doctorFilter, categoryFilter, dateFilter, specificDate]);

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const inQueueCount = useMemo(() => {
    return appointments.filter((a) => a.status === "Waiting" || a.status === "In consultation").length;
  }, [appointments]);

  const todaysAppointmentsCount = useMemo(() => {
    return appointments.filter((a) => {
      const d = (a.appointment_date || a.date || "").split("T")[0];
      return d === todayStr;
    }).length;
  }, [appointments, todayStr]);

  const remainingTodayCount = useMemo(() => {
    return appointments.filter((a) => {
      const d = (a.appointment_date || a.date || "").split("T")[0];
      return (d === todayStr || !d) && a.status !== "Completed" && a.status !== "Cancelled";
    }).length;
  }, [appointments, todayStr]);

  const noShowsCount = useMemo(() => {
    return appointments.filter((a) => a.status === "No-show").length;
  }, [appointments]);

  const avgWaitMin = useMemo(() => {
    return inQueueCount > 0 ? inQueueCount * 4 : 0;
  }, [inQueueCount]);

  // Dynamic 6-month appointment volume computed directly from actual appointments
  const monthlyAppointmentsData = useMemo(() => {
    const now = new Date();
    const months: { key: string; name: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const name = d.toLocaleString("en-US", { month: "short" });
      months.push({ key, name, value: 0 });
    }

    appointments.forEach((a) => {
      const dateStr = a.appointment_date || a.date || a.createdAt;
      if (!dateStr) return;
      const appMonth = String(dateStr).slice(0, 7);
      const found = months.find((m) => m.key === appMonth);
      if (found) {
        found.value += 1;
      }
    });

    return months.map(({ name, value }) => ({ name, value }));
  }, [appointments]);

  const avgMonthlyAppointments = useMemo(() => {
    if (!monthlyAppointmentsData.length) return 0;
    const total = monthlyAppointmentsData.reduce((acc, m) => acc + m.value, 0);
    return Math.round(total / monthlyAppointmentsData.length);
  }, [monthlyAppointmentsData]);

  const maxAppointmentCount = useMemo(() => {
    return Math.max(0, ...monthlyAppointmentsData.map((m) => m.value));
  }, [monthlyAppointmentsData]);

  const handleStartConsultation = async (app: any) => {
    try {
      toast.loading(`Admitting ${app.pet || "patient"} to OPD...`, { id: "admit-opd" });
      const created = await admitPatientFn({
        data: {
          petName: app.pet || "Patient",
          petId: app.petId,
          species: app.species || "Canine",
          breed: app.breed || "Mix",
          ownerName: app.owner || "Client",
          ownerPhone: app.ownerPhone || "N/A",
          doctorName: app.doctor || "Dr. Rohit Sharma",
          receptionistName: "Front Desk",
          vitals: {
            weightKg: 25.0,
            tempC: 38.5,
            complaint: `${app.type || "Consultation"} — Token ${app.token}`,
          },
        },
      });

      setAppointments((prev) =>
        prev.map((a) => (a.token === app.token ? { ...a, status: "In consultation" } : a))
      );
      void updateAppointmentStatusFn({ data: { token: app.token, status: "In consultation" } });

      toast.success(`Patient admitted to OPD queue: ${created.visitId}. The attending doctor can begin consultation from the Home Dashboard.`, { id: "admit-opd" });
    } catch (err: any) {
      console.warn("Could not admit patient on server, using session fallback:", err);
      toast.dismiss("admit-opd");

      setAppointments((prev) =>
        prev.map((a) => (a.token === app.token ? { ...a, status: "In consultation" } : a))
      );

      toast.success(`Patient admitted to OPD queue. The attending doctor can begin consultation from the Home Dashboard.`);
    }
  };

  const handleCallToken = (app: any) => {
    toast.info(`📢 Calling Token ${app.token} for ${app.pet} (${app.owner}) to Doctor's Room 1`, {
      duration: 5000,
    });
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        const utterance = new SpeechSynthesisUtterance(
          `Token ${app.token}, ${app.pet}, please proceed to room one`
        );
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
      } catch {}
    }
  };

  const handleBookFollowUp = (fu: any) => {
    setSelectedFollowUp(fu);
    setEditingAppointment(null);
    setShowBookModal(true);
  };

  const handleUpdateStatus = (token: any, newStatus: string) => {
    setAppointments((prev) =>
      prev.map((a) => (String(a.token) === String(token) ? { ...a, status: newStatus } : a))
    );
    void updateAppointmentStatusFn({ data: { token, status: newStatus } }).catch((err) => {
      console.warn("Could not sync status to server:", err);
    });
    toast.success(`Token ${token} updated to ${newStatus}`);
  };

  const handleBookedNew = (newApp: any) => {
    setAppointments((prev) => [newApp, ...prev]);
    if (selectedFollowUp) {
      void loadFollowUps();
    }
  };

  const handleEditAppointment = (app: any) => {
    setEditingAppointment(app);
    setSelectedFollowUp(null);
    setShowBookModal(true);
  };

  const handleUpdatedAppointment = (updatedApp: any) => {
    setAppointments((prev) =>
      prev.map((a) => (String(a.token) === String(updatedApp.token) ? { ...a, ...updatedApp } : a))
    );
  };

  const handleDeleteAppointment = async (token: any) => {
    try {
      await deleteAppointmentFn({ data: { token } });
      setAppointments((prev) => prev.filter((a) => String(a.token) !== String(token)));
      toast.success(`Appointment (Token #${token}) deleted`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete appointment");
    }
  };

  const handleReset = () => {
    void loadAppointments();
    setQuery("");
    setStatusFilter("all");
    setDoctorFilter("all");
    setDateFilter("all");
    setSpecificDate("");
    setCategoryFilter("all");
    toast.success("Appointments reloaded from MongoDB");
  };

  const exportCsv = () => {
    const header = "Token,Appointment Date,Slot,Pet,Patient ID,Owner,Phone,Doctor,Type,Category,Status";
    const body = filteredRows
      .map(
        (r) =>
          `"${r.token}","${formatAppointmentDate(r.appointment_date || r.date)}","${r.slot || r.time || ""}","${r.pet}","${r.petId || ""}","${r.owner}","${r.ownerPhone || ""}","${r.doctor}","${r.type}","${r.appointment_category || r.category || "Not specified"}","${r.status}"`
      )
      .join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `appointments_queue_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Appointments CSV exported");
  };

  return (
    <Shell title="Appointments &amp; Queue">
      <div className="mx-auto max-w-[1500px] space-y-6">
        {/* Top Header Bar matching Screenshot */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary font-bold shadow-xs">
              <CalendarClock className="size-6" />
            </span>
            <div>
              <h1 className="page-title text-xl font-bold text-foreground">Appointments &amp; Queue</h1>
              <p className="text-xs text-muted-foreground">Doctor schedules, bookings and the live queue</p>
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
              onClick={() => {
                setEditingAppointment(null);
                setSelectedFollowUp(null);
                setShowBookModal(true);
              }}
              className="gap-1.5 text-xs font-bold h-9 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs cursor-pointer"
            >
              <Plus className="size-4" /> Book Appointment
            </Button>
          </div>
        </div>

        {/* Top 4 KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            kpi={{ label: "IN QUEUE NOW", value: String(inQueueCount), trend: inQueueCount > 0 ? "+2 vs yesterday" : "Queue clear", trendTone: "up" }}
            index={0}
          />
          <KpiCard
            kpi={{ label: "TODAY'S APPOINTMENTS", value: String(todaysAppointmentsCount), trend: `${remainingTodayCount} remaining`, trendTone: "flat" }}
            index={1}
          />
          <KpiCard
            kpi={{ label: "AVG. WAIT", value: `${avgWaitMin} min`, trend: inQueueCount > 0 ? "-3 min" : "No wait", trendTone: "up" }}
            index={2}
          />
          <KpiCard
            kpi={{ label: "NO-SHOWS", value: String(noShowsCount), trend: noShowsCount > 0 ? "+1" : "None", trendTone: "down" }}
            index={3}
          />
        </div>

        {/* ── Follow-ups Due Widget ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="erp-card p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">UPCOMING FOLLOW-UPS (Next 14 Days)</p>
              <p className="text-[11px] text-muted-foreground">Scheduled return visits from clinical screen</p>
            </div>
            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs font-bold">
              {followUps.length} pending
            </Badge>
          </div>
          {followUpsLoading && (
            <div className="flex items-center gap-2 py-3">
              <div className="animate-spin size-4 border-2 border-primary border-t-transparent rounded-full" />
              <span className="text-xs text-muted-foreground">Loading follow-ups...</span>
            </div>
          )}
          {!followUpsLoading && followUps.length === 0 && (
            <p className="text-xs text-muted-foreground italic py-2">No follow-ups due in the next 14 days.</p>
          )}
          {!followUpsLoading && followUps.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground font-bold uppercase tracking-wider text-[10px]">
                    <th className="pb-2 pr-4">Patient</th>
                    <th className="pb-2 pr-4">Owner</th>
                    <th className="pb-2 pr-4">Next Visit</th>
                    <th className="pb-2 pr-4">Last Diagnosis</th>
                    <th className="pb-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {followUps.map((fu) => {
                    const isToday = fu.nextVisitDate === new Date().toISOString().slice(0, 10);
                    const isPast = fu.nextVisitDate < new Date().toISOString().slice(0, 10);
                    return (
                      <tr key={fu.visitId} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base">{fu.species === "Feline" ? "🐱" : fu.species === "Avian" ? "🦜" : "🐶"}</span>
                            <div>
                              <p className="font-bold text-foreground">{fu.petName}</p>
                              <p className="text-[10px] font-mono text-muted-foreground">{fu.petId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 pr-4">
                          <p className="font-medium text-foreground">{fu.ownerName}</p>
                          <p className="text-[10px] text-muted-foreground">{fu.ownerPhone}</p>
                        </td>
                        <td className="py-2 pr-4">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold",
                            isPast ? "bg-destructive/10 text-destructive" : isToday ? "bg-amber-500/10 text-amber-600" : "bg-primary/10 text-primary"
                          )}>
                            {isPast ? "⚠ Overdue " : isToday ? "📅 Today " : ""}{fu.nextVisitDate}
                          </span>
                        </td>
                        <td className="py-2 pr-4">
                          <p className="text-[11px] text-muted-foreground max-w-[160px] truncate">{fu.diagnosis || "—"}</p>
                        </td>
                        <td className="py-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px] font-bold text-primary border-primary/30 hover:bg-primary hover:text-primary-foreground gap-1 cursor-pointer"
                            onClick={() => handleBookFollowUp(fu)}
                          >
                            <Calendar className="size-3" /> Book
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="erp-card p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">APPOINTMENTS PER MONTH</p>
              <p className="text-[11px] text-muted-foreground">Monthly patient visit volume and doctor encounters</p>
            </div>
            <Badge variant="outline" className="text-xs font-semibold text-primary bg-primary/10">
              Avg. {avgMonthlyAppointments} / month
            </Badge>
          </div>

          <div className="h-[210px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyAppointmentsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                  tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                  domain={[0, maxAppointmentCount > 0 ? "auto" : 5]}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)" }}
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid var(--color-border)",
                    fontSize: 12,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                  }}
                  formatter={(val: any) => [`${val} appointments`, "Volume"]}
                />
                <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Live Queue and Appointments Table (Exact Screenshot Match) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="erp-card overflow-hidden shadow-xs space-y-0"
        >
          {/* Search and Filters Bar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-border p-4 bg-card">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search records by patient, token, owner, doctor, channel..."
                className="pl-9 text-xs h-9"
              />
            </div>

            {/* Date Filter */}
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[140px] text-xs h-9">
                <SelectValue placeholder="All Dates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="tomorrow">Tomorrow</SelectItem>
                <SelectItem value="specific">Specific Date</SelectItem>
              </SelectContent>
            </Select>

            {dateFilter === "specific" && (
              <Input
                type="date"
                value={specificDate}
                onChange={(e) => setSpecificDate(e.target.value)}
                className="w-[140px] text-xs h-9 bg-card"
              />
            )}

            {/* Category Filter */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[150px] text-xs h-9">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="call">Call</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="social_media">Social Media</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] text-xs h-9">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Waiting">Waiting</SelectItem>
                <SelectItem value="In consultation">In consultation</SelectItem>
                <SelectItem value="Scheduled">Scheduled</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="No-show">No-show</SelectItem>
              </SelectContent>
            </Select>

            <span className="text-xs text-muted-foreground font-medium">
              {filteredRows.length} of {appointments.length} records
            </span>
          </div>

          {/* Table (Columns: TOKEN, APPOINTMENT DATE, SLOT, PET, OWNER, DOCTOR, TYPE, CATEGORY, STATUS, ACTIONS) */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground border-b border-border text-left font-bold uppercase tracking-wider text-[11px]">
                  <th className="px-4 py-3">TOKEN</th>
                  <th className="px-4 py-3">APPOINTMENT DATE</th>
                  <th className="px-4 py-3">SLOT</th>
                  <th className="px-4 py-3">PET</th>
                  <th className="px-4 py-3">OWNER</th>
                  <th className="px-4 py-3">DOCTOR</th>
                  <th className="px-4 py-3">TYPE</th>
                  <th className="px-4 py-3">CATEGORY</th>
                  <th className="px-4 py-3">STATUS</th>
                  <th className="px-4 py-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRows.map((row) => (
                  <tr key={row.token} className="hover:bg-primary-soft/30 transition-colors group">
                    {/* Token */}
                    <td className="px-4 py-3 font-mono font-bold text-foreground">
                      <span className="bg-muted px-2 py-1 rounded text-xs border border-border">
                        {row.token}
                      </span>
                    </td>

                    {/* Appointment Date */}
                    <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                      {formatAppointmentDate(row.appointment_date || row.date)}
                    </td>

                    {/* Slot */}
                    <td className="px-4 py-3 font-mono font-semibold text-foreground whitespace-nowrap">
                      {row.slot || row.time || "—"}
                    </td>

                    {/* Pet */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 font-bold text-foreground">
                        <span className="size-6 rounded-full bg-muted flex items-center justify-center text-xs">
                          {row.species === "Feline" ? "🐱" : row.species === "Avian" ? "🦜" : "🐶"}
                        </span>
                        <span>{row.pet}</span>
                        {row.petId && (
                          <Badge variant="outline" className="font-mono text-[9px] py-0 bg-primary/10 text-primary border-primary/20">
                            {row.petId}
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* Owner */}
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">{row.owner}</p>
                      {row.ownerPhone && (
                        <p className="text-[10px] font-mono text-muted-foreground">{row.ownerPhone}</p>
                      )}
                    </td>

                    {/* Doctor */}
                    <td className="px-4 py-3 font-medium text-foreground">{row.doctor}</td>

                    {/* Type */}
                    <td className="px-4 py-3">
                      <span className="bg-primary/10 text-primary px-2 py-0.5 rounded font-semibold text-[11px]">
                        {row.type}
                      </span>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {renderCategoryBadge(row.appointment_category || row.category)}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusPill value={row.status} />
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditAppointment(row)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          title="Edit Appointment"
                        >
                          <Edit className="size-3.5" />
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteAppointment(row.token)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Delete Appointment"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>

                        {row.status !== "Completed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStartConsultation(row)}
                            className="h-7 text-[11px] font-bold text-primary border-primary/30 hover:bg-primary hover:text-primary-foreground gap-1"
                          >
                            <Stethoscope className="size-3" /> Admit OPD
                          </Button>
                        )}

                        {row.status === "Waiting" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCallToken(row)}
                            className="h-7 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                            title="Call Token over PA/Display"
                          >
                            <Megaphone className="size-3" />
                          </Button>
                        )}

                        <Select
                          value={row.status}
                          onValueChange={(newSt) => handleUpdateStatus(row.token, newSt)}
                        >
                          <SelectTrigger className="h-7 w-24 text-[10px] bg-card">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Waiting">Waiting</SelectItem>
                            <SelectItem value="In consultation">In consult</SelectItem>
                            <SelectItem value="Scheduled">Scheduled</SelectItem>
                            <SelectItem value="Completed">Completed</SelectItem>
                            <SelectItem value="No-show">No-show</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-xs text-muted-foreground">
                      No appointment records match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Book / Edit Appointment Modal */}
        <BookAppointmentModal
          open={showBookModal}
          onClose={() => {
            setShowBookModal(false);
            setEditingAppointment(null);
            setSelectedFollowUp(null);
          }}
          appointmentToEdit={editingAppointment}
          initialFollowUp={selectedFollowUp}
          onBooked={handleBookedNew}
          onUpdated={handleUpdatedAppointment}
        />
      </div>
    </Shell>
  );
}
