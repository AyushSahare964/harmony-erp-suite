/**
 * Migration 04 — turn each finalized ClinicalVisit into a posted SalesDoc
 * invoice, so the billing module's registers, party ledger and dashboard have
 * real historical data to show instead of an empty collection.
 *
 * Only visits with status "Paid" or "Billed" and totalAmount > 0 are financial
 * documents — "Admitted" / "In Consultation" visits are still open clinical
 * work with no real bill yet and are left alone.
 *
 * Tax split note: legacy visits store a document-level taxableAmount and
 * gstAmount but not a reconstructible per-line split (the seed figures do not
 * reconcile line-by-line against each line's own gstRate). This migration
 * apportions the document totals across lines by each line's share of
 * lineTotal, which is honest about what the source data actually contains and
 * guarantees the migrated SalesDoc.grandTotal matches the original
 * ClinicalVisit.totalAmount exactly — the reconciliation gate in §2.9.
 * Documents created after go-live go through the real tax engine and need no
 * such apportionment.
 *
 * Idempotent: a visit with `salesDocNo` already set is skipped on a re-run.
 * No stock movement is written — the historical inventory deduction already
 * happened through the old workflow; replaying it here would double-count.
 *
 *   node scripts/migrations/04-visits-to-salesdocs.mjs --dry-run
 *   node scripts/migrations/04-visits-to-salesdocs.mjs
 */

import { connect, coll, DRY_RUN, round2, fyCodeFor, finish, fail } from "./_lib.mjs";

const TAG = "04-visits-to-salesdocs";
const FINALIZED_STATUSES = new Set(["Paid", "Billed", "Closed"]);
const BRANCH_STATE_CODE = "27";

/** Split an integer-paise tax amount into CGST/SGST with the residue on SGST. */
function splitTax(taxAmount) {
  const paise = Math.round(round2(taxAmount) * 100);
  const cgstPaise = Math.floor(paise / 2);
  return { cgst: cgstPaise / 100, sgst: (paise - cgstPaise) / 100 };
}

/** Apportion `total` across `weights`, in 2dp, residue on the heaviest weight. */
function apportion(total, weights) {
  const amount = round2(total);
  const sum = weights.reduce((s, w) => s + w, 0);
  if (amount === 0 || sum === 0) return weights.map(() => 0);
  const shares = weights.map((w) => round2((amount * w) / sum));
  const assigned = round2(shares.reduce((s, v) => s + v, 0));
  const residue = round2(amount - assigned);
  if (residue !== 0) {
    let heaviest = 0;
    for (let i = 1; i < weights.length; i++) if (weights[i] > weights[heaviest]) heaviest = i;
    shares[heaviest] = round2(shares[heaviest] + residue);
  }
  return shares;
}

/** Normalise a legacy "INV/2026-27-0908" or "INV/2026-27/0905" into a seq number. */
function extractSeq(invoiceNo) {
  const m = String(invoiceNo ?? "").match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : 0;
}

function paymentStatusFor(totalAmount, paidAmount) {
  const due = round2(totalAmount - paidAmount);
  if (due <= 0.005) return "PAID";
  if (paidAmount > 0.005) return "PARTIAL";
  return "UNPAID";
}

