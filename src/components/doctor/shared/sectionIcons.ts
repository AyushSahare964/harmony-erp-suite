import {
  FlaskConical,
  ShieldCheck,
  ShoppingBag,
  Stethoscope,
  Syringe,
  type LucideIcon,
} from "lucide-react";
import type { Section } from "@/data/doctor/types";

/** Icon for each history section (same lucide icons as the reference). */
export const SECTION_ICON: Record<Section, LucideIcon> = {
  medical: Stethoscope,
  lab: FlaskConical,
  purchase: ShoppingBag,
  vaccine: Syringe,
  deworm: ShieldCheck,
};
