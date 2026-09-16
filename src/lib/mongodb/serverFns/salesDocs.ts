/**
 * Sales documents — quotations, invoices and credit notes.
 *
 * `postSalesDocFn` is the single writer of sale-side ledgers. Nothing else in
 * the codebase may write party_ledger or stock_ledger for a sale.
 *
 * Three rules this file exists to enforce:
 *   1. Totals are recomputed server-side from the lines. Client totals are
 *      display only and are never trusted.
 *   2. A document number is allocated at POST, inside the transaction.
 *   3. A POSTED document is immutable. Corrections are credit notes or cancels.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { withTransaction, sessionOpt } from "@/lib/mongodb/txn";
import { docPayload, docPayloads } from "@/lib/mongodb/docPayload";
import {
  SalesDocModel,
  derivePaymentStatus,
  SALES_LINE_TYPES,
  type ISalesLine,
} from "@/lib/mongodb/models/SalesDoc";
import { PartyLedgerModel } from "@/lib/mongodb/models/PartyLedger";
import { StockLedgerEntryModel } from "@/lib/mongodb/models/StockLedgerEntry";
import { FinDailySummaryModel } from "@/lib/mongodb/models/FinDailySummary";
import { AuditLogModel } from "@/lib/mongodb/models/AuditLog";
import { StockBatch } from "@/lib/mongodb/models/StockBatch";
import { InventoryItem } from "@/lib/mongodb/models/InventoryItem";
import { ClinicalVisit } from "@/lib/mongodb/models/ClinicalVisit";
import { getDefaultBranch } from "@/lib/mongodb/models/OrgBranch";
import { allocateDocNumber } from "./counters";
import { evaluateCredit } from "./parties";
import { computeDocument, type TaxDocInput } from "@/lib/finance/taxEngine";
import { roundMoney } from "@/lib/utils/moneyUtils";
import { todayIST } from "@/lib/utils/dateUtils";

// ─── Input schemas ────────────────────────────────────────────────────────────

const SalesLineInputZ = z.object({
  itemId: z.string().optional(),
  itemCode: z.string().optional(),
  itemName: z.string().min(1, "Item name is required"),
  itemClass: z.enum(["GOODS", "SERVICE"]).default("GOODS"),
  lineType: z.enum(SALES_LINE_TYPES as [string, ...string[]]).default("Service"),
  description: z.string().optional(),
  tag: z.string().optional(),
  serialNo: z.string().optional(),
  batchId: z.string().optional(),
  batchNo: z.string().optional(),
  expiryDate: z.string().optional(),
  animalId: z.string().optional(),
  hsnSac: z.string().optional(),
  uom: z.string().optional(),
  quantity: z.number().min(0),
  freeQuantity: z.number().min(0).default(0),
  rate: z.number().min(0),
  discountType: z.enum(["percentage", "fixed"]).default("percentage"),
  discountValue: z.number().min(0).default(0),
  gstRate: z.number().min(0).max(100).default(0),
  cessRate: z.number().min(0).max(100).default(0),
  sourceRef: z.string().optional(),
});

const SalesDocInputZ = z.object({
  id: z.string().optional(),
  docType: z.enum(["QUOTATION", "INVOICE", "CREDIT_NOTE"]).default("INVOICE"),
  docDate: z.string().min(1),
  branchId: z.string().default("MAIN"),
  invoiceType: z.enum(["GST", "NON_GST", "BILL_OF_SUPPLY", "EXPORT"]).default("GST"),
  linkType: z.enum(["COUNTER_SALE", "CLIENT_ACCOUNT"]).default("COUNTER_SALE"),

  partyId: z.string().optional(),
  partyName: z.string().default("CASH"),
  partyGstin: z.string().optional(),
  partyAddress: z.string().optional(),
  partyMobile: z.string().optional(),

  animalId: z.string().optional(),
  animalName: z.string().optional(),
  visitId: z.string().optional(),
  consultationId: z.string().optional(),

  placeOfSupply: z.string().default("27"),
  reverseCharge: z.boolean().default(false),
  soldByStaffId: z.string().optional(),
  soldByStaffName: z.string().optional(),
  priceInclusive: z.boolean().default(false),

  lines: z.array(SalesLineInputZ).default([]),

  invoiceDiscount: z.number().min(0).default(0),
  shippingAmount: z.number().min(0).default(0),
  shippingTaxable: z.boolean().default(false),

  referenceDoc: z.string().optional(),
  deliveryTerms: z.string().optional(),
  remarksPrivate: z.string().optional(),
  validUntil: z.string().optional(),
  againstDocNo: z.string().optional(),
  againstDocId: z.string().optional(),

  createdBy: z.string().optional(),
  createdByName: z.string().optional(),
});

export type SalesDocInput = z.infer<typeof SalesDocInputZ>;
type SalesLineInput = z.infer<typeof SalesLineInputZ>;

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface SalesDocTotals {
  subTotal: number;
  discountTotal: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  taxTotal: number;
  shippingAmount: number;
  roundOff: number;
  grandTotal: number;
  isInterstate: boolean;
  rateSummary: Array<{
    gstRate: number;
    taxableValue: number;
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
  }>;
}

export interface SalesDocRow {
  _id: string;
  docType: string;
  docNumber: string;
  docDate: string;
  invoiceType: string;
  linkType: string;
  partyId: string;
  partyName: string;
  partyGstin: string;
  partyMobile: string;
  animalId: string;
  animalName: string;
  visitId: string;
  placeOfSupply: string;
  isInterstate: boolean;
  subTotal: number;
  discountTotal: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  shippingAmount: number;
  roundOff: number;
  grandTotal: number;
  paidAmount: number;
  balanceDue: number;
  paymentStatus: string;
  status: string;
  validUntil: string;
  againstDocNo: string;
  convertedToDocNo: string;
  soldByStaffName: string;
  remarksPrivate: string;
  deliveryTerms: string;
  referenceDoc: string;
  lineCount: number;
  createdAt: string;
}

export interface SalesDocDetail extends SalesDocRow {
  lines: ISalesLine[];
  priceInclusive: boolean;
  invoiceDiscount: number;
  shippingTaxable: boolean;
  cancelReason: string;
  postedAt: string;
}

function toRow(d: Record<string, unknown>): SalesDocRow {
  const s = (k: string) => String(d[k] ?? "");
  const n = (k: string) => Number(d[k] ?? 0);
  return {
    _id: String(d["_id"] ?? ""),
    docType: s("docType"),
    docNumber: s("docNumber"),
    docDate: s("docDate"),
    invoiceType: s("invoiceType"),
    linkType: s("linkType"),
    partyId: s("partyId"),
    partyName: s("partyName"),
    partyGstin: s("partyGstin"),
    partyMobile: s("partyMobile"),
    animalId: s("animalId"),
    animalName: s("animalName"),
    visitId: s("visitId"),
    placeOfSupply: s("placeOfSupply"),
    isInterstate: Boolean(d["isInterstate"]),
    subTotal: n("subTotal"),
    discountTotal: n("discountTotal"),
    taxableValue: n("taxableValue"),
    cgst: n("cgst"),
    sgst: n("sgst"),
    igst: n("igst"),
    cess: n("cess"),
    shippingAmount: n("shippingAmount"),
    roundOff: n("roundOff"),
    grandTotal: n("grandTotal"),
    paidAmount: n("paidAmount"),
    balanceDue: n("balanceDue"),
    paymentStatus: s("paymentStatus"),
    status: s("status"),
    validUntil: s("validUntil"),
    againstDocNo: s("againstDocNo"),
    convertedToDocNo: s("convertedToDocNo"),
    soldByStaffName: s("soldByStaffName"),
    remarksPrivate: s("remarksPrivate"),
    deliveryTerms: s("deliveryTerms"),
    referenceDoc: s("referenceDoc"),
    lineCount: Array.isArray(d["lines"]) ? (d["lines"] as unknown[]).length : 0,
    createdAt: d["createdAt"] ? new Date(d["createdAt"] as string).toISOString() : "",
  };
}

function toDetail(d: Record<string, unknown>): SalesDocDetail {
  return {
    ...toRow(d),
    lines: (d["lines"] as ISalesLine[]) ?? [],
    priceInclusive: Boolean(d["priceInclusive"]),
    invoiceDiscount: Number(d["invoiceDiscount"] ?? 0),
    shippingTaxable: Boolean(d["shippingTaxable"]),
    cancelReason: String(d["cancelReason"] ?? ""),
    postedAt: d["postedAt"] ? new Date(d["postedAt"] as string).toISOString() : "",
  };
}

// ─── Tax computation ──────────────────────────────────────────────────────────

/**
 * Run the tax engine over an input document and return both the priced lines
 * and the totals. This is the ONLY path that produces money figures, so a
 * preview and a post can never disagree.
 */
