/**
 * Party server functions — clients and suppliers, their ledgers, outstanding
 * and credit control.
 *
 * Every handler declares an explicit plain return type and maps documents to a
 * DTO. Returning a lean mongoose document directly drags its internal types
 * across the server-function boundary, which does not serialise.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { PartyModel } from "@/lib/mongodb/models/Party";
import { Owner } from "@/lib/mongodb/models/Owner";
import {
  PartyLedgerModel,
  computePartyBalance,
  computeBalances,
} from "@/lib/mongodb/models/PartyLedger";
import { SalesDocModel } from "@/lib/mongodb/models/SalesDoc";
import { nextSeq } from "./counters";
import { roundMoney } from "@/lib/utils/moneyUtils";
import { todayIST, ageingBucket, daysBetweenISO } from "@/lib/utils/dateUtils";
import {
  validateGstinAgainstState,
  validatePan,
  validateIfsc,
  validateMobile,
  validatePin,
  normaliseMobile,
  collectErrors,
} from "@/lib/finance/validators";

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface PartyRow {
  _id: string;
  partyId: string;
  partyType: "CLIENT" | "SUPPLIER" | "BOTH";
  ownerId: string;
  supplierRefId: string;
  displayName: string;
  legalName: string;
  contactPerson: string;
  mobile: string;
  phone: string;
  email: string;
  billingAddress: string;
  city: string;
  stateCode: string;
  pin: string;
  country: string;
  gstin: string;
  pan: string;
  gstTreatment: string;
  docType: string;
  docNumber: string;
  openingBalance: number;
  openingType: "DR" | "CR";
  openingDate: string;
  creditAllowed: boolean;
  creditLimit: number;
  creditDays: number;
  dateOfBirth: string;
  anniversary: string;
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  photoPath: string;
  remark: string;
  isActive: boolean;
  /** Only populated when the caller asks for balances. */
  balance?: number;
}

function toRow(d: Record<string, unknown>): PartyRow {
  const s = (k: string) => String(d[k] ?? "");
  const n = (k: string) => Number(d[k] ?? 0);
  return {
    _id: String(d["_id"] ?? ""),
    partyId: s("partyId"),
    partyType: (d["partyType"] as PartyRow["partyType"]) ?? "CLIENT",
    ownerId: s("ownerId"),
    supplierRefId: s("supplierRefId"),
    displayName: s("displayName"),
    legalName: s("legalName"),
    contactPerson: s("contactPerson"),
    mobile: s("mobile"),
    phone: s("phone"),
    email: s("email"),
    billingAddress: s("billingAddress"),
    city: s("city"),
    stateCode: s("stateCode") || "27",
    pin: s("pin"),
    country: s("country") || "India",
    gstin: s("gstin"),
    pan: s("pan"),
    gstTreatment: s("gstTreatment") || "UNREGISTERED",
    docType: s("docType"),
    docNumber: s("docNumber"),
    openingBalance: n("openingBalance"),
    openingType: (d["openingType"] as "DR" | "CR") ?? "DR",
    openingDate: s("openingDate"),
    creditAllowed: Boolean(d["creditAllowed"]),
    creditLimit: n("creditLimit"),
    creditDays: n("creditDays"),
    dateOfBirth: s("dateOfBirth"),
    anniversary: s("anniversary"),
    bankName: s("bankName"),
    bankAccount: s("bankAccount"),
    bankIfsc: s("bankIfsc"),
    photoPath: s("photoPath"),
    remark: s("remark"),
    isActive: d["isActive"] !== false,
  };
}

export interface PartyPickerRow {
  partyId: string;
  displayName: string;
  mobile: string;
  gstin: string;
  stateCode: string;
  billingAddress: string;
  city: string;
  creditAllowed: boolean;
  creditLimit: number;
  creditDays: number;
  gstTreatment: string;
  partyType: string;
  ownerId: string;
}

export interface LedgerEntryRow {
  _id: string;
  entryDate: string;
  sourceKind: string;
  sourceNumber: string;
  narration: string;
  debit: number;
  credit: number;
  isReversal: boolean;
  runningBalance: number;
}

