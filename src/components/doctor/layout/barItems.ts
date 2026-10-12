// Side-bar entries for the doctor UI and the ERP Shell. Modules, icons, routes, hidden modules and the
// pinned order are the existing ERP sidebar's (roleModules(role) from src/lib/erp/config.ts, icons via
// getIcon() in src/components/erp/icon.tsx). "Home" (/) and "Clinic Dashboard" (/clinic) come first.
import { roleModules, type RoleConfig } from "@/lib/erp/config";

/** Hidden from sidebar navigation by request; the routes and dashboard cards still exist. */
export const HIDDEN_SIDEBAR_MODULES = new Set([
  "hrms",
  "marketing",
  "pharmacy",
  "communication",
  "integrations",
  "billing-suite",
  "accounting",
]);

/** Pinned right after Home Dashboard (positions 2-4); a stable sort keeps the rest in card order. */
const PINNED = ["inventory", "appointments", "billing"];

export interface NavModule {
  module: string;
  icon: string;
  /** Card title without a trailing "(...)", as the sidebar shows it. */
  label: string;
}

/** The modules the ERP sidebar lists for a role, in sidebar order. */
export function sidebarModules(role: RoleConfig): NavModule[] {
  const seen = new Set<string>();
  const items = roleModules(role).filter((c) => {
    if (HIDDEN_SIDEBAR_MODULES.has(c.module) || seen.has(c.module)) return false;
    seen.add(c.module);
    return true;
  });
  if (role.role === "admin" && !seen.has("identity")) {
    items.push({
      module: "identity",
      icon: "ShieldCheck",
      title: "Identity, Roles & Access",
      subtitle: "",
      metricLabel: "",
      metricValue: "",
    } as any);
  }
  const rank = (m: string) => {
    const i = PINNED.indexOf(m);
    return i < 0 ? PINNED.length : i;
  };
  items.sort((a, b) => rank(a.module) - rank(b.module));
  return items.map((c) => ({ module: c.module, icon: c.icon, label: c.title.replace(/\s*\(.*\)$/, "") }));
}

export interface BarItem {
  key: string;
  /** Short name shown under the icon on hover / focus. */
  short: string;
  /** Full name for aria-label. */
  name: string;
  /** Icon name understood by getIcon(). */
  icon: string;
  /** "/" (home), "/clinic", or a module id for /m/$moduleId. */
  to: "/" | "/clinic" | { moduleId: string };
}

const SHORT: Record<string, string> = {
  "crm-pets": "Pets",
  appointments: "Queue",
  laboratory: "Lab",
  boarding: "Boarding",
  nutrition: "Food",
  "clinical-records": "Records",
  pharmacy: "Pharmacy",
  billing: "Billing",
  inventory: "Stock",
  ledgers: "Ledgers",
  "discount-schemes": "Offers",
  reports: "Reports",
  "reports-finance": "Finance",
  "reports-platform": "Reports",
  payroll: "Payroll",
  identity: "Access",
  "identity-global": "Control",
  tenants: "Tenants",
  subscriptions: "Plans",
  "integrations-global": "Apps",
  audit: "Audit",
};

/** Left bar = clinical work, right bar = business; listed in the order they appear in each bar. */
const LEFT_ORDER = ["crm-pets", "appointments", "laboratory", "boarding", "nutrition", "clinical-records", "pharmacy"];
const RIGHT_ORDER = [
  "billing",
  "inventory",
  "ledgers",
  "discount-schemes",
  "reports",
  "reports-finance",
  "reports-platform",
  "payroll",
  "identity",
  "identity-global",
  "tenants",
  "subscriptions",
  "integrations-global",
  "audit",
];

const HOME: BarItem = { key: "home", short: "Home", name: "Home", icon: "Stethoscope", to: "/" };
const CLINIC: BarItem = { key: "clinic", short: "Clinic", name: "Clinic Dashboard", icon: "LayoutGrid", to: "/clinic" };

/**
 * Splits Home, Clinic Dashboard and the role's sidebar modules into a left and a right bar.
 * Admin: 7 + 7. Roles that see fewer modules are balanced as evenly as possible.
 */
export function barItemsFor(role: RoleConfig): { left: BarItem[]; right: BarItem[] } {
  const mods = sidebarModules(role);
  const toItem = (m: NavModule): BarItem => ({
    key: m.module,
    short: SHORT[m.module] ?? m.label.split(/[\s&,]/)[0]!,
    name: m.label,
    // "Shield" is not in the icon map (it fell back to the grid icon, like Clinic Dashboard)
    icon: m.module === "identity-global" ? "ShieldAlert" : m.icon,
    to: { moduleId: m.module },
  });
  const byOrder = (list: string[]) => (a: NavModule, b: NavModule) => {
    const ia = list.indexOf(a.module);
    const ib = list.indexOf(b.module);
    return (ia < 0 ? list.length : ia) - (ib < 0 ? list.length : ib);
  };
  const leftMods = mods.filter((m) => LEFT_ORDER.includes(m.module)).sort(byOrder(LEFT_ORDER));
  const rightMods = mods.filter((m) => !LEFT_ORDER.includes(m.module)).sort(byOrder(RIGHT_ORDER));
  const left = [HOME, CLINIC, ...leftMods.map(toItem)];
  const right = rightMods.map(toItem);
  // balance: move items across the middle until the bars differ by at most one
  while (left.length - right.length > 1) right.unshift(left.pop()!);
  while (right.length - left.length > 1) left.push(right.shift()!);
  return { left, right };
}
