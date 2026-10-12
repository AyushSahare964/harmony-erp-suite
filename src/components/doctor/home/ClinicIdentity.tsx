import { clinic } from "@/data/doctor/clinic";
import { BrandChip } from "../shared/BrandChip";

/** Clinic logo and "Powered by VetOS", centred in the free space. */
export function ClinicIdentity() {
  return (
    <section className="clinic vd-clinic" aria-label="Clinic">
      <img
        className="clinic-mark vd-clinic-mark"
        id="clinicMark"
        src="/doctor/realcare-logo.png"
        alt={clinic.name}
      />
      <h1 className="sr-only" id="clinicName">{clinic.name}</h1>
      <div className="powered vd-powered">
        Powered by <BrandChip />
      </div>
    </section>
  );
}
