# VetOS ERP — MongoDB Atlas Full Integration Plan

A complete database design and step-by-step integration roadmap for all modules of the **Harmony ERP Suite**, connecting the TanStack Start frontend to MongoDB Atlas.

---

> [!CAUTION]
> The credentials in `atlas-credentials.env` are committed to the repo and **must be rotated immediately**:
> 1. Go to **Atlas → Database Access → Edit `ayushsahare899_db_user`** → change password
> 2. Add `.env` (and `atlas-credentials.env`) to `.gitignore` if not already there
> 3. Never use `mongodb+srv://...` strings in source files — use environment variables only

---

## Overview

| Stack Element | Technology |
|---|---|
| Frontend | TanStack Start (React, SSR) |
| Database | MongoDB Atlas (existing cluster: `cluster0.d5k2cce.mongodb.net`) |
| DB Name | `vetos_erp` |
| ODM | Mongoose 8 (TypeScript) |
| Auth | JWT (access + refresh) + bcrypt 12-round hashing |
| API Layer | TanStack Start Server Functions (`createServerFn`) |
| Config | `.env` file + `dotenv` |
| Rate Limiting | `express-rate-limit` (or Nitro middleware) |

---

## Database: `vetos_erp`

Full namespace: `cluster0.d5k2cce.mongodb.net/vetos_erp`

---

## Collections Design

### 1. `users` — Operator Authentication & Profiles

Replaces the current local-storage `AuthService`.

```ts
{
  _id:          ObjectId,
  // identity
  fullName:     String (required, trim),
  email:        String (required, unique, lowercase, indexed),
  passwordHash: String (required),           // bcrypt 12 rounds — NEVER stored plain
  phone:        String,
  initials:     String,                      // derived on save

  // ERP role & access
  roleId:       "platform" | "admin" | "reception" | "accounts",  // enum
  roleName:     String,

  // clinic profile
  clinicName:   String (required),
  branch:       String (required),
  licenseNumber: String,
  department:   String,
  specialty:    "Canine"|"Feline"|"Avian"|"Exotic"|"Surgery"|"General Practice"|"Administration",

  // session management
  isActive:     Boolean (default: true),
  lastLoginAt:  Date,
  loginCount:   Number (default: 0),

  // metadata
  createdAt:    Date (auto),
  updatedAt:    Date (auto)
}

Indexes: { email: 1 } unique, { roleId: 1 }, { clinicName: 1, branch: 1 }
```

### 2. `refresh_tokens` — JWT Session Management

```ts
{
  _id:       ObjectId,
  userId:    ObjectId (ref: 'users', indexed),
  tokenHash: String (hashed refresh token — never store raw JWT),
  expiresAt: Date (TTL index — auto-expires documents),
  createdAt: Date (auto),
  userAgent: String,
  ipAddress: String
}

Indexes: { userId: 1 }, { expiresAt: 1 } (TTL index — auto-deletes expired tokens)
```

### 3. `tenants` — Multi-Clinic Tenant Registry

```ts
{
  _id:      ObjectId,
  name:     String (required, unique),
  code:     String (required, unique),          // e.g. "TEN-1001"
  branches: Number,
  plan:     "Starter" | "Growth" | "Enterprise",
  status:   "Active" | "Trial" | "Suspended",
  since:    Date,
  createdBy: ObjectId (ref: 'users'),
  createdAt: Date, updatedAt: Date
}
```

### 4. `subscriptions` — SaaS Billing Records

```ts
{
  _id:       ObjectId,
  tenantId:  ObjectId (ref: 'tenants', indexed),
  plan:      "Starter" | "Growth" | "Enterprise",
  seats:     Number,
  amount:    Number,               // monthly in INR
  renewal:   Date,
  status:    "Active" | "Due" | "Trial" | "Overdue",
  createdBy: ObjectId (ref: 'users'),
  createdAt: Date, updatedAt: Date
}

Indexes: { tenantId: 1 }, { status: 1 }, { renewal: 1 }
```

### 5. `pets` — Patient & Owner CRM

