import { createContext, useContext, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBalanceSheetFn, getChartOfAccountsFn } from "@/lib/mongodb/serverFns/accounts";
import type { PartyBalance, Position } from "@/lib/accounts/compute";
import { ReportFrame, Stat, downloadCsv, inr, modeLabel, todayIST, useReport } from "./shared";

/** Lower-cased Chart of Accounts search text; empty shows everything. */
const SearchContext = createContext("");

/** A balance line; with `parties` it expands to who makes up the number. */
function Account({
  code,
  label,
  amount,
  parties,
  note,
  children,
}: {
  code?: string;
  label: string;
  amount: number;
  parties?: PartyBalance[] | undefined;
  note?: string | undefined;
  children?: ReactNode;
}) {
  const q = useContext(SearchContext);
  const labelMatch = !q || label.toLowerCase().includes(q);
  const shownParties =
    !q || labelMatch ? parties : parties?.filter((x) => x.name.toLowerCase().includes(q));
  if (!labelMatch && !shownParties?.length) return null;

  const head = (
    <span className="flex w-full items-baseline justify-between gap-3 py-1.5 text-xs">
      <span>
        {code && <span className="mr-2 font-mono text-[10px] text-muted-foreground">{code}</span>}
        {label}
        {note && <span className="ml-2 text-[10px] text-muted-foreground">{note}</span>}
      </span>
      <span className="font-mono tabular-nums">{inr(amount)}</span>
    </span>
  );
  const hasKids = !!children || (shownParties && shownParties.length > 0);
  if (!hasKids) return <div className="border-b border-border/50">{head}</div>;
  return (
    <details className="group border-b border-border/50" open={q ? true : undefined}>
      <summary className="cursor-pointer list-none marker:hidden hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
        {head}
      </summary>
      <div className="mb-1 ml-4 border-l border-border pl-3">
        {shownParties?.map((p) => (
          <div key={p.id} className="flex justify-between py-1 text-[11px] text-muted-foreground">
            <span>{p.name}</span>
            <span className="font-mono tabular-nums">{inr(p.amount)}</span>
          </div>
        ))}
        {children}
      </div>
    </details>
  );
}

function Section({
  title,
  total,
  children,
  tone,
}: {
  title: string;
  total: number;
  children: ReactNode;
  tone?: string;
}) {
  return (
    <div className="erp-card p-4">
      <div className="mb-2 flex items-baseline justify-between border-b border-border pb-2">
        <h3 className={cn("text-sm font-bold", tone)}>{title}</h3>
        <span className="font-mono text-sm font-bold tabular-nums">{inr(total)}</span>
      </div>
      {children}
    </div>
  );
}

function bankAccounts(p: Position) {
  return p.bank.map((b) => ({ id: b.mode, name: modeLabel(b.mode), amount: b.amount }));
}

// ─── Balance Sheet ───────────────────────────────────────────────────────────

