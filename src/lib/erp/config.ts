export type RoleId = "doctor" | "admin" | "reception" | "accounts" | "platform";

export type Accent = "blue" | "green" | "amber" | "red";

export interface Kpi {
  label: string;
  value: string;
  trend?: string;
  trendTone?: "up" | "down" | "flat";
}

export interface Flashcard {
  module: string; // module id / route slug
  icon: string;
  title: string;
  subtitle: string;
  metricLabel: string;
  metricValue: string;
  trend?: string;
  trendTone?: "up" | "down" | "flat";
  accent?: Accent;
  badge?: string;
}

export interface CategoryBlock {
  category: string;
  cards: Flashcard[];
}

export interface RoleConfig {
  id: RoleId;
  name: string;
  person: string;
  initials: string;
  scope: string;
  scopeCaption: string;
  greeting: string;
  kpis: Kpi[];
  blocks: CategoryBlock[];
}

export const ROLES: Record<RoleId, RoleConfig> = {
  doctor: {
    id: "doctor",
    name: "Doctor / Senior Vet",
    person: "Dr. Rohit Sharma",
    initials: "RS",
    scope: "VetCare Specialty Pet Hospital — Central Avenue, Nagpur",
    scopeCaption: "OPD & Clinical Practice · Room 1",
    greeting: "Clinical OPD queue, live inventory prescriptions, and patient diagnostic records.",
    kpis: [
      { label: "Patients Waiting", value: "0", trend: "Queue clear", trendTone: "flat" },
      { label: "Today's Consultations", value: "0", trend: "0 visits today", trendTone: "flat" },
      { label: "Vaccinations Done", value: "0", trend: "0 scheduled", trendTone: "flat" },
      { label: "Prescriptions Issued", value: "0", trend: "0 issued", trendTone: "flat" },
      { label: "Follow-ups Due", value: "0", trend: "None pending", trendTone: "flat" },
    ],
    blocks: [
      {
        category: "Clinical Consultations & Queue",
        cards: [
          {
            module: "appointments",
            icon: "CalendarClock",
            title: "Appointments & Live Queue",
            subtitle: "Daily queue, patient triage and doctor slots",
            metricLabel: "In Queue Now",
            metricValue: "0",
            accent: "blue",
          },
          {
            module: "crm-pets",
            icon: "PawPrint",
            title: "Pet & Owner CRM",
            subtitle: "Multi-pet profiles, medical history and vaccines",
            metricLabel: "Active Patients",
            metricValue: "0",
            accent: "green",
          },
          {
            module: "laboratory",
            icon: "FlaskConical",
            title: "Laboratory & Diagnostics",
            subtitle: "Lab test orders, pathology & diagnostic reports",
            metricLabel: "Pending Reports",
            metricValue: "0",
            accent: "amber",
          },
          {
            module: "clinical-records",
            icon: "FileText",
            title: "Reports & Medical Records",
            subtitle: "Signed clinical reports, Rx archive & investigations",
            metricLabel: "Archived Records",
            metricValue: "0",
            accent: "green",
          },
        ],
      },
      {
        category: "Inventory, Nutrition & Boarding",
        cards: [
          {
            module: "inventory",
            icon: "Boxes",
            title: "Live Inventory & Batches",
            subtitle: "Stock levels, FEFO expiry tracking and reorders",
            metricLabel: "Active SKUs",
            metricValue: "0",
            accent: "amber",
          },
          {
            module: "nutrition",
            icon: "Bone",
            title: "Food & Nutrition Store",
            subtitle: "Therapeutic prescription diets and pet food",
            metricLabel: "Diet Plans Active",
            metricValue: "0",
            accent: "green",
          },
          {
            module: "boarding",
            icon: "Home",
            title: "Pet Boarding & Swimming",
            subtitle: "Kennel stays, check-in/out & hydrotherapy pool",
            metricLabel: "Current Occupancy",
            metricValue: "0 / 25",
            accent: "blue",
          },
        ],
      },
      {
        category: "Billing & Financial Operations",
        cards: [
          {
            module: "billing",
            icon: "Receipt",
            title: "Billing & Invoicing",
            subtitle: "OPD billing, payment settlements & tax receipts",
            metricLabel: "Today's Collections",
            metricValue: "₹0",
            accent: "blue",
          },
          {
            module: "accounting",
            icon: "Wallet",
            title: "Accounting & Finance",
            subtitle: "Revenue ledger, journal entries & P&L snapshot",
            metricLabel: "MTD Revenue",
            metricValue: "₹0",
            accent: "blue",
          },
        ],
      },
    ],
  },
  platform: {
    id: "platform",
    name: "Platform Administrator",
    person: "Ishaan Verma",
    initials: "IV",
    scope: "VetOS Cloud",
    scopeCaption: "Production · ap-south-1",
    greeting: "Platform control plane across all clinic tenants.",
    kpis: [
      { label: "Active tenants", value: "1", trend: "Primary tenant", trendTone: "flat" },
      { label: "Total branches", value: "1", trend: "Active", trendTone: "flat" },
      { label: "MRR", value: "₹0", trend: "Live", trendTone: "flat" },
      { label: "Open escalations", value: "0", trend: "0 open", trendTone: "flat" },
      { label: "System uptime", value: "99.9%", trend: "Healthy", trendTone: "flat" },
    ],
    blocks: [
      {
        category: "Platform Layer",
        cards: [
          {
            module: "tenants",
            icon: "Building2",
            title: "Platform & Tenant Administration",
            subtitle: "Onboard and configure clinic tenants and branches",
            metricLabel: "Tenants active",
            metricValue: "1",
          },
          {
            module: "subscriptions",
            icon: "CreditCard",
            title: "Subscription & SaaS Administration",
            subtitle: "Plans, entitlements and billing per tenant",
            metricLabel: "Renewals due",
            metricValue: "0",
            accent: "amber",
          },
          {
            module: "identity-global",
            icon: "ShieldCheck",
            title: "Identity & Access (Global)",
            subtitle: "Global roles, permission templates, security policy",
            metricLabel: "Admins across tenants",
            metricValue: "1",
          },

          {
            module: "reports-platform",
            icon: "BarChart3",
            title: "Reports & Analytics (Platform-wide)",
            subtitle: "Cross-tenant usage, revenue and health metrics",
            metricLabel: "Tenants flagged",
            metricValue: "0",
            accent: "amber",
          },
          {
            module: "audit",
            icon: "Activity",
            title: "Audit & System Health",
            subtitle: "Audit trail, backup status, incident log",
            metricLabel: "System status",
            metricValue: "Healthy",
            accent: "green",
          },
        ],
      },
    ],
  },

  admin: {
    id: "admin",
    name: "Admin",
    person: "Dr. Ananya Rao",
    initials: "AR",
    scope: "VetCare Specialty Pet Hospital — Central Avenue, Nagpur",
    scopeCaption: "Clinic Suite · v1.0",
    greeting: "Branch operations at a glance.",
    kpis: [
      { label: "Today's appointments", value: "0", trend: "0 in OPD queue", trendTone: "flat" },
      { label: "Revenue today", value: "₹0", trend: "₹0 collected today", trendTone: "flat" },
      { label: "Boarding occupancy", value: "0%", trend: "0 / 25 kennels", trendTone: "flat" },
      { label: "Low-stock items", value: "0", trend: "Stock levels normal", trendTone: "flat" },
      { label: "Staff on shift", value: "0", trend: "0 on leave", trendTone: "flat" },
    ],
    blocks: [
      {
        category: "Identity & Front Office",
        cards: [
          {
            module: "identity",
            icon: "ShieldCheck",
            title: "Identity, Roles & Access",
            subtitle: "Manage branch staff and permissions",
            metricLabel: "Active staff accounts",
            metricValue: "0",
          },
          {
            module: "crm-pets",
            icon: "PawPrint",
            title: "Pet & Owner CRM",
            subtitle: "Registered pets and owner records",
            metricLabel: "Registered patients",
            metricValue: "0",
          },
          {
            module: "appointments",
            icon: "CalendarClock",
            title: "Appointments & Queue",
            subtitle: "Doctor schedules and live queue",
            metricLabel: "In queue now",
            metricValue: "0",
          },
        ],
      },
      {
        category: "Service Operations",
        cards: [
          {
            module: "laboratory",
            icon: "FlaskConical",
            title: "Laboratory",
            subtitle: "Orders, test profiles and diagnostic reports",
            metricLabel: "Pending reports",
            metricValue: "0",
            accent: "amber",
          },
          {
            module: "boarding",
            icon: "Home",
            title: "Pet Boarding & Swimming",
            subtitle: "Kennel stays, check-in/out & hydrotherapy pool",
            metricLabel: "Occupied kennels",
            metricValue: "0 / 25",
            accent: "blue",
          },
        ],
      },

      {
        category: "Commerce & Stock",
        cards: [
          {
            module: "nutrition",
            icon: "Bone",
            title: "Food & Nutrition",
            subtitle: "Feeding plans and food purchase tracking",
            metricLabel: "Diet plans active",
            metricValue: "0",
            accent: "amber",
          },
          {
            module: "inventory",
            icon: "Boxes",
            title: "Inventory & Procurement",
            subtitle: "Stock levels, purchases and suppliers",
            metricLabel: "Low-stock items",
            metricValue: "0",
            accent: "red",
          },
          {
            module: "billing",
            icon: "Receipt",
            title: "Billing & Payments",
            subtitle: "Invoices, estimates and payment collection",
            metricLabel: "Unpaid invoices",
            metricValue: "0",
            accent: "amber",
          },
        ],
      },
      {
        category: "Finance & Accounts",
        cards: [
          {
            module: "accounting",
            icon: "Wallet",
            title: "Accounting & Finance (view)",
            subtitle: "Ledgers, P&L and cash flow snapshot",
            metricLabel: "Revenue today",
            metricValue: "₹0",
          },
        ],
      },
      {
        category: "Insight",
        cards: [
          {
            module: "reports",
            icon: "BarChart3",
            title: "Reports & Analytics",
            subtitle: "Branch performance and operational reports",
            metricLabel: "Visits recorded",
            metricValue: "0",
          },
        ],
      },
    ],
  },

  reception: {
    id: "reception",
    name: "Receptionist",
    person: "Kavitha Nair",
    initials: "KN",
    scope: "VetCare Specialty Pet Hospital — Central Avenue, Nagpur",
    scopeCaption: "Front Desk · Counter 1",
    greeting: "Everything you need for today's front desk.",
    kpis: [
      { label: "Waiting in Lobby", value: "0", trend: "Lobby clear", trendTone: "flat" },
      { label: "Today's Appointments", value: "0", trend: "0 checked in", trendTone: "flat" },
      { label: "New Client Intakes", value: "0", trend: "0 registered", trendTone: "flat" },
      { label: "Boarding & Pool Check-ins", value: "0", trend: "0 scheduled", trendTone: "flat" },
    ],
    blocks: [
      {
        category: "Front-Desk Operations & Patient Queue",
        cards: [
          {
            module: "appointments",
            icon: "CalendarClock",
            title: "Appointments & Queue",
            subtitle: "Book time slots, manage walk-in waiting list & check-ins",
            metricLabel: "Waiting Now",
            metricValue: "0",
            accent: "blue",
          },
          {
            module: "crm-pets",
            icon: "PawPrint",
            title: "Pet & Owner CRM",
            subtitle: "Register new pet parent and link pet medical records",
            metricLabel: "Registered Patients",
            metricValue: "0",
            accent: "green",
          },
          {
            module: "laboratory",
            icon: "FlaskConical",
            title: "Laboratory",
            subtitle: "Sample drop-off, test booking and report collection",
            metricLabel: "Active Lab Orders",
            metricValue: "0",
            accent: "amber",
          },
          {
            module: "clinical-records",
            icon: "FileText",
            title: "Reports & Analytics",
            subtitle: "Diagnostic records and daily front-desk report summary",
            metricLabel: "Today's Visits",
            metricValue: "0",
            accent: "green",
          },
        ],
      },
      {
        category: "Commerce, Boarding & Nutrition",
        cards: [
          {
            module: "inventory",
            icon: "Boxes",
            title: "Inventory & Stock Lookup",
            subtitle: "Check stock availability",
            metricLabel: "Active Items",
            metricValue: "0",
            accent: "amber",
          },
          {
            module: "nutrition",
            icon: "Bone",
            title: "Food & Nutrition",
            subtitle: "Feeding plans, pet food stock and diet purchases",
            metricLabel: "Food Items",
            metricValue: "0",
            accent: "green",
          },
          {
            module: "boarding",
            icon: "Home",
            title: "Pet Boarding & Swimming",
            subtitle: "Kennel check-in, pool slots & pet day-care stays",
            metricLabel: "Check-ins Today",
            metricValue: "0",
            accent: "blue",
          },
          {
            module: "billing",
            icon: "Receipt",
            title: "Billing & Collections",
            subtitle: "POS counter billing and payment collection",
            metricLabel: "Invoices Today",
            metricValue: "₹0",
            accent: "blue",
          },
        ],
      },
    ],
  },

  accounts: {
    id: "accounts",
    name: "Accountant",
    person: "Rahul Menon",
    initials: "RM",
    scope: "VetCare Specialty Pet Hospital — Central Avenue, Nagpur",
    scopeCaption: "Finance Office · FY 2026-27",
    greeting: "Financial position across the clinic group.",
    kpis: [
      { label: "Revenue today", value: "₹0", trend: "₹0 collected", trendTone: "flat" },
      { label: "Outstanding receivables", value: "₹0", trend: "0 open", trendTone: "flat" },
      { label: "Expenses MTD", value: "₹0", trend: "0 vouchers", trendTone: "flat" },
      { label: "Payroll status", value: "Due 30th", trend: "Roster active", trendTone: "flat" },
      { label: "Cash & bank", value: "₹0", trend: "Reconciled", trendTone: "flat" },
    ],
    blocks: [
      {
        category: "Commerce & Stock",
        cards: [
          {
            module: "billing",
            icon: "Receipt",
            title: "Billing & Payments",
            subtitle: "Invoices, refunds and payment reconciliation",
            metricLabel: "Unreconciled today",
            metricValue: "0",
            accent: "amber",
          },
          {
            module: "billing",
            icon: "BarChart3",
            title: "Payment Analytics",
            subtitle: "Collection by method · Razorpay panel · Ageing",
            metricLabel: "Outstanding receivables",
            metricValue: "₹0",
          },
          {
            module: "inventory",
            icon: "Boxes",
            title: "Inventory & Procurement (view)",
            subtitle: "Purchase costs and supplier outstanding",
            metricLabel: "Supplier outstanding",
            metricValue: "₹0",
            accent: "amber",
          },
        ],
      },
      {
        category: "Finance & Insight",
        cards: [
          {
            module: "accounting",
            icon: "Wallet",
            title: "Accounting & Finance",
            subtitle: "Ledgers, P&L, balance sheet, GST/TDS",
            metricLabel: "Net revenue",
            metricValue: "₹0",
          },
          {
            module: "reports-finance",
            icon: "BarChart3",
            title: "Reports & Analytics (Financial)",
            subtitle: "Department/branch profitability reports",
            metricLabel: "Reports scheduled",
            metricValue: "0",
          },
          {
            module: "crm-pets",
            icon: "PawPrint",
            title: "Pet & Owner CRM (view)",
            subtitle: "Look up an owner to trace an invoice",
            metricLabel: "Records",
            metricValue: "0",
          },
        ],
      },
    ],
  },
};

export const ROLE_ORDER: RoleId[] = ["doctor", "admin", "reception", "accounts", "platform"];

export function roleModules(role: RoleConfig): Flashcard[] {
  return role.blocks.flatMap((b) => b.cards);
}
