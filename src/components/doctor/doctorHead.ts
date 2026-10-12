import doctorCss from "./doctor.css?url";
import recordsCss from "./doctor-records.css?url";

/** <head> links every page using the doctor layout needs: its scoped CSS and fonts. */
export const doctorHeadLinks = [
  { rel: "stylesheet", href: doctorCss },
  { rel: "stylesheet", href: recordsCss },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Figtree:wght@400;500;600&family=Fredoka:wght@600;700&display=swap",
  },
];

/** Roles that see the doctor home on "/". Other roles keep the clinic dashboard. */
export const DOCTOR_HOME_ROLES = new Set(["doctor", "admin", "platform"]);