export interface PartyLedgerResult {
  openingBalance: number;
  closingBalance: number;
  entries: LedgerEntryRow[];
  nextCursor: string | null;
}

export interface OutstandingBillRow {
  docId: string;
  docNumber: string;
  docDate: string;
  grandTotal: number;
  paidAmount: number;
  balanceDue: number;
  ageDays: number;
  bucket: string;
  overdue: boolean;
}

export interface PartyOutstandingResult {
  partyId: string;
  partyName: string;
  totalOutstanding: number;
  ledgerBalance: number;
  buckets: Record<string, number>;
  bills: OutstandingBillRow[];
}

export interface CreditCheckResult {
  allowed: boolean;
  requiresOverride: boolean;
  reason: string;
  currentOutstanding: number;
  creditLimit: number;
  warning: string;
}

// ─── Input schema ─────────────────────────────────────────────────────────────

const PartyTypeZ = z.enum(["CLIENT", "SUPPLIER", "BOTH"]);

const SavePartyInputZ = z.object({
  partyId: z.string().optional(),
  partyType: PartyTypeZ.default("CLIENT"),
  ownerId: z.string().optional(),
  supplierRefId: z.string().optional(),

  displayName: z.string().min(1, "Name is required"),
  legalName: z.string().optional(),
  contactPerson: z.string().optional(),

  mobile: z.string().min(1, "Mobile number is required"),
  phone: z.string().optional(),
  email: z.string().optional(),

  billingAddress: z.string().optional(),
  city: z.string().optional(),
  stateCode: z.string().default("27"),
  pin: z.string().optional(),
  country: z.string().default("India"),

  gstin: z.string().optional(),
  pan: z.string().optional(),
  gstTreatment: z
    .enum(["REGULAR", "COMPOSITION", "UNREGISTERED", "SEZ", "EXPORT"])
    .default("UNREGISTERED"),

  docType: z.string().optional(),
  docNumber: z.string().optional(),

  openingBalance: z.number().default(0),
  openingType: z.enum(["DR", "CR"]).default("DR"),
  openingDate: z.string().optional(),

  creditAllowed: z.boolean().default(false),
  creditLimit: z.number().default(0),
  creditDays: z.number().default(0),

  dateOfBirth: z.string().optional(),
  anniversary: z.string().optional(),

  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  bankIfsc: z.string().optional(),

  photoPath: z.string().optional(),
  remark: z.string().optional(),
  isActive: z.boolean().default(true),
});

export type SavePartyInput = z.infer<typeof SavePartyInputZ>;

/** Field-level validation, internal to server handler. */
function validateParty(input: SavePartyInput): Record<string, string> | null {
  const isSupplierSide = input.partyType === "SUPPLIER" || input.partyType === "BOTH";

  return collectErrors({
    displayName: input.displayName.trim() ? null : "Name is required",
    mobile: validateMobile(input.mobile, true),
    gstin: validateGstinAgainstState(input.gstin, input.stateCode),
    pan: validatePan(input.pan),
    pin: validatePin(input.pin),
    bankIfsc: isSupplierSide ? validateIfsc(input.bankIfsc) : null,
    stateCode: input.stateCode ? null : "State is required",
  });
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export const listPartiesFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z
      .object({
        type: z.enum(["CLIENT", "SUPPLIER", "BOTH", "ALL"]).default("ALL"),
        q: z.string().optional(),
        activeOnly: z.boolean().default(false),
        withBalance: z.boolean().default(false),
        limit: z.number().int().min(1).max(500).default(200),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data }): Promise<PartyRow[]> => {
    await connectDB();

    const filter: Record<string, unknown> = {};
    if (data.type !== "ALL") {
      // A BOTH party acts in either capacity, so it belongs in both lists.
      filter["partyType"] = data.type === "BOTH" ? "BOTH" : { $in: [data.type, "BOTH"] };
    }
    if (data.activeOnly) filter["isActive"] = true;
    if (data.q?.trim()) {
      const rx = { $regex: data.q.trim(), $options: "i" };
      filter["$or"] = [
        { displayName: rx },
        { mobile: rx },
        { gstin: rx },
        { partyId: rx },
        { city: rx },
      ];
    }

    const docs = await PartyModel.find(filter).sort({ displayName: 1 }).limit(data.limit).lean();
    const rows = docs.map((d) => toRow(d as unknown as Record<string, unknown>));

    if (!data.withBalance) return rows;

    const balances = await computeBalances(rows.map((p) => p.partyId));
    return rows.map((p) => ({ ...p, balance: balances.get(p.partyId) ?? 0 }));
  });

