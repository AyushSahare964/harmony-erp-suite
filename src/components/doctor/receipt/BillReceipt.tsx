import { useEffect, useRef } from "react";
import { Receipt } from "lucide-react";
import { clinic } from "@/data/doctor/clinic";
import { invoiceTotal, type Invoice } from "@/data/doctor/history";
import type { Pet } from "@/data/doctor/types";
import { fmtDate, rupee } from "@/lib/doctor/format";
import { BrandChip } from "../shared/BrandChip";

interface BillReceiptProps {
  pet: Pet;
  invoiceNo: string;
  invoice: Invoice;
  onClose: () => void;
}

/** Bill receipt overlay. Print prints only the receipt (see @media print in doctor-records.css). */
export function BillReceipt({ pet, invoiceNo, invoice: v, onClose }: BillReceiptProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div
      className="receipt-layer"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="receipt-box" role="dialog" aria-modal="true" aria-label="Bill receipt">
        <div className="rc-head">
          <img className="rc-logo-img" src={clinic.emblemUrl} alt="" />
          <div>
            <div className="rc-clinic">{clinic.name}</div>
            <div className="rc-sub">
              Powered by <BrandChip />
            </div>
          </div>
        </div>
        <div className="rc-title">
          <span>Bill receipt</span>
          <b>{invoiceNo}</b>
        </div>
        <dl className="rc-meta">
          <div>
            <dt>Date</dt>
            <dd>{fmtDate(v.date)}</dd>
          </div>
          <div>
            <dt>Patient</dt>
            <dd>
              {pet.name} · {pet.breed}
            </dd>
          </div>
          <div>
            <dt>Owner</dt>
            <dd>{pet.owner}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{pet.phone}</dd>
          </div>
        </dl>
        <table className="rc-items">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {v.items.map(([name, qty, rate], i) => (
              <tr key={i}>
                <td>{name}</td>
                <td>{qty}</td>
                <td>{rupee(rate)}</td>
                <td>{rupee(qty * rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="rc-total">
          <span>Total (taxes included)</span>
          <b>{rupee(invoiceTotal(v))}</b>
        </div>
        <div className="rc-pay">
          <div>
            <span>Paid by</span>
            <b>{v.mode}</b>
          </div>
          <div>
            <span>Billed by</span>
            <b>{v.by}</b>
          </div>
          <div className="rc-paid">Paid</div>
        </div>
        <p className="rc-thanks">Thank you for visiting. Get well soon, {pet.name}!</p>
        <div className="rc-actions">
          <button ref={closeRef} className="rc-btn ghost" type="button" onClick={onClose}>
            Close
          </button>
          <button className="rc-btn" type="button" onClick={() => window.print()}>
            <Receipt aria-hidden="true" /> Print bill
          </button>
        </div>
      </div>
    </div>
  );
}
