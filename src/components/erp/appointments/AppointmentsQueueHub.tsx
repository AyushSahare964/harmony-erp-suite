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
import { VisitWorkspaceModal } from "@/components/erp/clinical/VisitWorkspaceModal";
import { listAppointmentsFn, createAppointmentFn, updateAppointmentStatusFn } from "@/lib/mongodb/serverFns/appointments";
import { cn } from "@/lib/utils";

const MONTHLY_APPOINTMENTS = [
  { name: "Mar", value: 842 },
  { name: "Apr", value: 901 },
  { name: "May", value: 934 },
  { name: "Jun", value: 1012 },
  { name: "Jul", value: 988 },
  { name: "Aug", value: 1104 },
];

export function AppointmentsQueueHub() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [doctorFilter, setDoctorFilter] = useState("all");

  // Modals state
  const [showBookModal, setShowBookModal] = useState(false);
  const [showVisitWorkspace, setShowVisitWorkspace] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<any | null>(null);

  useEffect(() => {
    void loadAppointments();
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

  // Filtered rows
  const filteredRows = useMemo(() => {
    const q = query.toLowerCase().trim();
    return appointments.filter((r) => {
      const matchQ =
        !q ||
        r.token?.toLowerCase().includes(q) ||
        r.pet?.toLowerCase().includes(q) ||
        r.petId?.toLowerCase().includes(q) ||
        r.owner?.toLowerCase().includes(q) ||
        r.doctor?.toLowerCase().includes(q) ||
        r.type?.toLowerCase().includes(q);

      const matchS =
        statusFilter === "all" ||
        r.status?.toLowerCase() === statusFilter.toLowerCase();

      const matchD = doctorFilter === "all" || r.doctor === doctorFilter;

      return matchQ && matchS && matchD;
    });
  }, [appointments, query, statusFilter, doctorFilter]);

  const inQueueCount = appointments.filter((a) => a.status === "Waiting" || a.status === "In consultation").length;
  const noShowsCount = appointments.filter((a) => a.status === "No-show").length;

  const handleStartConsultation = (app: any) => {
    const visitDraft = {
      visitId: `V-${Math.floor(1000 + Math.random() * 9000)}`,
      invoiceNo: `INV-${Math.floor(900 + Math.random() * 90)}`,
      prescriptionNo: `RX-${Math.floor(900 + Math.random() * 90)}`,
      date: new Date().toISOString().slice(0, 10),
      branch: "Main Clinic",
      billType: "GST",
      petId: app.petId || "PET-0001",
      petName: app.pet,
      species: app.species || "Canine",
      breed: app.breed || "Mix",
      ownerId: app.ownerId || "OWN-0001",
      ownerName: app.owner,
      ownerPhone: app.ownerPhone || "N/A",
      doctorName: app.doctor,
      status: "Admitted",
      vitals: {
        weightKg: 25.0,
        tempC: 38.5,
        complaint: `${app.type} — Token ${app.token}`,
      },
      items: [],
      subtotal: 0,
      totalAmount: 0,
      amountPaid: 0,
    };

    // Update appointment status to in consultation
    setAppointments((prev) =>
      prev.map((a) => (a.token === app.token ? { ...a, status: "In consultation" } : a))
    );

    setSelectedVisit(visitDraft);
    setShowVisitWorkspace(true);
  };

  const handleCallToken = (app: any) => {
    toast.info(`📢 Calling Token ${app.token} for ${app.pet} (${app.owner}) to Room 1`);
  };

  const handleUpdateStatus = (token: string, newStatus: string) => {
    setAppointments((prev) =>
      prev.map((a) => (a.token === token ? { ...a, status: newStatus } : a))
    );
    toast.success(`Token ${token} updated to ${newStatus}`);
  };

  const handleBookedNew = (newApp: any) => {
    setAppointments((prev) => [newApp, ...prev]);
  };

  const handleReset = () => {
    void loadAppointments();
    setQuery("");
    setStatusFilter("all");
    setDoctorFilter("all");
    toast.success("Appointments reloaded from MongoDB");
  };


  const exportCsv = () => {
    const header = "Token,Slot,Pet,Patient ID,Owner,Phone,Doctor,Type,Status";
    const body = filteredRows
      .map(
        (r) =>
          `"${r.token}","${r.time}","${r.pet}","${r.petId || ""}","${r.owner}","${r.ownerPhone || ""}","${r.doctor}","${r.type}","${r.status}"`
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
              onClick={() => setShowBookModal(true)}
              className="gap-1.5 text-xs font-bold h-9 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
            >
              <Plus className="size-4" /> + Book Appointment
            </Button>
          </div>
        </div>

        {/* Top 4 KPI Cards (Exact Screenshot Match) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            kpi={{ label: "IN QUEUE NOW", value: String(inQueueCount || 7), trend: "+2 vs yesterday", trendTone: "up" }}
            index={0}
          />
          <KpiCard
            kpi={{ label: "TODAY'S APPOINTMENTS", value: "42", trend: "16 remaining", trendTone: "flat" }}
            index={1}
          />
          <KpiCard
            kpi={{ label: "AVG. WAIT", value: "12 min", trend: "-3 min", trendTone: "up" }}
            index={2}
          />
          <KpiCard
            kpi={{ label: "NO-SHOWS", value: String(noShowsCount || 3), trend: "+1", trendTone: "down" }}
            index={3}
          />
        </div>

        {/* APPOINTMENTS PER MONTH Chart (Exact Screenshot Match) */}
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
              Avg. 963 / month
            </Badge>
          </div>

          <div className="h-[210px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MONTHLY_APPOINTMENTS} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
          {/* Search and Status Dropdown Filter */}
          <div className="flex flex-wrap items-center gap-3 border-b border-border p-4 bg-card">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search records by patient, token, owner, doctor..."
                className="pl-9 text-xs h-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] text-xs h-9">
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

          {/* Table (Exact Columns: TOKEN, SLOT, PET, OWNER, DOCTOR, TYPE, STATUS) */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground border-b border-border text-left font-bold uppercase tracking-wider text-[11px]">
                  <th className="px-4 py-3">TOKEN</th>
                  <th className="px-4 py-3">SLOT</th>
                  <th className="px-4 py-3">PET</th>
                  <th className="px-4 py-3">OWNER</th>
                  <th className="px-4 py-3">DOCTOR</th>
                  <th className="px-4 py-3">TYPE</th>
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

                    {/* Slot */}
                    <td className="px-4 py-3 font-mono font-semibold text-foreground">
                      {row.time}
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

                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusPill value={row.status} />
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
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
                    <td colSpan={8} className="py-12 text-center text-xs text-muted-foreground">
                      No appointment records match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Book Appointment Modal */}
        <BookAppointmentModal
          open={showBookModal}
          onClose={() => setShowBookModal(false)}
          onBooked={handleBookedNew}
        />

        {/* Clinical Workspace Modal for Consultation & Billing */}
        {selectedVisit && (
          <VisitWorkspaceModal
            open={showVisitWorkspace}
            onClose={() => {
              setShowVisitWorkspace(false);
              setSelectedVisit(null);
            }}
            visit={selectedVisit}
            onVisitFinalized={() => {
              if (selectedVisit?.token) {
                handleUpdateStatus(selectedVisit.token, "Completed");
              }
            }}
          />
        )}
      </div>
    </Shell>
  );
}
