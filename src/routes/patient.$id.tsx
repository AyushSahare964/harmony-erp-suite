import { Outlet, createFileRoute, useParams } from "@tanstack/react-router";
import { doctorHeadLinks } from "@/components/doctor/doctorHead";
import { DoctorLayout } from "@/components/doctor/layout/DoctorLayout";
import { RequireLogin } from "@/components/doctor/layout/RequireLogin";

// Patient file and history pages share the doctor layout (bars + centre column).
// Sample data only (src/data/doctor); no API calls.
export const Route = createFileRoute("/patient/$id")({
  head: () => ({
    meta: [{ title: "VetOS · Patient file" }],
    links: doctorHeadLinks,
  }),
  component: PatientShell,
});

function PatientShell() {
  const { section } = useParams({ strict: false });
  return (
    <RequireLogin>
      <DoctorLayout showSearch={!section}>
        <Outlet />
      </DoctorLayout>
    </RequireLogin>
  );
}
