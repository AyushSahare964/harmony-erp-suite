/**
 * Party balance, derived from source documents — there is no stored balance
 * and no shadow ledger table. Positive = the party owes us.
 *
 *   opening + invoices − credit notes − receipts (IN) + payments (OUT)
 *
 * Cancelled documents drop out via their status; bounced cheque splits are
 * subtracted from the payment they belong to.
 */
import { PartyModel } from "@/lib/mongodb/models/Party";
import { SalesDocModel } from "@/lib/mongodb/models/SalesDoc";
import { PaymentDocModel } from "@/lib/mongodb/models/PaymentDoc";
import { roundMoney } from "@/lib/utils/moneyUtils";
import { signedOpening } from "@/lib/ledger/buildLedger";

/** Net money of a payment after bounced instruments. Used by aggregate and per-doc code. */
export const NET_PAYMENT_EXPR = {
  $subtract: [
    "$totalAmount",
    {
      $sum: {
        $map: {
          input: "$splits",
          as: "s",
          in: { $cond: [{ $eq: ["$$s.clearingStatus", "BOUNCED"] }, "$$s.amount", 0] },
        },
      },
    },
  ],
};

export async function computeBalances(partyIds: string[]): Promise<Map<string, number>> {
  if (!partyIds.length) return new Map();

  const [parties, sales, pays] = await Promise.all([
    PartyModel.find({ partyId: { $in: partyIds } }, { partyId: 1, openingBalance: 1, openingType: 1 }).lean(),
    SalesDocModel.aggregate<{ _id: string; net: number }>([
      { $match: { partyId: { $in: partyIds }, status: "POSTED", docType: { $in: ["INVOICE", "CREDIT_NOTE"] } } },
      {
        $group: {
          _id: "$partyId",
          net: { $sum: { $cond: [{ $eq: ["$docType", "CREDIT_NOTE"] }, { $multiply: ["$grandTotal", -1] }, "$grandTotal"] } },
        },
      },
    ]),
    PaymentDocModel.aggregate<{ _id: string; net: number }>([
      { $match: { partyId: { $in: partyIds }, status: "POSTED" } },
      { $addFields: { netAmt: NET_PAYMENT_EXPR } },
      { $group: { _id: "$partyId", net: { $sum: { $cond: [{ $eq: ["$direction", "IN"] }, { $multiply: ["$netAmt", -1] }, "$netAmt"] } } } },
    ]),
  ]);

  const out = new Map<string, number>();
  for (const p of parties) {
    out.set(String(p.partyId), signedOpening(Number(p.openingBalance ?? 0), String(p.openingType ?? "DR")));
  }
  for (const r of [...sales, ...pays]) out.set(r._id, roundMoney((out.get(r._id) ?? 0) + r.net));
  return out;
}

export async function computePartyBalance(partyId: string): Promise<number> {
  return (await computeBalances([partyId])).get(partyId) ?? 0;
}
