/**
 * Pure read-side derivations for the Patient 360° profile. Nothing here
 * computes money — it only sums values already stored on ClinicalVisit, using
 * the same paid/balance fallbacks InvoiceDetailModal uses, so the profile and
 * the billing desk always agree.
 */

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const today = () => new Date().toISOString().slice(0, 10);

export function ageLabel(
  pet: { dob?: string; ageYears?: number; ageMonths?: number },
  now = new Date(),
): string {
  if (pet.dob) {
    const d = new Date(pet.dob);
    if (!isNaN(d.getTime()) && d <= now) {
      let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      if (now.getDate() < d.getDate()) months -= 1;
      const y = Math.floor(months / 12);
      const m = months % 12;
      if (y === 0) return `${m} ${m === 1 ? "Month" : "Months"}`;
      return m
        ? `${y} ${y === 1 ? "Year" : "Years"} ${m} Mo`
        : `${y} ${y === 1 ? "Year" : "Years"}`;
    }
  }
  if (pet.ageYears != null || pet.ageMonths != null) {
    const y = num(pet.ageYears);
    const m = num(pet.ageMonths);
    return (
      [y ? `${y} ${y === 1 ? "Year" : "Years"}` : "", m ? `${m} Mo` : ""]
        .filter(Boolean)
        .join(" ") || "N/A"
    );
  }
  return "N/A";
}

export type PayStatus = "Paid" | "Partially Paid" | "Pending";

/** One visit viewed as a bill. Mirrors InvoiceDetailModal's paid/balance fallbacks. */
export function billOf(visit: any) {
  const net = num(visit.totalAmount);
  const payments: any[] = visit.payments || [];
  const paid = num(visit.amountPaid) || payments.reduce((s, p) => s + num(p.amount), 0);
  const pending = visit.balanceDue !== undefined ? num(visit.balanceDue) : Math.max(0, net - paid);
  const lineDiscount = (visit.items || []).reduce(
    (s: number, it: any) => s + num(it.discountAmount),
    0,
  );
  const discount = num(visit.billDiscount) + lineDiscount;
  const consultationFees = (visit.items || [])
    .filter((it: any) => it.lineType === "Consultation")
    .reduce((s: number, it: any) => s + num(it.lineTotal), 0);
  const status: PayStatus = pending <= 0.005 ? "Paid" : paid > 0.005 ? "Partially Paid" : "Pending";
  const lastPayment = payments
    .map((p) => String(p.timestamp || ""))
    .filter(Boolean)
    .sort()
    .pop();
  return {
    gross: num(visit.subtotal) || net,
    discount,
    net,
    paid,
    pending,
    consultationFees,
    status,
    lastPayment,
    methods: [...new Set(payments.map((p) => p.mode).filter(Boolean))] as string[],
  };
}

/** Visits that are actual bills (an admitted-but-unbilled visit is not). */
export const isBill = (v: any) => num(v.totalAmount) > 0;

export function billingSummary(visits: any[]) {
  const bills = visits.filter(isBill).map(billOf);
  const sum = (k: "consultationFees" | "net" | "discount" | "paid" | "pending") =>
    Math.round(bills.reduce((s, b) => s + b[k], 0) * 100) / 100;
  const pending = sum("pending");
  const paid = sum("paid");
  const status: PayStatus | "N/A" = !bills.length
    ? "N/A"
    : pending <= 0.005
      ? "Paid"
      : paid > 0.005
        ? "Partially Paid"
        : "Pending";
  return {
    count: bills.length,
    consultationFees: sum("consultationFees"),
    total: sum("net"),
    discount: sum("discount"),
    paid,
    pending,
    lastPaymentDate: bills
      .map((b) => b.lastPayment || "")
      .filter(Boolean)
      .sort()
      .pop(),
    status,
  };
}

