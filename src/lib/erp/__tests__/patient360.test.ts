import { describe, expect, it } from "vitest";
import {
  ageLabel,
  billOf,
  billingSummary,
  paymentHistory,
  splitAppointments,
  prescriptionLines,
} from "../patient360";

const partial = {
  visitId: "V-1",
  invoiceNo: "INV/1",
  date: "2026-09-12",
  subtotal: 2500,
  billDiscount: 200,
  totalAmount: 2300,
  amountPaid: 1500,
  balanceDue: 800,
  items: [{ lineType: "Consultation", lineTotal: 500 }],
  payments: [{ amount: 1500, mode: "UPI", timestamp: "2026-09-12T10:00:00Z" }],
};
const paid = {
  visitId: "V-2",
  invoiceNo: "INV/2",
  date: "2026-08-01",
  totalAmount: 1000,
  amountPaid: 1000,
  balanceDue: 0,
  items: [],
  payments: [{ amount: 1000, mode: "Cash", timestamp: "2026-08-01T09:00:00Z" }],
};
const unbilled = { visitId: "V-3", date: "2026-09-20", totalAmount: 0, items: [], payments: [] };

describe("patient360 derivations", () => {
  it("reads a bill's stored totals without recomputing them", () => {
    expect(billOf(partial)).toMatchObject({
      gross: 2500,
      discount: 200,
      net: 2300,
      paid: 1500,
      pending: 800,
      status: "Partially Paid",
      consultationFees: 500,
    });
    // balanceDue missing → same fallback as InvoiceDetailModal
    expect(billOf({ totalAmount: 900, payments: [{ amount: 400 }] })).toMatchObject({
      paid: 400,
      pending: 500,
    });
  });

  it("summarises only real bills", () => {
    expect(billingSummary([partial, paid, unbilled])).toEqual({
      count: 2,
      consultationFees: 500,
      total: 3300,
      discount: 200,
      paid: 2500,
      pending: 800,
      lastPaymentDate: "2026-09-12T10:00:00Z",
      status: "Partially Paid",
    });
    expect(billingSummary([]).status).toBe("N/A");
    expect(paymentHistory([paid, partial]).map((p) => p.invoiceNo)).toEqual(["INV/1", "INV/2"]);
  });

  it("computes age from DOB, falling back to stored years", () => {
    expect(ageLabel({ dob: "2022-04-12" }, new Date("2026-09-27"))).toBe("4 Years 5 Mo");
    expect(ageLabel({ dob: "2026-07-01" }, new Date("2026-09-27"))).toBe("2 Months");
    expect(ageLabel({ ageYears: 3 })).toBe("3 Years");
    expect(ageLabel({})).toBe("N/A");
  });

  it("splits appointments into upcoming and previous", () => {
    const { upcoming, previous } = splitAppointments(
      [
        { token: 1, date: "2026-09-28", status: "Waiting" },
        { token: 2, date: "2026-09-30", status: "Cancelled" },
        { token: 3, date: "2026-09-01", status: "Completed" },
      ],
      "2026-09-27",
    );
    expect(upcoming.map((a) => a.token)).toEqual([1]);
    expect(previous.map((a) => a.token)).toEqual([2, 3]);
  });

  it("marks prescriptions active until their duration ends", () => {
    const v = {
      date: "2026-09-20",
      prescriptionData: {
        prescribedMedicines: [
          { medicineName: "Amoxicillin", duration: "10", durationUnit: "Days" },
        ],
      },
    };
    expect(prescriptionLines([v], "2026-09-27")[0]!.status).toBe("Active");
    expect(prescriptionLines([v], "2026-10-05")[0]!.status).toBe("Completed");
  });
});
