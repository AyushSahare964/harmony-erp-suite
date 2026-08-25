import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { ErpRow } from "@/lib/mongodb/models/ErpRow";

function toPlain<T>(v: any): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const SEED_SYSTEM_REPORTS = [
  {
    reportId: "REP-4011",
    title: "Comprehensive Biochemistry 14-Parameter Panel",
    category: "Laboratory",
    pet: "Bruno",
    petId: "PET-0001",
    species: "Canine",
    breed: "Golden Retriever",
    owner: "Tariq Hussain",
    ownerPhone: "+91 90000 11111",
    doctor: "Dr. Rohit Sharma",
    date: "2026-08-22",
    status: "Verified & Signed",
    isNarrative: false,
    impression: "Renal and hepatic profiles within normal canine limits. Total protein and albumin optimal.",
  },
  {
    reportId: "REP-4012",
    title: "Digital Radiography — Left Stifle & Pelvis X-Ray",
    category: "Radiology & Imaging",
    pet: "Rocky",
    petId: "PET-0003",
    species: "Canine",
    breed: "German Shepherd",
    owner: "Kavitha Nair",
    ownerPhone: "+91 90000 77777",
    doctor: "Dr. Aisha Nair",
    date: "2026-08-22",
    status: "Verified & Signed",
    isNarrative: true,
    narrative: "Two-view orthogonal radiographs of left stifle joint demonstrate intact cruciate ligament post-op stabilization plate. No implant loosening or periosteal reaction noted.",
    impression: "Satisfactory bone union progression following TPLO procedure. Recommended hydrotherapy rehab.",
  },
  {
    reportId: "REP-4013",
    title: "Kidney Function Biochemistry & Urinalysis",
    category: "Laboratory",
    pet: "Luna",
    petId: "PET-0002",
    species: "Feline",
    breed: "Persian",
    owner: "Vikram Shetty",
    ownerPhone: "+91 90000 66666",
    doctor: "Dr. Rohit Sharma",
    date: "2026-08-22",
    status: "Verified & Signed",
    isNarrative: false,
    parameters: [
      { name: "Blood Urea Nitrogen (BUN)", value: "34.5", unit: "mg/dL", refInterval: "16.0 - 36.0", flag: "Normal" },
      { name: "Serum Creatinine", value: "2.1", unit: "mg/dL", refInterval: "0.8 - 2.4", flag: "Normal" },
      { name: "Phosphorus", value: "4.8", unit: "mg/dL", refInterval: "3.1 - 7.5", flag: "Normal" },
      { name: "Urine Specific Gravity (USG)", value: "1.028", unit: "", refInterval: "1.035 - 1.060", flag: "Low" },
    ],
    impression: "Early Stage II IRIS Chronic Kidney Disease. Prescribed Royal Canin Renal Support diet.",
  },
  {
    reportId: "REP-4014",
    title: "Canine Ovariohysterectomy (Spay) Surgical Record",
    category: "Surgical & OT",
    pet: "Coco",
    petId: "PET-0008",
    species: "Canine",
    breed: "Shih Tzu",
    owner: "Deepika Iyer",
    ownerPhone: "+91 90000 33333",
    doctor: "Dr. Rohit Sharma",
    date: "2026-08-21",
    status: "Verified & Signed",
    isNarrative: true,
    narrative: "Routine elective ovariohysterectomy performed via mid-ventral celiotomy. Both ovaries and uterine horns fully ligated with 2-0 Vicryl. Hemostasis complete. Subcuticular intradermal skin closure.",
    impression: "Procedure uneventful. Recovery from isoflurane anaesthesia smooth. Suture check in 10 days.",
  },
  {
    reportId: "REP-4015",
    title: "Clinical Hydrotherapy & Range-of-Motion Assessment",
    category: "Rehab & Nutrition",
    pet: "Rocky",
    petId: "PET-0003",
    species: "Canine",
    breed: "German Shepherd",
    owner: "Kavitha Nair",
    ownerPhone: "+91 90000 77777",
    doctor: "Dr. Aisha Nair",
    date: "2026-08-22",
    status: "Verified & Signed",
    isNarrative: true,
    narrative: "45-minute warm water hydrotherapy session. Left hindlimb extension improved by 15 degrees. Weight bearing on affected limb reached 85% without pain response.",
    impression: "Significant mobility gains. Maintain bi-weekly pool sessions for 4 weeks.",
  },
  {
    reportId: "REP-4016",
    title: "External Referral Ultrasound Scan (City Pet Diagnostics)",
    category: "Uploaded External",
    pet: "Simba",
    petId: "PET-0007",
    species: "Feline",
    breed: "Maine Coon",
    owner: "Nalini Prasad",
    ownerPhone: "+91 90000 22222",
    doctor: "Dr. Aisha Nair",
    facility: "City Pet Imaging & Referral Clinic",
    date: "2026-08-20",
    status: "Verified & Signed",
    isNarrative: true,
    narrative: "Uploaded external ultrasound examination of abdominal cavity. Gastric mucosa slightly thickened (3.2mm) consistent with chronic hairball gastritis. Liver and spleen unremarkable.",
    impression: "Gastric hairball irritation. Initiated Royal Canin Hairball Care diet.",
  },
];

export const listClinicalReportsFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<any[]> => {
    await connectDB();
    const count = await ErpRow.countDocuments({ moduleId: "clinical_reports" });
    if (count === 0) {
      for (const item of SEED_SYSTEM_REPORTS) {
        await ErpRow.create({ moduleId: "clinical_reports", data: item });
      }
    }
    const docs = await ErpRow.find({ moduleId: "clinical_reports" }).sort({ createdAt: -1 }).lean();
    return toPlain(docs.map((d) => d.data));
  });

export const createClinicalReportFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.record(z.any()).parse(raw))
  .handler(async ({ data }): Promise<any> => {
    await connectDB();
    const doc = await ErpRow.create({
      moduleId: "clinical_reports",
      data,
    });
    return toPlain(doc.data);
  });

export const deleteClinicalReportFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ reportId: z.string() }).parse(raw))
  .handler(async ({ data }): Promise<boolean> => {
    await connectDB();
    await ErpRow.findOneAndDelete({ moduleId: "clinical_reports", "data.reportId": data.reportId });
    return true;
  });
