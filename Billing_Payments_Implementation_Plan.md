# Billing & Payments — Detailed Sub-Module Implementation Plan

**VetOS ERP  |  Module 11 (Billing & Payments) — Deep-Dive**
Version 1.0 | Draft for Stakeholder Review
Builds on: `1_ERP_Scope_Roles_Module_Catalogue.docx`, `2_Implementation_Plan_Roadmap.docx`, `4_SubModules_Stepwise_Feature_Breakdown.docx`

---

## 1. Why This Document Exists

The base Sub-Modules document (Section 11) covered Billing & Payments at a summary level (11.1 Invoice Generation, 11.2 Payment Collection, 11.3 Estimates/Refunds/Delivery). This document expands that module with four capabilities requested for build:

1. **Manual billing of a particular product** — raise a bill for a single product/service directly, without needing an OPD/lab/boarding encounter to exist first.
2. **Bill photo upload** — attach a photo (physical bill, handwritten receipt, supplier invoice, etc.) to a billing record.
3. **Bill photo visibility in-portal** — the uploaded photo must be viewable (not just stored) from the invoice/payment screen, with zoom/download.
4. **Payment analytics** — a dedicated analysis view of payment data (by method, by day, by staff, by status).
5. **Subscription billing** — recurring/membership-style billing (e.g., boarding/swimming memberships, retainer packages) tracked and billed from this module.
6. **Razorpay payment gateway** — an embedded, live Razorpay checkout inside the portal for online/card/UPI collection, with automatic reconciliation.

This is an **expansion of Module 11**, not a new module — it keeps the same roles (Admin: full, Receptionist: operate, Accountant: full) and the same position in the roadmap (Phase 3 — Commerce, Billing & Inventory).

---

## 2. Updated Sub-Module Map for Module 11

| # | Sub-module | Status |
|---|---|---|
| 11.1 | Invoice Generation (consolidated, multi-source) | Existing — unchanged |
| 11.2 | Payment Collection (cash/card/bank/UPI/split) | Existing — extended (Razorpay added, see 11.7) |
| 11.3 | Estimates, Refunds & Delivery | Existing — unchanged |
| **11.4** | **Manual Product Billing** | **New — this document** |
| **11.5** | **Bill/Receipt Photo Capture & Gallery** | **New — this document** |
| **11.6** | **Payment Analytics Dashboard** | **New — this document** |
| **11.7** | **Razorpay Payment Gateway Integration** | **New — this document** |
| **11.8** | **Subscription / Recurring Billing** | **New — this document** |

---

## 3. Sub-Module 11.4 — Manual Product Billing

### Purpose
Let Receptionist/Admin raise a bill for a specific product or service directly from the Billing module — e.g., a walk-in retail sale (leash, shampoo, food bag) or an ad-hoc service charge — **without** requiring a prior OPD/Lab/Boarding/Swimming record.

### Stepwise Features

| Step | Feature | Priority |
|---|---|---|
| Step 1 | "New Manual Bill" action from Billing module home | MVP |
| Step 2 | Product/service picker with search (pulls from Pharmacy/Retail & Service Catalogue) | MVP |
| Step 3 | Quantity, unit price (editable if permitted), auto GST calculation per product's tax rate | MVP |
| Step 4 | Multi-line manual bill (add more than one product in the same bill) | MVP |
| Step 5 | Optional link to an existing pet/owner record (searchable), or "walk-in / no pet record" mode for pure retail sale | MVP |
| Step 6 | Manual discount entry (%, flat, with reason field for audit) | Phase 2 |
| Step 7 | Auto stock decrement on save (writes to Inventory & Procurement stock ledger — cross-module rule) | MVP |
| Step 8 | Save as Draft vs Finalize & Bill (draft can be edited; finalized bill is locked and only correctable via credit note) | Phase 2 |

### Screen: "New Manual Bill"
- **Fields:** Pet/Owner (optional, searchable) → Product line items (product, batch/expiry auto-suggested FEFO, qty, unit price, tax, line total) → Add line → Subtotal, discount, tax, grand total → Payment section (see 11.2/11.7) → Notes.
- **Validation:** at least one line item required; quantity cannot exceed available stock (soft-warn if overridden by Admin); price cannot be zero unless explicitly marked "complimentary" with reason.
- **Actions:** Save Draft, Finalize & Bill, Print/Send.
- **Audit event:** `manual_bill.created`, `manual_bill.finalized`, `manual_bill.discount_applied` (actor, timestamp, tenant/branch).