async function priceDocument(
  input: SalesDocInput,
): Promise<{ lines: ISalesLine[]; totals: SalesDocTotals }> {
  const branch = await getDefaultBranch();

  const taxInput: TaxDocInput = {
    lines: input.lines.map((l) => ({
      quantity: l.quantity,
      freeQuantity: l.freeQuantity,
      rate: l.rate,
      discountType: l.discountType,
      discountValue: l.discountValue,
      gstRate: l.gstRate,
      cessRate: l.cessRate,
    })),
    invoiceType: input.invoiceType,
    branchStateCode: branch.stateCode,
    placeOfSupply: input.placeOfSupply,
    priceInclusive: input.priceInclusive,
    invoiceDiscount: input.invoiceDiscount,
    shippingAmount: input.shippingAmount,
    shippingTaxable: input.shippingTaxable,
    lutEnabled: branch.lutEnabled,
  };

  const result = computeDocument(taxInput);

  const lines: ISalesLine[] = input.lines.map((src: SalesLineInput, i: number) => {
    const calc = result.lines[i]!;
    return {
      lineNo: i + 1,
      itemId: src.itemId ?? "",
      itemCode: src.itemCode ?? "",
      itemName: src.itemName,
      itemClass: src.itemClass,
      lineType: src.lineType as ISalesLine["lineType"],
      description: src.description ?? "",
      tag: src.tag ?? "",
      serialNo: src.serialNo ?? "",
      batchId: src.batchId ?? "",
      batchNo: src.batchNo ?? "",
      expiryDate: src.expiryDate ?? "",
      animalId: src.animalId ?? "",
      hsnSac: src.hsnSac ?? "",
      uom: src.uom ?? "",
      quantity: src.quantity,
      freeQuantity: src.freeQuantity,
      rate: src.rate,
      discountType: src.discountType,
      discountValue: src.discountValue,
      // The engine's figure wins — it applies the cap and the % conversion.
      discountAmount: roundMoney(calc.discountAmount + calc.invoiceDiscountShare),
      taxableValue: calc.taxableValue,
      gstRate: calc.gstRate,
      cessRate: calc.cessRate,
      cgst: calc.cgst,
      sgst: calc.sgst,
      igst: calc.igst,
      cess: calc.cess,
      lineTotal: calc.lineTotal,
      sourceRef: src.sourceRef ?? "",
    };
  });

  const totals: SalesDocTotals = {
    subTotal: result.subTotal,
    discountTotal: result.discountTotal,
    taxableValue: result.taxableValue,
    cgst: result.cgst,
    sgst: result.sgst,
    igst: result.igst,
    cess: result.cess,
    taxTotal: result.taxTotal,
    shippingAmount: result.shippingAmount,
    roundOff: result.roundOff,
    grandTotal: result.grandTotal,
    isInterstate: result.isInterstate,
    rateSummary: result.rateSummary,
  };

  return { lines, totals };
}

