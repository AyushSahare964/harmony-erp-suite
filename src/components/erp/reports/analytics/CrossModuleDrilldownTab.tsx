import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Link2, ArrowRight, DollarSign, Calendar, PawPrint, User, ShieldCheck } from "lucide-react";
import { KpiCard } from "@/components/erp/KpiCard";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { type AnalyticsResponse } from "@/lib/mongodb/serverFns/analytics";
import { type DrilldownTarget } from "./analyticsTypes";

interface Props {
  data: AnalyticsResponse;
  onDrilldown: (target: DrilldownTarget) => void;
}

export function CrossModuleDrilldownTab({ data, onDrilldown }: Props) {
  const { crossModule, overview } = data;
  const [searchTerm, setSearchTerm] = useState("");

  const filteredChains = crossModule.petBillingChains.filter((c) => {
    const term = searchTerm.toLowerCase();
    return (
      c.petName.toLowerCase().includes(term) ||
      c.ownerName.toLowerCase().includes(term) ||
      c.petId.toLowerCase().includes(term)
    );
  });

  const totalBilledChain = crossModule.petBillingChains.reduce((sum, c) => sum + c.totalBilled, 0);
  const totalOutstandingChain = crossModule.petBillingChains.reduce((sum, c) => sum + c.outstanding, 0);
  const totalVisitsChain = crossModule.petBillingChains.reduce((sum, c) => sum + c.visitsCount, 0);

  return (
    <div className="space-y-6">
      {/* Cross-Module Health Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          kpi={{
            label: "PATIENTS LINKED",
            value: crossModule.petBillingChains.length.toString(),
            trend: "Across clinical & financial records",
            trendTone: "up",
          }}
          index={0}
        />
        <KpiCard
          kpi={{
            label: "ENCOUNTER VISITS",
            value: totalVisitsChain.toString(),
            trend: "Tracked hospital visits",
            trendTone: "up",
          }}
          index={1}
        />
        <KpiCard
          kpi={{
            label: "CROSS-SYSTEM BILLED",
            value: `₹${totalBilledChain.toLocaleString("en-IN")}`,
            trend: "Cumulative patient spend",
            trendTone: "up",
          }}
          index={2}
        />
        <KpiCard
          kpi={{
            label: "CROSS-SYSTEM RECEIVABLES",
            value: `₹${totalOutstandingChain.toLocaleString("en-IN")}`,
            trend: totalOutstandingChain > 0 ? "Pending collection" : "All cleared",
            trendTone: totalOutstandingChain > 0 ? "down" : "flat",
          }}
          index={3}
        />
      </div>

      {/* Cross-Module Drilldown Explorer */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="erp-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-primary" />
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                CROSS-MODULE AUDIT CHAIN: PET → CLINICAL ENCOUNTERS → INVOICING
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Direct trace linking patient master, appointment logs, clinical visits, and financial accounts
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search pet or owner..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>
        </div>

        {filteredChains.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No patient clinical-financial chains match your search criteria
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
                <tr>
                  <th className="p-2.5">Patient Master</th>
                  <th className="p-2.5">Owner / Parent</th>
                  <th className="p-2.5 text-center">Visits &amp; Encounters</th>
                  <th className="p-2.5 text-right">Total Invoiced</th>
                  <th className="p-2.5 text-right">Settled (Paid)</th>
                  <th className="p-2.5 text-right">Balance Due</th>
                  <th className="p-2.5 text-center">Audit Status</th>
                  <th className="p-2.5 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredChains.map((chain) => {
                  const hasDue = chain.outstanding > 0;
                  return (
                    <tr key={chain.petId} className="hover:bg-muted/30 transition-colors">
                      <td className="p-2.5 font-medium">
                        <div className="flex items-center gap-1.5">
                          <PawPrint className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="font-semibold text-foreground">{chain.petName}</span>
                        </div>
                      </td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <User className="w-3.5 h-3.5 shrink-0" />
                          <span>{chain.ownerName}</span>
                        </div>
                      </td>
                      <td className="p-2.5 text-center">
                        <Badge variant="outline" className="text-[11px] font-semibold">
                          {chain.visitsCount} visits
                        </Badge>
                      </td>
                      <td className="p-2.5 text-right font-medium">
                        ₹{chain.totalBilled.toLocaleString("en-IN")}
                      </td>
                      <td className="p-2.5 text-right font-medium text-emerald-600 dark:text-emerald-400">
                        ₹{chain.totalPaid.toLocaleString("en-IN")}
                      </td>
                      <td className="p-2.5 text-right font-bold">
                        <span className={hasDue ? "text-rose-500" : "text-muted-foreground"}>
                          ₹{chain.outstanding.toLocaleString("en-IN")}
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        {hasDue ? (
                          <Badge variant="destructive" className="text-[10px]">
                            Pending Due
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] text-emerald-600 dark:text-emerald-400">
                            Clear
                          </Badge>
                        )}
                      </td>
                      <td className="p-2.5 text-right">
                        <button
                          onClick={() =>
                            onDrilldown({
                              title: `Patient Lifecycle Audit: ${chain.petName}`,
                              type: "cross-chain",
                              data: chain,
                            })
                          }
                          className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1 justify-end"
                        >
                          Audit <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
