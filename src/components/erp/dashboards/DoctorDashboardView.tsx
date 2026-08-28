import React from "react";
import { motion } from "framer-motion";
import {
  Stethoscope,
  Sparkles,
  ArrowRight,
  Trash2,
  Calendar,
  AlertCircle,
  FileText,
  UserPlus,
  PawPrint,
  Clock,
  Pill,
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

export function DoctorDashboardView({
  role,
  visits,
  onStartConsultation,
  onDeleteVisit,
  onOpenAdmitPicker,
  onOpenRegisterModal,
}: Props) {
  return (
    <div className="space-y-7">
      {/* ── Clinical Quick Action Command Bar ────────────────────────────────── */}
      <div className="rounded-2xl border border-border/80 bg-gradient-to-r from-card via-card to-primary-soft/20 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            <Sparkles className="size-4" />
          </span>
          <div>
            <p className="text-xs font-bold text-foreground">Clinical Quick Actions</p>
            <p className="text-[11px] text-muted-foreground">Fast patient intake, consultation, billing &amp; live inventory</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={onOpenAdmitPicker}
            className="h-9 gap-1.5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
          >
            <Stethoscope className="size-3.5" /> Admit Patient (OPD)
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={onOpenRegisterModal}
            className="h-9 gap-1.5 text-xs font-semibold bg-card hover:bg-muted"
          >
            <PawPrint className="size-3.5" /> Register Owner &amp; Pet
          </Button>
        </div>
      </div>

      {/* ── Live OPD Consultation Queue ────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs">
              <Clock className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-foreground">Live OPD Consultation Queue &amp; Patient Records</h3>
              <p className="text-[11px] text-muted-foreground">Patients admitted ready for consultation, diagnosis, or billing settlement</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">{visits.length} records</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visits.map((v) => {
            const isCompleted =
              v.status === "PAID" ||
              v.status === "Settled" ||
              v.status === "Paid" ||
              v.status === "Completed" ||
              v.status === "Partially Paid" ||
              (Number(v.totalAmount || 0) > 0 && Number(v.amountPaid || 0) >= Number(v.totalAmount || 0)) ||
              Boolean(v.diagnosis && Number(v.totalAmount || 0) > 0);

            return (
              <motion.div
                key={v.visitId}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-xl border border-border bg-card hover:border-primary/40 p-3.5 shadow-2xs space-y-3 transition-all"
              >
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <strong className="text-sm font-bold text-foreground">{v.petName}</strong>
                      {v.petId && (
                        <Badge variant="outline" className="font-mono text-[9px] py-0 bg-primary/10 text-primary border-primary/20">
                          {v.petId}
                        </Badge>
                      )}
                      {(v.allergies?.length > 0 || String(v.vitals?.complaint || "").toLowerCase().includes("allergy")) && (
                        <Badge className="bg-destructive text-destructive-foreground font-extrabold text-[9px] py-0 px-1.5 uppercase tracking-wider shadow-xs">
                          ⚠ ALLERGY ALERT
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{v.species} · {v.breed}</p>

                  <span
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                      isCompleted
                        ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                        : v.status === "Diagnosed"
                        ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                        : "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                    )}
                  >
                    {v.status || "Admitted"}
                  </span>
                </div>

                <div className="rounded-lg bg-muted/40 p-2 text-xs space-y-1 text-muted-foreground">
                  <p><strong className="text-foreground">Owner:</strong> {v.ownerName} ({v.ownerPhone})</p>
                  <p className="line-clamp-1"><strong className="text-foreground">Complaint:</strong> {v.vitals?.complaint || "Routine checkup"}</p>
                  {v.totalAmount > 0 && (
                    <p className="text-primary font-semibold">Bill Total: ₹{v.totalAmount} ({v.items?.length || 0} items)</p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <span className="text-[11px] font-mono text-muted-foreground">{v.visitId}</span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDeleteVisit(v)}
                      className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
                      title="Delete Visit"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onStartConsultation(v)}
                      className={cn(
                        "h-7 text-xs font-semibold gap-1",
                        isCompleted
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : "bg-primary text-primary-foreground"
                      )}
                    >
                      {isCompleted ? (
                        <>
                          <FileText className="size-3" /> View Final Rx &amp; Bill
                        </>
                      ) : (
                        <>
                          Open Visit &amp; Rx <ArrowRight className="size-3" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {visits.length === 0 && (
            <div className="col-span-full py-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl bg-muted/10">
              No active OPD visits. Click &ldquo;Admit Patient (OPD)&rdquo; or switch to Front-Desk console to admit walk-ins.
            </div>
          )}
        </div>
      </div>

      {/* ── Doctor KPI Cards Grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {role.kpis.map((k: any, idx: number) => (
          <KpiCard key={k.label} kpi={k} index={idx} />
        ))}
      </div>

      {/* ── Doctor Module Categories Grid ──────────────────────────────────── */}
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