// ─── Preview (no persistence) ─────────────────────────────────────────────────

export const previewSalesDocFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => SalesDocInputZ.parse(raw))
  .handler(async ({ data }): Promise<{ lines: ISalesLine[]; totals: SalesDocTotals }> => {
    await connectDB();
    return priceDocument(data);
  });

// ─── Draft create / update ────────────────────────────────────────────────────

export const createDraftSalesDocFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => SalesDocInputZ.parse(raw))
  .handler(async ({ data }): Promise<SalesDocDetail> => {
    await connectDB();
    const { lines, totals } = await priceDocument(data);

    const created = await SalesDocModel.create(
      docPayload({
        ...data,
        // No number until POST — a number on an abandoned draft is a GST gap.
        docNumber: "",
        status: "DRAFT",
        lines,
        ...totals,
        paidAmount: 0,
        balanceDue: totals.grandTotal,
        paymentStatus: "UNPAID",
      }),
    );

    return toDetail(created.toObject() as unknown as Record<string, unknown>);
  });

export const updateDraftSalesDocFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => SalesDocInputZ.extend({ id: z.string().min(1) }).parse(raw))
  .handler(async ({ data }): Promise<SalesDocDetail> => {
    await connectDB();

    const existing = await SalesDocModel.findById(data.id).lean();
    if (!existing) throw new Error("Document not found");
    if (existing.status !== "DRAFT") {
      throw new Error(
        `${existing.docNumber || "This document"} is ${existing.status} and can no longer be edited. ` +
          `Raise a credit note or cancel and reissue instead.`,
      );
    }

    const { lines, totals } = await priceDocument(data);
    const { id: _id, ...rest } = data;

    const updated = await SalesDocModel.findByIdAndUpdate(
      data.id,
      { $set: { ...rest, lines, ...totals, balanceDue: totals.grandTotal } },
      { returnDocument: "after" },
    ).lean();
    if (!updated) throw new Error("Document not found");

    return toDetail(updated as unknown as Record<string, unknown>);
  });

// ─── FEFO batch allocation ────────────────────────────────────────────────────

export interface BatchSuggestion {
  batchId: string;
  batchNo: string;
  expiryDate: string;
  available: number;
  allocate: number;
  rate: number;
  expiringSoon: boolean;
}

export const allocateFefoFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z.object({ itemCode: z.string().min(1), qty: z.number().min(0) }).parse(raw),
  )
  .handler(async ({ data }): Promise<BatchSuggestion[]> => {
    await connectDB();
    return suggestBatches(data.itemCode, data.qty);
  });

/**
 * First-Expiry-First-Out. Expired batches are never offered — selling an
 * expired drug is a licensing problem, not a stock problem. Anything inside 30
 * days is offered but flagged.
 */
export async function suggestBatches(itemCode: string, qty: number): Promise<BatchSuggestion[]> {
  const today = todayIST();
  const soon = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const batches = await StockBatch.find({
    itemCode,
    status: { $in: ["Active"] },
    qty: { $gt: 0 },
  })
    .sort({ expiryDate: 1 })
    .lean();

  const out: BatchSuggestion[] = [];
  let remaining = qty;

  for (const b of batches) {
    const expiry = String(b.expiryDate ?? "");
    if (expiry && expiry < today) continue; // expired — never auto-select

    const available = Number(b.qty ?? 0);
    const take = Math.min(available, Math.max(0, remaining));
    remaining = roundMoney(remaining - take);

    out.push({
      batchId: String(b._id),
      batchNo: String(b.batchNo ?? ""),
      expiryDate: expiry,
      available,
      allocate: take,
      rate: Number(b.purchasePricePerUnit ?? 0) + Number(b.landingCostPerUnit ?? 0),
      expiringSoon: Boolean(expiry) && expiry <= soon,
    });

    if (remaining <= 0) break;
  }

  return out;
}

