import type { ReactNode } from "react";
import type { ClinicStats } from "@/data/doctor/types";
import { BrandChip } from "../shared/BrandChip";

/** Running-screen messages. Every one carries the VetOS tag; numbers are in <em> (sky blue). */
export const runningMessages = (s: ClinicStats): ReactNode[] => [
  <>
    <BrandChip /> brought <em>{s.newPatients} new furry friends</em> to your clinic this month
  </>,
  <>
    With <BrandChip /> your billing is <em>{s.billingFasterPct}% faster</em>
  </>,
  <>
    <BrandChip /> helped your revenue grow <em>{s.revenueUpPct}%</em> this month
  </>,
  <>
    <BrandChip /> saves you <em>{s.hoursSavedPerWeek} hours</em> of paperwork every week
  </>,
  <>
    <em>{s.reminderReturnPct}%</em> of <BrandChip /> vaccine reminders brought a pet back
  </>,
  <>
    <BrandChip /> welcomed back <em>{s.followUps} pets</em> for follow-up visits
  </>,
];
