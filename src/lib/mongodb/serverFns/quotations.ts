import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { Quotation, type IQuotation } from "@/lib/mongodb/models/Quotation";

function toPlain<T>(v: any): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const SEED_QUOTATIONS = [
  {
    quotationNo: "EST-2026-7876",
    date: "2026-09-12",
    validUntil: "2026-09-27",
    petName: "Bruno",
    species: "Canine",
    breed: "Golden Retriever",
    ownerName: "Ramesh Kulkarni",
    ownerPhone: "9823011223",
    doctorName: "Dr. Rohit Sharma",
    items: [
      {
        id: "item_1",
        name: "Orthopedic Fracture Plating & GA Package",
        category: "Surgery" as const,
        quantity: 1,
        rate: 28000,
        discountPercent: 5,
        gstRate: 18,
        lineTotal: 31388,
      },
      {
        id: "item_2",
        name: "Comprehensive Pre-Op Blood & Bio Panel",
        category: "Diagnostic" as const,
        quantity: 1,
        rate: 3200,
        discountPercent: 0,
        gstRate: 18,
        lineTotal: 3776,
      },
    ],
    subtotal: 29800,
    totalDiscount: 1400,
    totalGst: 5364,
    grandTotal: 35164,
    notes: "Estimate valid for 15 days. Post-operative hospitalization beyond 2 days will be billed separately.",
    status: "Sent" as const,
    createdAt: new Date().toISOString(),
  },
  {
    quotationNo: "EST-2026-7412",
    date: "2026-09-10",
    validUntil: "2026-09-25",
    petName: "Milo",
    species: "Feline",
    breed: "Persian",
    ownerName: "Sneha Patil",
    ownerPhone: "9765432109",
    doctorName: "Dr. Ananya Iyer",
    items: [
      {
        id: "item_1",
        name: "Dental Scaling & Extractions under GA",
        category: "Procedure" as const,
        quantity: 1,
        rate: 6500,
        discountPercent: 0,
        gstRate: 18,
        lineTotal: 7670,
      },
    ],
    subtotal: 6500,
    totalDiscount: 0,
    totalGst: 1170,
    grandTotal: 7670,
    notes: "Pre-anesthetic fasting required for 8 hours prior to the procedure.",
    status: "Accepted" as const,
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
];

export const listQuotationsFn = createServerFn({ method: "GET" })
  .validator((d: { query?: string } | undefined) => d || {})
  .handler(async ({ data }) => {
    try {
      await connectDB();
      const count = await Quotation.countDocuments();
      if (count === 0) {
        await Quotation.insertMany(SEED_QUOTATIONS);
      }

      const q = data?.query?.trim();
      const filter: any = {};
      if (q) {
        filter.$or = [
          { quotationNo: { $regex: q, $options: "i" } },
          { petName: { $regex: q, $options: "i" } },
          { ownerName: { $regex: q, $options: "i" } },
          { ownerPhone: { $regex: q, $options: "i" } },
        ];
      }

      const docs = await Quotation.find(filter).sort({ createdAt: -1 }).lean();
      return toPlain(docs);
    } catch (err) {
      console.error("[listQuotationsFn] Error:", err);
      return SEED_QUOTATIONS;
    }
  });

export const createQuotationFn = createServerFn({ method: "POST" })
  .validator(
    (d: {
      quotationNo: string;
      date: string;
      validUntil: string;
      petName: string;
      species?: string;
      breed?: string;
      ownerName: string;
      ownerPhone?: string;
      doctorName?: string;
      items: any[];
      subtotal: number;
      totalDiscount: number;
      totalGst: number;
      grandTotal: number;
      notes?: string;
      status?: string;
    }) => d
  )
  .handler(async ({ data }) => {
    try {
      await connectDB();
      const created = await Quotation.create({
        ...data,
        status: data.status || "Draft",
      });
      return toPlain(created);
    } catch (err: any) {
      console.error("[createQuotationFn] Error:", err);
      // Fallback: Return created object
      return toPlain(data);
    }
  });

export const updateQuotationStatusFn = createServerFn({ method: "POST" })
  .validator(
    (d: {
      quotationNo: string;
      status: "Draft" | "Sent" | "Accepted" | "Converted" | "Expired";
      convertedInvoiceNo?: string;
    }) => d
  )
  .handler(async ({ data }) => {
    try {
      await connectDB();
      const updated = await Quotation.findOneAndUpdate(
        { quotationNo: data.quotationNo },
        {
          $set: {
            status: data.status,
            ...(data.convertedInvoiceNo ? { convertedInvoiceNo: data.convertedInvoiceNo } : {}),
          },
        },
        { new: true }
      ).lean();
      return toPlain(updated);
    } catch (err) {
      console.error("[updateQuotationStatusFn] Error:", err);
      return null;
    }
  });

export const deleteQuotationFn = createServerFn({ method: "POST" })
  .validator((d: { quotationNo: string }) => d)
  .handler(async ({ data }) => {
    try {
      await connectDB();
      await Quotation.deleteOne({ quotationNo: data.quotationNo });
      return { success: true };
    } catch (err) {
      console.error("[deleteQuotationFn] Error:", err);
      return { success: false };
    }
  });