// ─── Posting ──────────────────────────────────────────────────────────────────

const PostInputZ = z.object({
  id: z.string().min(1),
  idempotencyKey: z.string().optional(),
  managerOverride: z.boolean().default(false),
  overrideReason: z.string().optional(),
  actorId: z.string().optional(),
  actorName: z.string().optional(),
});

export interface PostResult {
  ok: boolean;
  docId: string;
  docNumber: string;
  grandTotal: number;
  balanceDue: number;
  paymentStatus: string;
  /** True when the document was already posted and this call changed nothing. */
  alreadyPosted: boolean;
}

export const postSalesDocFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => PostInputZ.parse(raw))
  .handler(async ({ data }): Promise<PostResult> => {
    await connectDB();

    const doc = await SalesDocModel.findById(data.id).lean();
    if (!doc) throw new Error("Document not found");

    // Idempotency: a retried request (double click, flaky clinic wifi) must
    // return the original result rather than posting a second time.
    if (doc.status === "POSTED") {
      return {
        ok: true,
        docId: String(doc._id),
        docNumber: String(doc.docNumber),
        grandTotal: Number(doc.grandTotal ?? 0),
        balanceDue: Number(doc.balanceDue ?? 0),
        paymentStatus: String(doc.paymentStatus ?? "UNPAID"),
        alreadyPosted: true,
      };
    }
    if (doc.status === "CANCELLED") throw new Error("A cancelled document cannot be posted.");
    if (!doc.lines?.length) throw new Error("Add at least one line before saving.");

    // A quotation is an offer, not a financial event — it gets a number but
    // touches no ledger and no stock.
    const isQuotation = doc.docType === "QUOTATION";
    const isCreditNote = doc.docType === "CREDIT_NOTE";

    // ── Credit control, re-checked server-side ──
    if (!isQuotation && doc.linkType === "CLIENT_ACCOUNT" && doc.partyId) {
      const unpaid = Number(doc.grandTotal ?? 0) - Number(doc.paidAmount ?? 0);
      if (!isCreditNote && unpaid > 0.005) {
        const credit = await evaluateCredit(String(doc.partyId), unpaid);
        if (!credit.allowed) {
          if (!(credit.requiresOverride && data.managerOverride)) {
            throw new Error(credit.reason);
          }
          await AuditLogModel.create({
            entity: "SalesDoc",
            entityId: String(doc._id),
            action: "OVERRIDE",
            actorId: data.actorId ?? "",
            actorName: data.actorName ?? "",
            reason: data.overrideReason || credit.reason,
            afterJson: {
              outstanding: credit.currentOutstanding,
              creditLimit: credit.creditLimit,
              amount: unpaid,
            },
          });
        }
      }
    }

    // A counter sale must leave the counter settled.
    if (!isQuotation && !isCreditNote && doc.linkType === "COUNTER_SALE") {
      const unpaid = roundMoney(Number(doc.grandTotal ?? 0) - Number(doc.paidAmount ?? 0));
      if (unpaid > 0.005) {
        throw new Error(
          `A counter sale must be paid in full (₹${unpaid.toFixed(2)} outstanding). ` +
            `Switch "Link To" to Client Account to bill this on credit.`,
        );
      }
    }

    const docDate = String(doc.docDate);
    const docTypeCode = isQuotation ? "QTN" : isCreditNote ? "CRN" : "INV";
    const branchId = String(doc.branchId ?? "MAIN");

    let allocatedNumber = "";

    const result = await withTransaction(
      async (ctx) => {
        // 1. Number — inside the transaction, so a rollback returns it.
        const { docNumber } = await allocateDocNumber(docTypeCode, docDate, branchId, ctx.session);
        allocatedNumber = docNumber;

        const { paymentStatus, balanceDue } = derivePaymentStatus(
          Number(doc.grandTotal ?? 0),
          Number(doc.paidAmount ?? 0),
        );

        // 2. The document itself.
        await SalesDocModel.updateOne(
          { _id: doc._id },
          {
            $set: {
              docNumber,
              status: "POSTED",
              postedAt: new Date(),
              balanceDue,
              paymentStatus,
            },
          },
          sessionOpt(ctx.session),
        );

        if (!isQuotation) {
          // 3. Stock movements for goods lines.
          await writeStockMoves(
            doc as unknown as Record<string, unknown>,
            docNumber,
            isCreditNote,
            ctx.session,
          );

          // 4. Party ledger.
          if (doc.partyId) {
            const amount = roundMoney(Number(doc.grandTotal ?? 0));
            await PartyLedgerModel.create(
              docPayloads([
                {
                  partyId: doc.partyId,
                  entryDate: docDate,
                  sourceKind: isCreditNote ? "CREDIT_NOTE" : "SALE",
                  sourceId: String(doc._id),
                  sourceNumber: docNumber,
                  narration: isCreditNote ? `Credit note ${docNumber}` : `Invoice ${docNumber}`,
                  // A sale is a debit to the customer; a credit note reverses it.
                  debit: isCreditNote ? 0 : amount,
                  credit: isCreditNote ? amount : 0,
                },
              ]),
              sessionOpt(ctx.session),
            );
          }

          // 5. Daily summary.
          await bumpDailySummary(
            branchId,
            docDate,
            isCreditNote
              ? { creditNoteTotal: Number(doc.grandTotal ?? 0) }
              : {
                  saleTaxable: Number(doc.taxableValue ?? 0),
                  saleTax: roundMoney(
                    Number(doc.cgst ?? 0) +
                      Number(doc.sgst ?? 0) +
                      Number(doc.igst ?? 0) +
                      Number(doc.cess ?? 0),
                  ),
                  saleTotal: Number(doc.grandTotal ?? 0),
                  invoiceCount: 1,
                },
            ctx.session,
          );
        }

        return {
          ok: true,
          docId: String(doc._id),
          docNumber,
          grandTotal: Number(doc.grandTotal ?? 0),
          balanceDue,
          paymentStatus,
          alreadyPosted: false,
        } satisfies PostResult;
      },
      // Compensation for the non-transactional path: unwind in reverse.
      async () => {
        if (!allocatedNumber) return;
        await PartyLedgerModel.deleteMany({ sourceNumber: allocatedNumber });
        await StockLedgerEntryModel.deleteMany({ sourceNumber: allocatedNumber });
        await SalesDocModel.updateOne(
          { _id: doc._id },
          { $set: { docNumber: "", status: "DRAFT" }, $unset: { postedAt: "" } },
        );
      },
    );

    // Mirror onto the clinical visit so existing screens stay in step.
    if (doc.visitId) {
      await ClinicalVisit.updateOne(
        { visitId: doc.visitId },
        {
          $set: {
            salesDocNo: result.docNumber,
            salesDocId: String(doc._id),
            totalAmount: result.grandTotal,
            balanceDue: result.balanceDue,
            paymentStatus:
              result.paymentStatus === "PAID"
                ? "Full"
                : result.paymentStatus === "PARTIAL"
                  ? "Partial"
                  : "Unpaid",
          },
        },
      ).catch(() => {
        // The visit mirror is a convenience, not the source of truth — never
        // fail a posted invoice because the mirror could not be written.
      });
    }

    await AuditLogModel.create({
      entity: "SalesDoc",
      entityId: String(doc._id),
      entityRef: result.docNumber,
      action: "POST",
      actorId: data.actorId ?? "",
      actorName: data.actorName ?? "",
      afterJson: { grandTotal: result.grandTotal, status: "POSTED" },
    });

    return result;
  });