/** Flat list of payments made across all of this patient's bills. */
export function paymentHistory(visits: any[]) {
  return visits
    .filter(isBill)
    .flatMap((v) =>
      (v.payments || []).map((p: any) => ({
        date: p.timestamp,
        invoiceNo: v.invoiceNo,
        visitId: v.visitId,
        amount: num(p.amount),
        mode: p.mode,
        ref: p.trxRef,
        receivedBy: p.recordedBy,
        billStatus: billOf(v).status,
      })),
    )
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function durationDays(duration: unknown, unit: unknown): number | null {
  const n = parseFloat(String(duration ?? ""));
  if (!Number.isFinite(n)) return null;
  const u = String(unit || "days").toLowerCase();
  return u.startsWith("week") ? n * 7 : u.startsWith("month") ? n * 30 : n;
}

/** Every medicine line recorded on this patient's prescriptions, newest first. */
export function prescriptionLines(visits: any[], asOf = today()) {
  return visits.flatMap((v) => {
    const rx = v.prescriptionData || {};
    const date = rx.dateOfVisit || v.date;
    const prescribed = (rx.prescribedMedicines || []).map((m: any) => {
      const days = durationDays(m.duration, m.durationUnit);
      const ends =
        days != null && date
          ? new Date(new Date(date).getTime() + days * 86400000).toISOString().slice(0, 10)
          : null;
      return {
        visit: v,
        date,
        medicine: m.medicineName,
        dosage: [m.dosage, m.quantity && m.unit ? `${m.quantity} ${m.customUnit || m.unit}` : ""]
          .filter(Boolean)
          .join(" · "),
        frequency: m.frequency,
        duration: m.duration ? `${m.duration} ${m.durationUnit || ""}`.trim() : "",
        route: m.route,
        doctor: v.doctorName,
        status: ends ? (ends >= asOf ? "Active" : "Completed") : "Prescribed",
        kind: "Prescribed" as const,
      };
    });
    const immediate = (rx.immediateMedicines || []).map((m: any) => ({
      visit: v,
      date,
      medicine: m.medicineName,
      dosage: m.dosage,
      frequency: "Once",
      duration: "",
      route: "",
      doctor: v.doctorName,
      status: "Administered",
      kind: "In-clinic" as const,
    }));
    const injectables = (rx.injectables || []).map((m: any) => ({
      visit: v,
      date,
      medicine: m.name,
      dosage: m.dose ? `${m.dose} ${m.doseUnit || ""}`.trim() : "",
      frequency: m.frequency || "Once",
      duration: "",
      route: m.route,
      doctor: v.doctorName,
      status: "Administered",
      kind: "Injectable" as const,
    }));
    return [...prescribed, ...immediate, ...injectables];
  });
}

// ponytail: deworming is identified by drug name on billed lines; add an explicit lineType if the catalogue grows one
const DEWORM_RX =
  /deworm|worm|drontal|fenbendazole|praziquantel|albendazole|pyrantel|milbemycin|febantel|ivermectin|selamectin/i;

/** Vaccinations = dedicated Vaccination records + Vaccine lines billed on visits. */
export function vaccinationHistory(visits: any[], records: any[]) {
  const fromVisits = visits.flatMap((v) =>
    (v.items || [])
      .filter((it: any) => it.lineType === "Vaccine")
      .map((it: any) => ({
        name: it.name,
        date: v.date,
        nextDue: v.nextVaccineDate || v.prescriptionData?.followUp?.nextVaccineDate,
        batchNo: it.batchNo,
        doctor: v.doctorName,
        notes: it.dosageInstructions,
        visitId: v.visitId,
      })),
  );
  const seen = new Set(fromVisits.map((r) => r.visitId));
  const fromRecords = records
    .filter((r) => !r.visitId || !seen.has(r.visitId))
    .map((r) => ({
      name: r.vaccineType,
      date: r.dateGiven,
      nextDue: r.nextDueDate,
      batchNo: "",
      doctor: r.createdBy,
      notes: "",
      visitId: r.visitId,
    }));
  return [...fromVisits, ...fromRecords].sort((a, b) =>
    String(b.date).localeCompare(String(a.date)),
  );
}

export function dewormingHistory(visits: any[], records: any[]) {
  const fromVisits = visits.flatMap((v) => {
    const rx = v.prescriptionData || {};
    const names: { name: string; dosage?: string }[] = [
      ...(v.items || []).map((it: any) => ({ name: it.name, dosage: it.dosageInstructions })),
      ...(rx.prescribedMedicines || []).map((m: any) => ({
        name: m.medicineName,
        dosage: m.dosage,
      })),
      ...(rx.immediateMedicines || []).map((m: any) => ({
        name: m.medicineName,
        dosage: m.dosage,
      })),
    ];
    const hits = names.filter((n) => DEWORM_RX.test(String(n.name || "")));
    const unique = [...new Map(hits.map((h) => [h.name, h])).values()];
    return unique.map((h) => ({
      date: v.date,
      medicine: h.name,
      dosage: h.dosage || "",
      nextDue: v.nextDewormingDate || rx.followUp?.nextDewormingDate,
      doctor: v.doctorName,
      notes: "",
      visitId: v.visitId,
    }));
  });
  const seen = new Set(fromVisits.map((r) => r.visitId));
  const fromRecords = records
    .filter((r) => !r.visitId || !seen.has(r.visitId))
    .map((r) => ({
      date: r.dateGiven,
      medicine: "Deworming",
      dosage: "",
      nextDue: r.nextDueDate,
      doctor: "",
      notes: r.source || "",
      visitId: r.visitId,
    }));
  return [...fromVisits, ...fromRecords].sort((a, b) =>
    String(b.date).localeCompare(String(a.date)),
  );
}

const DONE = ["completed", "cancelled", "no-show", "no show"];

/** Splits appointments into upcoming (today onward, still open) and previous. */
export function splitAppointments(appts: any[], asOf = today()) {
  const dateOf = (a: any) => String(a.appointment_date || a.date || "").slice(0, 10);
  const upcoming: any[] = [];
  const previous: any[] = [];
  for (const a of appts) {
    const st = String(a.status || "").toLowerCase();
    if (dateOf(a) >= asOf && !DONE.includes(st)) upcoming.push(a);
    else previous.push(a);
  }
  upcoming.sort((a, b) => dateOf(a).localeCompare(dateOf(b)));
  previous.sort((a, b) => dateOf(b).localeCompare(dateOf(a)));
  return { upcoming, previous };
}
