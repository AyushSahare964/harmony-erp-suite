/**
 * Single source of truth for stock/expiry status thresholds, shared by
 * useInventoryStore.ts (AlertsPanel, catalogue views) and AdminDashboardView.tsx,
 * which previously computed overlapping-but-not-identical logic independently —
 * notably AdminDashboardView's expiring-soon window excluded already-expired items.
 */

export type StockStatus = "OK" | "Low" | "Out of Stock";
export type ExpiryBand = "safe" | "expiring-soon" | "critical" | "expired";

export function getStockStatus(currentStock: number, reorderLevel: number): StockStatus {
  if (currentStock === 0) return "Out of Stock";
  if (currentStock <= reorderLevel) return "Low";
  return "OK";
}

export function getExpiryBand(expiryDate: string | Date): ExpiryBand {
  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffDays = Math.floor((expiry.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return "expired";
  if (diffDays <= 7) return "critical";
  if (diffDays <= 30) return "expiring-soon";
  return "safe";
}

/** True for any band that should surface in an "expiring soon" alert list (expired included). */
export function isExpiringSoon(expiryDate: string | Date): boolean {
  const band = getExpiryBand(expiryDate);
  return band === "expired" || band === "critical" || band === "expiring-soon";
}
