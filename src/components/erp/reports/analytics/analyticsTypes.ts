import { type AnalyticsResponse } from "@/lib/mongodb/serverFns/analytics";

export type AnalyticsTabId =
  | "overview"
  | "pets"
  | "clients"
  | "appointments"
  | "billing"
  | "payments"
  | "laboratory"
  | "inventory"
  | "clinical"
  | "cross-module";

export interface DrilldownTarget {
  title: string;
  type: string;
  data: any;
}
