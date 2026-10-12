import { createFileRoute, notFound } from "@tanstack/react-router";
import { findPet } from "@/data/doctor/pets";
import { SECTIONS, type Section } from "@/data/doctor/types";
import { HistoryPage } from "@/components/doctor/history/HistoryPage";
import { Placeholder } from "@/components/doctor/shared/Placeholder";

// History pages: medical, lab, purchase, vaccine, deworm (sample data).
export const Route = createFileRoute("/patient/$id/$section")({
  beforeLoad: ({ params }) => {
    if (!SECTIONS.includes(params.section as Section)) throw notFound();
  },
  component: HistoryRoute,
});

function HistoryRoute() {
  const { id, section } = Route.useParams();
  const pet = findPet(id);
  if (!pet)
    return <Placeholder title="Patient not found" note={`No sample patient with id "${id}".`} />;
  // key: a fresh page (graph choice, selections) for each pet and section
  return <HistoryPage key={`${id}/${section}`} pet={pet} section={section as Section} />;
}