export const searchPartiesFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z
      .object({
        q: z.string().default(""),
        type: z.enum(["CLIENT", "SUPPLIER", "ALL"]).default("ALL"),
        limit: z.number().int().min(1).max(50).default(15),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data }): Promise<PartyPickerRow[]> => {
    await connectDB();
    const q = data.q.trim();
    // Type-ahead starts at 2 characters — one character matches nearly every
    // row and the dropdown stops being useful.
    if (q.length < 2) return [];

    const filter: Record<string, unknown> = {
      isActive: true,
      $or: [
        { displayName: { $regex: q, $options: "i" } },
        { mobile: { $regex: q, $options: "i" } },
        { partyId: { $regex: q, $options: "i" } },
      ],
    };
    if (data.type !== "ALL") filter["partyType"] = { $in: [data.type, "BOTH"] };

    const docs = await PartyModel.find(filter).sort({ displayName: 1 }).limit(data.limit).lean();

    return docs.map((d) => {
      const r = toRow(d as unknown as Record<string, unknown>);
      return {
        partyId: r.partyId,
        displayName: r.displayName,
        mobile: r.mobile,
        gstin: r.gstin,
        stateCode: r.stateCode,
        billingAddress: r.billingAddress,
        city: r.city,
        creditAllowed: r.creditAllowed,
        creditLimit: r.creditLimit,
        creditDays: r.creditDays,
        gstTreatment: r.gstTreatment,
        partyType: r.partyType,
        ownerId: r.ownerId,
      };
    });
  });

export const getPartyFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => z.object({ partyId: z.string().min(1) }).parse(raw))
  .handler(async ({ data }): Promise<PartyRow> => {
    await connectDB();
    const doc = await PartyModel.findOne({ partyId: data.partyId }).lean();
    if (!doc) throw new Error(`Party ${data.partyId} not found`);
    const row = toRow(doc as unknown as Record<string, unknown>);
    row.balance = await computePartyBalance(data.partyId);
    return row;
  });

// ─── Write ────────────────────────────────────────────────────────────────────

export const savePartyFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => SavePartyInputZ.parse(raw))
  .handler(async ({ data }): Promise<PartyRow> => {
    await connectDB();

    const errors = validateParty(data);
    if (errors) {
      throw new Error(
        `Please correct: ${Object.entries(errors)
          .map(([f, m]) => `${f} — ${m}`)
          .join("; ")}`,
      );
    }

    const mobile = normaliseMobile(data.mobile);
    const { partyId: _ignored, ...rest } = data;
    const payload: Record<string, unknown> = {
      ...rest,
      mobile,
      gstin: (data.gstin ?? "").toUpperCase(),
      pan: (data.pan ?? "").toUpperCase(),
    };

    // ── Update ──
    if (data.partyId) {
      const before = await PartyModel.findOne({ partyId: data.partyId }).lean();
      if (!before) throw new Error(`Party ${data.partyId} not found`);

      const openingChanged =
        Number(before.openingBalance ?? 0) !== data.openingBalance ||
        String(before.openingType ?? "DR") !== data.openingType;

      const updated = await PartyModel.findOneAndUpdate(
        { partyId: data.partyId },
        { $set: payload },
        { returnDocument: "after" },
      ).lean();
      if (!updated) throw new Error(`Party ${data.partyId} not found`);

      if (openingChanged) {
        await writeOpeningRow(
          data.partyId,
          data.openingBalance,
          data.openingType,
          data.openingDate,
        );
      }

      return toRow(updated as unknown as Record<string, unknown>);
    }

    // ── Create ──
    // Guard against the same person being added twice from two screens.
    const dupe = await PartyModel.findOne({
      mobile,
      displayName: data.displayName.trim(),
    }).lean();
    if (dupe) {
      throw new Error(
        `${data.displayName} with mobile ${mobile} already exists as ${String(dupe.partyId)}.`,
      );
    }

    const partyId = await nextSeq("party", "PTY", 4);
    const created = await PartyModel.create({ ...payload, partyId });

    if (data.openingBalance > 0) {
      await writeOpeningRow(partyId, data.openingBalance, data.openingType, data.openingDate);
    }

    return toRow(created.toObject() as unknown as Record<string, unknown>);
  });

