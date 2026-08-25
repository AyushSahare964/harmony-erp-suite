import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { Owner, type IOwner } from "@/lib/mongodb/models/Owner";
import { Pet, type IPet } from "@/lib/mongodb/models/Pet";
import { nextSeq, peekNextSeq } from "./counters";

function toPlain<T>(v: any): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

// ─── Max Seq Helpers ──────────────────────────────────────────────────────────

async function maxOwnerSeq(): Promise<number> {
  const latest = (await Owner.findOne({}).sort({ ownerId: -1 }).lean()) as { ownerId?: string } | null;
  if (!latest?.ownerId) return 0;
  const num = parseInt(latest.ownerId.replace(/^[^\d]+/, ""), 10);
  return isNaN(num) ? 0 : num;
}

async function maxPetSeq(): Promise<number> {
  const latest = (await Pet.findOne({}).sort({ petId: -1 }).lean()) as { petId?: string } | null;
  if (!latest?.petId) return 0;
  const num = parseInt(latest.petId.replace(/^[^\d]+/, ""), 10);
  return isNaN(num) ? 0 : num;
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const SEED_OWNERS = [
  { ownerId: "OWN-0001", name: "Atul Bhise", phone: "9823011221", altPhone: "9823011222", email: "atul.bhise@gmail.com", address: "Dharampeth, Nagpur", city: "Nagpur", gender: "Male", dob: "1988-05-14", outstandingBalance: 0, preferredPaymentMode: "UPI" },
  { ownerId: "OWN-0002", name: "Abhilash Bhusari", phone: "9823044556", email: "abhilash.b@yahoo.com", address: "Ramdaspeth, Nagpur", city: "Nagpur", gender: "Male", dob: "1992-11-20", outstandingBalance: -20, preferredPaymentMode: "Cash" },
  { ownerId: "OWN-0003", name: "Ambarish Deshpande", phone: "9422188776", email: "ambarish.d@rediffmail.com", address: "Civil Lines, Nagpur", city: "Nagpur", gender: "Male", dob: "1985-02-18", outstandingBalance: 0, preferredPaymentMode: "Card" },
  { ownerId: "OWN-0004", name: "Arthlekha Gaikwad", phone: "9765432100", email: "arthlekha.g@gmail.com", address: "Perfect Society, Nagpur", city: "Nagpur", gender: "Female", dob: "1996-07-29", outstandingBalance: 0, preferredPaymentMode: "UPI" },
  { ownerId: "OWN-0005", name: "Abhilash Gupta", phone: "9822998877", email: "abhilash.gupta@gmail.com", address: "Pratap Nagar, Nagpur", city: "Nagpur", gender: "Male", dob: "1990-09-03", outstandingBalance: 0, preferredPaymentMode: "UPI" },
  { ownerId: "OWN-0006", name: "Tariq Hussain", phone: "+91 90000 11111", email: "tariq.h@gmail.com", address: "Sadar, Nagpur", city: "Nagpur", gender: "Male", dob: "1984-03-12", outstandingBalance: 0, preferredPaymentMode: "UPI" },
  { ownerId: "OWN-0007", name: "Nalini Prasad", phone: "+91 90000 22222", email: "nalini.p@gmail.com", address: "Manish Nagar, Nagpur", city: "Nagpur", gender: "Female", dob: "1991-08-25", outstandingBalance: 0, preferredPaymentMode: "UPI" },
  { ownerId: "OWN-0008", name: "Deepika Iyer", phone: "+91 90000 33333", email: "deepika.iyer@gmail.com", address: "Wardha Road, Nagpur", city: "Nagpur", gender: "Female", dob: "1993-12-10", outstandingBalance: 0, preferredPaymentMode: "Card" },
];

const SEED_PETS = [
  { petId: "PET-0001", ownerId: "OWN-0001", name: "Bozo", species: "Canine" as const, breed: "Golden Retriever", gender: "Male" as const, ageYears: 4, weightKg: 28.5, sterilizationStatus: "Sterilized" as const, allergies: [], status: "Active" as const, color: "Golden" },
  { petId: "PET-0002", ownerId: "OWN-0002", name: "XYZ", species: "Feline" as const, breed: "Persian Cat", gender: "Female" as const, ageYears: 2, weightKg: 4.2, sterilizationStatus: "Intact" as const, allergies: [], status: "Active" as const, color: "White" },
  { petId: "PET-0003", ownerId: "OWN-0003", name: "Bruno", species: "Canine" as const, breed: "German Shepherd", gender: "Male" as const, ageYears: 5, dob: "2021-06-22", weightKg: 34.0, sterilizationStatus: "Intact" as const, allergies: ["Penicillin"], status: "Active" as const, color: "Black & Tan" },
  { petId: "PET-0004", ownerId: "OWN-0004", name: "Tittu", species: "Canine" as const, breed: "Labrador Retriever", gender: "Male" as const, ageYears: 3, weightKg: 31.0, sterilizationStatus: "Sterilized" as const, allergies: [], status: "Vaccination due" as const, color: "Chocolate" },
  { petId: "PET-0005", ownerId: "OWN-0005", name: "Jimmy", species: "Canine" as const, breed: "Pug", gender: "Male" as const, ageYears: 6, weightKg: 8.5, sterilizationStatus: "Sterilized" as const, allergies: [], status: "Active" as const, color: "Fawn" },
  { petId: "PET-0006", ownerId: "OWN-0006", name: "Bruno", species: "Canine" as const, breed: "Rottweiler", gender: "Male" as const, ageYears: 4, weightKg: 38.0, sterilizationStatus: "Intact" as const, allergies: [], status: "Active" as const, color: "Black" },
  { petId: "PET-0007", ownerId: "OWN-0007", name: "Simba", species: "Feline" as const, breed: "Maine Coon", gender: "Male" as const, ageYears: 2, weightKg: 7.2, sterilizationStatus: "Sterilized" as const, allergies: [], status: "Active" as const, color: "Orange Tabby" },
  { petId: "PET-0008", ownerId: "OWN-0008", name: "Coco", species: "Canine" as const, breed: "Shih Tzu", gender: "Female" as const, ageYears: 7, weightKg: 6.8, sterilizationStatus: "Spayed Female" as const, allergies: ["NSAIDs"], status: "Vaccination due" as const, color: "White & Brown" },
];

async function ensureCRMSeeded() {
  await connectDB();
  const count = await Owner.countDocuments();
  if (count === 0) {
    for (const o of SEED_OWNERS) {
      await Owner.findOneAndUpdate({ ownerId: o.ownerId }, { $setOnInsert: o }, { upsert: true });
    }
    for (const p of SEED_PETS) {
      await Pet.findOneAndUpdate({ petId: p.petId }, { $setOnInsert: p }, { upsert: true });
    }
  }
}

// ─── Input Schemas ────────────────────────────────────────────────────────────

const CreateOwnerInputZ = z.object({
  name: z.string().min(1, "Owner name is required"),
  phone: z.string().min(8, "Valid phone number is required"),
  altPhone: z.string().optional(),
  email: z.string().optional(),
  gender: z.enum(["Male", "Female", "Other"]).optional(),
  dob: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional().default("Nagpur"),
  idProofType: z.enum(["Aadhaar", "PAN", "Driving License", "Passport", "Other"]).optional(),
  idProofNo: z.string().optional(),
  preferredPaymentMode: z.enum(["UPI", "Cash", "Card", "Credit"]).optional().default("UPI"),
  referredBy: z.string().optional(),
  outstandingBalance: z.number().optional().default(0),
  notes: z.string().optional(),
});

const PetDraftInputZ = z.object({
  name: z.string().min(1, "Pet name is required"),
  species: z.enum(["Canine", "Feline", "Avian", "Rabbit", "Exotic", "Other"]).default("Canine"),
  breed: z.string().min(1, "Breed is required"),
  gender: z.enum(["Male", "Female", "Neutered Male", "Spayed Female"]).default("Male"),
  dob: z.string().optional(),
  ageYears: z.number().optional(),
  ageMonths: z.number().optional(),
  color: z.string().optional(),
  weightKg: z.number().optional(),
  microchipNo: z.string().optional(),
  sterilizationStatus: z.enum(["Intact", "Sterilized", "Unknown"]).default("Unknown"),
  bloodGroup: z.string().optional(),
  allergies: z.array(z.string()).optional().default([]),
  chronicConditions: z.array(z.string()).optional().default([]),
  dietPreference: z.string().optional(),
  medicalNotes: z.string().optional(),
  status: z.enum(["Active", "Vaccination due", "Under treatment", "Deceased", "Transferred", "Inactive"]).default("Active"),
  nextVaccineDate: z.string().optional(),
  nextDewormingDate: z.string().optional(),
});

const CreatePetInputZ = PetDraftInputZ.extend({
  ownerId: z.string().min(1, "Owner ID is required"),
});

const CreateOwnerWithMultiplePetsInputZ = z.object({
  owner: CreateOwnerInputZ,
  pets: z.array(PetDraftInputZ).min(1, "At least one pet must be registered"),
});

const UpdatePetInputZ = z.object({
  petId: z.string().min(1),
  updates: PetDraftInputZ.partial().extend({
    ownerId: z.string().optional(),
  }),
});

const UpdateOwnerInputZ = z.object({
  ownerId: z.string().min(1),
  updates: CreateOwnerInputZ.partial(),
});

// ─── Server Functions ─────────────────────────────────────────────────────────

export const peekNextOwnerIdFn = createServerFn({ method: "GET" }).handler(async () => {
  await ensureCRMSeeded();
  return peekNextSeq("owner", "OWN", 4, maxOwnerSeq);
});

export const peekNextPetIdFn = createServerFn({ method: "GET" }).handler(async () => {
  await ensureCRMSeeded();
  return peekNextSeq("pet", "PET", 4, maxPetSeq);
});

export const searchOwnersFn = createServerFn({ method: "GET" })
  .validator((query: unknown) => (typeof query === "string" ? query : ""))
  .handler(async ({ data: query }: { data: string }) => {
    await ensureCRMSeeded();
    const filter = query.trim()
      ? {
          $or: [
            { name: { $regex: query.trim(), $options: "i" } },
            { phone: { $regex: query.trim(), $options: "i" } },
            { email: { $regex: query.trim(), $options: "i" } },
            { ownerId: { $regex: query.trim(), $options: "i" } },
          ],
        }
      : {};

    const owners = await Owner.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    const ownerIds = owners.map((o: any) => o.ownerId);
    const pets = await Pet.find({ ownerId: { $in: ownerIds } }).lean();

    const result = owners.map((o: any) => ({
      ...o,
      pets: pets.filter((p: any) => p.ownerId === o.ownerId),
    }));

    return toPlain<any[]>(result);
  });

export const listOwnersWithPetsFn = createServerFn({ method: "GET" }).handler(async () => {
  try {
    await ensureCRMSeeded();
    const owners = await Owner.find({}).sort({ createdAt: -1 }).limit(200).lean();
    const ownerIds = owners.map((o: any) => o.ownerId);
    const pets = await Pet.find({ ownerId: { $in: ownerIds } }).lean();

    const result = owners.map((o: any) => ({
      ...o,
      pets: pets.filter((p: any) => p.ownerId === o.ownerId),
    }));

    return toPlain<any[]>(result);
  } catch (err) {
    console.warn("[CRM] listOwnersWithPets fallback:", err);
    const result = SEED_OWNERS.map((o) => ({
      ...o,
      pets: SEED_PETS.filter((p) => p.ownerId === o.ownerId),
    }));
    return toPlain<any[]>(result);
  }
});

export const listPetsWithOwnersFn = createServerFn({ method: "GET" }).handler(async () => {
  try {
    await ensureCRMSeeded();
    const pets = await Pet.find({}).sort({ createdAt: -1 }).limit(200).lean();
    const ownerIds = [...new Set(pets.map((p: any) => p.ownerId))];
    const owners = await Owner.find({ ownerId: { $in: ownerIds } }).lean();
    const ownerMap = new Map(owners.map((o: any) => [o.ownerId, o]));

    const result = pets.map((p: any) => ({
      ...p,
      owner: ownerMap.get(p.ownerId) || { name: "Unknown Owner", phone: "N/A", outstandingBalance: 0 },
    }));

    return toPlain<any[]>(result);
  } catch (err) {
    console.warn("[CRM] listPetsWithOwners fallback:", err);
    const ownerMap = new Map(SEED_OWNERS.map((o) => [o.ownerId, o]));
    const result = SEED_PETS.map((p) => ({
      ...p,
      owner: ownerMap.get(p.ownerId) || { name: "Unknown Owner", phone: "N/A", outstandingBalance: 0 },
    }));
    return toPlain<any[]>(result);
  }
});

export const createOwnerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => CreateOwnerInputZ.parse(data))
  .handler(async ({ data }: { data: z.infer<typeof CreateOwnerInputZ> }) => {
    await connectDB();
    const ownerId = await nextSeq("owner", "OWN", 4, maxOwnerSeq);
    const docPayload: any = { ...data, ownerId };
    const newOwner = await Owner.create(docPayload);
    return toPlain<any>(newOwner.toObject ? newOwner.toObject() : newOwner);
  });

