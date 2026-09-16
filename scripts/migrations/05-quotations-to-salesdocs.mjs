/**
 * Migration 05 — copy each legacy Quotation into a SalesDoc{QUOTATION}.
 *
 * Unlike ClinicalVisit (migration 04), these line items reconcile exactly
 * against a real tax computation: lineTotal = (rate × qty − discount) × (1 +
 * gstRate/100) to the paisa. So this migration recomputes each line properly
 * rather than apportioning document totals across lines.
 *
 * The old `Quotation` collection is left untouched — `quotations.ts` keeps
 * reading it for the existing QuotationModal UI. This migration only makes
 * the same data ALSO visible through the unified SalesDoc register, so a
 * biller sees one list instead of hunting through two.
 *
 * Idempotent: a quotation with a `salesDocRef` already recorded (via a side
 * collection) is skipped on re-run — see `migratedQuotationNos` below.
 *
 *   node scripts/migrations/05-quotations-to-salesdocs.mjs --dry-run
 *   node scripts/migrations/05-quotations-to-salesdocs.mjs
 */

import { connect, coll, DRY_RUN, round2, fyCodeFor, finish, fail } from "./_lib.mjs";

const TAG = "05-quotations-to-salesdocs";
const BRANCH_STATE_CODE = "27";

function splitTax(taxAmount) {
  const paise = Math.round(round2(taxAmount) * 100);
  const cgstPaise = Math.floor(paise / 2);
  return { cgst: cgstPaise / 100, sgst: (paise - cgstPaise) / 100 };
}

const STATUS_MAP = {
  Draft: "DRAFT",
  Sent: "POSTED",
  Accepted: "POSTED",
  Expired: "POSTED",
  Converted: "CONVERTED",
};