/**
 * Write one stock movement per stockable line.
 *
 * Services and non-stock items are skipped. A credit note moves stock back IN.
 * Free quantity moves too — it leaves the shelf even though it is not billed.
 */
async function writeStockMoves(
  doc: Record<string, unknown>,
  docNumber: string,
  isReturn: boolean,
  session: Parameters<typeof sessionOpt>[0],
): Promise<void> {
  const lines = (doc["lines"] as ISalesLine[]) ?? [];
  const docDate = String(doc["docDate"] ?? "");

  for (const line of lines) {
    if (line.itemClass !== "GOODS" || !line.itemCode) continue;

    const item = await InventoryItem.findOne({ itemCode: line.itemCode }).lean();
    if (item && item.maintainStock === false) continue;

    const moveQty = roundMoney(Number(line.quantity ?? 0) + Number(line.freeQuantity ?? 0));
    if (moveQty <= 0) continue;

    // Rx immediate treatment already consumed this stock at administration
    // time; billing it must not deduct a second time.
    if (!isReturn && line.sourceRef) {
      const consumed = await StockLedgerEntryModel.findOne({
        sourceKind: "CONSUMPTION",
        narration: line.sourceRef,
      }).lean();
      if (consumed) continue;
    }

    if (line.batchId) {
      await StockBatch.updateOne(
        { _id: line.batchId },
        { $inc: { qty: isReturn ? moveQty : -moveQty } },
        sessionOpt(session),
      );
    }

    const balanceAfter = line.itemCode
      ? Number(
          (await InventoryItem.findOne({ itemCode: line.itemCode }).lean())?.currentStock ?? 0,
        ) + (isReturn ? moveQty : -moveQty)
      : 0;

    if (line.itemCode) {
      await InventoryItem.updateOne(
        { itemCode: line.itemCode },
        { $inc: { currentStock: isReturn ? moveQty : -moveQty } },
        sessionOpt(session),
      );
    }

    await StockLedgerEntryModel.create(
      docPayloads([
        {
          itemId: line.itemId ?? "",
          itemCode: line.itemCode,
          itemName: line.itemName,
          batchId: line.batchId ?? "",
          batchNo: line.batchNo ?? "",
          entryDate: docDate,
          sourceKind: isReturn ? "RETURN_IN" : "SALE",
          sourceId: String(doc["_id"] ?? ""),
          sourceNumber: docNumber,
          qtyIn: isReturn ? moveQty : 0,
          qtyOut: isReturn ? 0 : moveQty,
          rate: line.rate,
          value: roundMoney(moveQty * line.rate),
          balanceAfter,
          narration: line.sourceRef ?? "",
        },
      ]),
      sessionOpt(session),
    );
  }
}