export const createPetFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => CreatePetInputZ.parse(data))
  .handler(async ({ data }: { data: z.infer<typeof CreatePetInputZ> }) => {
    await connectDB();
    const petId = await nextSeq("pet", "PET", 4, maxPetSeq);
    const docPayload: any = { ...data, petId };
    const newPet = await Pet.create(docPayload);
    return toPlain<any>(newPet.toObject ? newPet.toObject() : newPet);
  });

export const createOwnerWithMultiplePetsFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => CreateOwnerWithMultiplePetsInputZ.parse(data))
  .handler(async ({ data }: { data: z.infer<typeof CreateOwnerWithMultiplePetsInputZ> }) => {
    await connectDB();
    // 1. Create owner with auto-generated ID
    const ownerId = await nextSeq("owner", "OWN", 4, maxOwnerSeq);
    const ownerDoc = await Owner.create({ ...data.owner, ownerId });

    // 2. Create all linked pets with sequential auto-generated Pet IDs
    const createdPets = [];
    for (const petData of data.pets) {
      const petId = await nextSeq("pet", "PET", 4, maxPetSeq);
      const petDoc = await Pet.create({
        ...petData,
        petId,
        ownerId,
      });
      createdPets.push(petDoc.toObject ? petDoc.toObject() : petDoc);
    }

    return toPlain<{ owner: any; pets: any[] }>({
      owner: ownerDoc.toObject ? ownerDoc.toObject() : ownerDoc,
      pets: createdPets,
    });
  });

