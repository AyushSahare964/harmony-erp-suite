import type { IsoDate } from "@/data/doctor/types";

/** Parse "YYYY-MM-DD" as a local date (not UTC), so the day never shifts. */
export const parseDate = (iso: IsoDate) => {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** "14 Aug 2025" */
export const formatDate = (iso: IsoDate) =>
  parseDate(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
