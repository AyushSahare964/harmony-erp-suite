/**
 * Real Care Animals Clinical Complex — Centralized Clinic Configuration
 * Update this file to change clinic branding across the entire system.
 */

export const CLINIC_CONFIG = {
  /** Short name shown in sidebar / mobile header */
  shortName: "Real Care Clinic",
  /** Full name shown in invoices and prescriptions */
  fullName: "REAL CARE SMALL ANIMAL CLINIC",
  /** Sub-brand (second entity on letterhead) */
  subName: "Real Care Animals Clinical Complex",
  /** Primary doctor */
  doctorName: "Dr. Makarand M. Dixit",
  /** Doctor qualifications */
  doctorQualifications: "B.V.Sc & AH, M.V.Sc, PGDAW (M.S.V.C.-8648)",
  /** Doctor designation */
  doctorDesignation: "Chief Veterinary Physician & Surgeon",
  /** Address line 1 */
  addressLine1: "Real Care Small Animal Clinic",
  /** Address line 2 */
  addressLine2: "Nagpur, Maharashtra",
  /** Phone number */
  phone: "+91 87674 84342",
  /** Website */
  website: "www.petsdmart.com",
  /** Email */
  email: "care@realcareclinic.com",
  /** GSTIN (if applicable) */
  gstin: "",
  /** Registration number */
  regNo: "",
  /** Path to the clinic logo — served from /public */
  logoPath: "/clinic-logo.png",
  /** Tagline */
  tagline: "An Animal's Eyes Have The Power to Speak a Great Language",
  /** Sub-tagline */
  subTagline: "We Specialise in your Satisfaction",
} as const;