export function BalanceSheetView() {
  const [asOf, setAsOf] = useState(todayIST());
  const { data: p, error, loading } = useReport(() => getBalanceSheetFn({ data: { asOf } }), asOf);

  const exportCsv = () => {
    if (!p) return;
    downloadCsv(
      `Balance_Sheet_${asOf}.csv`,
      ["Side", "Account", "Amount"],
      [
        ["Asset", "Cash in hand", p.cash],
        ...p.bank.map(
          (b) => ["Asset", `${modeLabel(b.mode)} balance`, b.amount] as (string | number)[],
        ),
        ["Asset", "Cheques/DD pending clearance", p.pendingInstruments],
        ["Asset", "Receivable from clients", p.receivablesTotal],
        ["Asset", "Advances to suppliers", p.supplierAdvancesTotal],
        ["Asset", "Staff advances", p.staffAdvancesTotal],
        ["Asset", "Stock on hand (at cost)", p.stock.value],
        ["Asset", "GST credit", p.gstCredit],
        ["Asset", "Total assets", p.totalAssets],
        ["Liability", "Payable to suppliers", p.payablesTotal],
        ["Liability", "Client advances & credits", p.customerAdvancesTotal],
        ["Liability", "Due to staff", p.staffDueTotal],
        ["Liability", "GST payable", p.gstPayable],
        ["Liability", "Total liabilities", p.totalLiabilities],
        ["Net worth", "Net worth", p.netWorth],
      ],
    );
  };

  return (
    <ReportFrame
      title="Balance Sheet"
      subtitle="What the clinic owns and owes, worked out from every bill, receipt and payment on record."
      asOf={asOf}
      onAsOf={setAsOf}
      onExport={exportCsv}
      loading={loading}
      error={error}
      notes={[
        "Net worth is assets minus liabilities. It is explained as profit to date (purchase basis) + stock not yet expensed + capital, opening balances and anything else not recorded in the system.",
        ...(p?.stockIsCurrent
          ? ["Stock is shown at its current quantity and cost, not as it stood on the chosen date."]
          : []),
        "GST deposited with the government is not recorded, so GST payable is before any such deposits.",
      ]}
    >
      {p && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat label="Total assets" value={inr(p.totalAssets)} />
            <Stat label="Total liabilities" value={inr(p.totalLiabilities)} />
            <Stat
              label="Net worth"
              value={inr(p.netWorth)}
              tone={p.netWorth < 0 ? "bad" : "good"}
            />
          </div>
          {p.totalAssets > 0 && (
            <div className="erp-card px-4 py-3">
              <p className="section-label mb-2">What the assets are funded by</p>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="bg-destructive/70"
                  style={{ width: `${Math.min(100, (p.totalLiabilities / p.totalAssets) * 100)}%` }}
                />
                <div
                  className="bg-success/70"
                  style={{
                    width: `${Math.max(0, Math.min(100, (p.netWorth / p.totalAssets) * 100))}%`,
                  }}
                />
              </div>
              <div className="mt-1.5 flex gap-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-destructive/70" /> Owed to others
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-success/70" /> Owned by the clinic
                </span>
              </div>
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Assets" total={p.totalAssets} tone="text-success">
              <Account label="Cash in hand" amount={p.cash} />
              <Account
                label="Bank & digital receipts"
                amount={p.bankTotal}
                parties={bankAccounts(p)}
              />
              {Math.abs(p.pendingInstruments) >= 0.005 && (
                <Account label="Cheques / DD pending clearance" amount={p.pendingInstruments} />
              )}
              <Account
                label="Receivable from clients"
                amount={p.receivablesTotal}
                parties={p.receivables}
              />
              {p.supplierAdvancesTotal > 0 && (
                <Account
                  label="Advances to suppliers"
                  amount={p.supplierAdvancesTotal}
                  parties={p.supplierAdvances}
                />
              )}
              {p.staffAdvancesTotal > 0 && (
                <Account
                  label="Staff advances"
                  amount={p.staffAdvancesTotal}
                  parties={p.staffAdvances}
                />
              )}
              <Account
                label="Stock on hand (at cost)"
                amount={p.stock.value}
                note={
                  p.stock.expiredValue > 0
                    ? `+ ${inr(p.stock.expiredValue)} expired, not counted`
                    : undefined
                }
              />
              {p.gstCredit > 0 && (
                <Account label="GST credit (input exceeds output)" amount={p.gstCredit} />
              )}
            </Section>

            <div className="space-y-4">
              <Section title="Liabilities" total={p.totalLiabilities} tone="text-destructive">
                <Account
                  label="Payable to suppliers"
                  amount={p.payablesTotal}
                  parties={p.payables}
                />
                <Account
                  label="Client advances & credits"
                  amount={p.customerAdvancesTotal}
                  parties={p.customerAdvances}
                />
                {p.staffDueTotal > 0 && (
                  <Account label="Due to staff" amount={p.staffDueTotal} parties={p.staffDue} />
                )}
                <Account
                  label="GST payable"
                  amount={p.gstPayable}
                  note={`output ${inr(p.outputGst)} − input ${inr(p.inputGst)}`}
                />
              </Section>
              <Section title="Net worth" total={p.netWorth}>
                <Account label="Profit to date (purchase basis)" amount={p.profitToDate} />
                <Account label="Stock on hand not yet expensed" amount={p.stockNotExpensed} />
                <Account
                  label="Capital, opening balances & other"
                  amount={p.capitalAndOther}
                  note="balancing figure"
                />
              </Section>
            </div>
          </div>
        </>
      )}
    </ReportFrame>
  );
}

// ─── Chart of Accounts ───────────────────────────────────────────────────────

export function ChartOfAccountsView() {
  const [asOf, setAsOf] = useState(todayIST());
  const [search, setSearch] = useState("");
  const { data, error, loading } = useReport(() => getChartOfAccountsFn({ data: { asOf } }), asOf);

  const exportCsv = () => {
    if (!data) return;
    const { position: p, pnl } = data;
    downloadCsv(
      `Chart_of_Accounts_${asOf}.csv`,
      ["Type", "Account", "Balance"],
      [
        ["Asset", "Cash in hand", p.cash],
        ...p.bank.map((b) => ["Asset", modeLabel(b.mode), b.amount] as (string | number)[]),
        ["Asset", "Cheques/DD pending", p.pendingInstruments],
        ...p.receivables.map(
          (r) => ["Asset", `Receivable – ${r.name}`, r.amount] as (string | number)[],
        ),
        ["Asset", "Stock on hand", p.stock.value],
        ...p.payables.map(
          (r) => ["Liability", `Payable – ${r.name}`, r.amount] as (string | number)[],
        ),
        ["Liability", "GST payable", p.gstPayable],
        ...pnl.income.map((r) => ["Income", r.label, r.amount] as (string | number)[]),
        ["Expense", "Purchases", pnl.purchases],
        ...pnl.expenses.map((r) => ["Expense", r.label, r.amount] as (string | number)[]),
      ],
    );
  };

  const p = data?.position;
  const pnl = data?.pnl;

  return (
    <ReportFrame
      title="Chart of Accounts"
      subtitle="Every account the books are made of, with its live balance. Click an account to see who it is made up of."
      asOf={asOf}
      onAsOf={setAsOf}
      onExport={exportCsv}
      loading={loading}
      error={error}
      notes={[
        "Accounts are not typed in: they come from your clients, suppliers, staff, payment modes, sales types, expense categories and stock, so a new supplier or expense category appears here the moment it is used.",
        ...(data
          ? [`Income and expense accounts cover the financial year from ${data.fyFrom} to ${asOf}.`]
          : []),
        ...(data?.stockIsCurrent ? ["Stock is shown at its current quantity and cost."] : []),
      ]}
    >
      {p && pnl && (
        <SearchContext.Provider value={search.trim().toLowerCase()}>
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search accounts, clients, suppliers…"
              aria-label="Search accounts"
              className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <Section title="Assets" total={p.totalAssets}>
                <Account code="1000" label="Cash in hand" amount={p.cash} />
                <Account
                  code="1100"
                  label="Bank & digital"
                  amount={p.bankTotal}
                  parties={bankAccounts(p)}
                />
                <Account code="1150" label="Cheques / DD pending" amount={p.pendingInstruments} />
                <Account
                  code="1200"
                  label="Accounts receivable"
                  amount={p.receivablesTotal}
                  parties={p.receivables}
                />
                <Account
                  code="1250"
                  label="Advances to suppliers"
                  amount={p.supplierAdvancesTotal}
                  parties={p.supplierAdvances}
                />
                <Account
                  code="1260"
                  label="Staff advances"
                  amount={p.staffAdvancesTotal}
                  parties={p.staffAdvances}
                />
                <Account code="1300" label="Inventory (stock on hand)" amount={p.stock.value} />
                <Account code="1400" label="GST input credit" amount={p.gstCredit} />
              </Section>
              <Section title="Liabilities" total={p.totalLiabilities}>
                <Account
                  code="2000"
                  label="Accounts payable"
                  amount={p.payablesTotal}
                  parties={p.payables}
                />
                <Account
                  code="2100"
                  label="Client advances & credits"
                  amount={p.customerAdvancesTotal}
                  parties={p.customerAdvances}
                />
                <Account
                  code="2200"
                  label="Due to staff"
                  amount={p.staffDueTotal}
                  parties={p.staffDue}
                />
                <Account code="2300" label="GST output payable" amount={p.gstPayable} />
              </Section>
              <Section title="Equity" total={p.netWorth}>
                <Account code="3000" label="Retained profit to date" amount={p.profitToDate} />
                <Account code="3100" label="Stock not yet expensed" amount={p.stockNotExpensed} />
                <Account
                  code="3200"
                  label="Capital & opening balances"
                  amount={p.capitalAndOther}
                />
              </Section>
            </div>
            <div className="space-y-4">
              <Section title="Income (this financial year)" total={pnl.totalIncome}>
                {pnl.income.length === 0 && (
                  <p className="py-2 text-xs text-muted-foreground">
                    No sales yet this financial year.
                  </p>
                )}
                {pnl.income.map((r, i) => (
                  <Account
                    key={r.label}
                    code={String(4000 + i * 10)}
                    label={r.label}
                    amount={r.amount}
                  />
                ))}
              </Section>
              <Section
                title="Expenses (this financial year)"
                total={r2(pnl.purchases + pnl.totalExpenses)}
              >
                <Account code="5000" label="Purchases (stock & supplies)" amount={pnl.purchases} />
                {pnl.expenses.map((r, i) => (
                  <Account
                    key={r.label}
                    code={String(5100 + i * 10)}
                    label={r.label}
                    amount={r.amount}
                  />
                ))}
              </Section>
            </div>
          </div>
        </SearchContext.Provider>
      )}
    </ReportFrame>
  );
}

const r2 = (n: number) => Math.round(n * 100) / 100;
