import { ClinicIdentity } from "./ClinicIdentity";
import { PetsStage } from "./PetsStage";
import "./home-final.css";

/** Centre of the doctor home: clinic identity, then kitten + board at the bottom. */
export function HomeDashboard() {
  return (
    <div className="home vd-home" id="home">
      <ClinicIdentity />
      <PetsStage />
    </div>
  );
}
