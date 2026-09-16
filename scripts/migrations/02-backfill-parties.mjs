/**
 * Migration 02 — backfill the Party master from existing Owner and Supplier
 * records, and write `partyId` back onto both.
 *
 * Match key is the normalised mobile number. An owner who is also a supplier
 * (rare, but it happens with a vet who sells to another clinic) collapses into
 * a single party with partyType BOTH.
 *
 *   node scripts/migrations/02-backfill-parties.mjs --dry-run
 *   node scripts/migrations/02-backfill-parties.mjs
 */

import { connect, coll, DRY_RUN, normaliseMobile, makeSeq, finish, fail } from "./_lib.mjs";

const TAG = "02-backfill-parties";

/** Existing records store a state NAME; the finance module wants the GST code. */
const STATE_NAME_TO_CODE = {
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
  bihar: "10",
  odisha: "21",
  chhattisgarh: "22",
  goa: "30",
  "andhra pradesh": "37",
  jharkhand: "20",
  assam: "18",
};

function toStateCode(value) {
  const raw = String(value ?? "").trim();
  if (/^\d{1,2}$/.test(raw)) return raw.padStart(2, "0");
  return STATE_NAME_TO_CODE[raw.toLowerCase()] ?? "27"; // clinic's home state
}

async function main() {
  console.log(`[${TAG}] ${DRY_RUN ? "DRY RUN — no writes" : "applying"}`);
  await connect(TAG);

  const parties = coll("parties");
  const owners = coll("owners");
  const suppliers = coll("suppliers");
  const seq = await makeSeq("party", "PTY", 4);

  const stats = {
    ownersScanned: 0,
    ownersLinked: 0,
    ownersCreated: 0,
    ownersSkippedNoMobile: 0,
    suppliersScanned: 0,
    suppliersLinked: 0,
    suppliersCreated: 0,
    mergedToBoth: 0,
  };

  // Index what already exists so a re-run links instead of duplicating.
  const byMobile = new Map();
  for (const p of await parties.find({}).toArray()) {
    const key = normaliseMobile(p.mobile);
    if (key) byMobile.set(key, p);
  }

  // ── Owners → CLIENT parties ──
  for (const o of await owners.find({}).toArray()) {
    stats.ownersScanned++;

    const mobile = normaliseMobile(o.phone || o.altPhone);
    if (!mobile) {
      // A party without a mobile cannot be matched or contacted; the ledger
      // would be orphaned. Report it instead of inventing a key.
      stats.ownersSkippedNoMobile++;
      continue;
    }

    const existing = byMobile.get(mobile);
    if (existing) {
      stats.ownersLinked++;
      if (!DRY_RUN && !existing.ownerId) {
        await parties.updateOne(
          { _id: existing._id },
          { $set: { ownerId: o.ownerId, updatedAt: new Date() } },
        );
      }
      if (!DRY_RUN) {
        await owners.updateOne({ _id: o._id }, { $set: { partyId: existing.partyId } });
      }
      continue;
    }

    const partyId = seq.next();
    const doc = {
      partyId,
      partyType: "CLIENT",
      ownerId: o.ownerId ?? "",
      supplierRefId: "",
      displayName: o.name ?? "Unnamed owner",
      legalName: "",
      contactPerson: "",
      mobile,
      phone: o.altPhone ?? "",
      email: o.email ?? "",
      billingAddress: o.address ?? "",
      city: o.city ?? "Nagpur",
      stateCode: toStateCode(o.state),
      pin: "",
      country: "India",
      gstin: (o.gstin ?? "").toUpperCase(),
      pan: (o.pan ?? "").toUpperCase(),
      gstTreatment: o.gstin ? "REGULAR" : "UNREGISTERED",
      docType: o.idProofType ?? "",
      docNumber: o.idProofNo ?? "",
      // Any legacy outstanding becomes the party's opening debit; migration 03
      // turns it into the ledger's OPENING row.
      openingBalance: Number(o.outstandingBalance ?? 0),
      openingType: "DR",
      openingDate: "",
      creditAllowed: Number(o.outstandingBalance ?? 0) > 0,
      creditLimit: 0,
      creditDays: 0,
      dateOfBirth: o.dob ?? "",
      anniversary: "",
      bankName: "",
      bankAccount: "",
      bankIfsc: "",
      photoPath: "",
      remark: o.notes ?? "",
      isActive: o.status !== "Inactive",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (!DRY_RUN) {
      await parties.insertOne(doc);
      await owners.updateOne({ _id: o._id }, { $set: { partyId } });
    }
    byMobile.set(mobile, doc);
    stats.ownersCreated++;
  }

  // ── Suppliers → SUPPLIER parties ──
  for (const s of await suppliers.find({}).toArray()) {
    stats.suppliersScanned++;

    // Match on supplierRefId first: it is the only key that always exists.
    // Suppliers frequently have no phone number, and matching on mobile alone
    // would re-create those on every run.
    const mobile = normaliseMobile(s.phone);
    const existing =
      (await parties.findOne({ supplierRefId: String(s._id) })) ??
      (mobile ? byMobile.get(mobile) : undefined);

    if (existing) {
      // Same phone as an owner — one counterparty acting in both capacities.
      const partyType = existing.partyType === "CLIENT" ? "BOTH" : existing.partyType;
      if (partyType === "BOTH") stats.mergedToBoth++;
      stats.suppliersLinked++;

      if (!DRY_RUN) {
        await parties.updateOne(
          { _id: existing._id },
          {
            $set: {
              partyType,
              supplierRefId: String(s._id),
              gstin: (s.gstin || existing.gstin || "").toUpperCase(),
              updatedAt: new Date(),
            },
          },
        );
        await suppliers.updateOne({ _id: s._id }, { $set: { partyId: existing.partyId } });
      }
      continue;
    }

    const partyId = seq.next();
    const doc = {
      partyId,
      partyType: "SUPPLIER",
      ownerId: "",
      supplierRefId: String(s._id),
      displayName: s.name ?? "Unnamed supplier",
      legalName: s.name ?? "",
      contactPerson: s.contactPerson ?? "",
      mobile: mobile || "",
      phone: s.phone ?? "",
      email: s.email ?? "",
      billingAddress: s.address ?? "",
      city: s.city ?? "",
      stateCode: toStateCode(s.state),
      pin: "",
      country: "India",
      gstin: (s.gstin ?? "").toUpperCase(),
      pan: "",
      gstTreatment: s.gstin ? "REGULAR" : "UNREGISTERED",
      docType: "",
      docNumber: "",
      openingBalance: Number(s.openingBalance ?? 0),
      // A supplier opening balance is money WE owe → credit.
      openingType: s.openingBalanceType === "Dr" ? "DR" : "CR",
      openingDate: s.openingBalanceDate ?? "",
      creditAllowed: true,
      creditLimit: 0,
      creditDays: Number(s.creditDays ?? 30),
      dateOfBirth: "",
      anniversary: "",
      bankName: "",
      bankAccount: "",
      bankIfsc: "",
      photoPath: "",
      remark: "",
      isActive: s.isActive !== false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (!DRY_RUN) {
      await parties.insertOne(doc);
      await suppliers.updateOne({ _id: s._id }, { $set: { partyId } });
    }
    if (mobile) byMobile.set(mobile, doc);
    stats.suppliersCreated++;
  }

  await seq.commit();

  if (stats.ownersSkippedNoMobile) {
    console.warn(
      `[${TAG}] ${stats.ownersSkippedNoMobile} owner(s) have no phone number and were ` +
        `skipped — add a number, then re-run this migration to bring them in.`,
    );
  }

  await finish(TAG, [stats]);
}

main().catch((err) => fail(TAG, err));