```ts
{
  _id:      ObjectId,
  petId:    String (required, unique),           // e.g. "PET77301"
  name:     String (required),
  species:  "Dog" | "Cat" | "Bird" | "Rabbit" | "Other",
  breed:    String,
  age:      Number,                              // years
  weight:   Number,                              // kg
  ownerName: String (required),
  ownerPhone: String,
  ownerEmail: String,
  gender:   "Male" | "Female",
  dob:      Date,
  microchipId: String,
  vaccinationStatus: String,
  status:   "Active" | "Vaccination due" | "Inactive",

  // linked data
  tenantId:  ObjectId (ref: 'tenants', indexed),
  branchId:  String,
  createdBy: ObjectId (ref: 'users'),
  createdAt: Date, updatedAt: Date
}

Indexes: { petId: 1 } unique, { ownerPhone: 1 }, { species: 1 }, { status: 1 }, { tenantId: 1 }
```

### 6. `appointments` — OPD Queue & Bookings

```ts
{
  _id:       ObjectId,
  token:     String (required),              // e.g. "A-101"
  slot:      Date (required),                // ISO datetime
  petId:     ObjectId (ref: 'pets', indexed),
  petName:   String,
  ownerName: String,
  doctorName: String,
  type:      "Consultation"|"Vaccination"|"Follow-up"|"Dental"|"Surgery review",
  status:    "Scheduled"|"Waiting"|"In consultation"|"Completed"|"No-show",
  notes:     String,

  tenantId:  ObjectId (ref: 'tenants'),
  createdBy: ObjectId (ref: 'users'),
  createdAt: Date, updatedAt: Date
}

Indexes: { petId: 1 }, { slot: 1 }, { status: 1 }, { doctorName: 1, slot: 1 }
```

### 7. `encounters` — OPD Clinical Records

```ts
{
  _id:             ObjectId,
  encId:           String (required, unique),    // e.g. "ENC-4411"
  appointmentId:   ObjectId (ref: 'appointments'),
  petId:           ObjectId (ref: 'pets', indexed),
  petName:         String,
  doctorName:      String,
  chiefComplaint:  String (required),
  diagnosis:       String,
  treatment:       String,
  prescriptions:   [{ medicine: String, dosage: String, duration: String }],
  amount:          Number,
  billingStatus:   "Open" | "Unbilled" | "Billed",

  tenantId:        ObjectId (ref: 'tenants'),
  createdBy:       ObjectId (ref: 'users'),
  createdAt:       Date, updatedAt: Date
}

Indexes: { petId: 1 }, { encId: 1 } unique, { billingStatus: 1 }, { createdAt: -1 }
```

### 8. `lab_orders` — Laboratory Module

```ts
{
  _id:        ObjectId,
  orderId:    String (required, unique),     // e.g. "LAB-8801"
  petId:      ObjectId (ref: 'pets', indexed),
  petName:    String,
  testName:   String (required),
  sampleType: "Blood"|"Urine"|"Skin"|"Swab"|"Stool",
  collectedAt: Date,
  reportUrl:  String,
  status:     "Pending"|"In process"|"In transit"|"Urgent"|"Reported",

  tenantId:   ObjectId (ref: 'tenants'),
  orderedBy:  ObjectId (ref: 'users'),
  createdAt:  Date, updatedAt: Date
}

Indexes: { orderId: 1 } unique, { petId: 1 }, { status: 1 }, { createdAt: -1 }
```

### 9. `boarding_bookings` — Boarding Module

```ts
{
  _id:       ObjectId,
  bookingId: String (required, unique),   // e.g. "BRD-311"
  petId:     ObjectId (ref: 'pets', indexed),
  petName:   String,
  kennel:    String (required),
  checkIn:   Date (required),
  checkOut:  Date (required),
  ratePerDay: Number (required),
  status:    "Reserved" | "Checked-in" | "Staying" | "Checked-out",
  specialInstructions: String,

  tenantId:  ObjectId (ref: 'tenants'),
  createdBy: ObjectId (ref: 'users'),
  createdAt: Date, updatedAt: Date
}

Indexes: { petId: 1 }, { status: 1 }, { checkIn: 1, checkOut: 1 }, { kennel: 1 }
```

### 10. `swimming_sessions` — Aqua Therapy / Swimming Module

