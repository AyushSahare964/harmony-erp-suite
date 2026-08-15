export type RoleId = "platform" | "admin" | "reception" | "accounts";

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
    scope: "Paws & Claws — Banjara Hills",
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
            module: "opd",
            icon: "Stethoscope",
            title: "OPD Front-Desk",
            subtitle: "Check-ins and encounter billing status",
            metricLabel: "Open encounters",
            metricValue: "12",
            accent: "amber",
          },
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
            title: "Boarding",
            subtitle: "Bookings, check-in/out and occupancy",
            metricLabel: "Occupied kennels",
            metricValue: "18 / 23",
          },
          {
            module: "swimming",
            icon: "Waves",
            title: "Swimming",
            subtitle: "Sessions, bookings and memberships",
            metricLabel: "Sessions today",
            metricValue: "11",
            accent: "green",
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
            module: "documents",
            icon: "FileText",
            title: "Documents & Media",
            subtitle: "Reports, X-rays, consent forms",
            metricLabel: "Uploaded this week",
            metricValue: "126",
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
    scope: "Paws & Claws — Banjara Hills",
    scopeCaption: "Front Desk · Counter 2",
    greeting: "Everything you need for today's front desk.",
    kpis: [
      { label: "My queue today", value: "7", trend: "3 waiting", trendTone: "flat" },
      { label: "Appointments remaining", value: "16", trend: "-6 done", trendTone: "up" },
      { label: "Invoices to collect", value: "11", trend: "₹38,400", trendTone: "down" },
      { label: "Reminders due today", value: "34", trend: "12 sent", trendTone: "flat" },
    ],
    blocks: [
      {
        category: "Identity & Front Office",
        cards: [
          {
            module: "crm-pets",
            icon: "PawPrint",
            title: "Pet & Owner CRM",
            subtitle: "Register a new pet or find an existing one",
            metricLabel: "New today",
            metricValue: "9",
          },
          {
            module: "appointments",
            icon: "CalendarClock",
            title: "Appointments & Queue",
            subtitle: "Book, check-in and manage the queue",
            metricLabel: "Waiting now",
            metricValue: "3",
            badge: "3 waiting",
          },
        ],
      },
      {
        category: "Service Operations",
        cards: [
          {
            module: "opd",
            icon: "Stethoscope",
            title: "OPD Front-Desk",
            subtitle: "Check patients in for consultation",
            metricLabel: "Checked-in",
            metricValue: "12",
          },
          {
            module: "laboratory",
            icon: "FlaskConical",
            title: "Laboratory",
            subtitle: "Create a lab order for a pet",
            metricLabel: "Orders today",
            metricValue: "14",
          },
          {
            module: "boarding",
            icon: "Home",
            title: "Boarding",
            subtitle: "Book or check-in a boarding stay",
            metricLabel: "Check-ins today",
            metricValue: "5",
          },
          {
            module: "swimming",
            icon: "Waves",
            title: "Swimming",
            subtitle: "Book a swimming session",
            metricLabel: "Bookings today",
            metricValue: "11",
            accent: "green",
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
            subtitle: "Ring up a medicine/food/accessory sale",
            metricLabel: "Sales today",
            metricValue: "₹46,200",
          },
          {
            module: "billing",
            icon: "Receipt",
            title: "Billing & Payments",
            subtitle: "Raise invoices and collect payment",
            metricLabel: "Pending collection",
            metricValue: "₹38,400",
            accent: "amber",
            badge: "11 open",
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
            subtitle: "Send reminders and offers",
            metricLabel: "Due today",
            metricValue: "34",
            accent: "amber",
          },
          {
            module: "documents",
            icon: "FileText",
            title: "Documents & Media",
            subtitle: "Upload a report or consent form",
            metricLabel: "Uploaded today",
            metricValue: "23",
          },
          {
            module: "communication",
            icon: "MessageSquare",
            title: "Communication Center",
            subtitle: "Message an owner directly",
            metricLabel: "Unread replies",
            metricValue: "6",
            accent: "amber",
            badge: "6 new",
          },
          {
            module: "reports-frontdesk",
            icon: "BarChart3",
            title: "Reports (Front-Desk)",
            subtitle: "Daily registration and footfall summary",
            metricLabel: "Today's footfall",
            metricValue: "68",
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
    scope: "Paws & Claws — All Branches",
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

export const ROLE_ORDER: RoleId[] = ["platform", "admin", "reception", "accounts"];

export function roleModules(role: RoleConfig): Flashcard[] {
  return role.blocks.flatMap((b) => b.cards);
}
