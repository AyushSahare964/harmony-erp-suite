import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/erp/Shell";
import { listInvoicesFn } from "@/lib/mongodb/serverFns/billing";
import { InventoryProvider } from "@/components/erp/inventory/useInventoryStore";

// One-Page Dashboard Component & Right Rail
import { BillingDeskDashboard } from "./BillingDeskDashboard";
import { RightRail } from "./RightRail";

// Modals
import { InvoiceDetailModal } from "./InvoiceDetailModal";
import { NewSalesInvoiceModal } from "./NewSalesInvoiceModal";
import { QuotationModal } from "./QuotationModal";
import { BillingReminderModal } from "./BillingReminderModal";
import { PaymentInModal } from "./PaymentInModal";
import { SupplierBillFormModal } from "@/components/erp/accounting/SupplierBillFormModal";
import { ExpenseFormModal } from "@/components/erp/accounting/ExpenseFormModal";
import { OwnerPetRegistrationModal } from "@/components/erp/crm/OwnerPetRegistrationModal";
import { NewSupplierModal } from "@/components/erp/accounting/NewSupplierModal";
import { SupplierLedgerModal } from "@/components/erp/accounting/SupplierLedgerModal";
import { type SupplierMasterRow } from "@/lib/mongodb/serverFns/masters";
import { DailySummaryModal } from "./DailySummaryModal";
import { StockSummaryModal } from "./StockSummaryModal";

