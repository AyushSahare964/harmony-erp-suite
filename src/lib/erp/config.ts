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
      { label: "Patients Waiting", value: "4", trend: "In OPD queue", trendTone: "up" },
      { label: "Today's Consultations", value: "18", trend: "+3 vs yesterday", trendTone: "up" },
      { label: "Vaccinations Done", value: "7", trend: "100% on schedule", trendTone: "up" },
      { label: "Prescriptions Issued", value: "15", trend: "Live FEFO sync", trendTone: "up" },
      { label: "Follow-ups Due", value: "6", trend: "Next 48h", trendTone: "flat" },
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
            metricValue: "4 waiting",
            accent: "blue",
            badge: "Live Queue",
          },
          {
            module: "crm-pets",
            icon: "PawPrint",
            title: "Pet & Owner CRM",
            subtitle: "Multi-pet profiles, medical history and vaccines",
            metricLabel: "Active Patients",
            metricValue: "735",
            accent: "green",
            badge: "CRM",
          },
          {
            module: "laboratory",
            icon: "FlaskConical",
            title: "Laboratory & Diagnostics",
            subtitle: "Lab test orders, pathology & diagnostic reports",
            metricLabel: "Pending Reports",
            metricValue: "8 tests",
            accent: "amber",
            badge: "Diagnostics",
          },
          {
            module: "clinical-records",
            icon: "FileText",
            title: "Reports & Medical Records",
            subtitle: "Signed clinical reports, Rx archive & investigations",
            metricLabel: "Archived Records",
            metricValue: "1,420",
            accent: "green",
            badge: "Reports",
          },
        ],
      },
      {
        category: "Pharmacy, Inventory & Nutrition",
        cards: [
          {
            module: "pharmacy",
            icon: "Pill",
            title: "Pharmacy & Retail POS",
            subtitle: "Dispensary counter, dosage guidelines & OTC",
            metricLabel: "Today's Rx Sales",
            metricValue: "₹46,200",
            accent: "amber",
            badge: "Dispensary",
          },
          {
            module: "inventory",
            icon: "Boxes",
            title: "Live Inventory & Batches",
            subtitle: "Stock levels, FEFO expiry tracking and reorders",
            metricLabel: "Active SKUs",
            metricValue: "313 items",
            accent: "amber",
            badge: "FEFO Stock",
          },
          {
            module: "nutrition",
            icon: "Bone",
            title: "Food & Nutrition Store",
            subtitle: "Therapeutic prescription diets and pet food",
            metricLabel: "Diet Plans Active",
            metricValue: "48",
            accent: "green",
            badge: "Nutrition",
          },
          {
            module: "boarding",
            icon: "Home",
            title: "Pet Boarding & Swimming",
            subtitle: "Kennel stays, check-in/out & hydrotherapy pool",
            metricLabel: "Current Occupancy",
            metricValue: "18 / 23",
            accent: "blue",
            badge: "Boarding/Pool",
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
            metricValue: "₹1,24,850",
            accent: "blue",
            badge: "Billing",
          },
          {
            module: "accounting",
            icon: "Wallet",
            title: "Accounting & Finance",
            subtitle: "Revenue ledger, journal entries & P&L snapshot",
            metricLabel: "MTD Revenue",
            metricValue: "₹21.6L",
            accent: "blue",
            badge: "Finance",
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
      { label: "Active tenants", value: "38", trend: "+3 this month", trendTone: "up" },
      { label: "Total branches", value: "112", trend: "+7", trendTone: "up" },
      { label: "MRR", value: "₹18.4L", trend: "+6.2%", trendTone: "up" },
      { label: "Open escalations", value: "9", trend: "+2 today", trendTone: "down" },
      { label: "System uptime", value: "99.98%", trend: "30-day", trendTone: "flat" },
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
            metricValue: "38",
            trend: "+3 this month",
            trendTone: "up",
          },
          {
            module: "subscriptions",
            icon: "CreditCard",
            title: "Subscription & SaaS Administration",
            subtitle: "Plans, entitlements and billing per tenant",
            metricLabel: "Renewals due this week",
            metricValue: "6",
            accent: "amber",
            badge: "2 overdue",
          },
          {
            module: "identity-global",
            icon: "ShieldCheck",
            title: "Identity & Access (Global)",
            subtitle: "Global roles, permission templates, security policy",
            metricLabel: "Admins across tenants",
            metricValue: "74",
          },
          {
            module: "integrations-global",
            icon: "Plug",
            title: "Integration Hub & Settings (Global)",
            subtitle: "WhatsApp, SMS, payment gateway, GST providers",
            metricLabel: "Integrations connected",
            metricValue: "11",
            accent: "green",
          },
          {
            module: "reports-platform",
            icon: "BarChart3",
            title: "Reports & Analytics (Platform-wide)",
            subtitle: "Cross-tenant usage, revenue and health metrics",
            metricLabel: "Tenants flagged for review",
            metricValue: "4",
            accent: "amber",
          },
          {
            module: "audit",
            icon: "Activity",
            title: "Audit & System Health",
            subtitle: "Audit trail, backup status, incident log",
            metricLabel: "Failed jobs / alerts",
            metricValue: "3",
            accent: "red",
            badge: "1 critical",
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
      { label: "Today's appointments", value: "42", trend: "+6 vs yesterday", trendTone: "up" },
      { label: "Revenue today", value: "₹1,24,850", trend: "+12.4%", trendTone: "up" },
      { label: "Boarding occupancy", value: "78%", trend: "18 / 23 kennels", trendTone: "flat" },
      { label: "Low-stock items", value: "14", trend: "+3", trendTone: "down" },
      { label: "Staff on shift", value: "19", trend: "2 on leave", trendTone: "flat" },
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
            metricValue: "31",
          },
          {
            module: "crm-pets",
            icon: "PawPrint",
            title: "Pet & Owner CRM",
            subtitle: "Registered pets and owner records",
            metricLabel: "New registrations today",
            metricValue: "9",
            trend: "+4 vs yesterday",
            trendTone: "up",
          },
          {
            module: "appointments",
            icon: "CalendarClock",
            title: "Appointments & Queue",
            subtitle: "Doctor schedules and live queue",
            metricLabel: "In queue now",
            metricValue: "7",
            trend: "+2 vs yesterday",
            trendTone: "up",
            badge: "3 waiting",
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
            subtitle: "Orders, sample tracking and report status",
            metricLabel: "Pending reports",
            metricValue: "8",
            accent: "amber",
            badge: "2 urgent",
          },
          {
            module: "boarding",
            icon: "Home",
            title: "Pet Boarding & Swimming",
            subtitle: "Kennel stays, check-in/out & hydrotherapy pool",
            metricLabel: "Occupied kennels",
            metricValue: "18 / 23",
            accent: "blue",
            badge: "Hydrotherapy",
          },
        ],
      },

      {
        category: "Commerce & Stock",
        cards: [
          {
            module: "pharmacy",
            icon: "Pill",
            title: "Pharmacy & Retail",
            subtitle: "Medicine, food and accessory sales",
            metricLabel: "Sales today",
            metricValue: "₹46,200",
            trend: "+8.1%",
            trendTone: "up",
          },
          {
            module: "nutrition",
            icon: "Bone",
            title: "Food & Nutrition",
            subtitle: "Feeding plans and food purchase tracking",
            metricLabel: "Reorder due",
            metricValue: "5",
            accent: "amber",
          },
          {
            module: "inventory",
            icon: "Boxes",
            title: "Inventory & Procurement",
            subtitle: "Stock levels, purchases and suppliers",
            metricLabel: "Low-stock items",
            metricValue: "14",
            accent: "red",
            badge: "3 expiring",
          },
          {
            module: "billing",
            icon: "Receipt",
            title: "Billing & Payments",
            subtitle: "Invoices, estimates and payment collection",
            metricLabel: "Unpaid invoices",
            metricValue: "23",
            accent: "amber",
          },
          {
            module: "billing",
            icon: "ShoppingCart",
            title: "Manual Product Billing",
            subtitle: "Bill a product directly without a prior encounter",
            metricLabel: "Manual bills today",
            metricValue: "3",
            badge: "11.4",
          },
          {
            module: "billing",
            icon: "BarChart3",
            title: "Payment Analytics",
            subtitle: "Collection by method, trend and receivables ageing",
            metricLabel: "Razorpay success rate",
            metricValue: "96.8%",
            accent: "green",
            badge: "11.6",
          },
          {
            module: "billing",
            icon: "RefreshCw",
            title: "Subscription Billing",
            subtitle: "Membership plans, session packs and auto-renewals",
            metricLabel: "Active subscriptions",
            metricValue: "3",
            badge: "11.8",
          },
        ],
      },
      {
        category: "Finance & People",
        cards: [
          {
            module: "accounting",
            icon: "Wallet",
            title: "Accounting & Finance (view)",
            subtitle: "Ledgers, P&L and cash flow snapshot",
            metricLabel: "Net revenue MTD",
            metricValue: "₹21.6L",
            trend: "+9.4%",
            trendTone: "up",
          },
          {
            module: "hrms",
            icon: "Users",
            title: "HRMS",
            subtitle: "Staff attendance, leave and payroll status",
            metricLabel: "On leave today",
            metricValue: "2",
          },
          {
            module: "identity-global",
            icon: "Shield",
            title: "Identity, Role & Access Control",
            subtitle: "Staff directory, registration approvals & permissions",
            metricLabel: "Pending review",
            metricValue: "Live",
            accent: "blue",
          },
        ],
      },

      {
        category: "Engagement & Insight",
        cards: [
          {
            module: "marketing",
            icon: "Megaphone",
            title: "CRM & Marketing",
            subtitle: "Reminders, campaigns and loyalty",
            metricLabel: "Reminders due today",
            metricValue: "34",
            accent: "amber",
          },
          {
            module: "communication",
            icon: "MessageSquare",
            title: "Communication Center",
            subtitle: "WhatsApp/SMS/email delivery log",
            metricLabel: "Messages sent today",
            metricValue: "418",
            accent: "green",
          },
          {
            module: "reports",
            icon: "BarChart3",
            title: "Reports & Analytics",
            subtitle: "Branch performance and operational reports",
            metricLabel: "Saved reports",
            metricValue: "27",
          },
          {
            module: "integrations",
            icon: "Plug",
            title: "Integration Hub & Settings (Branch)",
            subtitle: "Branch-level service catalogue and config",
            metricLabel: "Active integrations",
            metricValue: "6",
            accent: "green",
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
      { label: "Waiting in Lobby", value: "3", trend: "Ready for triage", trendTone: "flat" },
      { label: "Today's Appointments", value: "24", trend: "16 remaining", trendTone: "up" },
      { label: "New Client Intakes", value: "9", trend: "+4 vs yesterday", trendTone: "up" },
      { label: "Boarding & Pool Check-ins", value: "5", trend: "Confirmed", trendTone: "flat" },
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
            metricValue: "3 patients",
            badge: "Live Queue",
            accent: "blue",
          },
          {
            module: "crm-pets",
            icon: "PawPrint",
            title: "Pet & Owner CRM",
            subtitle: "Register new pet parent and link pet medical records",
            metricLabel: "New Intakes",
            metricValue: "9 today",
            accent: "green",
            badge: "CRM",
          },
          {
            module: "laboratory",
            icon: "FlaskConical",
            title: "Laboratory",
            subtitle: "Sample drop-off, test booking and report collection",
            metricLabel: "Active Lab Orders",
            metricValue: "14 tests",
            accent: "amber",
          },
          {
            module: "clinical-records",
            icon: "FileText",
            title: "Reports & Analytics",
            subtitle: "Diagnostic records and daily front-desk report summary",
            metricLabel: "Today's Footfall",
            metricValue: "68 visits",
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
            subtitle: "Check retail & pharmacy stock availability",
            metricLabel: "Active Items",
            metricValue: "313 SKUs",
            accent: "amber",
          },
          {
            module: "nutrition",
            icon: "Bone",
            title: "Food & Nutrition",
            subtitle: "Feeding plans, pet food stock and diet purchases",
            metricLabel: "Food SKUs",
            metricValue: "42 items",
            accent: "green",
          },
          {
            module: "boarding",
            icon: "Home",
            title: "Pet Boarding & Swimming",
            subtitle: "Kennel check-in, pool slots & pet day-care stays",
            metricLabel: "Check-ins Today",
            metricValue: "5 pets",
            accent: "blue",
            badge: "Hydrotherapy",
          },
          {
            module: "billing",
            icon: "Receipt",
            title: "Billing & Collections",
            subtitle: "POS counter billing and payment collection",
            metricLabel: "Invoices Today",
            metricValue: "₹38,400",
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
      { label: "Revenue today", value: "₹1,24,850", trend: "+12.4%", trendTone: "up" },
      { label: "Outstanding receivables", value: "₹6.8L", trend: "+₹42k", trendTone: "down" },
      { label: "Expenses MTD", value: "₹9.2L", trend: "-3.1%", trendTone: "up" },
      { label: "Payroll status", value: "Due 30th", trend: "31 employees", trendTone: "flat" },
      { label: "Cash & bank", value: "₹14.3L", trend: "+₹1.1L", trendTone: "up" },
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
            metricValue: "17",
            accent: "amber",
            badge: "17 open",
          },
          {
            module: "billing",
            icon: "BarChart3",
            title: "Payment Analytics",
            subtitle: "Collection by method · Razorpay panel · Ageing",
            metricLabel: "Outstanding receivables",
            metricValue: "₹38,400",
            badge: "11.6",
          },
          {
            module: "inventory",
            icon: "Boxes",
            title: "Inventory & Procurement (view)",
            subtitle: "Purchase costs and supplier outstanding",
            metricLabel: "Supplier outstanding",
            metricValue: "₹2.4L",
            accent: "amber",
          },
        ],
      },
      {
        category: "Finance & People",
        cards: [
          {
            module: "accounting",
            icon: "Wallet",
            title: "Accounting & Finance",
            subtitle: "Ledgers, P&L, balance sheet, GST/TDS",
            metricLabel: "Net revenue MTD",
            metricValue: "₹21.6L",
            trend: "+9.4%",
            trendTone: "up",
          },
          {
            module: "payroll",
            icon: "Users",
            title: "HRMS — Payroll",
            subtitle: "Salary runs, advances and incentives",
            metricLabel: "Payroll due date",
            metricValue: "30 Aug",
            accent: "amber",
          },
        ],
      },
      {
        category: "Engagement & Insight",
        cards: [
          {
            module: "reports-finance",
            icon: "BarChart3",
            title: "Reports & Analytics (Financial)",
            subtitle: "Department/branch profitability reports",
            metricLabel: "Reports scheduled",
            metricValue: "8",
          },
          {
            module: "crm-pets",
            icon: "PawPrint",
            title: "Pet & Owner CRM (view)",
            subtitle: "Look up an owner to trace an invoice",
            metricLabel: "Records",
            metricValue: "—",
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
