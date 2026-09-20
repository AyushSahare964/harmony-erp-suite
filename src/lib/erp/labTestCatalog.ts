/**
 * Shared diagnostic test catalog — backed by MongoDB via the generic ErpRow
 * store (moduleId "lab_test_catalog"). Used by both the Test Master &
 * Profiles admin screen and the Create Lab Order modal so both share a
 * single source of truth: tests added/removed in one place show up in the
 * other immediately.
 */
import { getRowsFn, addRowFn, deleteRowFn } from "@/lib/mongodb/serverFns/rows";

export const LAB_TEST_CATALOG_MODULE = "lab_test_catalog";

export interface LabTestProfile {
  code: string;
  name: string;
  sample: string;
  dept: string;
  tat: string;
  price: number;
  urgentAvailable: boolean;
}

// Reference price list used to seed the catalog the first time it is read
// (i.e. when no test profiles have been persisted to MongoDB yet).
export const DEFAULT_TEST_CATALOG: LabTestProfile[] = [
  { code: "TST-CBC", name: "Complete Blood Count (CBC + Diff)", sample: "Blood (EDTA Purple)", dept: "Hematology", tat: "2 hrs", price: 750, urgentAvailable: true },
  { code: "TST-LFT", name: "Liver Function Panel (ALT, AST, ALP, Bili, Alb)", sample: "Serum (SST Yellow)", dept: "Biochemistry", tat: "4 hrs", price: 1200, urgentAvailable: true },
  { code: "TST-KFT", name: "Kidney Function Panel (BUN, Creatinine, Phos)", sample: "Serum (SST Yellow)", dept: "Biochemistry", tat: "3 hrs", price: 950, urgentAvailable: true },
  { code: "TST-ELISA-PARVO", name: "Canine Parvovirus Antigen ELISA Snap", sample: "Fecal Swab", dept: "Serology", tat: "30 min", price: 850, urgentAvailable: true },
  { code: "TST-URINE", name: "Urinalysis + Microscopic Sediment", sample: "Urine (Sterile Cup)", dept: "Clinical Pathology", tat: "2 hrs", price: 500, urgentAvailable: false },
  { code: "TST-SKIN-CYTO", name: "Skin Scraping Cytology & Tape Impression", sample: "Skin / Exudate", dept: "Microbiology", tat: "3 hrs", price: 650, urgentAvailable: false },
  { code: "TST-THYROID", name: "Total Thyroxine (T4) Immunoassay", sample: "Serum (Plain Red)", dept: "Endocrinology", tat: "6 hrs", price: 1400, urgentAvailable: false },
  { code: "TST-ELECTRO", name: "Electrolytes Panel (Na+, K+, Cl-, iCa)", sample: "Whole Blood (Heparin Green)", dept: "Critical Care", tat: "45 min", price: 800, urgentAvailable: true },
  { code: "TST-FE-SNAP", name: "Feline Triple Snap (FeLV / FIV / Heartworm)", sample: "Whole Blood / Serum", dept: "Serology", tat: "20 min", price: 1650, urgentAvailable: true },
  { code: "TST-LIPASE-CPL", name: "Canine Pancreatic Lipase (cPL) Rapid", sample: "Serum", dept: "Gastroenterology", tat: "25 min", price: 1250, urgentAvailable: true },
  { code: "TST-CORTISOL", name: "Basal Serum Cortisol (RIA / ECLIA)", sample: "Serum (Red Plain)", dept: "Endocrinology", tat: "24 hrs", price: 1800, urgentAvailable: false },
  { code: "TST-BLOOD-GAS", name: "Venous Blood Gas & Acid-Base (i-STAT)", sample: "Heparin Blood", dept: "Critical Care", tat: "15 min", price: 1100, urgentAvailable: true },
  { code: "TST-HISTO-BX", name: "Histopathology Biopsy (Small / Medium Specimen)", sample: "Tissue in 10% Formalin", dept: "Anatomic Pathology", tat: "5-7 days", price: 2800, urgentAvailable: false },
  { code: "TST-CSF-CYTO", name: "CSF Fluid Analysis & Total Protein", sample: "Cerebrospinal Fluid", dept: "Neurology", tat: "4 hrs", price: 1950, urgentAvailable: true },
];

export async function loadTestCatalog(): Promise<LabTestProfile[]> {
  const rows = await getRowsFn({ data: { moduleId: LAB_TEST_CATALOG_MODULE } });
  if (rows && rows.length > 0) return rows as unknown as LabTestProfile[];

  // First-time seed: persist the reference price list so it can be edited
  // (added to / deleted from) from here on.
  try {
    await Promise.all(
      DEFAULT_TEST_CATALOG.map((t) => addRowFn({ data: { moduleId: LAB_TEST_CATALOG_MODULE, row: t } }))
    );
    const seeded = await getRowsFn({ data: { moduleId: LAB_TEST_CATALOG_MODULE } });
    if (seeded && seeded.length > 0) return seeded as unknown as LabTestProfile[];
  } catch (e) {
    console.warn("[labTestCatalog] Could not seed default test catalog:", e);
  }
  return DEFAULT_TEST_CATALOG;
}

export async function addTestToCatalog(test: LabTestProfile) {
  return addRowFn({ data: { moduleId: LAB_TEST_CATALOG_MODULE, row: test } });
}

export async function deleteTestFromCatalog(index: number) {
  return deleteRowFn({ data: { moduleId: LAB_TEST_CATALOG_MODULE, index } });
}