```ts
{
  _id:       ObjectId,
  petId:     ObjectId (ref: 'pets', indexed),
  petName:   String,
  slot:      Date (required),
  trainer:   String,
  plan:      "Single session" | "Membership" | "Hydrotherapy",
  fee:       Number,
  status:    "Booked" | "In session" | "Completed" | "Cancelled",

  tenantId:  ObjectId (ref: 'tenants'),
  createdBy: ObjectId (ref: 'users'),
  createdAt: Date, updatedAt: Date
}

Indexes: { petId: 1 }, { slot: 1 }, { status: 1 }
```

### 11. `inventory` — Stock & Procurement

```ts
{
  _id:        ObjectId,
  sku:        String (required, unique),
  itemName:   String (required),
  category:   "Medicine" | "Food" | "Accessory" | "Supplement" | "Surgical",
  supplier:   String,
  onHand:     Number (required, min: 0),
  reorderLevel: Number,
  unitPrice:  Number,
  expiry:     Date,
  status:     "In stock" | "Low stock" | "Critical" | "Expiring",

  tenantId:   ObjectId (ref: 'tenants'),
  updatedBy:  ObjectId (ref: 'users'),
  createdAt:  Date, updatedAt: Date
}

Indexes: { sku: 1 } unique, { status: 1 }, { expiry: 1 }, { tenantId: 1 }
```

### 12. `pharmacy_sales` — Retail Sales / Pharmacy

```ts
{
  _id:       ObjectId,
  billNo:    String (required, unique),    // e.g. "RT-9001"
  petId:     ObjectId (ref: 'pets'),
  itemSku:   String (ref: 'inventory'),
  itemName:  String (required),
  category:  "Medicine" | "Food" | "Accessory" | "Supplement",
  qty:       Number (required, min: 1),
  unitPrice: Number,
  amount:    Number (required),
  paymentStatus: "Paid" | "Pending" | "Refunded",
  paymentMode:   "Cash" | "UPI" | "Card",

  tenantId:  ObjectId (ref: 'tenants'),
  soldBy:    ObjectId (ref: 'users'),
  createdAt: Date, updatedAt: Date
}

Indexes: { billNo: 1 } unique, { petId: 1 }, { paymentStatus: 1 }, { createdAt: -1 }
```

### 13. `invoices` — Billing & Payments

```ts
{
  _id:         ObjectId,
  invoiceNo:   String (required, unique),   // e.g. "INV-20481"
  petId:       ObjectId (ref: 'pets', indexed),
  petName:     String,
  ownerName:   String,
  department:  "OPD" | "Laboratory" | "Pharmacy" | "Boarding" | "Swimming",
  lineItems:   [{ description: String, qty: Number, unitPrice: Number, amount: Number }],
  subtotal:    Number,
  gst:         Number,
  discount:    Number (default: 0),
  totalAmount: Number (required),
  paymentMode: "Cash" | "UPI" | "Card" | null,
  paidAt:      Date,
  status:      "Paid" | "Unpaid" | "Partially paid" | "Unreconciled" | "Refunded",

  tenantId:    ObjectId (ref: 'tenants'),
  generatedBy: ObjectId (ref: 'users'),
  createdAt:   Date, updatedAt: Date
}

Indexes: { invoiceNo: 1 } unique, { petId: 1 }, { status: 1 }, { createdAt: -1 }, { department: 1 }
```

### 14. `journal_entries` — Accounting / Finance

```ts
{
  _id:        ObjectId,
  entryNo:    String (required, unique),    // e.g. "JV-3301"
  date:       Date (required),
  ledger:     String (required),
  narration:  String,
  amount:     Number (required),
  type:       "Credit" | "Debit" | "Liability",
  referenceId: ObjectId,
  referenceType: String,

  tenantId:   ObjectId (ref: 'tenants'),
  createdBy:  ObjectId (ref: 'users'),
  createdAt:  Date, updatedAt: Date
}

Indexes: { entryNo: 1 } unique, { date: -1 }, { ledger: 1 }, { type: 1 }
```

### 15. `staff` — HRMS Employee Profiles

