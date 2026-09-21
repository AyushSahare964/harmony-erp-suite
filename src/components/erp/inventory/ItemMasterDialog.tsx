/**
 * ItemMasterDialog
 * Backward compatible wrapper delegating to ProductMasterWizardDialog
 */

import { ProductMasterWizardDialog } from "./ProductMasterWizardDialog";
import { resolveProductType, type Medicine, type MedicineCategory } from "./useInventoryStore";

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
  const resolvedType = resolveProductType(defaultCategory, editing?.productType);

  return (
    <ProductMasterWizardDialog
      open={open}
      onClose={onClose}
      editing={editing}
      defaultProductType={resolvedType}
    />
  );
}
