import { createFileRoute } from "@tanstack/react-router";
import { findPet } from "@/data/doctor/pets";
import { PatientPage } from "@/components/doctor/patient/PatientPage";
import { Placeholder } from "@/components/doctor/shared/Placeholder";

// Patient file (sample data).
export const Route = createFileRoute("/patient/$id/")({
  component: PatientRoute,
});

function PatientRoute() {
  const { id } = Route.useParams();
  const pet = findPet(id);
  if (!pet)
    return <Placeholder title="Patient not found" note={`No sample patient with id "${id}".`} />;
  return <PatientPage pet={pet} />;
}