/** Increment the materialised daily totals the dashboard reads. */
export async function bumpDailySummary(
  branchId: string,
  date: string,
  deltas: Partial<{
    saleTaxable: number;
    saleTax: number;
    saleTotal: number;
    creditNoteTotal: number;
    received: number;
    paidOut: number;
    purchaseTotal: number;
    expenseTotal: number;
    cashIn: number;
    cashOut: number;
    invoiceCount: number;
  }>,
  session?: Parameters<typeof sessionOpt>[0],
): Promise<void> {
  const inc: Record<string, number> = {};
  for (const [k, v] of Object.entries(deltas)) {
    if (v) inc[k] = roundMoney(v);
  }
  if (!Object.keys(inc).length) return;

  await FinDailySummaryModel.updateOne(
    { branchId, date },
    { $inc: inc, $setOnInsert: { branchId, date } },
    { upsert: true, ...sessionOpt(session) },
  );
}

// ─── Cancel ───────────────────────────────────────────────────────────────────

export const cancelSalesDocFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({
        id: z.string().min(1),
        reason: z.string().min(3, "A cancellation reason is required"),
        actorId: z.string().optional(),
        actorName: z.string().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; docNumber: string }> => {
    await connectDB();

    const doc = await SalesDocModel.findById(data.id).lean();
    if (!doc) throw new Error("Document not found");
    if (doc.status === "CANCELLED") return { ok: true, docNumber: String(doc.docNumber) };

    if (Number(doc.paidAmount ?? 0) > 0.005) {
      throw new Error(
        `${doc.docNumber} has ₹${Number(doc.paidAmount).toFixed(2)} received against it. ` +
          `Cancel or reverse the payment first.`,
      );
    }

    const docNumber = String(doc.docNumber ?? "");
    const isQuotation = doc.docType === "QUOTATION";
    const isCreditNote = doc.docType === "CREDIT_NOTE";

    await withTransaction(async (ctx) => {
      // The number is retained and never reused — GST requires the series to
      // stay consecutive, gaps included as cancelled documents.
      await SalesDocModel.updateOne(
        { _id: doc._id },
        {
          $set: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancelReason: data.reason,
            balanceDue: 0,
            paymentStatus: "UNPAID",
          },
        },
        sessionOpt(ctx.session),
      );

      if (isQuotation || doc.status !== "POSTED") return;

      // Reversal rows rather than deletions — the history stays visible.
      if (doc.partyId) {
        const amount = roundMoney(Number(doc.grandTotal ?? 0));
        await PartyLedgerModel.create(
          docPayloads([
            {
              partyId: doc.partyId,
              entryDate: todayIST(),
              sourceKind: isCreditNote ? "CREDIT_NOTE" : "SALE",
              sourceId: String(doc._id),
              sourceNumber: docNumber,
              narration: `Cancelled ${docNumber}: ${data.reason}`,
              debit: isCreditNote ? amount : 0,
              credit: isCreditNote ? 0 : amount,
              isReversal: true,
              reversalOfId: String(doc._id),
            },
          ]),
          sessionOpt(ctx.session),
        );
      }

      // Put the stock back.
      await writeStockMoves(
        doc as unknown as Record<string, unknown>,
        docNumber,
        !isCreditNote,
        ctx.session,
      );

      await bumpDailySummary(
        String(doc.branchId ?? "MAIN"),
        String(doc.docDate),
        isCreditNote
          ? { creditNoteTotal: -Number(doc.grandTotal ?? 0) }
          : {
              saleTaxable: -Number(doc.taxableValue ?? 0),
              saleTax: -roundMoney(
                Number(doc.cgst ?? 0) +
                  Number(doc.sgst ?? 0) +
                  Number(doc.igst ?? 0) +
                  Number(doc.cess ?? 0),
              ),
              saleTotal: -Number(doc.grandTotal ?? 0),
              invoiceCount: -1,
            },
        ctx.session,
      );
    });

    await AuditLogModel.create({
      entity: "SalesDoc",
      entityId: String(doc._id),
      entityRef: docNumber,
      action: "CANCEL",
      actorId: data.actorId ?? "",
      actorName: data.actorName ?? "",
      reason: data.reason,
    });

    return { ok: true, docNumber };
  });

// ─── Reads ────────────────────────────────────────────────────────────────────