/**
 * Opening balance is a ledger row like any other, not a special column.
 * Re-running replaces the previous OPENING row, so editing it cannot
 * double-count.
 */
export async function writeOpeningRow(
  partyId: string,
  amount: number,
  type: "DR" | "CR",
  openingDate?: string,
): Promise<void> {
  await PartyLedgerModel.deleteMany({ partyId, sourceKind: "OPENING" });
  if (!amount) return;

  await PartyLedgerModel.create({
    partyId,
    entryDate: openingDate || todayIST(),
    sourceKind: "OPENING",
    sourceNumber: "OPENING",
    narration: "Opening balance",
    debit: type === "DR" ? roundMoney(amount) : 0,
    credit: type === "CR" ? roundMoney(amount) : 0,
  });
}

// ─── Ledger ───────────────────────────────────────────────────────────────────

export const getPartyLedgerFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z
      .object({
        partyId: z.string().min(1),
        from: z.string().optional(),
        to: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(100),
        /** Keyset cursor: the previous page's last _id. */
        cursor: z.string().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }): Promise<PartyLedgerResult> => {
    await connectDB();

    const filter: Record<string, unknown> = { partyId: data.partyId };
    if (data.from || data.to) {
      const range: Record<string, string> = {};
      if (data.from) range["$gte"] = data.from;
      if (data.to) range["$lte"] = data.to;
      filter["entryDate"] = range;
    }
    // Keyset paging on (entryDate, _id) — never OFFSET, which degrades badly
    // once a party has thousands of rows.
    if (data.cursor) filter["_id"] = { $gt: data.cursor };

    const docs = await PartyLedgerModel.find(filter)
      .sort({ entryDate: 1, _id: 1 })
      .limit(data.limit)
      .lean();

    // The window's opening balance is everything strictly before it.
    let openingBefore = 0;
    if (data.from) {
      const [agg] = await PartyLedgerModel.aggregate<{ debit: number; credit: number }>([
        { $match: { partyId: data.partyId, entryDate: { $lt: data.from } } },
        { $group: { _id: null, debit: { $sum: "$debit" }, credit: { $sum: "$credit" } } },
      ]);
      openingBefore = roundMoney((agg?.debit ?? 0) - (agg?.credit ?? 0));
    }

    let running = openingBefore;
    const entries: LedgerEntryRow[] = docs.map((d) => {
      const debit = Number(d.debit ?? 0);
      const credit = Number(d.credit ?? 0);
      running = roundMoney(running + debit - credit);
      return {
        _id: String(d._id),
        entryDate: String(d.entryDate ?? ""),
        sourceKind: String(d.sourceKind ?? ""),
        sourceNumber: String(d.sourceNumber ?? ""),
        narration: String(d.narration ?? ""),
        debit,
        credit,
        isReversal: Boolean(d.isReversal),
        runningBalance: running,
      };
    });

    return {
      openingBalance: openingBefore,
      closingBalance: running,
      entries,
      nextCursor: docs.length === data.limit ? String(docs[docs.length - 1]?._id ?? "") : null,
    };
  });

// ─── Outstanding + ageing ─────────────────────────────────────────────────────

export const getPartyOutstandingFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => z.object({ partyId: z.string().min(1) }).parse(raw))
  .handler(async ({ data }): Promise<PartyOutstandingResult> => {
    await connectDB();
    return computeOutstanding(data.partyId);
  });