```ts
{
  _id:        ObjectId,
  userId:     ObjectId (ref: 'users'),
  empCode:    String (unique),
  fullName:   String (required),
  role:       "Admin"|"Veterinarian"|"Receptionist"|"Accountant"|"Lab Technician"|"Groomer",
  department: String,
  phone:      String,
  email:      String,
  joinDate:   Date,
  grossSalary: Number,
  status:     "Active" | "Invited" | "Locked" | "Resigned",

  tenantId:   ObjectId (ref: 'tenants'),
  createdAt:  Date, updatedAt: Date
}
```

### 16. `attendance` — HRMS Attendance

```ts
{
  _id:        ObjectId,
  staffId:    ObjectId (ref: 'staff', indexed),
  date:       Date (required),
  shift:      "Morning" | "Evening" | "Night",
  inTime:     String,
  outTime:    String,
  hoursWorked: Number,
  status:     "Present" | "Late" | "On leave" | "Absent",

  tenantId:   ObjectId (ref: 'tenants'),
  markedBy:   ObjectId (ref: 'users'),
  createdAt:  Date
}

Indexes: { staffId: 1, date: 1 } (compound unique)
```

### 17. `payroll` — HRMS Payroll Runs

```ts
{
  _id:        ObjectId,
  staffId:    ObjectId (ref: 'staff', indexed),
  month:      String (required),              // "2026-08"
  gross:      Number (required),
  deductions: Number (required),
  netPay:     Number (required),
  tds:        Number,
  status:     "Approved" | "Pending" | "Hold" | "Paid",
  paidAt:     Date,

  tenantId:   ObjectId (ref: 'tenants'),
  approvedBy: ObjectId (ref: 'users'),
  createdAt:  Date, updatedAt: Date
}

Indexes: { staffId: 1, month: 1 } unique
```

### 18. `nutrition_plans`, `documents`, `communications`, `marketing_campaigns`, `audit_logs`

Each follows the same `{ tenantId, createdBy, createdAt, updatedAt }` base pattern with domain-specific fields (see full schemas above in the detailed plan).

---

## Phased Implementation Roadmap

### Phase 1 — Foundation & Auth (Days 1–3)
> [!IMPORTANT]
> Rotate Atlas password first!

- [ ] Rotate Atlas credentials, update `.env`, add to `.gitignore`
- [ ] Install `mongoose`, `bcrypt`, `jsonwebtoken`
- [ ] `src/lib/mongodb/client.ts` — singleton Mongoose connection
- [ ] `src/lib/mongodb/models/User.ts` — full operator schema
- [ ] `src/lib/mongodb/models/RefreshToken.ts` — with TTL index
- [ ] `src/lib/mongodb/serverFns/auth.ts` — `loginFn`, `registerFn`, `logoutFn`, `getMeFn`
- [ ] Replace localStorage `AuthService` with server function calls
- [ ] Seed 4 demo staff with hashed passwords

### Phase 2 — CRM & Appointments (Days 3–5)
- [ ] `Pet.ts`, `Appointment.ts`, `Encounter.ts` models + server functions
- [ ] Replace `crm-pets`, `appointments`, `opd` localStorage

### Phase 3 — Clinical Operations (Days 5–8)
- [ ] `LabOrder.ts`, `BoardingBooking.ts`, `SwimmingSession.ts`, `NutritionPlan.ts`, `Document.ts`

### Phase 4 — Finance, Inventory & HR (Days 8–12)
- [ ] `Inventory.ts`, `PharmacySale.ts`, `Invoice.ts`, `JournalEntry.ts`, `Staff.ts`, `Attendance.ts`, `Payroll.ts`

### Phase 5 — Platform, Comms & Hardening (Days 12–16)
- [ ] `Tenant.ts`, `Subscription.ts`, `Communication.ts`, `MarketingCampaign.ts`, `AuditLog.ts`
- [ ] Rate limiting, Zod validation on all server functions
- [ ] Token refresh rotation
- [ ] Atlas IP allowlist & least-privilege DB user

---

## Open Questions Before Proceeding

1. **Single vs multi-tenant?** — One clinic or multiple clinic organizations on this system?
2. **Token storage** — httpOnly cookies (recommended for security) or localStorage?
3. **File storage** — Where to store X-rays and documents? Atlas, S3, or Cloudflare R2?
4. **Seed data** — Should demo staff be seeded into Atlas, or will real staff onboard via registration?
