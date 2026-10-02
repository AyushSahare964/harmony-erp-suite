import { createServerFn } from "@tanstack/react-start";
import { connectDB } from "@/lib/mongodb/client";
import { InventoryItem } from "@/lib/mongodb/models/InventoryItem";
import { ErpRow } from "@/lib/mongodb/models/ErpRow";
import { ClinicalVisit } from "@/lib/mongodb/models/ClinicalVisit";
import { BillingReminderModel } from "@/lib/mongodb/models/BillingReminder";
import { PurchaseBill } from "@/lib/mongodb/models/PurchaseBill";
import { todayIST } from "@/lib/utils/dateUtils";

export type NotificationCategory = "stock" | "appointments" | "billing";
export type NotificationSeverity = "critical" | "warning" | "info";

export interface NotificationRow {
  id: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  detail: string;
  moduleId: string;
  /** Set for billing reminders so the bell can settle them inline. */
  reminderId?: string;
}

const EXPIRY_WARN_DAYS = 30;
const MAX_PER_SOURCE = 25;

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

// Read-only aggregate; each source is isolated so one failing query never blanks the bell.
export const getNotificationsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<NotificationRow[]> => {
    await connectDB();
    const today = todayIST();
    const weekAhead = addDays(today, 7);
    const expiryCutoff = addDays(today, EXPIRY_WARN_DAYS);
    const out: NotificationRow[] = [];
    const safe = async (fn: () => Promise<void>) => {
      try {
        await fn();
      } catch (e) {
        console.warn("[getNotificationsFn] source failed:", e);
      }
    };

    // ── Stock & inventory ────────────────────────────────────────────────
    await safe(async () => {
      const items = await InventoryItem.find({ status: "Active", maintainStock: { $ne: false } }).lean();
      for (const it of items as any[]) {
        const stock = Number(it.currentStock) || 0;
        const threshold = Number(it.reorderLevel) || Number(it.minStockLevel) || 0;
        const unit = it.packagingHierarchy?.baseUnit ?? it.unit ?? "";
        if (stock <= 0) {
          out.push({ id: `stk-out-${it.itemCode}`, category: "stock", severity: "critical", moduleId: "inventory",
            title: `${it.name} is out of stock`, detail: `${it.itemCode} · reorder level ${threshold} ${unit}` });
        } else if (threshold > 0 && stock <= threshold) {
          out.push({ id: `stk-low-${it.itemCode}`, category: "stock", severity: "warning", moduleId: "inventory",
            title: `${it.name} is below threshold`, detail: `${stock} ${unit} left · reorder level ${threshold}` });
        }
        const exp = String(it.medicineDetails?.expiryDate || "").slice(0, 10);
        if (exp && stock > 0 && exp <= expiryCutoff) {
          out.push({ id: `stk-exp-${it.itemCode}`, category: "stock", severity: exp < today ? "critical" : "warning", moduleId: "inventory",
            title: exp < today ? `${it.name} has expired` : `${it.name} expires soon`, detail: `Expiry ${exp} · ${stock} ${unit} in stock` });
        }
      }
    });

    // ── Appointments & follow-ups ────────────────────────────────────────
    await safe(async () => {
      const appts = await ErpRow.find({
        moduleId: "appointments",
        $or: [
          { "data.appointment_date": { $gte: today, $lte: weekAhead } },
          { "data.date": { $gte: today, $lte: weekAhead } },
        ],
      }).lean();
      const active = (appts as any[]).filter((a) => {
        const st = String(a.data?.status || "").toLowerCase().trim();
        return st !== "completed" && st !== "cancelled" && st !== "no-show";
      });
      for (const a of active.slice(0, MAX_PER_SOURCE)) {
        const d = a.data || {};
        const date = String(d.appointment_date || d.date || "").slice(0, 10);
        const isToday = date === today;
        out.push({ id: `apt-${a._id}`, category: "appointments", severity: isToday ? "warning" : "info", moduleId: "appointments",
          title: `Appointment ${isToday ? "today" : `on ${date}`}: ${d.pet || "Patient"}${d.owner ? ` · ${d.owner}` : ""}`,
          detail: [d.slot || d.time, d.status].filter(Boolean).join(" · ") || "Scheduled" });
      }

      const followUps = await ClinicalVisit.find({ nextVisitDate: { $gte: today, $lte: weekAhead } })
        .limit(MAX_PER_SOURCE).lean();
      for (const v of followUps as any[]) {
        const isToday = v.nextVisitDate === today;
        out.push({ id: `fu-${v.visitId}-${v.nextVisitDate}`, category: "appointments", severity: isToday ? "warning" : "info", moduleId: "appointments",
          title: `Follow-up ${isToday ? "today" : `on ${v.nextVisitDate}`}: ${v.petName}${v.ownerName ? ` · ${v.ownerName}` : ""}`,
          detail: [v.diagnosis, v.doctorName, v.ownerPhone].filter(Boolean).join(" · ") });
      }
    });

    // ── Billing ──────────────────────────────────────────────────────────
    await safe(async () => {
      const reminders = await BillingReminderModel.find({ status: "Pending", scheduledDate: { $lte: today } })
        .sort({ scheduledDate: 1 }).limit(MAX_PER_SOURCE).lean();
      for (const r of reminders as any[]) {
        const overdue = r.scheduledDate < today;
        out.push({ id: `rem-${r.reminderId}`, category: "billing", severity: overdue ? "critical" : "warning", moduleId: "billing",
          reminderId: r.reminderId,
          title: `${overdue ? "Overdue" : "Due today"}: ${r.petName} · ${r.ownerName}`,
          detail: `${r.reminderType} · ${inr(r.dueAmount)}${overdue ? ` · was due ${r.scheduledDate}` : ""}` });
      }

      const bills = await PurchaseBill.find({ status: { $in: ["UNPAID", "PARTIAL"] } })
        .limit(MAX_PER_SOURCE).lean();
      for (const b of bills as any[]) {
        const due = String(b.dueDate || "").slice(0, 10);
        if (due > today) continue; // not due yet
        const sev: NotificationSeverity = !due ? "info" : due < today ? "critical" : "warning";
        out.push({ id: `pb-${b._id}`, category: "billing", severity: sev, moduleId: "billing",
          title: `Supplier bill ${!due ? "unpaid" : due < today ? "overdue" : "due today"}: ${b.supplierName}`,
          detail: `${b.billNumber || ""} · ${inr(b.grandTotal)}${due ? ` · due ${due}` : ""}` });
      }

      const unpaid = await ClinicalVisit.aggregate([
        { $match: { balanceDue: { $gt: 0 } } },
        { $group: { _id: null, n: { $sum: 1 }, total: { $sum: "$balanceDue" } } },
      ]);
      if (unpaid[0]?.n) {
        out.push({ id: "inv-outstanding", category: "billing", severity: "info", moduleId: "billing",
          title: `${unpaid[0].n} invoice${unpaid[0].n > 1 ? "s" : ""} with outstanding balance`,
          detail: `${inr(unpaid[0].total)} to collect` });
      }
    });

    return out;
  }
);