export async function computeOutstanding(partyId: string): Promise<PartyOutstandingResult> {
  const party = await PartyModel.findOne({ partyId }).lean();
  if (!party) throw new Error(`Party ${partyId} not found`);

  const bills = await SalesDocModel.find({
    partyId,
    docType: "INVOICE",
    status: "POSTED",
    balanceDue: { $gt: 0 },
  })
    .sort({ docDate: 1 })
    .lean();

  const today = todayIST();
  const creditDays = Number(party.creditDays ?? 0);
  const buckets: Record<string, number> = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };

  const rows: OutstandingBillRow[] = bills.map((b) => {
    const bucket = ageingBucket(String(b.docDate), today);
    const balanceDue = Number(b.balanceDue ?? 0);
    buckets[bucket] = roundMoney((buckets[bucket] ?? 0) + balanceDue);
    const ageDays = daysBetweenISO(String(b.docDate), today);
    return {
      docId: String(b._id),
      docNumber: String(b.docNumber ?? ""),
      docDate: String(b.docDate ?? ""),
      grandTotal: Number(b.grandTotal ?? 0),
      paidAmount: Number(b.paidAmount ?? 0),
      balanceDue,
      ageDays,
      bucket,
      overdue: creditDays > 0 && ageDays > creditDays,
    };
  });

  return {
    partyId: String(party.partyId),
    partyName: String(party.displayName ?? ""),
    totalOutstanding: roundMoney(rows.reduce((s, r) => s + r.balanceDue, 0)),
    ledgerBalance: await computePartyBalance(partyId),
    buckets,
    bills: rows,
  };
}

// ─── Credit control (plan §6.7) ───────────────────────────────────────────────

export const checkCreditFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z.object({ partyId: z.string().min(1), amount: z.number().min(0) }).parse(raw),
  )
  .handler(async ({ data }): Promise<CreditCheckResult> => {
    await connectDB();
    return evaluateCredit(data.partyId, data.amount);
  });

/**
 * Shared by the UI pre-check and the posting transaction. Posting re-runs this
 * server-side; a client-side check alone is only a hint.
 */
export async function evaluateCredit(
  partyId: string,
  unpaidAmount: number,
): Promise<CreditCheckResult> {
  const party = await PartyModel.findOne({ partyId }).lean();
  if (!party) {
    return {
      allowed: false,
      requiresOverride: false,
      reason: `Party ${partyId} not found`,
      currentOutstanding: 0,
      creditLimit: 0,
      warning: "",
    };
  }

  const currentOutstanding = await computePartyBalance(partyId);
  const creditLimit = Number(party.creditLimit ?? 0);
  const creditDays = Number(party.creditDays ?? 0);
  const name = String(party.displayName ?? partyId);

  // Nothing left unpaid — credit rules do not apply at all.
  if (unpaidAmount <= 0.005) {
    return {
      allowed: true,
      requiresOverride: false,
      reason: "",
      currentOutstanding,
      creditLimit,
      warning: "",
    };
  }

  if (!party.creditAllowed) {
    return {
      allowed: false,
      requiresOverride: false,
      reason: `${name} is not approved for credit. Full payment is required.`,
      currentOutstanding,
      creditLimit,
      warning: "",
    };
  }

  if (creditLimit > 0 && currentOutstanding + unpaidAmount > creditLimit) {
    return {
      allowed: false,
      requiresOverride: true,
      reason:
        `Credit limit exceeded: outstanding ₹${currentOutstanding.toFixed(2)} + ` +
        `₹${unpaidAmount.toFixed(2)} is over the ₹${creditLimit.toFixed(2)} limit.`,
      currentOutstanding,
      creditLimit,
      warning: "",
    };
  }

  // Age warning — surfaced to the biller, but never blocking.
  let warning = "";
  if (creditDays > 0) {
    const oldest = await SalesDocModel.findOne({
      partyId,
      docType: "INVOICE",
      status: "POSTED",
      balanceDue: { $gt: 0 },
    })
      .sort({ docDate: 1 })
      .lean();

    if (oldest) {
      const age = daysBetweenISO(String(oldest.docDate), todayIST());
      if (age > creditDays) {
        warning = `${String(oldest.docNumber)} is ${age} days old, past the ${creditDays}-day term.`;
      }
    }
  }

  return {
    allowed: true,
    requiresOverride: false,
    reason: "",
    currentOutstanding,
    creditLimit,
    warning,
  };
}

// ─── Deactivate (never hard-delete a party that has history) ──────────────────