export const listSalesDocsFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z
      .object({
        docType: z.enum(["QUOTATION", "INVOICE", "CREDIT_NOTE", "ALL"]).default("INVOICE"),
        from: z.string().optional(),
        to: z.string().optional(),
        partyId: z.string().optional(),
        status: z.string().optional(),
        paymentStatus: z.string().optional(),
        q: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(100),
        skip: z.number().int().min(0).default(0),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data }): Promise<{ rows: SalesDocRow[]; total: number }> => {
    await connectDB();

    const filter: Record<string, unknown> = {};
    if (data.docType !== "ALL") filter["docType"] = data.docType;
    if (data.from || data.to) {
      const range: Record<string, string> = {};
      if (data.from) range["$gte"] = data.from;
      if (data.to) range["$lte"] = data.to;
      filter["docDate"] = range;
    }
    if (data.partyId) filter["partyId"] = data.partyId;
    if (data.status && data.status !== "all") filter["status"] = data.status;
    if (data.paymentStatus && data.paymentStatus !== "all") {
      filter["paymentStatus"] = data.paymentStatus;
    }
    if (data.q?.trim()) {
      const rx = { $regex: data.q.trim(), $options: "i" };
      filter["$or"] = [
        { docNumber: rx },
        { partyName: rx },
        { partyMobile: rx },
        { animalName: rx },
        { "lines.itemName": rx },
      ];
    }

    const [docs, total] = await Promise.all([
      SalesDocModel.find(filter)
        .sort({ docDate: -1, createdAt: -1 })
        .skip(data.skip)
        .limit(data.limit)
        .lean(),
      SalesDocModel.countDocuments(filter),
    ]);

    return { rows: docs.map((d) => toRow(d as unknown as Record<string, unknown>)), total };
  });

export const getSalesDocFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) =>
    z.object({ id: z.string().optional(), docNumber: z.string().optional() }).parse(raw),
  )
  .handler(async ({ data }): Promise<SalesDocDetail> => {
    await connectDB();
    const doc = data.id
      ? await SalesDocModel.findById(data.id).lean()
      : await SalesDocModel.findOne({ docNumber: String(data.docNumber ?? "") }).lean();
    if (!doc) throw new Error("Document not found");
    return toDetail(doc as unknown as Record<string, unknown>);
  });

// ─── Quotation → invoice ──────────────────────────────────────────────────────

export const convertQuotationFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ id: z.string().min(1) }).parse(raw))
  .handler(async ({ data }): Promise<SalesDocDetail> => {
    await connectDB();

    const q = await SalesDocModel.findById(data.id).lean();
    if (!q) throw new Error("Quotation not found");
    if (q.docType !== "QUOTATION") throw new Error("This document is not a quotation.");
    if (q.status === "CONVERTED") {
      throw new Error(`Already converted to ${q.convertedToDocNo}.`);
    }
    if (q.status === "CANCELLED") throw new Error("A cancelled quotation cannot be converted.");

    const plain = q as unknown as Record<string, unknown>;
    const draft = await SalesDocModel.create(
      docPayload({
        ...plain,
        _id: undefined,
        docType: "INVOICE",
        docNumber: "",
        // The invoice is dated today, not when the estimate was given.
        docDate: todayIST(),
        status: "DRAFT",
        postedAt: undefined,
        validUntil: "",
        referenceDoc: `Quotation ${q.docNumber}`,
        paidAmount: 0,
        balanceDue: Number(q.grandTotal ?? 0),
        paymentStatus: "UNPAID",
        createdAt: undefined,
        updatedAt: undefined,
      }),
    );

    await SalesDocModel.updateOne(
      { _id: q._id },
      { $set: { status: "CONVERTED", convertedToDocNo: `DRAFT:${String(draft._id)}` } },
    );

    return toDetail(draft.toObject() as unknown as Record<string, unknown>);
  });

// ─── Credit note from an invoice ──────────────────────────────────────────────

export const createCreditNoteFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({
        sourceInvoiceId: z.string().min(1),
        /** Omit to credit the whole invoice. */
        lineNos: z.array(z.number()).optional(),
        reason: z.string().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }): Promise<SalesDocDetail> => {
    await connectDB();

    const inv = await SalesDocModel.findById(data.sourceInvoiceId).lean();
    if (!inv) throw new Error("Invoice not found");
    if (inv.docType !== "INVOICE") throw new Error("Credit notes are raised against invoices.");
    if (inv.status !== "POSTED") {
      throw new Error("Only a posted invoice can be credited.");
    }

    const allLines = (inv.lines as ISalesLine[]) ?? [];
    const keep = data.lineNos?.length
      ? allLines.filter((l) => data.lineNos!.includes(l.lineNo))
      : allLines;
    if (!keep.length) throw new Error("Select at least one line to credit.");

    const input: SalesDocInput = SalesDocInputZ.parse({
      docType: "CREDIT_NOTE",
      docDate: todayIST(),
      branchId: String(inv.branchId ?? "MAIN"),
      invoiceType: String(inv.invoiceType ?? "GST"),
      linkType: String(inv.linkType ?? "COUNTER_SALE"),
      partyId: String(inv.partyId ?? ""),
      partyName: String(inv.partyName ?? "CASH"),
      partyGstin: String(inv.partyGstin ?? ""),
      partyAddress: String(inv.partyAddress ?? ""),
      partyMobile: String(inv.partyMobile ?? ""),
      animalId: String(inv.animalId ?? ""),
      animalName: String(inv.animalName ?? ""),
      placeOfSupply: String(inv.placeOfSupply ?? "27"),
      priceInclusive: Boolean(inv.priceInclusive),
      againstDocNo: String(inv.docNumber ?? ""),
      againstDocId: String(inv._id),
      remarksPrivate: data.reason ?? "",
      lines: keep.map((l) => ({
        itemId: l.itemId,
        itemCode: l.itemCode,
        itemName: l.itemName,
        itemClass: l.itemClass,
        lineType: l.lineType,
        batchId: l.batchId,
        batchNo: l.batchNo,
        expiryDate: l.expiryDate,
        animalId: l.animalId,
        hsnSac: l.hsnSac,
        uom: l.uom,
        quantity: l.quantity,
        rate: l.rate,
        discountType: l.discountType,
        discountValue: l.discountValue,
        gstRate: l.gstRate,
        cessRate: l.cessRate,
      })),
    });

    const { lines, totals } = await priceDocument(input);
    const created = await SalesDocModel.create(
      docPayload({
        ...input,
        docNumber: "",
        status: "DRAFT",
        lines,
        ...totals,
        paidAmount: 0,
        balanceDue: totals.grandTotal,
        paymentStatus: "UNPAID",
      }),
    );

    return toDetail(created.toObject() as unknown as Record<string, unknown>);
  });

