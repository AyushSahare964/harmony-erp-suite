import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { ExpenseCategoryModel, seedExpenseCategories } from "@/lib/mongodb/models/ExpenseCategory";
import { PaymentAccountModel, seedPaymentAccounts } from "@/lib/mongodb/models/PaymentAccount";

// ─── Expense Categories ───────────────────────────────────────────────────────

export interface ExpenseCategoryRow {
  _id: string;
  name: string;
  nature: "BUSINESS" | "PERSONAL";
  sortOrder: number;
  isActive: boolean;
}

export const listExpenseCategoriesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ExpenseCategoryRow[]> => {
    await connectDB();
    await seedExpenseCategories();
    const docs = await ExpenseCategoryModel.find({ isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .lean();
    return docs.map((d) => ({
      _id: String(d._id),
      name: d.name,
      nature: d.nature,
      sortOrder: d.sortOrder,
      isActive: d.isActive,
    }));
  },
);

export const listAllExpenseCategoriesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ExpenseCategoryRow[]> => {
    await connectDB();
    await seedExpenseCategories();
    const docs = await ExpenseCategoryModel.find({}).sort({ sortOrder: 1, name: 1 }).lean();
    return docs.map((d) => ({
      _id: String(d._id),
      name: d.name,
      nature: d.nature,
      sortOrder: d.sortOrder,
      isActive: d.isActive,
    }));
  },
);

export const saveExpenseCategoryFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({
        _id: z.string().optional(),
        name: z.string().min(1).max(80),
        nature: z.enum(["BUSINESS", "PERSONAL"]).default("BUSINESS"),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    await connectDB();
    if (data._id) {
      const updateData: any = {
        name: data.name,
        nature: data.nature,
      };
      if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      await ExpenseCategoryModel.findByIdAndUpdate(data._id, updateData);
    } else {
      const createData: any = {
        name: data.name,
        nature: data.nature,
      };
      if (data.sortOrder !== undefined) createData.sortOrder = data.sortOrder;
      if (data.isActive !== undefined) createData.isActive = data.isActive;
      await ExpenseCategoryModel.create(createData);
    }
    return { ok: true };
  });

// ─── Payment Accounts ─────────────────────────────────────────────────────────

export interface PaymentAccountRow {
  _id: string;
  name: string;
  type: "CASH" | "BANK";
  isDefault: boolean;
  isActive: boolean;
}

export const listPaymentAccountsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<PaymentAccountRow[]> => {
    await connectDB();
    await seedPaymentAccounts();
    const docs = await PaymentAccountModel.find({ isActive: true })
      .sort({ type: 1, name: 1 })
      .lean();
    return docs.map((d) => ({
      _id: String(d._id),
      name: d.name,
      type: d.type,
      isDefault: d.isDefault,
      isActive: d.isActive,
    }));
  },
);

export const savePaymentAccountFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({
        _id: z.string().optional(),
        name: z.string().min(1).max(80),
        type: z.enum(["CASH", "BANK"]),
        isDefault: z.boolean().optional(),
        isActive: z.boolean().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    await connectDB();
    if (data.type === "BANK" && data.isDefault) {
      // Un-default all other bank accounts
      await PaymentAccountModel.updateMany({ type: "BANK" }, { isDefault: false });
    }
    const updateData: any = {
      name: data.name,
      type: data.type,
    };
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    if (data._id) {
      await PaymentAccountModel.findByIdAndUpdate(data._id, updateData);
    } else {
      await PaymentAccountModel.create(updateData);
    }
    return { ok: true };
  });

// ─── Suppliers Master ─────────────────────────────────────────────────────────

import { SupplierModel, seedSuppliers } from "@/lib/mongodb/models/Supplier";
import { syncPartyForSupplier } from "./parties";

export interface SupplierMasterRow {
  _id: string;
  name: string;
  contactPerson?: string | undefined;
  phone?: string | undefined;
  mobileNo?: string | undefined;
  email?: string | undefined;
  gstin?: string | undefined;
  panNo?: string | undefined;
  address?: string | undefined;
  city?: string | undefined;
  state?: string | undefined;
  pincode?: string | undefined;
  country?: string | undefined;
  bankName?: string | undefined;
  bankAccountNo?: string | undefined;
  ifscCode?: string | undefined;
  remarks?: string | undefined;
  creditDays: number;
  openingBalance: number;
  openingBalanceType: "Cr" | "Dr" | "Debit" | "Credit";
  isActive: boolean;
  createdAt?: string | undefined;
}