async function main() {
  console.log(`[${TAG}] ${DRY_RUN ? "DRY RUN — no writes" : "applying"}`);
  await connect(TAG);

  const visits = coll("clinicalvisits");
  const salesDocs = coll("sales_docs");
  const paymentDocs = coll("payment_docs");
  const partyLedger = coll("party_ledger");
  const parties = coll("parties");
  const numberSeries = coll("number_series");

  const partyByOwnerId = new Map();
  for (const p of await parties.find({ ownerId: { $ne: "" } }).toArray()) {
    partyByOwnerId.set(p.ownerId, p);
  }

  const stats = {
    scanned: 0,
    migrated: 0,
    alreadyDone: 0,
    skippedNotFinalized: 0,
    skippedZero: 0,
    paymentsCreated: 0,
    totalGrandTotal: 0,
    partyMissing: 0,
  };

  const maxSeqByFy = new Map(); // fyCode -> highest INV seq used
  const paySeqByFy = new Map(); // fyCode -> next PIN seq to hand out
  let payCounter = 0;

  for (const v of await visits.find({}).toArray()) {
    stats.scanned++;

    if (v.salesDocNo) {
      stats.alreadyDone++;
      continue;
    }
    if (!FINALIZED_STATUSES.has(v.status)) {
      stats.skippedNotFinalized++;
      continue;
    }
    const totalAmount = round2(v.totalAmount);
    if (!(totalAmount > 0)) {
      stats.skippedZero++;
      continue;
    }

    const fyCode = fyCodeFor(v.date || "2026-04-01");
    const seq = extractSeq(v.invoiceNo) || (maxSeqByFy.get(fyCode) ?? 0) + 1;
    maxSeqByFy.set(fyCode, Math.max(maxSeqByFy.get(fyCode) ?? 0, seq));
    const docNumber = `INV/${fyCode}/${String(seq).padStart(4, "0")}`;

    const party = partyByOwnerId.get(v.ownerId);
    if (!party) stats.partyMissing++;

    const items = v.items ?? [];
    const lineTotals = items.map((it) => round2(it.lineTotal ?? 0));
    const taxableShares = apportion(v.taxableAmount ?? totalAmount, lineTotals);
    const taxShares = apportion(v.gstAmount ?? 0, lineTotals);

    const lines = items.map((it, i) => {
      const { cgst, sgst } = splitTax(taxShares[i] ?? 0);
      return {
        lineNo: i + 1,
        itemId: "",
        itemCode: it.itemCode ?? "",
        itemName: it.name ?? "Item",
        itemClass: it.lineType === "Consultation" || it.lineType === "Service" ? "SERVICE" : "GOODS",
        lineType: it.lineType ?? "Service",
        description: "",
        tag: "",
        serialNo: "",
        batchId: "",
        batchNo: it.batchNo ?? "",
        expiryDate: "",
        animalId: v.petId ?? "",
        hsnSac: "",
        uom: "",
        quantity: it.quantity ?? 1,
        freeQuantity: 0,
        rate: it.unitPrice ?? 0,
        discountType: "percentage",
        discountValue: it.discountPercent ?? 0,
        discountAmount: 0,
        taxableValue: taxableShares[i] ?? 0,
        gstRate: it.gstRate ?? 0,
        cessRate: 0,
        cgst,
        sgst,
        igst: 0,
        cess: 0,
        lineTotal: lineTotals[i] ?? 0,
        sourceRef: "",
      };
    });

    const { cgst: cgstTotal, sgst: sgstTotal } = splitTax(v.gstAmount ?? 0);
    const paymentStatus = paymentStatusFor(totalAmount, v.amountPaid ?? 0);

    const salesDoc = {
      docType: "INVOICE",
      docNumber,
      docDate: v.date,
      branchId: "MAIN",
      invoiceType: v.billType === "Non-GST" ? "NON_GST" : "GST",
      linkType: "CLIENT_ACCOUNT",
      partyId: party?.partyId ?? "",
      partyName: v.ownerName ?? "CASH",
      partyGstin: "",
      partyAddress: "",
      partyMobile: v.ownerPhone ?? "",
      animalId: v.petId ?? "",
      animalName: v.petName ?? "",
      visitId: v.visitId,
      consultationId: "",
      placeOfSupply: BRANCH_STATE_CODE,
      isInterstate: false,
      reverseCharge: false,
      soldByStaffId: "",
      soldByStaffName: v.doctorName ?? "",
      priceInclusive: false,
      lines,
      subTotal: round2(v.subtotal ?? totalAmount),
      discountTotal: round2(v.billDiscount ?? 0),
      invoiceDiscount: round2(v.billDiscount ?? 0),
      taxableValue: round2(v.taxableAmount ?? totalAmount),
      cgst: cgstTotal,
      sgst: sgstTotal,
      igst: 0,
      cess: 0,
      shippingAmount: 0,
      shippingTaxable: false,
      roundOff: round2(v.roundOff ?? 0),
      grandTotal: totalAmount,
      paidAmount: round2(v.amountPaid ?? 0),
      balanceDue: round2(v.balanceDue ?? totalAmount - (v.amountPaid ?? 0)),
      paymentStatus,
      status: "POSTED",
      referenceDoc: "",
      deliveryTerms: "",
      remarksPrivate: `Migrated from ClinicalVisit ${v.visitId}`,
      validUntil: "",
      convertedToDocNo: "",
      revisedFromId: "",
      againstDocNo: "",
      againstDocId: "",
      postedAt: v.createdAt ?? new Date(),
      createdBy: "",
      createdByName: v.receptionistName ?? "",
      createdAt: v.createdAt ?? new Date(),
      updatedAt: v.updatedAt ?? new Date(),
    };

    let salesDocId = null;
    if (!DRY_RUN) {
      const inserted = await salesDocs.insertOne(salesDoc);
      salesDocId = inserted.insertedId;
    }

    // Party ledger: the sale itself (full amount, regardless of payment status).
    if (party && !DRY_RUN) {
      await partyLedger.insertOne({
        partyId: party.partyId,
        entryDate: v.date,
        sourceKind: "SALE",
        sourceId: salesDocId ? String(salesDocId) : "",
        sourceNumber: docNumber,
        narration: `Invoice ${docNumber} (migrated)`,
        debit: totalAmount,
        credit: 0,
        isReversal: false,
        reversalOfId: "",
        createdAt: v.createdAt ?? new Date(),
        updatedAt: v.createdAt ?? new Date(),
      });
    }

    // One PaymentDoc per recorded payment, allocated in full to this invoice.
    for (const p of v.payments ?? []) {
      const amount = round2(p.amount ?? 0);
      if (!(amount > 0)) continue;

      payCounter += 1;
      const paySeq = (paySeqByFy.get(fyCode) ?? 0) + 1;
      paySeqByFy.set(fyCode, paySeq);
      const payNumber = `PIN/${fyCode}/${String(paySeq).padStart(4, "0")}`;
      const payMode = String(p.mode ?? "Cash").toUpperCase();
      const normalisedMode = ["CASH", "UPI", "CARD", "CHEQUE", "BANK_TRANSFER"].includes(payMode)
        ? payMode
        : payMode === "NETBANKING"
          ? "BANK_TRANSFER"
          : payMode === "ACCOUNT DUE"
            ? "CASH"
            : "CASH";

      if (!DRY_RUN) {
        await paymentDocs.insertOne({
          docNumber: payNumber,
          docDate: (p.timestamp ?? v.date ?? "").slice(0, 10) || v.date,
          branchId: "MAIN",
          direction: "IN",
          partyId: party?.partyId ?? "",
          partyName: v.ownerName ?? "",
          totalAmount: amount,
          allocatedAmount: amount,
          unallocatedAmount: 0,
          splits: [
            {
              payMode: normalisedMode,
              amount,
              referenceNo: p.trxRef ?? "",
              bankName: "",
              instrumentDate: "",
              clearingStatus: "CLEARED",
            },
          ],
          allocations: [
            { docKind: "SALE", docId: salesDocId ? String(salesDocId) : "", docNumber, amount },
          ],
          idempotencyKey: "",
          narration: `Migrated from visit ${v.visitId}`,
          status: "POSTED",
          createdBy: "",
          createdByName: p.recordedBy ?? "",
          createdAt: p.timestamp ? new Date(p.timestamp) : (v.createdAt ?? new Date()),
          updatedAt: p.timestamp ? new Date(p.timestamp) : (v.createdAt ?? new Date()),
        });

        if (party) {
          await partyLedger.insertOne({
            partyId: party.partyId,
            entryDate: (p.timestamp ?? v.date ?? "").slice(0, 10) || v.date,
            sourceKind: "PAYMENT",
            sourceId: "",
            sourceNumber: payNumber,
            narration: `Receipt ${payNumber} (migrated)`,
            debit: 0,
            credit: amount,
            isReversal: false,
            reversalOfId: "",
            createdAt: p.timestamp ? new Date(p.timestamp) : (v.createdAt ?? new Date()),
            updatedAt: p.timestamp ? new Date(p.timestamp) : (v.createdAt ?? new Date()),
          });
        }
      }
      stats.paymentsCreated++;
    }

    if (!DRY_RUN) {
      await visits.updateOne(
        { _id: v._id },
        { $set: { salesDocNo: docNumber, salesDocId: salesDocId ? String(salesDocId) : "" } },
      );
    }

    stats.migrated++;
    stats.totalGrandTotal = round2(stats.totalGrandTotal + totalAmount);
  }

  // Roll the live INV/PIN number series forward past everything just imported,
  // so the next live invoice/receipt cannot collide with a migrated number.
  if (!DRY_RUN) {
    for (const [fyCode, maxSeq] of maxSeqByFy) {
      await numberSeries.updateOne(
        { branchId: "MAIN", docType: "INV", fyCode },
        { $max: { lastNumber: maxSeq }, $setOnInsert: { prefix: "INV", padding: 4 } },
        { upsert: true },
      );
    }
    for (const [fyCode, seq] of paySeqByFy) {
      await numberSeries.updateOne(
        { branchId: "MAIN", docType: "PIN", fyCode },
        { $max: { lastNumber: seq }, $setOnInsert: { prefix: "PIN", padding: 4 } },
        { upsert: true },
      );
    }
  }

  if (stats.partyMissing) {
    console.warn(
      `[${TAG}] ${stats.partyMissing} visit(s) had no matching Party — run migration 02 first ` +
        `if any owners are missing a phone number.`,
    );
  }

  console.log(`[${TAG}] total migrated grand total: ₹${stats.totalGrandTotal.toFixed(2)}`);
  await finish(TAG, [stats]);
}

main().catch((err) => fail(TAG, err));
