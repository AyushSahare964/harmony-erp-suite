import { createFileRoute } from "@tanstack/react-router";
import { ClinicDashboard } from "@/components/clinic/ClinicDashboard";

// The previous home dashboard ("/"), unchanged, now at /clinic.
export const Route = createFileRoute("/clinic")({
  head: () => ({
    meta: [
      { title: "Clinic Dashboard — VetOS ERP" },
      {
        name: "description",
        content:
          "VetOS ERP clinical operations: appointments, OPD consultation, live inventory Rx, billing, accounting and HRMS in one console.",
      },
    ],
  }),
  component: () => <ClinicDashboard title="Clinic Dashboard" />,
});
