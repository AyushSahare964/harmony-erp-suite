import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { ErpRow } from "@/lib/mongodb/models/ErpRow";

function toPlain<T>(v: any): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const SEED_LAB_ORDERS = [
  {
    orderId: "LAB-8801",
    pet: "Bruno",
    petId: "PET-0001",
    species: "Canine",
    breed: "Golden Retriever",
    owner: "Tariq Hussain",
    phone: "+91 90000 11111",
    testName: "Comprehensive Biochemistry 14-Parameter Panel",
    profile: "Biochemistry Profile",
    sampleType: "Serum (Red Top / SST)",
    barcode: "BC-8801-BRU",
    tat: "45 mins",
    priority: "Urgent STAT",
    doctor: "Dr. Rohit Sharma",
    date: "2026-08-22",
    time: "10:30 AM",
    status: "Completed",
    isAbnormal: false,
    parameters: [
      { name: "Blood Urea Nitrogen (BUN)", value: "22.4", unit: "mg/dL", refInterval: "10.0 - 28.0", flag: "Normal" },
      { name: "Serum Creatinine", value: "1.2", unit: "mg/dL", refInterval: "0.5 - 1.5", flag: "Normal" },
      { name: "Alanine Aminotransferase (ALT)", value: "48", unit: "U/L", refInterval: "10 - 100", flag: "Normal" },
      { name: "Alkaline Phosphatase (ALP)", value: "64", unit: "U/L", refInterval: "20 - 150", flag: "Normal" },
      { name: "Total Protein", value: "6.8", unit: "g/dL", refInterval: "5.4 - 7.5", flag: "Normal" },
      { name: "Albumin", value: "3.2", unit: "g/dL", refInterval: "2.6 - 4.0", flag: "Normal" },
      { name: "Blood Glucose", value: "98", unit: "mg/dL", refInterval: "70 - 120", flag: "Normal" },
    ],
  },
  {
    orderId: "LAB-8802",
    pet: "Luna",
    petId: "PET-0002",
    species: "Feline",
    breed: "Persian",
    owner: "Vikram Shetty",
    phone: "+91 90000 66666",
    testName: "Kidney Function Biochemistry & Urinalysis",
    profile: "Renal Profile",
    sampleType: "Whole Blood EDTA + Urine",
    barcode: "BC-8802-LUN",
    tat: "30 mins",
    priority: "Routine",
    doctor: "Dr. Rohit Sharma",
    date: "2026-08-22",
    time: "11:15 AM",
    status: "Completed",
    isAbnormal: true,
    parameters: [
      { name: "Blood Urea Nitrogen (BUN)", value: "34.5", unit: "mg/dL", refInterval: "16.0 - 36.0", flag: "Normal" },
      { name: "Serum Creatinine", value: "2.1", unit: "mg/dL", refInterval: "0.8 - 2.4", flag: "Normal" },
      { name: "Phosphorus", value: "4.8", unit: "mg/dL", refInterval: "3.1 - 7.5", flag: "Normal" },
      { name: "Urine Specific Gravity (USG)", value: "1.028", unit: "", refInterval: "1.035 - 1.060", flag: "Low" },
    ],
  },
  {
    orderId: "LAB-8803",
    pet: "Rocky",
    petId: "PET-0003",
    species: "Canine",
    breed: "German Shepherd",
    owner: "Kavitha Nair",
    phone: "+91 90000 77777",
    testName: "Pre-Operative Coagulation & Complete Blood Count (CBC)",
    profile: "Hematology & Coagulation",
    sampleType: "Whole Blood EDTA + Citrate",
    barcode: "BC-8803-ROC",
    tat: "60 mins",
    priority: "Pre-Op Urgent",
    doctor: "Dr. Aisha Nair",
    date: "2026-08-22",
    time: "12:00 PM",
    status: "Processing",
    isAbnormal: false,
    parameters: [],
  },
  {
    orderId: "LAB-8804",
    pet: "Coco",
    petId: "PET-0008",
    species: "Canine",
    breed: "Shih Tzu",
    owner: "Deepika Iyer",
    phone: "+91 90000 33333",
    testName: "Skin Scraping Cytology & Fungal DTM Culture",
    profile: "Dermatology & Cytology",
    sampleType: "Skin Impression Slide",
    barcode: "BC-8804-COC",
    tat: "2 hours",
    priority: "Routine",
    doctor: "Dr. Rohit Sharma",
    date: "2026-08-22",
    time: "01:30 PM",
    status: "Sample Collected",
    isAbnormal: false,
    parameters: [],
  },
];

export const listLabOrdersFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<any[]> => {
    await connectDB();
    const count = await ErpRow.countDocuments({ moduleId: "lab_orders" });
    if (count === 0) {
      for (const item of SEED_LAB_ORDERS) {
        await ErpRow.create({ moduleId: "lab_orders", data: item });
      }
    }
    const docs = await ErpRow.find({ moduleId: "lab_orders" }).sort({ createdAt: -1 }).lean();
    return toPlain(docs.map((d) => d.data));
  });

export const createLabOrderFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.record(z.any()).parse(raw))
  .handler(async ({ data }): Promise<any> => {
    await connectDB();
    const doc = await ErpRow.create({
      moduleId: "lab_orders",
      data,
    });
    return toPlain(doc.data);
  });

export const updateLabResultsFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ orderId: z.string(), patch: z.record(z.any()) }).parse(raw))
  .handler(async ({ data }): Promise<boolean> => {
    await connectDB();
    const existing = await ErpRow.findOne({ moduleId: "lab_orders", "data.orderId": data.orderId });
    if (existing) {
      existing.data = { ...existing.data, ...data.patch };
      existing.markModified("data");
      await existing.save();
    }
    return true;
  });
