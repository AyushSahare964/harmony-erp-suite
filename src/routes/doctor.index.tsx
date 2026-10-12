import { createFileRoute, redirect } from "@tanstack/react-router";

// Old address of the doctor home. The doctor home now lives at "/".
export const Route = createFileRoute("/doctor/")({
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true });
  },
});