async function main() {
  console.log(`[${TAG}] ${DRY_RUN ? "DRY RUN — no writes" : "applying"}`);
  await connect(TAG);

  const quotations = coll("quotations");
  const salesDocs = coll("sales_docs");
  const parties = coll("parties");
  const numberSeries = coll("number_series");

  // Match owners by phone — quotations don't carry an ownerId.
  const partyByPhone = new Map();
  for (const p of await parties.find({ mobile: { $ne: "" } }).toArray()) {
    partyByPhone.set(p.mobile, p);
  }
  const normPhone = (v) => String(v ?? "").replace(/\D/g, "").slice(-10);

  const stats = { scanned: 0, migrated: 0, alreadyDone: 0, draftSkippedNumbering: 0 };
  const seqByFy = new Map();

  // Already-migrated quotations are found by matching referenceDoc, which we
  // set to the legacy quotationNo — cheap and needs no extra collection.
  const existingRefs = new Set(
    (await salesDocs.find({ docType: "QUOTATION" }).project({ referenceDoc: 1 }).toArray()).map(
      (d) => d.referenceDoc,
    ),
  );

  for (const q of await quotations.find({}).toArray()) {
    stats.scanned++;

    if (existingRefs.has(q.quotationNo)) {
      stats.alreadyDone++;
      continue;
    }

    const status = STATUS_MAP[q.status] ?? "DRAFT";
    const party = partyByPhone.get(normPhone(q.ownerPhone));

    const lines = (q.items ?? []).map((it, i) => {
      const gross = round2((it.quantity ?? 1) * (it.rate ?? 0));
      const discountAmount = round2((gross * (it.discountPercent ?? 0)) / 100);
      const net = round2(gross - discountAmount);
      const tax = round2((net * (it.gstRate ?? 0)) / 100);
      const { cgst, sgst } = splitTax(tax);
      return {
        lineNo: i + 1,
        itemId: "",
        itemCode: "",
        itemName: it.name ?? "Item",
        itemClass: it.category === "Pharmacy" ? "GOODS" : "SERVICE",
        lineType:
          it.category === "Procedure"
            ? "Procedure"
            : it.category === "Diagnostic"
              ? "Diagnostic"
              : it.category === "Pharmacy"
                ? "Pharmacy"
                : "Service",
        description: it.description ?? "",
        tag: "",
        serialNo: it.serialNo ?? "",
        batchId: "",
        batchNo: "",
        expiryDate: "",
        animalId: "",
        hsnSac: "",
        uom: it.uom ?? "",
        quantity: it.quantity ?? 1,
        freeQuantity: 0,
        rate: it.rate ?? 0,
        discountType: "percentage",
        discountValue: it.discountPercent ?? 0,
        discountAmount,
        taxableValue: net,
        gstRate: it.gstRate ?? 0,
        cessRate: 0,
        cgst,
        sgst,
        igst: 0,
        cess: 0,
        lineTotal: round2(net + tax),
        sourceRef: "",
      };
    });

    const taxableValue = round2(lines.reduce((s, l) => s + l.taxableValue, 0));
    const cgst = round2(lines.reduce((s, l) => s + l.cgst, 0));
    const sgst = round2(lines.reduce((s, l) => s + l.sgst, 0));
    const grandTotalRaw = round2(lines.reduce((s, l) => s + l.lineTotal, 0) + (q.shippingCosts ?? 0));
    const grandTotal = Math.round(grandTotalRaw);

    let docNumber = "";
    if (status !== "DRAFT") {
      const fyCode = fyCodeFor(q.date || "2026-04-01");
      const seq = (seqByFy.get(fyCode) ?? 0) + 1;
      seqByFy.set(fyCode, seq);
      docNumber = `QTN/${fyCode}/${String(seq).padStart(4, "0")}`;
    } else {
      stats.draftSkippedNumbering++;
    }

    const salesDoc = {
      docType: "QUOTATION",
      docNumber,
      docDate: q.date,
      branchId: "MAIN",
      invoiceType: q.quotationType === "Non-GST" ? "NON_GST" : "GST",
      linkType: party ? "CLIENT_ACCOUNT" : "COUNTER_SALE",
      partyId: party?.partyId ?? "",
      partyName: q.ownerName ?? "CASH",
      partyGstin: q.clientGstin ?? "",
      partyAddress: q.address ?? "",
      partyMobile: q.ownerPhone ?? "",
      animalId: "",
      animalName: q.petName ?? "",
      visitId: "",
      consultationId: "",
      placeOfSupply: BRANCH_STATE_CODE,
      isInterstate: false,
      reverseCharge: false,
      soldByStaffId: "",
      soldByStaffName: q.doctorName ?? "",
      priceInclusive: false,
      lines,
      subTotal: round2(q.subtotal ?? taxableValue),
      discountTotal: round2(q.totalDiscount ?? 0),
      invoiceDiscount: 0,
      taxableValue,
      cgst,
      sgst,
      igst: 0,
      cess: 0,
      shippingAmount: round2(q.shippingCosts ?? 0),
      shippingTaxable: false,
      roundOff: round2(grandTotal - grandTotalRaw),
      grandTotal,
      paidAmount: 0,
      balanceDue: grandTotal,
      paymentStatus: "UNPAID",
      status,
      referenceDoc: q.quotationNo,
      deliveryTerms: q.deliveryTerms ?? "",
      remarksPrivate: q.remarks ?? "",
      validUntil: q.validUntil ?? "",
      convertedToDocNo: q.convertedInvoiceNo ?? "",
      revisedFromId: "",
      againstDocNo: "",
      againstDocId: "",
      postedAt: status !== "DRAFT" ? (q.createdAt ?? new Date()) : undefined,
      createdBy: "",
      createdByName: q.doctorName ?? "",
      createdAt: q.createdAt ?? new Date(),
      updatedAt: q.updatedAt ?? new Date(),
    };

    if (!DRY_RUN) await salesDocs.insertOne(salesDoc);
    stats.migrated++;
  }

  if (!DRY_RUN) {
    for (const [fyCode, seq] of seqByFy) {
      await numberSeries.updateOne(
        { branchId: "MAIN", docType: "QTN", fyCode },
        { $max: { lastNumber: seq }, $setOnInsert: { prefix: "QTN", padding: 4 } },
        { upsert: true },
      );
    }
  }

  await finish(TAG, [stats]);
}

main().catch((err) => fail(TAG, err));