export const setPartyActiveFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z.object({ partyId: z.string().min(1), isActive: z.boolean() }).parse(raw),
  )
  .handler(async ({ data }): Promise<PartyRow> => {
    await connectDB();
    const updated = await PartyModel.findOneAndUpdate(
      { partyId: data.partyId },
      { $set: { isActive: data.isActive } },
      { returnDocument: "after" },
    ).lean();
    if (!updated) throw new Error(`Party ${data.partyId} not found`);
    return toRow(updated as unknown as Record<string, unknown>);
  });

// ─── Keep-in-sync helpers (called from crm.ts / masters.ts) ───────────────────
//
// A Party is created for every Owner and Supplier by migration 02, but new
// records created afterwards through the live CRM/Supplier screens would
// never get a partyId — invisible to the ledger, credit control and payment
// allocation — unless every write path also syncs Party. These two functions
// are that one write path: call after every owner/supplier create or update,
// and the party record can never drift out of sync with its source.

/** Two-digit GST state code lookup for the free-text state names CRM stores. */
const OWNER_STATE_NAME_TO_CODE: Record<string, string> = {
  maharashtra: "27",
  gujarat: "24",
  karnataka: "29",
  "madhya pradesh": "23",
  telangana: "36",
  "tamil nadu": "33",
  delhi: "07",
  "uttar pradesh": "09",
  rajasthan: "08",
  "west bengal": "19",
  kerala: "32",
  punjab: "03",
  haryana: "06",
};

function resolveOwnerStateCode(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (/^\d{1,2}$/.test(raw)) return raw.padStart(2, "0");
  return OWNER_STATE_NAME_TO_CODE[raw.toLowerCase()] ?? "27";
}

export interface OwnerSyncInput {
  ownerId: string;
  name: string;
  phone?: string | undefined;
  altPhone?: string | undefined;
  email?: string | undefined;
  address?: string | undefined;
  city?: string | undefined;
  gstin?: string | undefined;
  pan?: string | undefined;
  stateCode?: string | undefined;
  billingAddress?: string | undefined;
  pin?: string | undefined;
  creditAllowed?: boolean | undefined;
  creditLimit?: number | undefined;
  openingBalance?: number | undefined;
  openingType?: "DR" | "CR" | undefined;
  dob?: string | undefined;
  anniversary?: string | undefined;
  status?: string | undefined;
}

/**
 * Upsert the Party record for an owner and write `partyId` back onto the
 * Owner document — the same shape migration 02 uses, but callable inline
 * from createOwnerFn / updateOwnerFn so a party is never missed.
 *
 * Returns the partyId, or "" when there is no usable mobile number (a party
 * cannot be matched or contacted without one — matches migration 02's rule).
 */
export async function syncPartyForOwner(input: OwnerSyncInput): Promise<string> {
  await connectDB();

  const mobile = normaliseMobile(input.phone || input.altPhone);
  if (!mobile) return "";

  const existingByOwner = await PartyModel.findOne({ ownerId: input.ownerId }).lean();
  const existingByMobile = existingByOwner ? null : await PartyModel.findOne({ mobile }).lean();
  const existing = existingByOwner ?? existingByMobile;

  const set: Record<string, unknown> = {
    ownerId: input.ownerId,
    displayName: input.name,
    mobile,
    phone: input.altPhone ?? "",
    email: input.email ?? "",
    billingAddress: input.billingAddress ?? input.address ?? "",
    city: input.city ?? "",
    stateCode: input.stateCode ?? resolveOwnerStateCode(undefined),
    pin: input.pin ?? "",
    isActive: input.status !== "Inactive",
  };
  if (input.gstin !== undefined) set["gstin"] = input.gstin.toUpperCase();
  if (input.pan !== undefined) set["pan"] = input.pan.toUpperCase();
  if (input.creditAllowed !== undefined) set["creditAllowed"] = input.creditAllowed;
  if (input.creditLimit !== undefined) set["creditLimit"] = input.creditLimit;
  if (input.dob !== undefined) set["dateOfBirth"] = input.dob;
  if (input.anniversary !== undefined) set["anniversary"] = input.anniversary;

  if (existing) {
    const partyType = existing.partyType === "SUPPLIER" ? "BOTH" : existing.partyType;
    await PartyModel.updateOne({ _id: existing._id }, { $set: { ...set, partyType } });
    if (
      String(existing.partyId) &&
      !(await Owner.exists({ ownerId: input.ownerId, partyId: existing.partyId }))
    ) {
      await Owner.updateOne({ ownerId: input.ownerId }, { $set: { partyId: existing.partyId } });
    }
    if (input.openingBalance !== undefined) {
      await writeOpeningRow(
        String(existing.partyId),
        input.openingBalance,
        input.openingType ?? "DR",
      );
    }
    return String(existing.partyId);
  }

  const partyId = await nextSeq("party", "PTY", 4);
  await PartyModel.create({
    partyId,
    partyType: "CLIENT",
    ...set,
  });
  await Owner.updateOne({ ownerId: input.ownerId }, { $set: { partyId } });
  if (input.openingBalance) {
    await writeOpeningRow(partyId, input.openingBalance, input.openingType ?? "DR");
  }
  return partyId;
}

