import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Shell } from "@/components/erp/Shell";
import { KpiCard } from "@/components/erp/KpiCard";
import { ModuleFlashcard } from "@/components/erp/Flashcard";
import { useErp } from "@/lib/erp/store";
import { ROLES, ROLE_ORDER } from "@/lib/erp/config";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VetOS ERP — Veterinary Clinic Management Suite" },
      {
        name: "description",
        content:
          "VetOS ERP dashboard for veterinary clinics: appointments, OPD, laboratory, boarding, pharmacy, billing, accounting and HRMS in one console.",
      },
      { property: "og:title", content: "VetOS ERP — Veterinary Clinic Management Suite" },
      {
        property: "og:description",
        content:
          "Role-based clinic ERP with live KPIs and module flashcards for admins, receptionists and accountants.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { role, roleId, setRoleId } = useErp();

  return (
    <Shell title="Home Dashboard">
      <div className="mx-auto max-w-[1500px] space-y-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <motion.div
            key={roleId + "-header"}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h1 className="page-title">Welcome back, {role.person.split(" ").slice(-1)[0]}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{role.greeting}</p>
          </motion.div>

          {/* Animated role selector bar */}
          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-xs">
            {ROLE_ORDER.map((id) => (
              <button
                key={id}
                onClick={() => setRoleId(id)}
                className={cn(
                  "relative rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150",
                  id === roleId
                    ? "text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted/70",
                )}
              >
                {id === roleId && (
                  <motion.div
                    layoutId="active-role-tab"
                    className="absolute inset-0 rounded-lg bg-primary shadow-xs"
                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                  />
                )}
                <span className="relative z-10">{ROLES[id].name}</span>
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={roleId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="space-y-7"
          >
            {/* KPI Cards Grid */}
            <div
              className={cn(
                "grid grid-cols-2 gap-4",
                role.kpis.length >= 5 ? "lg:grid-cols-5" : "lg:grid-cols-4",
              )}
            >
              {role.kpis.map((k, idx) => (
                <KpiCard key={k.label} kpi={k} index={idx} />
              ))}
            </div>

            {/* Module Categories Grid */}
            {role.blocks.map((block, bIdx) => (
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
                  {block.cards.map((card, cIdx) => (
                    <ModuleFlashcard key={card.module + card.title} card={card} index={cIdx} />
                  ))}
                </div>
              </motion.section>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </Shell>
  );
}