export const updatePetFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => UpdatePetInputZ.parse(data))
  .handler(async ({ data }: { data: z.infer<typeof UpdatePetInputZ> }) => {
    await connectDB();
    const updated = await Pet.findOneAndUpdate(
      { petId: data.petId },
      { $set: data.updates },
      { new: true }
    ).lean();
    return toPlain<any>(updated);
  });

export const updateOwnerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => UpdateOwnerInputZ.parse(data))
  .handler(async ({ data }: { data: z.infer<typeof UpdateOwnerInputZ> }) => {
    await connectDB();
    const updated = await Owner.findOneAndUpdate(
      { ownerId: data.ownerId },
      { $set: data.updates },
      { new: true }
    ).lean();
    return toPlain<any>(updated);
  });

export const deletePetFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ petId: z.string() }).parse(data))
  .handler(async ({ data }: { data: { petId: string } }) => {
    await connectDB();
    await Pet.deleteOne({ petId: data.petId });
    return { success: true };
  });

export const deleteOwnerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ ownerId: z.string() }).parse(data))
  .handler(async ({ data }: { data: { ownerId: string } }) => {
    await connectDB();
    await Owner.deleteOne({ ownerId: data.ownerId });
    await Pet.deleteMany({ ownerId: data.ownerId });
    return { success: true };
  });