export interface SupplierSyncInput {
  supplierRefId: string;
  name: string;
  phone?: string | undefined;
  mobileNo?: string | undefined;
  email?: string | undefined;
  contactPerson?: string | undefined;
  address?: string | undefined;
  city?: string | undefined;
  state?: string | undefined;
  pincode?: string | undefined;
  gstin?: string | undefined;
  panNo?: string | undefined;
  bankName?: string | undefined;
  bankAccountNo?: string | undefined;
  ifscCode?: string | undefined;
  creditDays?: number | undefined;
  openingBalance?: number | undefined;
  /** Supplier's own vocabulary ("Cr"/"Dr"/"Debit"/"Credit") — normalised here. */
  openingBalanceType?: string | undefined;
  isActive?: boolean | undefined;
}

/** Same pattern as syncPartyForOwner, for the Supplier side. */
export async function syncPartyForSupplier(input: SupplierSyncInput): Promise<string> {
  await connectDB();

  const mobile = normaliseMobile(input.phone || input.mobileNo);
  const existingByRef = await PartyModel.findOne({ supplierRefId: input.supplierRefId }).lean();
  const existingByMobile =
    !existingByRef && mobile ? await PartyModel.findOne({ mobile }).lean() : null;
  const existing = existingByRef ?? existingByMobile;

  const isDebit = input.openingBalanceType === "Dr" || input.openingBalanceType === "Debit";

  const set: Record<string, unknown> = {
    supplierRefId: input.supplierRefId,
    displayName: input.name,
    contactPerson: input.contactPerson ?? "",
    mobile: mobile || existing?.mobile || "",
    phone: input.phone ?? "",
    email: input.email ?? "",
    billingAddress: input.address ?? "",
    city: input.city ?? "",
    stateCode: resolveOwnerStateCode(input.state),
    pin: input.pincode ?? "",
    bankName: input.bankName ?? "",
    bankAccount: input.bankAccountNo ?? "",
    bankIfsc: input.ifscCode ?? "",
    isActive: input.isActive !== false,
  };
  if (input.gstin !== undefined) set["gstin"] = input.gstin.toUpperCase();
  if (input.panNo !== undefined) set["pan"] = input.panNo.toUpperCase();
  if (input.creditDays !== undefined) set["creditDays"] = input.creditDays;

  if (existing) {
    const partyType = existing.partyType === "CLIENT" ? "BOTH" : existing.partyType;
    await PartyModel.updateOne({ _id: existing._id }, { $set: { ...set, partyType } });
    if (input.openingBalance !== undefined) {
      await writeOpeningRow(String(existing.partyId), input.openingBalance, isDebit ? "DR" : "CR");
    }
    return String(existing.partyId);
  }

  const partyId = await nextSeq("party", "PTY", 4);
  await PartyModel.create({
    partyId,
    partyType: "SUPPLIER",
    creditAllowed: true,
    ...set,
  });
  if (input.openingBalance) {
    await writeOpeningRow(partyId, input.openingBalance, isDebit ? "DR" : "CR");
  }
  return partyId;
}
