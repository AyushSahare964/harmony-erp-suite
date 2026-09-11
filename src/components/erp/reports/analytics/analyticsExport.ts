import { type AnalyticsResponse } from "@/lib/mongodb/serverFns/analytics";
import { type AnalyticsTabId } from "./analyticsTypes";
import { toast } from "sonner";

export function exportAnalyticsCsv(activeTab: AnalyticsTabId, data: AnalyticsResponse) {
  let header = "";
  let rows: string[] = [];

  switch (activeTab) {
    case "overview":
      header = "Metric,Value";
      rows = [
        `"Total Pets","${data.overview.totalPets}"`,
        `"Total Clients","${data.overview.totalClients}"`,
        `"Total Appointments","${data.overview.totalAppointments}"`,
        `"Completed Appointments","${data.overview.completedAppointments}"`,
        `"Total Revenue (Billed)","₹${data.overview.totalRevenue}"`,
        `"Total Collected","₹${data.overview.totalCollected}"`,
        `"Total Outstanding","₹${data.overview.totalOutstanding}"`,
        `"Total Lab Orders","${data.overview.totalLabOrders}"`,
        `"Total Inventory Valuation","₹${data.overview.inventoryTotalValue}"`,
        `"Low Stock Count","${data.overview.lowStockCount}"`,
      ];
      break;

    case "pets":
      header = "Species,Count";
      rows = data.petAnalytics.speciesSplit.map((s) => `"${s.name}","${s.value}"`);
      break;

    case "clients":
      header = "Client ID,Name,Phone,Pets Count,Total Visits,Total Spend,Outstanding";
      rows = data.clientAnalytics.topClients.map(
        (c) =>
          `"${c.ownerId}","${c.name}","${c.phone}","${c.petsCount}","${c.totalVisits}","${c.totalSpend}","${c.outstanding}"`
      );
      break;

    case "appointments":
      header = "Channel/Source,Appointments Count,Completed,Cancelled / No Show,Conversion Rate";
      rows = data.appointmentAnalytics.channelBreakdown.map(
        (ch) => `"${ch.channel}","${ch.count}","${ch.completed}","${ch.cancelledOrNoShow}","${ch.conversionRate}%"`
      );
      break;

    case "billing":
      header = "Service Line,Revenue Amount";
      rows = data.billingRevenue.serviceLineRevenue.map((s) => `"${s.service}","₹${s.amount}"`);
      break;

    case "payments":
      header = "Payment Method,Amount,Count";
      rows = data.paymentAnalysis.paymentMethodSplit.map((p) => `"${p.method}","₹${p.amount}","${p.count}"`);
      break;

    case "laboratory":
      header = "Test Name,Order Count,Estimated Revenue";
      rows = data.laboratoryAnalytics.topTests.map((t) => `"${t.test}","${t.count}","₹${t.revenue}"`);
      break;

    case "inventory":
      header = "Item Code,Item Name,Category,Current Stock,Min Level,Unit Cost";
      rows = data.inventorySales.lowStockAlerts.map(
        (i) => `"${i.itemCode}","${i.name}","${i.category}","${i.currentStock}","${i.minStockLevel}","₹${i.unitCost}"`
      );
      break;

    case "clinical":
      header = "Category,Report Count";
      rows = data.clinicalAnalytics.reportsByCategory.map((c) => `"${c.category}","${c.count}"`);
      break;

    case "cross-module":
      header = "Pet ID,Pet Name,Owner,Visits,Total Billed,Total Paid,Outstanding";
      rows = data.crossModule.petBillingChains.map(
        (c) => `"${c.petId}","${c.petName}","${c.ownerName}","${c.visitsCount}","₹${c.totalBilled}","₹${c.totalPaid}","₹${c.outstanding}"`
      );
      break;
  }

  const csvContent = `${header}\n${rows.join("\n")}`;
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `analytics_${activeTab}_${data.startDate}_to_${data.endDate}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${activeTab.toUpperCase()} analytics report as CSV`);
}
