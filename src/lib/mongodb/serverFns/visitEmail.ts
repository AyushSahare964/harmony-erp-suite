/**
 * Bill + prescription email: server-side checks for the "Email to Client" button.
 * The PDFs themselves are built and sent from the browser (see lib/email/visitDocsEmail.ts),
 * so they never touch this server or any storage.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { ClinicalVisit } from "@/lib/mongodb/models/ClinicalVisit";
import { Pet } from "@/lib/mongodb/models/Pet";
import { Owner } from "@/lib/mongodb/models/Owner";
import { getMeFn } from "./auth";

const visitZ = z.object({ visitId: z.string().min(1) });

async function requireStaff() {
  const me = await getMeFn();
  if (!me || !["admin", "doctor", "reception"].includes(me.roleId)) throw new Error("Not permitted");
}

export interface VisitEmailTarget {
  visitId: string;
  invoiceNo: string;
  prescriptionNo: string;
  petName: string;
  ownerName: string;
  /** From the owner record, not from the browser. Empty when none is on file. */
  email: string;
  billEmailSentAt?: string | undefined;
}

/** The visit's owner email, after confirming visit, pet and owner all point at the same patient. */
export const getVisitEmailTargetFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => visitZ.parse(raw))
  .handler(async ({ data }): Promise<VisitEmailTarget> => {
    await requireStaff();
    await connectDB();
    const visit = await ClinicalVisit.findOne({ visitId: data.visitId }).lean();
    if (!visit) throw new Error("Visit not found");
    const pet = await Pet.findOne({ petId: visit.petId }).lean();
    if (!pet || pet.ownerId !== visit.ownerId) throw new Error("Visit's patient and owner do not match; not sending.");
    const owner = await Owner.findOne({ ownerId: visit.ownerId }).lean();
    return {
      visitId: visit.visitId,
      invoiceNo: visit.invoiceNo,
      prescriptionNo: visit.prescriptionNo,
      petName: visit.petName,
      ownerName: owner?.name || visit.ownerName,
      email: (owner?.email || "").trim(),
      billEmailSentAt: visit.billEmailSentAt,
    };
  });

/** Call only after EmailJS confirmed the send. */
export const markVisitEmailedFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => visitZ.parse(raw))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    await requireStaff();
    await connectDB();
    await ClinicalVisit.updateOne({ visitId: data.visitId }, { $set: { billEmailSentAt: new Date().toISOString() } });
    return { ok: true };
  });
