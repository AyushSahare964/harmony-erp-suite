import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/erp/Shell";
import { listInvoicesFn } from "@/lib/mongodb/serverFns/billing";
import { InventoryProvider } from "@/components/erp/inventory/useInventoryStore";

// One-Page Dashboard Component
import { BillingDeskDashboard } from "./BillingDeskDashboard";

// Modals
import { InvoiceDetailModal } from "./InvoiceDetailModal";
import { NewSalesInvoiceModal } from "./NewSalesInvoiceModal";
import { QuotationModal } from "./QuotationModal";
import { BillingReminderModal } from "./BillingReminderModal";
import { PaymentInModal } from "./PaymentInModal";
import { SupplierBillFormModal } from "@/components/erp/accounting/SupplierBillFormModal";
import { ExpenseFormModal } from "@/components/erp/accounting/ExpenseFormModal";

function PatientBillingHubInner() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick Action Modals
  const [showNewInvoiceModal, setShowNewInvoiceModal] = useState(false);
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showPurchaseBillModal, setShowPurchaseBillModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showPaymentInModal, setShowPaymentInModal] = useState(false);
  const [payInvoiceNo, setPayInvoiceNo] = useState<string | undefined>(undefined);

  // Full Patient Bill Details Modal (Preserved as requested!)
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

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

  // Keyboard shortcuts for high-speed counter billing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing inside an input or textarea
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
        setShowNewInvoiceModal(true);
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
      <div className="mx-auto max-w-[1600px]">
        {/* ── Single Unified One-Page Module: Dashboard, Actions, Insights & Patient Invoices Table ── */}
        <BillingDeskDashboard
          invoices={invoices}
          loading={loading}
          onRefresh={loadInvoices}
          onNewInvoice={() => setShowNewInvoiceModal(true)}
          onNewQuotation={() => setShowQuotationModal(true)}
          onAddPurchase={() => setShowPurchaseBillModal(true)}
          onAddExpense={() => setShowExpenseModal(true)}
          onPaymentIn={(invoiceNo) => {
            setPayInvoiceNo(invoiceNo);
            setShowPaymentInModal(true);
          }}
          onPaymentOut={() => setShowExpenseModal(true)}
          onAddCustomer={() => {
            setShowNewInvoiceModal(true);
            toast.info("Quick add new pet owner directly while creating an invoice!");
          }}
          onAddReminder={() => setShowReminderModal(true)}
          onViewInvoice={(invoice) => setSelectedInvoice(invoice)}
          onConvertToInvoice={(quotation) => {
            setShowNewInvoiceModal(true);
            toast.success(`Converting quotation ${quotation.quotationNo} for ${quotation.petName} to Live Invoice!`);
          }}
        />

        {/* ── 1. Full Patient Bill Detail Modal (Line items, print, WhatsApp, payment settlement) ── */}
        {selectedInvoice && (
          <InvoiceDetailModal
            open={!!selectedInvoice}
            onClose={() => setSelectedInvoice(null)}
            invoice={selectedInvoice}
            onUpdated={loadInvoices}
            onDeleted={loadInvoices}
          />
        )}

        {/* ── 2. New Sales Invoice Modal (F2 / Alt+N) ── */}
        <NewSalesInvoiceModal
          open={showNewInvoiceModal}
          onClose={() => setShowNewInvoiceModal(false)}
          onCreated={loadInvoices}
        />

        {/* ── 3. Medical Quotation & Cost Estimate Modal (Alt+Q) ── */}
        <QuotationModal
          open={showQuotationModal}
          onClose={() => setShowQuotationModal(false)}
          onConvertToInvoice={(quotationData) => {
            setShowQuotationModal(false);
            setShowNewInvoiceModal(true);
            toast.success(`Converted estimate for ${quotationData.petName} to Live Invoice!`);
          }}
        />

        {/* ── 4. Billing Reminders & Dues Modal (Alt+R) ── */}
        <BillingReminderModal
          open={showReminderModal}
          onClose={() => setShowReminderModal(false)}
          invoices={invoices}
        />

        {/* ── 5. Add Supplier Purchase Bill Modal (Alt+P) ── */}
        <SupplierBillFormModal
          open={showPurchaseBillModal}
          onClose={() => setShowPurchaseBillModal(false)}
          onSuccess={loadInvoices}
        />

        {/* ── 6. Add Clinic Expense Modal (Alt+E) ── */}
        <ExpenseFormModal
          open={showExpenseModal}
          onClose={() => setShowExpenseModal(false)}
          onSuccess={loadInvoices}
        />

        {/* ── 7. Payment In / Receipt Collection Modal (Alt+I) ── */}
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
