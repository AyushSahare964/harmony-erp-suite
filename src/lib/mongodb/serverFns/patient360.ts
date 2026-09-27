import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { Pet } from "@/lib/mongodb/models/Pet";
import { Owner } from "@/lib/mongodb/models/Owner";
import { ClinicalVisit } from "@/lib/mongodb/models/ClinicalVisit";
import { Vaccination } from "@/lib/mongodb/models/Vaccination";
import { DewormingRecord } from "@/lib/mongodb/models/DewormingRecord";
import { ErpRow } from "@/lib/mongodb/models/ErpRow";

function toPlain<T>(v: any): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const FILES_MODULE = "patient_files";
const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const last10 = (p: unknown) =>
  String(p ?? "")
    .replace(/\D/g, "")
    .slice(-10);

/**
 * Read-only aggregate for the Patient 360° profile. Every section is loaded
 * independently so one failing collection never blanks the whole profile —
 * failures come back in `errors` keyed by section.
 */
export const getPatient360Fn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => z.object({ petId: z.string().min(1) }).parse(raw))
  .handler(async ({ data }) => {
    await connectDB();
    const pet = (await Pet.findOne({ petId: data.petId }).lean()) as any;
    if (!pet) throw new Error(`Patient ${data.petId} not found`);

    const sections = {
      owner: () => Owner.findOne({ ownerId: pet.ownerId }).lean(),
      otherPets: () =>
        Pet.find({ ownerId: pet.ownerId, petId: { $ne: pet.petId } })
          .select("petId name species breed gender status photoUrl")
          .lean(),
      // ponytail: whole visit history for one pet in one read; paginate server-side if a pet ever exceeds a few hundred visits
      visits: () =>
        ClinicalVisit.find({ petId: pet.petId })
          .sort({ date: -1, createdAt: -1 })
          .limit(500)
          .lean(),
      appointments: async () => {
        const owner = (await Owner.findOne({ ownerId: pet.ownerId }).select("phone").lean()) as any;
        const rows = await ErpRow.find({
          moduleId: "appointments",
          $or: [
            { "data.petId": pet.petId },
            { "data.pet": { $regex: `^${escapeRx(pet.name)}$`, $options: "i" } },
          ],
        })
          .sort({ createdAt: -1 })
          .limit(300)
          .lean();
        // Rows matched only by name must also belong to this owner, so a
        // same-named pet of another client never leaks into this profile.
        return rows
          .map((r: any) => r.data || {})
          .filter(
            (a: any) =>
              a.petId === pet.petId ||
              (!a.petId &&
                (a.ownerId === pet.ownerId ||
                  (last10(a.ownerPhone || a.phone) !== "" &&
                    last10(a.ownerPhone || a.phone) === last10(owner?.phone)))),
          );
      },
      vaccinations: () =>
        Vaccination.find({ patientId: pet.petId }).sort({ dateGiven: -1 }).limit(200).lean(),
      dewormings: () =>
        DewormingRecord.find({ patientId: pet.petId }).sort({ dateGiven: -1 }).limit(200).lean(),
      files: () =>
        ErpRow.find({ moduleId: FILES_MODULE, "data.petId": pet.petId })
          .select({ "data.dataUrl": 0 })
          .sort({ createdAt: -1 })
          .lean()
          .then((rows: any[]) => rows.map((r) => r.data)),
    };

    const keys = Object.keys(sections) as (keyof typeof sections)[];
    const settled = await Promise.allSettled(keys.map((k) => sections[k]()));
    const result: Record<string, unknown> = { pet };
    const errors: Record<string, string> = {};
    settled.forEach((s, i) => {
      const key = keys[i]!;
      if (s.status === "fulfilled") result[key] = s.value;
      else {
        console.error(`[patient360] ${key} failed for ${pet.petId}:`, s.reason);
        errors[key] = String((s.reason as Error)?.message || s.reason);
      }
    });
    return toPlain<any>({ ...result, errors });
  });

// ─── Patient documents & photos ──────────────────────────────────────────────

const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
/** ~3 MB of file after base64 — keeps each upload under serverless body limits. */
const MAX_DATA_URL_CHARS = 4_100_000;

const AddPatientFileInputZ = z
  .object({
    petId: z.string().min(1),
    kind: z.enum(["document", "photo"]),
    category: z.string().max(80).default("Other"),
    name: z.string().min(1).max(200),
    mime: z.enum(ALLOWED_MIME as [string, ...string[]]),
    size: z.number().int().min(1),
    description: z.string().max(1000).optional(),
    date: z.string().optional(),
    uploadedBy: z.string().max(120).optional(),
    dataUrl: z.string().max(MAX_DATA_URL_CHARS, "File too large (max 3 MB)"),
    /** Small JPEG preview for photos, returned with the list so the gallery needs no per-image fetch. */
    thumbUrl: z.string().startsWith("data:image/").max(200_000).optional(),
  })
  .refine(
    (d) => d.dataUrl.startsWith(`data:${d.mime};base64,`),
    "File content does not match its type",
  );

export const addPatientFileFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => AddPatientFileInputZ.parse(raw))
  .handler(async ({ data }) => {
    await connectDB();
    // Every file must hang off a real patient — never stored unassociated.
    if (!(await Pet.exists({ petId: data.petId })))
      throw new Error(`Patient ${data.petId} not found`);
    const fileId = `PF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const record = {
      ...data,
      fileId,
      date: data.date || new Date().toISOString().slice(0, 10),
      uploadedAt: new Date().toISOString(),
    };
    await ErpRow.create({ moduleId: FILES_MODULE, data: record });
    const { dataUrl: _omit, ...meta } = record;
    return toPlain<any>(meta);
  });

export const getPatientFileFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => z.object({ fileId: z.string().min(1) }).parse(raw))
  .handler(async ({ data }) => {
    await connectDB();
    const row = (await ErpRow.findOne({
      moduleId: FILES_MODULE,
      "data.fileId": data.fileId,
    }).lean()) as any;
    if (!row) throw new Error("File not found");
    return toPlain<any>(row.data);
  });

export const deletePatientFileFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ fileId: z.string().min(1) }).parse(raw))
  .handler(async ({ data }) => {
    await connectDB();
    await ErpRow.deleteOne({ moduleId: FILES_MODULE, "data.fileId": data.fileId });
    return { success: true };
  });