// ─── Print payload ────────────────────────────────────────────────────────────

export interface InvoicePrintPayload {
  doc: SalesDocDetail;
  branch: {
    name: string;
    gstin: string;
    stateCode: string;
    address: string;
    city: string;
    pin: string;
    phone: string;
    email: string;
    invoiceFooter: string;
  };
  rateSummary: SalesDocTotals["rateSummary"];
  amountInWords: string;
  payments: Array<{ docNumber: string; docDate: string; modes: string; amount: number }>;
}

export const getInvoicePrintPayloadFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => z.object({ id: z.string().min(1) }).parse(raw))
  .handler(async ({ data }): Promise<InvoicePrintPayload> => {
    await connectDB();

    const doc = await SalesDocModel.findById(data.id).lean();
    if (!doc) throw new Error("Document not found");

    const branchDoc = await getDefaultBranch();
    const { OrgBranchModel } = await import("@/lib/mongodb/models/OrgBranch");
    const full = await OrgBranchModel.findOne({ code: branchDoc.code }).lean();

    const lines = (doc.lines as ISalesLine[]) ?? [];
    const rateMap = new Map<number, SalesDocTotals["rateSummary"][number]>();
    for (const l of lines) {
      const row = rateMap.get(l.gstRate) ?? {
        gstRate: l.gstRate,
        taxableValue: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        cess: 0,
      };
      row.taxableValue = roundMoney(row.taxableValue + l.taxableValue);
      row.cgst = roundMoney(row.cgst + l.cgst);
      row.sgst = roundMoney(row.sgst + l.sgst);
      row.igst = roundMoney(row.igst + l.igst);
      row.cess = roundMoney(row.cess + l.cess);
      rateMap.set(l.gstRate, row);
    }

    const { PaymentDocModel } = await import("@/lib/mongodb/models/PaymentDoc");
    const pays = await PaymentDocModel.find({
      status: "POSTED",
      "allocations.docId": String(doc._id),
    }).lean();

    return {
      doc: toDetail(doc as unknown as Record<string, unknown>),
      branch: {
        name: full?.name ?? branchDoc.name,
        gstin: full?.gstin ?? "",
        stateCode: full?.stateCode ?? branchDoc.stateCode,
        address: full?.address ?? "",
        city: full?.city ?? "",
        pin: full?.pin ?? "",
        phone: full?.phone ?? "",
        email: full?.email ?? "",
        invoiceFooter: full?.invoiceFooter ?? "",
      },
      rateSummary: Array.from(rateMap.values()).sort((a, b) => a.gstRate - b.gstRate),
      amountInWords: amountInWords(Number(doc.grandTotal ?? 0)),
      payments: pays.map((p) => ({
        docNumber: String(p.docNumber ?? ""),
        docDate: String(p.docDate ?? ""),
        modes: (p.splits ?? []).map((s) => s.payMode).join(", "),
        amount: roundMoney(
          (p.allocations ?? [])
            .filter((a) => a.docId === String(doc._id))
            .reduce((s, a) => s + a.amount, 0),
        ),
      })),
    };
  });

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n] ?? "";
  const t = TENS[Math.floor(n / 10)] ?? "";
  const o = ONES[n % 10] ?? "";
  return o ? `${t} ${o}` : t;
}

/** Indian numbering: lakh and crore, as a GST invoice must print. */
export function amountInWords(amount: number): string {
  const rupees = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - rupees) * 100);
  if (rupees === 0 && paise === 0) return "Zero Rupees Only";

  const parts: string[] = [];
  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const hundred = Math.floor((rupees % 1000) / 100);
  const rest = rupees % 100;

  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (rest) parts.push(twoDigits(rest));

  let words = parts.join(" ").trim();
  if (amount < 0) words = `Minus ${words}`;
  return paise ? `${words} Rupees and ${twoDigits(paise)} Paise Only` : `${words} Rupees Only`;
}
