import { createFileRoute } from "@tanstack/react-router";
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
          <div>
            <h1 className="page-title">Welcome back, {role.person.split(" ").slice(-1)[0]}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{role.greeting}</p>
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-card p-1">
            {ROLE_ORDER.map((id) => (
              <button
                key={id}
                onClick={() => setRoleId(id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  id === roleId
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {ROLES[id].name}
              </button>
            ))}
          </div>
        </div>

        <div
          className={cn(
            "grid grid-cols-2 gap-4",
            role.kpis.length >= 5 ? "lg:grid-cols-5" : "lg:grid-cols-4",
          )}
        >
          {role.kpis.map((k) => (
            <KpiCard key={k.label} kpi={k} />
          ))}
        </div>

        {role.blocks.map((block) => (
          <section key={block.category} className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="section-label">{block.category}</h2>
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">{block.cards.length} modules</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {block.cards.map((card) => (
                <ModuleFlashcard key={card.module + card.title} card={card} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </Shell>
  );
}
