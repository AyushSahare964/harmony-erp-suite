import { createFileRoute, redirect } from "@tanstack/react-router";

// Old address of a history page. History pages now live at /patient/$id/$section.
export const Route = createFileRoute("/doctor/patient/$id/$section")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/patient/$id/$section",
      params: { id: params.id, section: params.section },
      replace: true,
    });
  },
});
