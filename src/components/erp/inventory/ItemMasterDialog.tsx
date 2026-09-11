/**
 * ItemMasterDialog
 * Backward compatible wrapper delegating to ProductMasterWizardDialog
 */

import { ProductMasterWizardDialog } from "./ProductMasterWizardDialog";
import type { Medicine, MedicineCategory, ProductType } from "./useInventoryStore";

export function ItemMasterDialog({
  open,
  onClose,
  editing,
  defaultCategory,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Medicine | undefined;
  defaultCategory?: MedicineCategory | undefined;
}) {
  const resolvedType: ProductType =
    editing?.productType ||
    (defaultCategory === "Food" || defaultCategory === "Animal Food"
      ? "FOOD"
      : defaultCategory === "Accessory" || defaultCategory === "Animal Accessories"
      ? "ACCESSORY"
      : "MEDICINE");

  return (
    <ProductMasterWizardDialog
      open={open}
      onClose={onClose}
      editing={editing}
      defaultProductType={resolvedType}
    />
  );
}
