import { Link } from "@tanstack/react-router";
import { ArrowLeft, PawPrint, ShieldCheck, Syringe } from "lucide-react";
import type { Pet, Section } from "@/data/doctor/types";
import { BrandChip } from "../shared/BrandChip";
import { SECTION_ICON } from "../shared/sectionIcons";
import { StatusCard } from "./StatusCard";

const BUTTONS: [Section, string, string][] = [
  ["medical", "Medical", "Visits and treatments"],
  ["lab", "Laboratory", "Blood reports and graphs"],
  ["purchase", "Purchase", "Products and invoices"],
  ["vaccine", "Vaccine history", "Every vaccine given"],
  ["deworm", "Deworming history", "Every deworming given"],
];

/** Patient file: header card, two look-only status cards, five history buttons (3 on top, 2 below). */
export function PatientPage({ pet }: { pet: Pet }) {
  return (
    <>
      <Link to="/" className="p-back home-btn">
        <ArrowLeft strokeWidth={1.8} aria-hidden="true" /> Home
      </Link>
      <section className="patient" aria-label="Patient file">
        <div className="card p-head">
          <div className="p-avatar">
            <PawPrint strokeWidth={1.7} aria-hidden="true" />
          </div>
          <div className="p-id">
            <div className="p-file">
              <BrandChip /> Patient file
            </div>
            <h2>{pet.name}</h2>
            <p>
              {pet.breed} · {pet.age} · {pet.sex}
            </p>
          </div>
          <div className="p-owner">
            Owner<b>{pet.owner}</b>
            {pet.phone}
          </div>
        </div>

        <div className="p-status">
          <StatusCard icon={Syringe} title="Vaccine" dose={pet.vaccine} />
          <StatusCard icon={ShieldCheck} title="Deworming" dose={pet.deworm} />
        </div>

        <div className="p-grid">
          {BUTTONS.map(([section, title, sub]) => {
            const Icon = SECTION_ICON[section];
            return (
              <Link
                key={section}
                to="/patient/$id/$section"
                params={{ id: pet.id, section }}
                className="card p-btn"
              >
                <span className="p-ico">
                  <Icon strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className="p-txt">
                  <strong>{title}</strong>
                  <span>{sub}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
