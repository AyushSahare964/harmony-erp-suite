# VetOS ERP — Current Theme, Modules & Sub-Modules Documentation

This document provides a comprehensive technical and functional breakdown of the **VetOS ERP Suite**, detailing the design system, color palette, typography, micro-animations, role-based views, and the complete catalog of primary modules and sub-modules.

---

## Table of Contents
1. [Theme & Design System Architecture](#1-theme--design-system-architecture)
   - [1.1 Color Palette & OKLCH Tokens](#11-color-palette--oklch-tokens)
   - [1.2 Typography & Radius Tokens](#12-typography--radius-tokens)
   - [1.3 Motion Dynamics & Animation Effects](#13-motion-dynamics--animation-effects)
   - [1.4 Custom Utility Classes](#14-custom-utility-classes)
2. [Application Architecture & Routing](#2-application-architecture--routing)
   - [2.1 File-Based Route Tree](#21-file-based-route-tree)
   - [2.2 Role-Based Access Control (RBAC) & View Personas](#22-role-based-access-control-rbac--view-personas)
3. [Modules and Sub-Modules Catalog](#3-modules-and-sub-modules-catalog)
   - [Category A: Platform Administration (Global Multi-Tenant Layer)](#category-a-platform-administration-global-multi-tenant-layer)
   - [Category B: Identity & Front Office](#category-b-identity--front-office)
   - [Category C: Clinical & Service Operations](#category-c-clinical--service-operations)
   - [Category D: Commerce, Inventory & Billing](#category-d-commerce-inventory--billing)
   - [Category E: Finance & People](#category-e-finance--people)
   - [Category F: Engagement, Communication & Reports](#category-f-engagement-communication--reports)
4. [Deep Dive: Advanced Inventory Hub Sub-Modules](#4-deep-dive-advanced-inventory-hub-sub-modules)
5. [Complete Module & Route Reference Matrix](#5-complete-module--route-reference-matrix)
6. [Data Persistence & State Management](#6-data-persistence--state-management)

---

## 1. Theme & Design System Architecture

VetOS ERP features a **Clinical SaaS** design system tailored for veterinary healthcare networks and multi-branch clinic management.

### 1.1 Color Palette & OKLCH Tokens
Defined in `src/styles.css`, using Tailwind CSS 4 with the OKLCH color space:

| Token | CSS Variable | Hex / OKLCH Value | UI Role & Purpose |
| :--- | :--- | :--- | :--- |
| **Background** | `--background` | `oklch(0.9715 0.0021 264.54)` (`#F5F6F8`) | Light gray high-legibility canvas |
| **Foreground** | `--foreground` | `oklch(0.2652 0.0509 267.5)` (`#16233F`) | Deep navy primary text |
| **Navy Headings** | `--navy` | `oklch(0.2652 0.0509 267.5)` (`#16233F`) | Section headings, modal titles, brand label |
| **Card Surface** | `--card` | `oklch(1 0 0)` (`#FFFFFF`) | Pure white background for cards & tables |
| **Primary** | `--primary` | `oklch(0.4855 0.2153 265.6)` (`#1F4ED8`) | Clinical Blue for primary CTA buttons & active states |
| **Primary Hover** | `--primary-hover`| `oklch(0.3963 0.1817 265.9)` (`#163AA8`) | Interactive hover state |
| **Primary Soft** | `--primary-soft` | `oklch(0.9494 0.0224 264.5)` | Tinted background for badges and icon boxes |
| **Success** | `--success` | `oklch(0.5334 0.135 154.4)` (`#168A47`) | Green status indicators, paid items, upward trends |
| **Success Soft** | `--success-soft` | `oklch(0.9545 0.0281 155)` | Soft green badge background |
| **Warning** | `--warning` | `oklch(0.6172 0.1258 79.4)` (`#B7791F`) | Amber alerts, due renewals, unbilled encounters |
| **Warning Soft** | `--warning-soft` | `oklch(0.9631 0.045 90)` | Soft amber badge background |
| **Destructive** | `--destructive` | `oklch(0.5162 0.1836 27.6)` (`#C0362C`) | Red alerts, critical stock warnings, errors |
| **Danger Soft** | `--danger-soft` | `oklch(0.9552 0.0206 25)` | Soft red badge background |
| **Border / Line** | `--border` | `oklch(0.9166 0.0086 258.3)` (`#E2E6ED`) | Subtle outlines and dividing borders |
| **Muted Text** | `--muted-foreground` | `oklch(0.5117 0.0201 262.4)` (`#5B6472`) | Secondary captions, timestamps & helper labels |

### 1.2 Typography & Radius Tokens
- **Font Family**: `"Inter", ui-sans-serif, system-ui, sans-serif`
- **Border Radii**:
  - Small (`--radius-sm`): `calc(var(--radius) - 4px)` (~7.2px)
  - Medium (`--radius-md`): `calc(var(--radius) - 2px)` (~9.2px)
  - Base (`--radius-lg` / `--radius`): `0.7rem` (11.2px)
  - Extra Large (`--radius-xl`): `calc(var(--radius) + 4px)` (~15.2px)
  - Double Extra Large (`--radius-2xl`): `calc(var(--radius) + 8px)` (~19.2px)
- **Shadow Tokens**:
  - Standard Card: `0 1px 2px oklch(0.2 0.04 260 / 0.04)`
  - Card Hover: `0 8px 24px -8px oklch(0.42 0.19 264 / 0.25)`

### 1.3 Motion Dynamics & Animation Effects
- **Framer Motion Layout Transitions**: Spring physics (`stiffness: 400-450`, `damping: 25-35`) for active tab pills and role selectors.
- **Glassmorphism Panels**:
  - Light Glass (`.glass-panel`): `rgba(255, 255, 255, 0.82)`, `backdrop-filter: blur(12px)`.
  - Dark Glass (`.dark-glass-panel`): `rgba(22, 35, 63, 0.88)`, `backdrop-filter: blur(16px)`.
- **CSS Marquee & Keyframe Effects**:
  - `.animate-marquee-vertical`: Infinite vertical pet showcase slider (32s loop).
  - `.animate-marquee-horizontal`: Continuous horizontal brand ticker (28s loop).
  - `.animate-float-slow`: Subtle 4s vertical floating animation.
  - `.animate-pulse-glow`: 3s breathing opacity animation.
  - `.animate-heartbeat`: 2.2s dual-thump pulse for critical vitals and alerts.

### 1.4 Custom Utility Classes
- `@utility page-title`: `font-size: 1.6rem`, `font-weight: 700`, `color: var(--color-navy)`, `letter-spacing: -0.02em`.
- `@utility erp-card`: Clean card container with `border`, `var(--color-card)` background, and card shadow.
- `@utility section-label`: Uppercase `0.68rem` bold label with `0.09em` tracking.

---

## 2. Application Architecture & Routing

### 2.1 File-Based Route Tree
Built with `@tanstack/react-router`:
```
src/routes/
├── __root.tsx          # Root shell layout, toast provider, head meta
├── index.tsx           # Home Dashboard with role switcher, KPIs & flashcards
├── login.tsx           # Staff sign in, register & demo accounts
└── m.$moduleId.tsx     # Dynamic CRUD workspace renderer & custom module hubs
```

### 2.2 Role-Based Access Control (RBAC) & View Personas

| Role ID | Role Title | Default User | Default Branch / Scope | Primary Operational View |
| :--- | :--- | :--- | :--- | :--- |
| **`platform`** | Platform Administrator | Ishaan Verma | VetOS Cloud (ap-south-1) | SaaS tenant provisioning, subscription billing, global security, system health |
| **`admin`** | Clinic Administrator | Dr. Aisha Nair / Dr. Ananya Rao | Harmony Pet Hospital (Koramangala) | Full branch oversight, clinical encounters, staff management, inventory & P&L |
| **`reception`** | Receptionist & Triage Lead | Rohan Sen / Kavitha Nair | Front Desk (Counter 2) | Fast check-ins, appointments, live waiting queue, invoice collection |
| **`accounts`** | Accounts & Billing Manager | Maya Iyer / Rahul Menon | Accounts Office (FY 2026-27) | Ledger reconciliations, double-entry JV, GST/TDS tax, payroll runs |

---

## 3. Modules and Sub-Modules Catalog

---

### Category A: Platform Administration (Global Multi-Tenant Layer)

#### 1. Platform & Tenant Administration (`/m/tenants`)
- **Purpose**: Provision, configure, and monitor multi-branch clinic tenants.
- **Fields & Table Columns**: Tenant Name, Tenant ID (`code`), Number of Branches, Subscription Plan, Status (`Active`, `Trial`, `Suspended`), Onboarding Date.
- **Sub-Features**: Interactive modal to onboard new clinic groups, branch count tracking, plan filtering.
- **KPI Metrics**: Active Tenants (38), Total Branches (112), Trials Running (5), Suspended (1).

#### 2. Subscription & SaaS Administration (`/m/subscriptions`)
- **Purpose**: Manage licensing tiers, seat limits, and monthly recurring revenue (MRR).
- **Fields & Table Columns**: Tenant, Plan (`Starter`, `Growth`, `Enterprise`), Seats Allocated, Monthly Amount, Renewal Date, Payment Status (`Active`, `Due`, `Trial`, `Overdue`).
- **Sub-Features**: Subscription renewal tracker, seat limit allocator, billing cycle manager.
- **KPI Metrics**: MRR (₹18.4L), Renewals This Week (6), Churn 90d (1.8%), Avg. Seats/Tenant (27).

#### 3. Identity & Access (Global) (`/m/identity-global`)
- **Purpose**: Cross-tenant user auditing, security policy enforcement, and MFA posture.
- **Fields & Table Columns**: User Name, Tenant, Role, MFA Status (`Enabled`, `Disabled`), Last Active Date, Account Status (`Active`, `Review`, `Dormant`).
- **Sub-Features**: Global admin directory, dormant account flagging, MFA enforcement.
- **KPI Metrics**: Admins Across Tenants (74), Permission Templates (12), MFA Enforced (86%), Dormant Accounts (13).

#### 4. Global Integration Hub (`/m/integrations-global`)
- **Purpose**: Platform-wide third-party connectors (WhatsApp BSP, SMS gateways, payment aggregators).
- **Fields & Table Columns**: Provider Name, Integration Type, Connected Tenants, Success Rate %, Latency, Operational Status (`Healthy`, `Degraded`, `Maintenance`).
- **Sub-Features**: Gateway heartbeat monitor, webhook retry queues, API error logging.
- **KPI Metrics**: Active Providers (11), SMS Delivery (99.1%), Payment Success (98.6%), Pending Webhooks (2).

#### 5. Reports & Analytics (Platform-wide) (`/m/reports-platform`)
- **Purpose**: Macro analytics on cross-tenant revenue, system adoption, and usage scorecards.
- **Fields & Table Columns**: Report Name, Target Scope, Generation Frequency (`Daily`, `Weekly`, `Monthly`), Report Owner, Schedule Status (`Scheduled`, `Draft`, `Paused`).
- **Sub-Features**: Trend charting, automated report dispatch, tenant adoption scoring.
- **KPI Metrics**: Tenants Flagged (4), Reports Scheduled (14), Avg. Usage Score (72/100), Revenue per Tenant (₹48.4k).

#### 6. Audit & System Health (`/m/audit`)
- **Purpose**: Platform error logging, database backup status, and incident response.
- **Fields & Table Columns**: Timestamp, Event Summary, Actor/Service, Affected Tenant, Severity Level (`Info`, `Warning`, `Critical`).
- **Sub-Features**: Incident logger, automated backup status verifier, real-time error alerts.
- **KPI Metrics**: Failed Jobs / Alerts (3), 30-day Uptime (99.98%), Last Backup Status (Successful), Audit Events 24h (8,412).

---

### Category B: Identity & Front Office

#### 7. Identity, Roles & Access (Branch) (`/m/identity`)
- **Purpose**: Manage local clinic staff, assign role permissions, and issue invites.
- **Fields & Table Columns**: Staff Name, Role (`Admin`, `Veterinarian`, `Receptionist`, `Accountant`, `Lab Technician`, `Groomer`), Department, Phone Number, Account Status (`Active`, `Invited`, `Locked`).
- **Sub-Features**: Staff account onboarding, department assignment, account unlock/lock.
- **KPI Metrics**: Active Staff Accounts (31), Roles Configured (7), Pending Invites (3), Locked Accounts (1).

#### 8. Pet & Owner CRM (`/m/crm-pets`)
- **Purpose**: Centralized electronic patient records (EMR/EHR) and pet parent profiles.
- **Fields & Table Columns**: Pet ID (`PET00000`), Pet Name, Species (`Dog`, `Cat`, `Bird`, `Rabbit`, `Other`), Age, Owner Name, Contact Phone, Status (`Active`, `Vaccination due`, `Inactive`).
- **Sub-Features**: Rapid pet registration modal, search by pet name, microchip ID, or owner phone number.
- **KPI Metrics**: Registered Pets (3,148), Pet Parents/Owners (2,406), Monthly Visits (912), Vaccinations Due (56).

#### 9. Appointments & Live Queue (`/m/appointments`)
- **Purpose**: Real-time waiting room orchestration and doctor slot allocation.
- **Fields & Table Columns**: Token Number (`A-101`), Slot Time, Pet Name, Owner Name, Assigned Doctor, Visit Type (`Consultation`, `Vaccination`, `Follow-up`, `Dental`, `Surgery review`), Queue Status (`Scheduled`, `Waiting`, `In consultation`, `Completed`, `No-show`).
- **Sub-Features**: Appointment booking dialog, live status transitions, doctor schedule allocation.
- **KPI Metrics**: In Queue Now (7), Today's Bookings (42), Avg. Wait Time (12 min), No-Shows (3).

---

### Category C: Clinical & Service Operations

#### 10. OPD Front-Desk (`/m/opd`)
- **Purpose**: Clinical consultations, doctor examination notes, and encounter billing handoff.
- **Fields & Table Columns**: Encounter ID (`ENC-0000`), Pet Name, Attending Doctor, Presenting Complaint, Consultation Charges, Billing Status (`Open`, `Unbilled`, `Billed`).
- **Sub-Features**: New encounter creator, clinical triage categorization, unbilled encounter tracking.
- **KPI Metrics**: Open Encounters (12), Checked-In Today (28), Avg. Consult Time (18 min), Unbilled Encounters (6).

#### 11. Laboratory & Diagnostics (`/m/laboratory`)
- **Purpose**: Diagnostic test orders, sample tracking, and automated lab reports.
- **Fields & Table Columns**: Lab Order ID (`LAB-0000`), Pet Name, Test Name (e.g., CBC, Renal Panel, Cytology), Sample Type (`Blood`, `Urine`, `Skin`, `Swab`, `Stool`), Collection Time, Status (`Pending`, `In process`, `In transit`, `Urgent`, `Reported`).
- **Sub-Features**: Lab requisition form, urgent test flagging, sample chain-of-custody tracking.
- **KPI Metrics**: Pending Reports (8), Orders Today (14), Samples in Transit (4), Avg. Turnaround Time (6.2 hrs).

#### 12. Boarding & Pet Hotel (`/m/boarding`)
- **Purpose**: Kennel reservation management, stay duration tracking, and boarding amenities.
- **Fields & Table Columns**: Booking ID (`BRD-000`), Pet Name, Kennel ID (`K-01` to `K-08`), Check-in Date, Check-out Date, Daily Rate, Stay Status (`Reserved`, `Checked-in`, `Staying`, `Checked-out`).
- **Sub-Features**: Kennel occupancy grid, reservation scheduler, automated daily boarding rate calculator.
- **KPI Metrics**: Occupied Kennels (18 / 23 - 78%), Check-ins Today (5), Check-outs Today (3), MTD Boarding Revenue (₹3.4L).

#### 13. Swimming & Hydrotherapy (`/m/swimming`)
- **Purpose**: Pet fitness pools, hydrotherapy rehabilitation sessions, and package memberships.
- **Fields & Table Columns**: Time Slot, Pet Name, Hydrotherapist / Trainer, Plan (`Single session`, `Membership`, `Hydrotherapy`), Session Fee, Status (`Booked`, `In session`, `Completed`, `Cancelled`).
- **Sub-Features**: Hydrotherapy slot booking, trainer allocation, package membership validation.
- **KPI Metrics**: Sessions Today (11), Active Memberships (64), Pool Utilization (82%), MTD Revenue (₹1.1L).

---

### Category D: Commerce, Inventory & Billing

#### 14. Pharmacy & Retail Counter (`/m/pharmacy`)
- **Purpose**: Point-of-Sale (POS) for over-the-counter medicine, food, toys, and grooming gear.
- **Fields & Table Columns**: Bill ID (`RT-0000`), Item Sold, Category (`Medicine`, `Food`, `Accessory`, `Supplement`), Quantity, Total Amount, Payment Status (`Paid`, `Pending`, `Refunded`).
- **Sub-Features**: Quick sale dialog, category filters, payment collection tracking.
- **KPI Metrics**: Today's Sales (₹46,200), Bills Issued (37), Avg. Bill Value (₹1,249), Out of Stock Items (6).

#### 15. Food & Clinical Nutrition (`/m/nutrition`)
- **Purpose**: Prescription diet tracking, calorie guidelines, and feed reorder reminders.
- **Fields & Table Columns**: Plan ID (`NUT-000`), Pet Name, Prescribed Diet Formulation, Daily Quantity (grams), Next Review Date, Status (`Active`, `Review due`, `Closed`).
- **Sub-Features**: Customized feeding plan builder, review date reminders, diet status tracker.
- **KPI Metrics**: Reorders Due (5), Active Feeding Plans (142), MTD Food Sales (₹2.7L), Diet Reviews Due (12).

#### 16. Inventory & Procurement Hub (`/m/inventory`)
- **Purpose**: Advanced 5-tab real-time pharmacy and supply chain management suite (see [Section 4](#4-deep-dive-advanced-inventory-hub-sub-modules)).
- **KPI Metrics**: Low-Stock Items (14), Expiring in 30d (3), Stock Value (₹11.6L), Supplier Outstanding (₹2.4L).

#### 17. Billing & Payments (`/m/billing`)
- **Purpose**: Multi-department invoicing, split payments, refunds, and reconciliation.
- **Fields & Table Columns**: Invoice Number (`INV-00000`), Owner Name, Pet Name, Originating Department (`OPD`, `Laboratory`, `Pharmacy`, `Boarding`, `Swimming`), Total Amount, Payment Method (`Cash`, `UPI`, `Card`), Status (`Paid`, `Unpaid`, `Partially paid`, `Unreconciled`, `Refunded`).
- **Sub-Features**: Invoice creator, department billing sync, reconciliation status flagger.
- **KPI Metrics**: Unpaid Invoices (23), Collected Today (₹1,24,850), Unreconciled Payments (17), MTD Refunds (₹6,400).

---

### Category E: Finance & People

#### 18. Accounting & Ledgers (`/m/accounting`)
- **Purpose**: Double-entry bookkeeping, chart of accounts, income/expense entries, and GST reconciliation.
- **Fields & Table Columns**: Journal Entry Number (`JV-0000`), Entry Date, Account Ledger, Narration / Remarks, Amount, Entry Type (`Credit`, `Debit`, `Liability`).
- **Sub-Features**: Journal voucher entry modal, ledger classification, monthly trend chart.
- **KPI Metrics**: MTD Net Revenue (₹21.6L), MTD Expenses (₹9.2L), Cash & Bank Balance (₹14.3L), GST Payable (₹1.8L).

#### 19. HRMS — Staff Attendance (`/m/hrms`)
- **Purpose**: Shift scheduling, attendance tracking, and leave management.
- **Fields & Table Columns**: Employee Name, Department, Shift (`Morning`, `Evening`, `Night`), In-Time Punch, Logged Hours, Attendance Status (`Present`, `Late`, `On leave`, `Absent`).
- **Sub-Features**: Daily punch attendance marker, shift roster filter, leave approval status.
- **KPI Metrics**: On Leave Today (2), Staff Present (19 / 21), Late Marks MTD (7), Payroll Due Date (30 Aug).

#### 20. HRMS — Payroll Processing (`/m/payroll`)
- **Purpose**: Monthly compensation runs, allowances, TDS tax deductions, and pay slips.
- **Fields & Table Columns**: Employee Name, Role, Gross Monthly Salary, Deductions (TDS/PF), Net Payable Amount, Approval Status (`Approved`, `Pending`, `Hold`, `Paid`).
- **Sub-Features**: Payroll line item generator, deduction computation, salary disbursement approval.
- **KPI Metrics**: Payroll Due Date (30 Aug), Gross Payroll (₹7.4L), Pending Salary Advances (₹64,000), TDS Deducted (₹42,300).

---

### Category F: Engagement, Communication & Reports

#### 21. CRM & Marketing Campaigns (`/m/marketing`)
- **Purpose**: Automated vaccination reminders, preventive health outreach, and loyalty tiers.
- **Fields & Table Columns**: Campaign Name, Channel (`WhatsApp`, `SMS`, `Email`), Target Audience, Sent Count, Opened Count, Campaign Status (`Scheduled`, `Running`, `Completed`, `Paused`).
- **Sub-Features**: Multi-channel campaign creator, open-rate metrics, loyalty audience segmentation.
- **KPI Metrics**: Reminders Due Today (34), Active Campaigns (5), Loyalty Club Members (812), Outreach Response Rate (38%).

#### 22. Documents & Media Repository (`/m/documents`)
- **Purpose**: Cloud digital asset management for radiographs, ultrasound clips, PDF lab results, and signed consent waivers.
- **Fields & Table Columns**: File Name, Pet Name, Document Type (`X-ray`, `Lab report`, `Consent form`, `Clinical note`, `Invoice copy`), File Size, Upload Date, Access Status (`Internal`, `Shared`, `Pending signature`).
- **Sub-Features**: Cloud file upload modal, owner sharing link toggle, signature tracker.
- **KPI Metrics**: Files Uploaded This Week (126), Pending Signatures (9), Cloud Storage Used (48 GB / 200 GB), Shared with Owners (72).

#### 23. Communication Center (`/m/communication`)
- **Purpose**: Unified omnichannel inbox for 2-way client WhatsApp chats, SMS dispatch, and delivery receipts.
- **Fields & Table Columns**: Message Timestamp, Owner Name, Channel, Message Excerpt, Delivery Status (`Delivered`, `Read`, `Unread`, `Failed`).
- **Sub-Features**: Direct messaging console, delivery status indicator, unread message reply thread.
- **KPI Metrics**: Messages Sent Today (418), Delivery Rate (97.4%), Unread Inbound Inquiries (6), Delivery Failures (11).

#### 24. Reporting & Analytics Views
- **Operational Reports (`/m/reports`)**: Cross-department productivity, consultation volumes, and compliance.
- **Front-Desk Reports (`/m/reports-frontdesk`)**: Hourly breakdown of walk-ins vs. scheduled visits, new pet registrations, and counter collections.
- **Financial Reports (`/m/reports-finance`)**: Departmental margin analysis (OPD, Pharmacy, Diagnostics, Boarding, Hydrotherapy) with revenue vs. cost comparisons.

#### 25. Branch Integrations & Hardware Settings (`/m/integrations`)
- **Purpose**: Local hardware peripherals and branch API connections.
- **Fields & Table Columns**: Integration Name, Category (`Messaging`, `Payments`, `Compliance`, `Hardware`, `Scheduling`), Configuration Details, Last Updated, Link Status (`Connected`, `Disabled`, `Failing`).
- **Sub-Features**: WhatsApp Business API, Razorpay POS, GSTIN e-Invoicing, ESC/POS Thermal Printers, Google Calendar sync.
- **KPI Metrics**: Active Integrations (6), Service Catalogue Items (84), Tax Profiles Configured (3), Hardware Printers Connected (4).

---

## 4. Deep Dive: Advanced Inventory Hub Sub-Modules

The `/m/inventory` route loads a dedicated multi-tab subsystem with 5 specialized sub-modules:

```
Inventory Hub (/m/inventory)
├── Tab 1: Medicine Catalogue [Badge: 12.4]
├── Tab 2: Real-Time Stock    [Badge: 12.5]
├── Tab 3: Stock Movements    [Badge: 12.6]
├── Tab 4: Billing Sync       [Badge: 12.7]
└── Tab 5: Alerts & Expiry    [Badge: 12.8]
```

### Sub-Module 1: Medicine Catalogue (`MedicineCatalogue.tsx`)
- **Functionality**: Master formulary and pharmaceutical directory.
- **Capabilities**:
  - Search by brand name, generic formulation, or SKU code.
  - Filter by category (Antibiotics, Vaccines, NSAIDs, Fluids, Consumables, Supplements).
  - Add/Edit medicine definitions with dosage form, manufacturer, packaging unit, and default reorder threshold.

### Sub-Module 2: Real-Time Stock View (`StockView.tsx`)
- **Functionality**: Live warehouse & dispensary inventory tracker.
- **Capabilities**:
  - Live stock level badges (`In Stock`, `Low Stock`, `Critical`, `Expiring Soon`).
  - Batch number, purchase cost, selling price (MRP), and shelf location.
  - Quick adjustment drawer for rapid quantity reconciliation.

### Sub-Module 3: Stock Movements (`StockMovements.tsx`)
- **Functionality**: Immutable audit ledger of all inventory transactions.
- **Capabilities**:
  - Movement types: `Inward (GRN)`, `Outward (Dispensed)`, `Damage / Expired Write-off`, `Audit Adjustment`, `Transfer`.
  - Batch number tracking, recorded timestamp, operator initials, and linked reference ID.

### Sub-Module 4: Billing Sync (`BillingSync.tsx`)
- **Functionality**: Automatic bridge between Point-of-Sale (POS) / OPD prescriptions and inventory deductions.
- **Capabilities**:
  - Live prescription item queue.
  - Auto-deduction upon payment clearance with batch allocation (FIFO).
  - Stock deficit alerts if dispensing exceeds available on-hand stock.

### Sub-Module 5: Expiry & Critical Alerts (`AlertsPanel.tsx`)
- **Functionality**: Automated risk mitigation engine for expired and depleted items.
- **Capabilities**:
  - 30 / 60 / 90-day expiry forecast and quarantine toggle.
  - Low-stock reorder triggers with one-click purchase order (PO) generation.
  - Supplier contact and order history preview.

---

## 5. Complete Module & Route Reference Matrix

| Category | Module Title | Route Slug | Icon | Dynamic Dialog | Trend Chart |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **Platform** | Platform & Tenants | `/m/tenants` | `Building2` | Yes | Yes (Bar) |
| **Platform** | SaaS Subscriptions | `/m/subscriptions` | `CreditCard` | Yes | Yes (Bar) |
| **Platform** | Global Identity | `/m/identity-global` | `ShieldCheck` | Yes | — |
| **Platform** | Global Integrations | `/m/integrations-global` | `Plug` | Yes | — |
| **Platform** | Platform Analytics | `/m/reports-platform` | `BarChart3` | Yes | Yes (Bar) |
| **Platform** | Audit & Health | `/m/audit` | `Activity` | Yes | — |
| **Front Office** | Identity & Staff | `/m/identity` | `ShieldCheck` | Yes | — |
| **Front Office** | Pet & Owner CRM | `/m/crm-pets` | `PawPrint` | Yes | Yes (Bar) |
| **Front Office** | Appointments & Queue| `/m/appointments` | `CalendarClock` | Yes | Yes (Bar) |
| **Clinical** | OPD Front-Desk | `/m/opd` | `Stethoscope` | Yes | — |
| **Clinical** | Laboratory | `/m/laboratory` | `FlaskConical` | Yes | — |
| **Services** | Boarding & Kennels | `/m/boarding` | `Home` | Yes | Yes (Bar) |
| **Services** | Swimming Pool | `/m/swimming` | `Waves` | Yes | — |
| **Commerce** | Pharmacy & Retail | `/m/pharmacy` | `Pill` | Yes | Yes (Bar) |
| **Commerce** | Food & Nutrition | `/m/nutrition` | `Bone` | Yes | — |
| **Commerce** | **Inventory Hub (5 Sub-tabs)**| `/m/inventory` | `Boxes` | Yes | Dedicated Hub |
| **Commerce** | Billing & Payments | `/m/billing` | `Receipt` | Yes | Yes (Bar) |
| **Finance** | Accounting & Ledgers| `/m/accounting` | `Wallet` | Yes | Yes (Bar) |
| **People** | HRMS Attendance | `/m/hrms` | `Users` | Yes | — |
| **People** | HRMS Payroll | `/m/payroll` | `Users` | Yes | Yes (Bar) |
| **Engagement** | CRM Marketing | `/m/marketing` | `Megaphone` | Yes | — |
| **Engagement** | Documents & Media | `/m/documents` | `FileText` | Yes | — |
| **Engagement** | Communication Inbox| `/m/communication` | `MessageSquare`| Yes | — |
| **Analytics** | Operational Reports| `/m/reports` | `BarChart3` | Yes | Yes (Bar) |
| **Analytics** | Front-Desk Reports | `/m/reports-frontdesk`| `BarChart3` | Yes | Yes (Bar) |
| **Analytics** | Financial Reports | `/m/reports-finance` | `BarChart3` | Yes | Yes (Bar) |
| **Settings** | Branch Integrations | `/m/integrations` | `Plug` | Yes | — |

---

## 6. Data Persistence & State Management

1. **MongoDB Atlas Production Layer**:
   - `User`: Staff credentials, roles, clinic affiliations, contact info.
   - `RefreshToken`: Cryptographically secured token rotation for session management.
   - `ErpRow`: Dynamic collections storing records for all workspaces.
2. **Offline-First Reactive State (`useErp`)**:
   - Built on React Context with LocalStorage caching for zero-latency UI rendering.
   - Real-time synchronous filtering, record insertion, deletion, and factory-reset capability.
3. **Dedicated Inventory Store (`useInventoryStore`)**:
   - Specialized reducer state for managing real-time stock deductions, batch expiries, movement logs, and purchase requisition thresholds.
