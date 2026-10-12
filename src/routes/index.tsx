import { createFileRoute } from "@tanstack/react-router";
import { useErp } from "@/lib/erp/store";
import { ClinicDashboard } from "@/components/clinic/ClinicDashboard";
import { DOCTOR_HOME_ROLES, doctorHeadLinks } from "@/components/doctor/doctorHead";
import { DoctorLayout } from "@/components/doctor/layout/DoctorLayout";
import { RequireLogin } from "@/components/doctor/layout/RequireLogin";
import { HomeDashboard } from "@/components/doctor/home/HomeDashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VetOS ERP — Veterinary Clinic Management Suite" },
      {
        name: "description",
        content:
          "VetOS ERP clinical operations: appointments, OPD consultation, live inventory Rx, billing, accounting and HRMS in one console.",
      },
      { property: "og:title", content: "VetOS ERP — Veterinary Clinic Management Suite" },
      {
        property: "og:description",
        content:
          "Doctor-tailored clinic ERP with live OPD queue, multi-pet CRM, dynamic inventory billing, and double-entry accounting.",
      },
    ],
    links: doctorHeadLinks,
  }),
  component: Home,
});

// Doctor, admin and platform users get the new doctor home (blue design).
// Other roles keep the previous dashboard, which also lives at /clinic.
function Home() {
  return (
    <RequireLogin>
      <HomeForRole />
    </RequireLogin>
  );
}

function HomeForRole() {
  const { roleId } = useErp();
  if (!DOCTOR_HOME_ROLES.has(roleId)) return <ClinicDashboard title="Home Dashboard" />;
  return (
    <DoctorLayout showSearch>
      <HomeDashboard />
    </DoctorLayout>
  );
}
