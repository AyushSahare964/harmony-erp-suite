import React from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Building2,
  Users,
  Settings,
  Activity,
  Layers,
  Sparkles,
  BarChart3,
  Plug,
  CalendarClock,
  Clock,
  ArrowRight,
  Trash2,
  FileText,
} from "lucide-react";
import { KpiCard } from "@/components/erp/KpiCard";
import { ModuleFlashcard } from "@/components/erp/Flashcard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  role: any;
  visits: any[];
  onStartConsultation: (visit: any) => void;
  onDeleteVisit: (visit: any) => void;
  onOpenAdmitPicker: () => void;
  onOpenRegisterModal: () => void;
}

export function AdminDashboardView({
  role,
  visits,
  onStartConsultation,
  onDeleteVisit,
  onOpenAdmitPicker,
  onOpenRegisterModal,
}: Props) {
  return (
    <div className="space-y-7">
      {/* ── Admin Command Header ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/80 bg-gradient-to-r from-card via-card to-purple-500/10 p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-purple-600 text-white font-bold shadow-xs">
            <ShieldCheck className="size-6" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-foreground">Clinic Administrator &amp; Master Control</h2>
              <span className="bg-purple-500/10 text-purple-700 dark:text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-500/20">
                Full Master Access
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Comprehensive operations management across Clinical, Front-Desk, Pharmacy, Finance, HRMS, and Integrations.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={onOpenAdmitPicker}
            className="h-9 gap-1.5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
          >
            <CalendarClock className="size-3.5" /> OPD Consultation Queue
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={onOpenRegisterModal}
            className="h-9 gap-1.5 text-xs font-semibold bg-card hover:bg-muted"
          >
            <Users className="size-3.5" /> Client Registration
          </Button>
        </div>
      </div>

      {/* ── Admin KPI Stats Grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {role.kpis.map((k: any, idx: number) => (
          <KpiCard key={k.label} kpi={k} index={idx} />
        ))}
      </div>

      {/* ── OPD Queue Snapshot for Administrator ──────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 font-bold text-xs">
              <Activity className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-foreground">Active Clinic OPD Queue</h3>
              <p className="text-[11px] text-muted-foreground">Real-time status of today&apos;s patient appointments and billing</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">{visits.length} records</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visits.slice(0, 6).map((v) => {
            const isCompleted =
              v.status === "PAID" ||
              v.status === "Settled" ||
              v.status === "Paid" ||
              v.status === "Completed" ||
              v.status === "Partially Paid" ||
              (Number(v.totalAmount || 0) > 0 && Number(v.amountPaid || 0) >= Number(v.totalAmount || 0));

            return (
              <motion.div
                key={v.visitId}
                layout
                className="rounded-xl border border-border bg-card p-3.5 shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <strong className="text-sm font-bold text-foreground">{v.petName}</strong>
                      {v.petId && (
                        <Badge variant="outline" className="font-mono text-[9px] py-0 bg-primary/10 text-primary border-primary/20">
                          {v.petId}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{v.species} · {v.breed}</p>
                  </div>

                  <span
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                      isCompleted
                        ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                        : "bg-blue-500/10 text-blue-700 border-blue-500/20"
                    )}
                  >
                    {v.status || "Admitted"}
                  </span>
                </div>

                <div className="rounded-lg bg-muted/40 p-2 text-xs space-y-1 text-muted-foreground">
                  <p><strong className="text-foreground">Owner:</strong> {v.ownerName} ({v.ownerPhone})</p>
                  <p className="line-clamp-1"><strong className="text-foreground">Doctor:</strong> {v.doctorName || "Dr. Rohit Sharma"}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <span className="text-[11px] font-mono text-muted-foreground">{v.visitId}</span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDeleteVisit(v)}
                      className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onStartConsultation(v)}
                      className="h-7 text-xs font-semibold gap-1 bg-primary text-primary-foreground"
                    >
                      {isCompleted ? <FileText className="size-3" /> : <ArrowRight className="size-3" />} View
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── Complete Master Modules Grid ─────────────────────────────────── */}
      {role.blocks.map((block: any, bIdx: number) => (
        <motion.section
          key={block.category}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: bIdx * 0.08, ease: "easeOut" }}
          className="space-y-3"
        >
          <div className="flex items-center gap-3">
            <h2 className="section-label">{block.category}</h2>
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">{block.cards.length} modules</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {block.cards.map((card: any, cIdx: number) => (
              <ModuleFlashcard key={card.module + card.title} card={card} index={cIdx} />
            ))}
          </div>
        </motion.section>
      ))}
    </div>
  );
}