export const listSuppliersFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<SupplierMasterRow[]> => {
    await connectDB();
    await seedSuppliers();
    const docs = await SupplierModel.find({ isActive: { $ne: false } }).sort({ name: 1 }).lean();
    return docs.map((d: any) => ({
      _id: String(d._id),
      name: d.name,
      contactPerson: d.contactPerson || "",
      phone: d.phone || d.mobileNo || "",
      mobileNo: d.mobileNo || "",
      email: d.email || "",
      gstin: d.gstin || "",
      panNo: d.panNo || "",
      address: d.address || "",
      city: d.city || "",
      state: d.state || "",
      pincode: d.pincode || "",
      country: d.country || "India",
      bankName: d.bankName || "",
      bankAccountNo: d.bankAccountNo || "",
      ifscCode: d.ifscCode || "",
      remarks: d.remarks || "",
      creditDays: d.creditDays ?? 30,
      openingBalance: d.openingBalance ?? 0,
      openingBalanceType:
        d.openingBalanceType === "Debit" || d.openingBalanceType === "Dr" ? "Dr" : "Cr",
      isActive: d.isActive !== false,
      createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : undefined,
    }));
  },
);

export const deleteSupplierFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ id: z.string() }).parse(raw))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    await connectDB();
    await SupplierModel.findByIdAndUpdate(data.id, { isActive: false });
    return { ok: true };
  });

export const saveSupplierFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({
        _id: z.string().optional(),
        name: z.string().min(1).max(120),
        contactPerson: z.string().optional(),
        phone: z.string().optional(),
        mobileNo: z.string().optional(),
        email: z.string().optional(),
        gstin: z.string().optional(),
        panNo: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        pincode: z.string().optional(),
        country: z.string().optional(),
        bankName: z.string().optional(),
        bankAccountNo: z.string().optional(),
        ifscCode: z.string().optional(),
        remarks: z.string().optional(),
        creditDays: z.number().optional(),
        openingBalance: z.number().optional(),
        openingBalanceType: z.string().optional(),
        isActive: z.boolean().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; _id: string }> => {
    await connectDB();
    const updateData: any = {
      name: data.name,
    };
    if (data.contactPerson !== undefined) updateData.contactPerson = data.contactPerson;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.mobileNo !== undefined) updateData.mobileNo = data.mobileNo;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.gstin !== undefined) updateData.gstin = data.gstin;
    if (data.panNo !== undefined) updateData.panNo = data.panNo;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.state !== undefined) updateData.state = data.state;
    if (data.pincode !== undefined) updateData.pincode = data.pincode;
    if (data.country !== undefined) updateData.country = data.country;
    if (data.bankName !== undefined) updateData.bankName = data.bankName;
    if (data.bankAccountNo !== undefined) updateData.bankAccountNo = data.bankAccountNo;
    if (data.ifscCode !== undefined) updateData.ifscCode = data.ifscCode;
    if (data.remarks !== undefined) updateData.remarks = data.remarks;
    if (data.creditDays !== undefined) updateData.creditDays = data.creditDays;
    if (data.openingBalance !== undefined) updateData.openingBalance = data.openingBalance;
    if (data.openingBalanceType !== undefined)
      updateData.openingBalanceType = data.openingBalanceType;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    let supplierId: string;
    if (data._id) {
      await SupplierModel.findByIdAndUpdate(data._id, updateData);
      supplierId = data._id;
    } else {
      const doc = await SupplierModel.create(updateData);
      supplierId = String(doc._id);
    }

    // Keep the finance-side Party record in step — a new/edited supplier
    // otherwise has no ledger and is invisible to Payment Out allocation.
    await syncPartyForSupplier({ ...data, supplierRefId: supplierId }).catch((err) =>
      console.error("[Masters] syncPartyForSupplier failed for", supplierId, err),
    );

    return { ok: true, _id: supplierId };
  });
