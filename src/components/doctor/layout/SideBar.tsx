import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { clinic } from "@/data/doctor/clinic";
import { useErp } from "@/lib/erp/store";
import { barItemsFor } from "./barItems";
import { FloatingBar } from "./FloatingBar";

/**
 * One of the two slim side bars with the signed-in role's menu (same modules, icons and routes as the
 * ERP sidebar). Left: Real Care emblem badge. Right: VetOS badge. Used by the doctor UI and by Shell.
 */
export function SideBar({ side }: { side: "left" | "right" }) {
  const { role } = useErp();
  const items = useMemo(() => barItemsFor(role)[side], [role, side]);
  return side === "left" ? (
    <FloatingBar
      side="left"
      label="Clinic pages"
      items={items}
      badge={
        <Link to="/" aria-label="Go to home" className="vd-badge-link">
          <img src={clinic.emblemUrl} alt="" />
        </Link>
      }
    />
  ) : (
    <FloatingBar
      side="right"
      label="Clinic tools"
      items={items}
      badgeClass="is-vet"
      badge={
        <span>
          Vet<b>OS</b>
        </span>
      }
    />
  );
}