### Data Model Addition
```
manual_bill
  id, tenant_id, branch_id, pet_id (nullable), owner_id (nullable),
  status (draft|finalized|void), created_by, created_at, finalized_at,
  subtotal, discount_amount, discount_reason, tax_amount, grand_total

manual_bill_line
  id, manual_bill_id, product_id, batch_id, quantity, unit_price,
  tax_rate, line_total
```
`manual_bill` rolls up into the same `invoice` entity used by 11.1 so all billing — encounter-linked or manual — reports through one ledger.

### Acceptance Criteria
- A Receptionist can bill a single retail product to a walk-in customer with no pet record in under 60 seconds.
- Stock ledger reflects the decrement immediately; a second sale cannot oversell the same batch.
- A finalized manual bill appears in the same invoice list, revenue reports and payment analytics (11.6) as encounter-linked bills.

---

## 4. Sub-Module 11.5 — Bill / Receipt Photo Capture & Gallery

### Purpose
Attach a photo of a physical bill, handwritten receipt, or payment proof (e.g., a supplier's paper invoice being logged, or a UPI payment screenshot) to a billing/payment record, and make it viewable directly in the portal.

### Stepwise Features

| Step | Feature | Priority |
|---|---|---|
| Step 1 | "Attach Photo" button on invoice/payment screen — upload from device or capture via camera (mobile/tablet) | MVP |
| Step 2 | File validation: JPG/PNG/HEIC/PDF, max 10 MB, auto-compress on upload | MVP |
| Step 3 | Multiple photos per bill (e.g., front + back of a receipt) | MVP |
| Step 4 | Inline thumbnail preview on the invoice/payment row in list views | MVP |
| Step 5 | Full-screen viewer with pinch-zoom/rotate, directly inside the portal (no download required to view) | MVP |
| Step 6 | Download / print the attached photo | Phase 2 |
| Step 7 | Role-based access: Receptionist can upload/view; Accountant can view/download for reconciliation; Admin full; Platform Admin — none (tenant data isolation) | MVP |
| Step 8 | Retention/versioning if a photo is re-uploaded (old version kept, not overwritten) | Phase 3 |

### Screen Behaviour
- On the Invoice Detail and Payment Detail screens, add a **"Bill Photo" panel**: shows thumbnail strip; clicking a thumbnail opens the full-screen viewer as a modal/lightbox — this satisfies "the photo of bill should be visible on this portal," i.e. it renders inline in-app, not just as a downloadable attachment.
- Upload widget re-uses the Documents & Media module's (Module 16) storage and access-control layer — this sub-module is a **billing-scoped view** on top of that shared document store, tagged `document_type = bill_photo`, `linked_entity = invoice/payment`.

### Data Model Addition
```
document (existing, Module 16)
  ... existing fields ...
  linked_entity_type ('invoice' | 'payment' | 'manual_bill' | ...)
  linked_entity_id
  document_type ('bill_photo' | 'consent' | 'lab_report' | ...)
```
No new table required — Billing reuses the Documents & Media entity with a tag, keeping one canonical file-storage/access-control system across the ERP.

### Acceptance Criteria
- A bill photo uploaded against an invoice is visible full-screen from within the invoice screen with zero additional clicks to "download."
- Only roles with billing access to that tenant/branch can view the photo (enforced by the same RBAC as the invoice itself).
- Upload works from both desktop (file picker) and mobile/tablet (camera capture).

---

## 5. Sub-Module 11.6 — Payment Analytics Dashboard

### Purpose
Give Admin and Accountant a dedicated analysis view of payment data — separate from raw invoice lists — answering "how are we getting paid, and is it reconciling."

### Stepwise Features

| Step | Feature | Priority |
|---|---|---|
| Step 1 | Payment-method breakdown: Cash / Card / Bank Transfer / UPI / Razorpay, as a chart + table, for a selected date range | MVP |
| Step 2 | Daily/weekly/monthly collection trend chart | MVP |
| Step 3 | Outstanding vs collected (receivables ageing) | MVP |
| Step 4 | Staff-wise collection (who raised/collected which bills — ties to HRMS incentive data later) | Phase 2 |
| Step 5 | Manual-bill vs encounter-linked-bill split (visibility into 11.4 usage) | Phase 2 |
| Step 6 | Razorpay-specific panel: success rate, failed/pending transactions, settlement status (see 11.7) | Phase 2 |
| Step 7 | Export (PDF/Excel) and scheduled email of the analysis | Phase 3 |

### Screen: "Payment Analytics"
- Filters: date range, branch (Admin/multi-branch), payment method, staff.
- KPI strip: Total Collected · Outstanding · Refunded · Razorpay Success Rate.
- Charts: bar (by method), line (trend), donut (method share).
- Table: itemized list, drill-down to source invoice.

### Acceptance Criteria
- Every completed payment (any method, including Razorpay) appears in this dashboard within the same reporting cycle it was collected.
- Numbers reconcile 1:1 against the Accounting module's cash/bank book (Module 13) for the same period — no double counting between manual and gateway payments.

---

## 6. Sub-Module 11.7 — Razorpay Payment Gateway Integration

### Purpose
Let a Receptionist/Admin collect payment via an embedded Razorpay checkout inside the portal — card, UPI, netbanking, wallets — instead of only recording cash/manual references, with automatic status sync.

### Stepwise Features

| Step | Feature | Priority |
|---|---|---|
| Step 1 | Razorpay account connection at tenant level (API key/secret stored in Integration Hub, Module 20 — not hardcoded per invoice) | MVP |
| Step 2 | "Pay via Razorpay" option on the Payment Collection screen (11.2), alongside Cash/Card/Bank/UPI-reference | MVP |
| Step 3 | Create a Razorpay Order for the invoice's due amount, launch embedded Razorpay Checkout widget in-portal | MVP |
| Step 4 | On success callback, mark payment as `paid`, store Razorpay `payment_id` / `order_id` / `signature` against the invoice | MVP |
| Step 5 | Webhook listener for asynchronous status (payment captured/failed/refunded) so the portal stays correct even if the browser closes mid-flow | MVP |
| Step 6 | Signature verification on every webhook (security — prevent spoofed "paid" events) | MVP |
| Step 7 | Refund initiation from the portal via Razorpay Refund API, status tracked back to the invoice | Phase 2 |
| Step 8 | Payment link generation (send a Razorpay payment link via WhatsApp/SMS for remote/advance payment) | Phase 2 |
| Step 9 | Settlement reconciliation report — match Razorpay settlement batch to portal-recorded payments | Phase 3 |

### Integration Flow
```
1. Receptionist clicks "Pay via Razorpay" on an invoice
2. Portal backend creates a Razorpay Order (amount, currency, receipt = invoice_id)
3. Portal opens embedded Razorpay Checkout (in-page modal, not external redirect)
4. Owner/customer completes payment (card/UPI/netbanking/wallet)
5. Razorpay returns payment_id + signature to the browser -> sent to backend
6. Backend verifies signature -> marks invoice payment status = "paid"
7. Razorpay webhook (server-to-server) confirms capture independently
   -> reconciles even if step 5's browser callback was missed/closed
8. Payment appears in Payment Analytics (11.6) and Accounting ledger (Module 13)
```

### Data Model Addition
```
payment (existing entity, extended)
  ... existing fields ...
  gateway ('razorpay' | null)
  gateway_order_id
  gateway_payment_id
  gateway_signature
  gateway_status ('created' | 'captured' | 'failed' | 'refunded')
  webhook_received_at
```

### Security & Compliance Notes
- API keys stored server-side only (Integration Hub, encrypted at rest); never exposed to the frontend beyond the public key needed to launch Checkout.
- All webhook payloads signature-verified before trusting status changes (per Razorpay's HMAC scheme).
- Payment/refund actions are idempotent — a retried webhook must not double-credit an invoice (cross-module rule already defined in Doc 1/FRS).
- PCI scope: card details never touch VetOS servers — Razorpay Checkout handles card capture entirely; this keeps the ERP out of full PCI-DSS scope.

### Acceptance Criteria
- An invoice can be paid end-to-end via Razorpay without leaving the portal.
- If the browser is closed mid-payment but the payment actually succeeded, the webhook still correctly marks the invoice paid within minutes.
- A failed/cancelled Razorpay attempt does not mark the invoice as paid, and the Receptionist can retry or fall back to another method.

---

## 7. Sub-Module 11.8 — Subscription / Recurring Billing

### Purpose
Support membership/package-style recurring billing (e.g., boarding/swimming memberships from Modules 7–8, or a retainer/AMC-style package a clinic sells) as a distinct billing type that Accountant can track for renewals and revenue recognition.

### Stepwise Features

| Step | Feature | Priority |
|---|---|---|
| Step 1 | Define a subscription/package plan (name, price, validity period or session count, billing frequency) | Phase 2 |
| Step 2 | Sell a subscription against a pet/owner — creates a `subscription` record with start/end date or session balance | Phase 2 |
| Step 3 | Auto-generate the recurring invoice on the billing cycle date (for time-based plans) or decrement session balance (for count-based plans, links to Boarding/Swimming) | Phase 2 |
| Step 4 | Renewal reminder to owner before expiry (ties into CRM module 15) | Phase 3 |
| Step 5 | Subscription status view: active / expiring soon / expired / cancelled | Phase 2 |
| Step 6 | Subscription revenue reflected separately in Payment Analytics (11.6) — "recurring vs one-time" split | Phase 3 |
| Step 7 | Razorpay Subscriptions/autopay integration for card-based auto-renewal (optional, advanced) | Phase 3 |

### Data Model Addition
```
subscription_plan
  id, tenant_id, name, price, billing_type ('recurring' | 'session_pack'),
  frequency ('monthly' | 'quarterly' | 'annual' | null),
  session_count (nullable), validity_days (nullable)

subscription
  id, tenant_id, pet_id, owner_id, plan_id, status ('active'|'expiring'|'expired'|'cancelled'),
  start_date, end_date, sessions_remaining, next_billing_date
```

### Acceptance Criteria
- Selling a subscription creates one clear record the Accountant can see revenue against, distinct from a one-off manual bill.
- A time-based subscription auto-invoices on schedule; a session-based one decrements correctly when used in Boarding/Swimming.
- Payment Analytics (11.6) can separate subscription revenue from transactional revenue for a given period.

---

## 8. Combined Data Flow (All New Sub-Modules Together)

```
Manual Product Billing (11.4) ─┐
Encounter-linked Billing (11.1)├─► invoice ─► payment (11.2) ─┬─► Cash/Card/Bank/UPI-ref
Subscription Billing (11.8)   ─┘                              └─► Razorpay (11.7)
                                        │
                                        ├─► document (bill_photo, 11.5) — attached, viewable in-portal
                                        ├─► stock_ledger (Module 12) — decrement on product sale
                                        ├─► accounting_ledger (Module 13) — posted entry
                                        └─► Payment Analytics (11.6) — reporting layer over all of the above
```

---

## 9. Implementation Sequence (fits inside existing Phase 3 window)

| Sprint | Deliverable | Depends on |
|---|---|---|
| 1 | 11.4 Manual Product Billing (Steps 1–5, 7) | Module 9 Pharmacy catalogue, Module 12 stock ledger |
| 2 | 11.5 Bill Photo Capture & Gallery (Steps 1–5, 7) | Module 16 Documents & Media storage layer |
| 3 | 11.7 Razorpay — Steps 1–6 (create order, checkout, webhook, signature verify) | Integration Hub (Module 20) key storage |
| 4 | 11.6 Payment Analytics — Steps 1–3, 6 (incl. Razorpay panel) | Sprints 1–3 producing real payment data |
| 5 | 11.4 remaining (discount, draft/finalize) + 11.7 refunds (Step 7) | Sprint 1 & 3 |
| 6 | 11.8 Subscription Billing (Steps 1–5) | Modules 7–8 (Boarding/Swimming) for session-pack linkage |
| 7 | Hardening: reconciliation report (11.7 Step 9), analytics export (11.6 Step 7), subscription reminders (11.8 Step 4) | All above |

**Estimated duration:** 7 sprints (≈14 weeks) run in parallel with, not after, the rest of Phase 3 — this is additive detail on the same phase in Document 2, not a new phase.

---

## 10. Roles Recap (unchanged from Document 1)

| Capability | Platform Admin | Admin | Receptionist | Accountant |
|---|---|---|---|---|
| Manual Product Billing (11.4) | — | Full | Create/Edit | View |
| Upload Bill Photo (11.5) | — | Full | Upload/View | View/Download |
| Payment Analytics (11.6) | — | Full | View (front-desk scope only) | Full |
| Razorpay Collection (11.7) | Configure keys (Integration Hub) | Full | Collect payment | View/Reconcile |
| Subscription Billing (11.8) | — | Full | Sell/Renew | View/Report |

---

## 11. Open Questions for Stakeholder Confirmation

- Should "subscription" also cover the **platform's own SaaS subscription billing** (tenant → VetOS), or is it strictly **clinic-to-customer** membership billing as scoped above? This document assumes the latter (customer-facing), since SaaS subscription billing already belongs to Module 19.
- Confirm Razorpay is the only gateway needed for MVP, or if a second gateway should be abstracted behind the same `gateway` field for future flexibility.
- Confirm bill-photo retention period (compliance/storage-cost consideration) for Phase 3 versioning (Step 8 of 11.5).
