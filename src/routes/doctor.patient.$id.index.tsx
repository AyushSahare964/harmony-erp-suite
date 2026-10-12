import { createFileRoute, redirect } from "@tanstack/react-router";

// Old address of a patient page. Patient pages now live at /patient/$id.
export const Route = createFileRoute("/doctor/patient/$id/")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/patient/$id", params: { id: params.id }, replace: true });
  },
});
