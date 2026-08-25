import {
  ResponsiveContainer, LineChart, Line, CartesianGrid,
  XAxis, YAxis, Tooltip, BarChart, Bar, Legend,
} from "recharts";
import type { Medicine } from "../../useInventoryStore";

interface Props { medicine: Medicine; stockQty: number; }

// ─── Mock stock trend data ────────────────────────────────────────────────────
function generateStockTrend(baseQty: number) {
  const months = ["Mar", "Apr", "May", "Jun", "Jul", "Aug"];
  return months.map((m, i) => ({
    month: m,
    stock: Math.max(0, baseQty + Math.round(Math.sin(i) * 8) - i * 2),
    purchased: Math.round(10 + Math.random() * 20),
    sold: Math.round(5 + Math.random() * 15),
  }));
}

function Tooltip2({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; name: string; value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="erp-card px-3 py-2 text-xs shadow-md">
      <p className="section-label mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-semibold text-foreground">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export function ItemDashboard({ medicine, stockQty }: Props) {
  const trend = generateStockTrend(stockQty);

  const totalPurchased = trend.reduce((s, r) => s + r.purchased, 0);
  const totalSold = trend.reduce((s, r) => s + r.sold, 0);

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Current Stock", value: String(stockQty), unit: medicine.unit, color: "text-primary" },
          { label: "Reorder Level", value: String(medicine.reorderLevel), unit: medicine.unit, color: stockQty <= medicine.reorderLevel ? "text-destructive" : "text-warning" },
          { label: "Purchased (6 mo)", value: String(totalPurchased), unit: medicine.unit, color: "text-success" },
          { label: "Sold (6 mo)", value: String(totalSold), unit: medicine.unit, color: "text-foreground" },
        ].map((k) => (
          <div key={k.label} className="erp-card px-4 py-3">
            <p className="section-label">{k.label}</p>
            <p className={`mt-1 text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{k.unit}</p>
          </div>
        ))}
      </div>

      {/* Stock Level Trend */}
      <div className="erp-card p-5">
        <p className="mb-1 font-semibold text-navy">Stock Level — Last 6 Months</p>
        <p className="mb-4 text-xs text-muted-foreground">Running stock balance by month</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
            <Tooltip content={<Tooltip2 />} />
            <Line type="monotone" dataKey="stock" name="Stock" stroke="#1F4ED8" strokeWidth={2.5} dot={{ r: 4, fill: "#1F4ED8" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Purchases vs Sales Bar Chart */}
      <div className="erp-card p-5">
        <p className="mb-1 font-semibold text-navy">Purchases vs Sales — Last 6 Months</p>
        <p className="mb-4 text-xs text-muted-foreground">Units movement by month</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={trend} barGap={3}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
            <Tooltip content={<Tooltip2 />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="purchased" name="Purchased" fill="#168A47" radius={[4, 4, 0, 0]} />
            <Bar dataKey="sold" name="Sold" fill="#B7791F" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Transactions */}
      <div className="erp-card overflow-hidden">
        <div className="border-b border-border px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent Transactions</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20 text-left">
              {["Date", "Document", "Qty In", "Qty Out", "Balance"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { date: "2026-08-14", doc: "Purchase Order PO-5501", in: 50, out: 0, bal: stockQty },
              { date: "2026-08-12", doc: "Sales Invoice INV-20481", in: 0, out: 12, bal: stockQty - 12 },
              { date: "2026-08-08", doc: "Sales Invoice INV-20475", in: 0, out: 8, bal: stockQty - 20 },
              { date: "2026-07-28", doc: "Purchase Order PO-5480", in: 30, out: 0, bal: stockQty - 28 },
            ].map((r, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-2.5 text-muted-foreground">{r.date}</td>
                <td className="px-4 py-2.5 text-primary font-medium">{r.doc}</td>
                <td className="px-4 py-2.5 text-success font-medium">{r.in || "—"}</td>
                <td className="px-4 py-2.5 text-destructive font-medium">{r.out || "—"}</td>
                <td className="px-4 py-2.5 font-semibold">{r.bal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
