import { filterByCatalogueType } from "../CatalogueSearch";

// Mixed catalogue fixtures representing realistic ERP records
const MIXED_CATALOGUE = [
  { itemCode: "M-0001", name: "Amoxicillin 250mg", productType: "MEDICINE", category: "Medicine" },
  { itemCode: "M-0002", name: "Rabies Vaccine 1ml", productType: "MEDICINE", category: "Vaccine" },
  { itemCode: "M-0003", name: "Dexamethasone 4mg", productType: "MEDICINE", category: "Medicine" },
  { itemCode: "F-0001", name: "Royal Canin Maxi 4kg", productType: "FOOD", category: "Food" },
  { itemCode: "F-0002", name: "Pedigree Adult Chicken 3kg", productType: "FOOD", category: "Animal Food" },
  { itemCode: "A-0001", name: "Tick & Flea Collar (L)", productType: "ACCESSORY", category: "Accessory" },
  { itemCode: "A-0002", name: "Nylon Training Leash 6ft", productType: "ACCESSORY", category: "Animal Accessories" },
];

export function runCatalogueAssertions(): { success: boolean; errors: string[] } {
  const errors: string[] = [];

  // Context 1: Medicine Catalogue Search
  const medResults = filterByCatalogueType(MIXED_CATALOGUE, "medicine");
  const hasNonMedInMedicine = medResults.some(
    (item) => item.productType === "FOOD" || item.productType === "ACCESSORY" || item.category === "Food" || item.category === "Accessory"
  );
  if (hasNonMedInMedicine) {
    errors.push("Medicine filter leaked Food or Accessory items into medicine results!");
  }
  if (medResults.length !== 3) {
    errors.push(`Expected 3 medicine items, got ${medResults.length}`);
  }

  // Context 2: Food Catalogue Search
  const foodResults = filterByCatalogueType(MIXED_CATALOGUE, "food");
  const hasNonFoodInFood = foodResults.some(
    (item) => item.productType === "MEDICINE" || item.productType === "ACCESSORY" || item.category === "Medicine" || item.category === "Accessory"
  );
  if (hasNonFoodInFood) {
    errors.push("Food filter leaked Medicine or Accessory items into food results!");
  }
  if (foodResults.length !== 2) {
    errors.push(`Expected 2 food items, got ${foodResults.length}`);
  }

  // Context 3: Accessories Catalogue Search
  const accResults = filterByCatalogueType(MIXED_CATALOGUE, "accessory");
  const hasNonAccInAcc = accResults.some(
    (item) => item.productType === "MEDICINE" || item.productType === "FOOD" || item.category === "Medicine" || item.category === "Food"
  );
  if (hasNonAccInAcc) {
    errors.push("Accessory filter leaked Medicine or Food items into accessory results!");
  }
  if (accResults.length !== 2) {
    errors.push(`Expected 2 accessory items, got ${accResults.length}`);
  }

  return { success: errors.length === 0, errors };
}