function PatientBillingHubInner() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick Action Modals
  const [showNewInvoiceModal, setShowNewInvoiceModal] = useState(false);
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showPurchaseBillModal, setShowPurchaseBillModal] = useState(false);
  const [purchasesRefreshKey, setPurchasesRefreshKey] = useState(0);
  const [suppliersRefreshKey, setSuppliersRefreshKey] = useState(0);
  const [clientsRefreshKey, setClientsRefreshKey] = useState(0);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showPaymentInModal, setShowPaymentInModal] = useState(false);
  const [payInvoiceNo, setPayInvoiceNo] = useState<string | undefined>(undefined);

  // Direct Client Intake & Supplier modals (No duplicate 'double double' party forms)
  const [showPetOwnerModal, setShowPetOwnerModal] = useState(false);
  const [showNewSupplierModal, setShowNewSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierMasterRow | null>(null);
  const [selectedSupplierForLedger, setSelectedSupplierForLedger] = useState<string | null>(null);

  // Summary Modals
  const [showDailySummary, setShowDailySummary] = useState(false);
  const [showStockSummary, setShowStockSummary] = useState(false);

  // Full Patient Bill Details Modal
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  // Deep link from Global Search (?petId=...&petName=...), read once on mount
  const [deepLinkPet, setDeepLinkPet] = useState<{ petId: string; petName: string } | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const petId = params.get("petId");
    if (petId) {
      setDeepLinkPet({ petId, petName: params.get("petName") || "this patient" });
      const url = new URL(window.location.href);
      url.searchParams.delete("petId");
      url.searchParams.delete("petName");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listInvoicesFn({ data: { query: "" } });
      setInvoices(data || []);
    } catch (err) {
      console.error("[PatientBillingHub] Failed to load invoices:", err);
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  // Keyboard shortcuts for high-speed counter billing (Plan §5.7)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      if (e.key === "F2" || (e.altKey && (e.key === "n" || e.key === "N"))) {
        e.preventDefault();
        setShowNewInvoiceModal(true);
      } else if (e.altKey && (e.key === "q" || e.key === "Q")) {
        e.preventDefault();
        setShowQuotationModal(true);
      } else if (e.altKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        setShowPurchaseBillModal(true);
      } else if (e.altKey && (e.key === "e" || e.key === "E")) {
        e.preventDefault();
        setShowExpenseModal(true);
      } else if (e.altKey && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        setShowPetOwnerModal(true);
      } else if (e.altKey && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        setShowReminderModal(true);
      } else if (e.altKey && (e.key === "i" || e.key === "I")) {
        e.preventDefault();
        setPayInvoiceNo(undefined);
        setShowPaymentInModal(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <Shell title="Billing Desk — Real Care Small Animal Clinic">
      <div className="flex gap-4 items-start mx-auto max-w-[1720px]">
        {/* ── Main Scrolling Dashboard Area ── */}
        <div className="flex-1 min-w-0">
          <BillingDeskDashboard
            invoices={invoices}
            loading={loading}
            deepLinkPet={deepLinkPet}
            onRefresh={loadInvoices}
            purchasesRefreshKey={purchasesRefreshKey}
            suppliersRefreshKey={suppliersRefreshKey}
            clientsRefreshKey={clientsRefreshKey}
            onNewInvoice={() => setShowNewInvoiceModal(true)}
            onNewQuotation={() => setShowQuotationModal(true)}
            onAddPurchase={() => setShowPurchaseBillModal(true)}
            onAddExpense={() => setShowExpenseModal(true)}
            onPaymentIn={(invoiceNo) => {
              setPayInvoiceNo(invoiceNo);
              setShowPaymentInModal(true);
            }}
            onPaymentOut={() => setShowExpenseModal(true)}
            onAddCustomer={() => setShowPetOwnerModal(true)}
            onAddSupplier={() => {
              setEditingSupplier(null);
              setShowNewSupplierModal(true);
            }}
            onEditSupplier={(sup) => {
              setEditingSupplier(sup);
              setShowNewSupplierModal(true);
            }}
            onViewSupplierLedger={(supId) => setSelectedSupplierForLedger(supId)}
            onAddReminder={() => setShowReminderModal(true)}
            onViewInvoice={(invoice) => setSelectedInvoice(invoice)}
            onConvertToInvoice={(quotation) => {
              setShowNewInvoiceModal(true);
              toast.success(`Converting quotation ${quotation.quotationNo} for ${quotation.petName} to Live Invoice!`);
            }}
          />
        </div>

        {/* ── Right Rail (Narrow Icon Rail from Plan §5.2) ── */}
        <RightRail
          onNewInvoice={() => setShowNewInvoiceModal(true)}
          onNewQuotation={() => setShowQuotationModal(true)}
          onAddPurchase={() => setShowPurchaseBillModal(true)}
          onAddExpense={() => setShowExpenseModal(true)}
          onAddCustomer={() => setShowPetOwnerModal(true)}
          onAddReminder={() => setShowReminderModal(true)}
          onPaymentIn={() => {
            setPayInvoiceNo(undefined);
            setShowPaymentInModal(true);
          }}
          onPaymentOut={() => setShowExpenseModal(true)}
          onOpenDailySummary={() => setShowDailySummary(true)}
          onOpenStockSummary={() => setShowStockSummary(true)}
        />

        {/* ── 1. Full Patient Bill Detail Modal ── */}
        {selectedInvoice && (
          <InvoiceDetailModal
            open={!!selectedInvoice}
            onClose={() => setSelectedInvoice(null)}
            invoice={selectedInvoice}
            onUpdated={loadInvoices}
            onDeleted={loadInvoices}
          />
        )}

        {/* ── 2. New Sales Invoice Modal (Matches Image 4) ── */}
        <NewSalesInvoiceModal
          open={showNewInvoiceModal}
          onClose={() => setShowNewInvoiceModal(false)}
          onInvoiceCreated={loadInvoices}
        />

        {/* ── 3. Medical Quotation & Cost Estimate Modal ── */}
        <QuotationModal
          open={showQuotationModal}
          onClose={() => setShowQuotationModal(false)}
          onConvertToInvoice={(quotationData) => {
            setShowQuotationModal(false);
            setShowNewInvoiceModal(true);
            toast.success(`Converted estimate for ${quotationData.petName} to Live Invoice!`);
          }}
        />

        {/* ── 4. Billing Reminders & Dues Modal ── */}
        <BillingReminderModal
          open={showReminderModal}
          onClose={() => setShowReminderModal(false)}
          invoices={invoices}
        />

        {/* ── 5. Add Supplier Purchase Bill Modal (Matches Image 2) ── */}
        <SupplierBillFormModal
          open={showPurchaseBillModal}
          onClose={() => setShowPurchaseBillModal(false)}
          onSuccess={() => setPurchasesRefreshKey((k) => k + 1)}
        />

        {/* ── 6. Add Clinic Expense Modal ── */}
        <ExpenseFormModal
          open={showExpenseModal}
          onClose={() => setShowExpenseModal(false)}
          onSuccess={loadInvoices}
        />

        {/* ── 7. Payment In / Receipt Collection Modal ── */}
        <PaymentInModal
          open={showPaymentInModal}
          onClose={() => {
            setShowPaymentInModal(false);
            setPayInvoiceNo(undefined);
          }}
          invoices={invoices}
          initialInvoiceNo={payInvoiceNo}
          onSuccess={loadInvoices}
        />

        {/* ── 8. Register New Pet & Owner Modal (Direct Clinic Client Registration) ── */}
        <OwnerPetRegistrationModal
          open={showPetOwnerModal}
          onClose={() => setShowPetOwnerModal(false)}
          onRegistered={({ owner, pets: registeredPets }) => {
            toast.success(`Client "${owner.name}" (${registeredPets.length} pet${registeredPets.length === 1 ? "" : "s"}) registered successfully!`);
            void loadInvoices();
            setClientsRefreshKey((k) => k + 1);
          }}
        />

        {/* ── 9. Daily Till Summary Modal ── */}
        <DailySummaryModal
          open={showDailySummary}
          onClose={() => setShowDailySummary(false)}
          invoices={invoices}
        />

        {/* ── 10. Stock Summary Modal ── */}
        <StockSummaryModal
          open={showStockSummary}
          onClose={() => setShowStockSummary(false)}
        />

        {/* ── 11. New / Edit Supplier Profile Modal (Matches Image 1 & 2) ── */}
        <NewSupplierModal
          open={showNewSupplierModal}
          onClose={() => {
            setShowNewSupplierModal(false);
            setEditingSupplier(null);
          }}
          supplierToEdit={editingSupplier}
          onSuccess={(sup) => {
            setSuppliersRefreshKey((k) => k + 1);
          }}
        />

        {/* ── 12. Supplier Statement / Ledger Modal ── */}
        {selectedSupplierForLedger && (
          <SupplierLedgerModal
            open={!!selectedSupplierForLedger}
            onClose={() => setSelectedSupplierForLedger(null)}
            supplierId={selectedSupplierForLedger}
          />
        )}
      </div>
    </Shell>
  );
}

export function PatientBillingHub() {
  return (
    <InventoryProvider>
      <PatientBillingHubInner />
    </InventoryProvider>
  );
}
