import { useState, useEffect, useMemo } from "react";
import {
  X,
  Bell,
  Plus,
  CheckCircle2,
  Calendar,
  Clock,
  User,
  Dog,
  Phone,
  MessageSquare,
  AlertTriangle,
  Trash2,
  ExternalLink,
  ChevronRight,
  Filter,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { todayIST, formatDisplayDate } from "@/lib/utils/dateUtils";

export interface BillingReminder {
  id: string;
  invoiceNo?: string | undefined;
  petName: string;
  ownerName: string;
  ownerPhone: string;
  dueAmount: number;
  reminderType: "Payment Due" | "Post-Op Settlement" | "Vaccine Fee" | "Insurance Claim" | "Cheque Clearance";
  scheduledDate: string;
  channel: "WhatsApp" | "Call" | "SMS";
  priority: "Normal" | "High" | "Urgent";
  status: "Pending" | "Settled" | "Snoozed";
  notes: string;
  createdAt: string;
}

const DEFAULT_REMINDERS: BillingReminder[] = [
  {
    id: "rem_1",
    invoiceNo: "INV-2026-0042",
    petName: "Bruno",
    ownerName: "Anil Deshmukh",
    ownerPhone: "9823011223",
    dueAmount: 1450,
    reminderType: "Payment Due",
    scheduledDate: todayIST(),
    channel: "WhatsApp",
    priority: "High",
    status: "Pending",
    notes: "Owner requested to collect pending blood test balance via UPI link today evening.",
    createdAt: new Date().toISOString(),
  },
  {
    id: "rem_2",
    invoiceNo: "INV-2026-0038",
    petName: "Simba",
    ownerName: "Kavita Rao",
    ownerPhone: "9731234567",
    dueAmount: 3200,
    reminderType: "Post-Op Settlement",
    scheduledDate: todayIST(),
    channel: "Call",
    priority: "Urgent",
    status: "Pending",
    notes: "Post-surgery suture removal scheduled for today; collect remaining surgical charges.",
    createdAt: new Date().toISOString(),
  },
];

interface BillingReminderModalProps {
  open: boolean;
  onClose: () => void;
  invoices?: any[];
}

export function BillingReminderModal({ open, onClose, invoices = [] }: BillingReminderModalProps) {
  const [reminders, setReminders] = useState<BillingReminder[]>(() => {
    if (typeof window === "undefined") return DEFAULT_REMINDERS;
    try {
      const saved = localStorage.getItem("vetos_billing_reminders");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_REMINDERS;
  });

  const [activeTab, setActiveTab] = useState<"list" | "create">("list");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "settled">("all");

  // Create Form State
  const [selectedInvoiceNo, setSelectedInvoiceNo] = useState<string>("");
  const [petName, setPetName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [dueAmount, setDueAmount] = useState<number>(0);
  const [reminderType, setReminderType] = useState<BillingReminder["reminderType"]>("Payment Due");
  const [scheduledDate, setScheduledDate] = useState(todayIST());
  const [channel, setChannel] = useState<BillingReminder["channel"]>("WhatsApp");
  const [priority, setPriority] = useState<BillingReminder["priority"]>("Normal");
  const [notes, setNotes] = useState("");

  // Save reminders to localStorage whenever changed
  useEffect(() => {
    try {
      localStorage.setItem("vetos_billing_reminders", JSON.stringify(reminders));
    } catch (e) {
      console.error(e);
    }
  }, [reminders]);

  // When selecting an invoice, auto-fill details
  const handleInvoiceSelect = (invNo: string) => {
    setSelectedInvoiceNo(invNo);
    const found = invoices.find((i) => i.invoiceNo === invNo);
    if (found) {
      setPetName(found.petName || "");
      setOwnerName(found.ownerName || "");
      setOwnerPhone(found.ownerPhone || "");
      const bal = found.balanceDue ?? Math.max(0, (found.totalAmount || 0) - (found.amountPaid || 0));
      setDueAmount(bal);
      setNotes(`Pending balance on ${invNo} for ${found.petName}.`);
    }
  };

  const handleQuickPresetDate = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    setScheduledDate(d.toISOString().slice(0, 10));
  };

  const handleCreateReminder = () => {
    if (!ownerName && !petName) {
      toast.error("Please enter at least Pet Name or Owner Name.");
      return;
    }

    const newRem: BillingReminder = {
      id: `rem_${Date.now()}`,
      invoiceNo: selectedInvoiceNo || undefined,
      petName: petName || "Patient",
      ownerName: ownerName || "Pet Parent",
      ownerPhone: ownerPhone || "",
      dueAmount: Number(dueAmount) || 0,
      reminderType,
      scheduledDate,
      channel,
      priority,
      status: "Pending",
      notes: notes || "Payment follow-up scheduled.",
      createdAt: new Date().toISOString(),
    };

    setReminders((prev) => [newRem, ...prev]);
    toast.success(`Billing reminder scheduled for ${scheduledDate}`);
    setActiveTab("list");

    // Reset form
    setSelectedInvoiceNo("");
    setPetName("");
    setOwnerName("");
    setOwnerPhone("");
    setDueAmount(0);
    setNotes("");
  };

  const handleMarkSettled = (id: string) => {
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "Settled" as const } : r))
    );
    toast.success("Reminder marked as settled!");
  };

  const handleSnooze = (id: string, days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const newDate = d.toISOString().slice(0, 10);
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, scheduledDate: newDate, status: "Pending" as const } : r))
    );
    toast.success(`Reminder snoozed to ${formatDisplayDate(newDate)}`);
  };

  const handleDelete = (id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
    toast.success("Reminder removed.");
  };

  const handleSendWhatsApp = (rem: BillingReminder) => {
    const phone = (rem.ownerPhone || "").replace(/[^0-9]/g, "");
    const cleanPhone = phone.startsWith("91") ? phone : `91${phone}`;
    const text = encodeURIComponent(
      `Dear ${rem.ownerName || "Pet Parent"},\nGreetings from Real Care Small Animal Clinic.\nThis is a polite reminder regarding pending dues of ₹${rem.dueAmount.toLocaleString(
        "en-IN"
      )} for ${rem.petName || "your pet"}'s care (${rem.invoiceNo || "Invoice"}).\nKindly settle via UPI at your convenience. Thank you!`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, "_blank");
  };

  const filteredReminders = useMemo(() => {
    return reminders.filter((r) => {
      if (filterStatus === "pending") return r.status === "Pending";
      if (filterStatus === "settled") return r.status === "Settled";
      return true;
    });
  }, [reminders, filterStatus]);

  const pendingCount = reminders.filter((r) => r.status === "Pending").length;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto p-0 gap-0 border-border bg-card">
        {/* Glass Header */}
        <div className="relative p-6 border-b border-border bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 p-1.5">
                  <Bell className="size-5" />
                </span>
                <DialogTitle className="text-lg font-black tracking-tight text-white">
                  Billing Reminders &amp; Dues Follow-ups
                </DialogTitle>
                <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-300 border border-amber-500/30">
                  {pendingCount} Pending
                </span>
              </div>
              <DialogDescription className="mt-1 text-xs text-slate-300">
                Track pending customer balances, schedule WhatsApp payment reminders, and follow up on clinic receivables.
              </DialogDescription>
            </div>

            {/* Tab switch */}
            <div className="flex items-center rounded-xl bg-white/10 p-1 border border-white/15">
              <button
                type="button"
                onClick={() => setActiveTab("list")}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                  activeTab === "list" ? "bg-white text-slate-900 shadow-sm" : "text-white/80 hover:text-white"
                }`}
              >
                Active Reminders ({reminders.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("create")}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                  activeTab === "create" ? "bg-white text-slate-900 shadow-sm" : "text-white/80 hover:text-white"
                }`}
              >
                + Schedule New
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {activeTab === "list" ? (
            <div className="space-y-4">
              {/* Filter Strip */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground font-medium">Filter:</span>
                  <button
                    type="button"
                    onClick={() => setFilterStatus("all")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                      filterStatus === "all"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All ({reminders.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterStatus("pending")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                      filterStatus === "pending"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Pending ({pendingCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterStatus("settled")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                      filterStatus === "settled"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Settled ({reminders.length - pendingCount})
                  </button>
                </div>

                <Button size="sm" onClick={() => setActiveTab("create")} className="h-7 text-xs gap-1">
                  <Plus className="size-3.5" /> Schedule Reminder
                </Button>
              </div>

              {/* Reminders List */}
              {filteredReminders.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border py-12 text-center text-muted-foreground space-y-2">
                  <Bell className="size-8 mx-auto text-muted-foreground/40" />
                  <p className="text-sm font-semibold text-foreground">No reminders in this view</p>
                  <p className="text-xs">Schedule a payment follow-up or link a reminder to an invoice.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredReminders.map((rem) => {
                    const isToday = rem.scheduledDate === todayIST();
                    const isSettled = rem.status === "Settled";

                    return (
                      <div
                        key={rem.id}
                        className={`rounded-xl border p-4 transition-all ${
                          isSettled
                            ? "border-border bg-muted/20 opacity-70"
                            : isToday
                            ? "border-amber-500/40 bg-amber-500/5 shadow-xs"
                            : "border-border bg-card hover:border-primary/30"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                                  rem.priority === "Urgent"
                                    ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                                    : rem.priority === "High"
                                    ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                                    : "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                                }`}
                              >
                                {rem.priority} Priority
                              </span>

                              <span className="text-xs font-bold text-foreground flex items-center gap-1">
                                <Dog className="size-3 text-primary" /> {rem.petName}
                              </span>
                              <span className="text-xs text-muted-foreground">· Owner: {rem.ownerName}</span>

                              {rem.invoiceNo && (
                                <span className="font-mono text-[11px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                  {rem.invoiceNo}
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-foreground/90 font-medium">{rem.notes}</p>

                            <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                              <span className="flex items-center gap-1 font-semibold text-foreground">
                                <Calendar className="size-3 text-primary" /> Due: {formatDisplayDate(rem.scheduledDate)}
                                {isToday && !isSettled && (
                                  <span className="rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold px-1.5 py-0.2 text-[10px]">
                                    TODAY
                                  </span>
                                )}
                              </span>

                              {rem.ownerPhone && (
                                <span className="flex items-center gap-1 font-mono">
                                  <Phone className="size-3" /> {rem.ownerPhone}
                                </span>
                              )}

                              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                Channel: {rem.channel}
                              </span>
                            </div>
                          </div>

                          {/* Right side amount & actions */}
                          <div className="flex flex-col items-end gap-2">
                            <div className="text-right">
                              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Balance Due</span>
                              <div className="text-base font-black text-rose-600 font-mono">
                                ₹{rem.dueAmount.toLocaleString("en-IN")}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {rem.ownerPhone && !isSettled && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleSendWhatsApp(rem)}
                                  className="h-7 px-2 text-xs font-semibold text-emerald-600 border-emerald-600/30 hover:bg-emerald-500/10 gap-1"
                                >
                                  <MessageSquare className="size-3" /> WhatsApp
                                </Button>
                              )}

                              {!isSettled ? (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => handleMarkSettled(rem.id)}
                                    className="h-7 px-2 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-1"
                                  >
                                    <CheckCircle2 className="size-3" /> Settled
                                  </Button>
                                  <button
                                    type="button"
                                    onClick={() => handleSnooze(rem.id, 3)}
                                    title="Snooze 3 days"
                                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground text-[10px] font-medium"
                                  >
                                    +3d
                                  </button>
                                </>
                              ) : (
                                <span className="rounded bg-emerald-500/10 text-emerald-600 px-2 py-0.5 text-xs font-bold flex items-center gap-1">
                                  <CheckCircle2 className="size-3" /> Settled
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={() => handleDelete(rem.id)}
                                className="rounded p-1 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Create New Reminder Form */
            <div className="space-y-4">
              {/* Optional: Link to Unpaid Invoice */}
              {invoices.length > 0 && (
                <div>
                  <Label className="text-xs font-semibold text-foreground">Link to Unpaid Patient Invoice (Optional)</Label>
                  <Select value={selectedInvoiceNo} onValueChange={handleInvoiceSelect}>
                    <SelectTrigger className="h-8 text-xs mt-1">
                      <SelectValue placeholder="Select patient invoice with balance due..." />
                    </SelectTrigger>
                    <SelectContent>
                      {invoices
                        .filter((inv) => (inv.balanceDue || 0) > 0 || inv.status !== "Paid")
                        .slice(0, 15)
                        .map((inv) => (
                          <SelectItem key={inv.invoiceNo} value={inv.invoiceNo}>
                            {inv.invoiceNo} · {inv.petName} ({inv.ownerName}) — ₹{(inv.balanceDue || inv.totalAmount || 0).toLocaleString("en-IN")} due
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Patient / Pet Name *</Label>
                  <Input
                    placeholder="e.g. Bruno"
                    value={petName}
                    onChange={(e) => setPetName(e.target.value)}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Pet Parent / Owner Name *</Label>
                  <Input
                    placeholder="e.g. Anil Deshmukh"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Mobile Phone (for WhatsApp/SMS)</Label>
                  <Input
                    placeholder="e.g. 9823011223"
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Due Amount (₹)</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="e.g. 1500"
                    value={dueAmount}
                    onChange={(e) => setDueAmount(Number(e.target.value) || 0)}
                    className="h-8 text-xs mt-1 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Reminder Category</Label>
                  <Select value={reminderType} onValueChange={(v) => setReminderType(v as any)}>
                    <SelectTrigger className="h-8 text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Payment Due">Payment Due Settlement</SelectItem>
                      <SelectItem value="Post-Op Settlement">Post-Op Bill Balance</SelectItem>
                      <SelectItem value="Vaccine Fee">Vaccination Booster Dues</SelectItem>
                      <SelectItem value="Insurance Claim">Insurance Claim Follow-up</SelectItem>
                      <SelectItem value="Cheque Clearance">Cheque Clearance Reminder</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Follow-up Channel</Label>
                  <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
                    <SelectTrigger className="h-8 text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WhatsApp">WhatsApp Message</SelectItem>
                      <SelectItem value="Call">Phone Call</SelectItem>
                      <SelectItem value="SMS">Direct SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Urgency Priority</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                    <SelectTrigger className="h-8 text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Normal">Normal Priority</SelectItem>
                      <SelectItem value="High">High Priority</SelectItem>
                      <SelectItem value="Urgent">Urgent Priority</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Follow-up Target Date</Label>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-muted-foreground">Presets:</span>
                    <button
                      type="button"
                      onClick={() => handleQuickPresetDate(1)}
                      className="rounded bg-muted px-1.5 py-0.5 text-primary hover:bg-muted/80 font-medium"
                    >
                      Tomorrow
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickPresetDate(3)}
                      className="rounded bg-muted px-1.5 py-0.5 text-primary hover:bg-muted/80 font-medium"
                    >
                      In 3 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickPresetDate(7)}
                      className="rounded bg-muted px-1.5 py-0.5 text-primary hover:bg-muted/80 font-medium"
                    >
                      In 1 Week
                    </button>
                  </div>
                </div>
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Reminder Note / Internal Remark</Label>
                <textarea
                  rows={3}
                  placeholder="e.g. Pet owner requested to pay remainder amount upon next booster visit."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full mt-1 rounded-lg border border-input bg-card p-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setActiveTab("list")} className="text-xs">
                  Back to List
                </Button>
                <Button size="sm" onClick={handleCreateReminder} className="text-xs gap-1.5">
                  <Bell className="size-3.5" /> Save Reminder
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
