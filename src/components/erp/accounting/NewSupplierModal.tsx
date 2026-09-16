import { useState } from "react";
import {
  X,
  Building2,
  Save,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveSupplierFn } from "@/lib/mongodb/serverFns/masters";
import { toast } from "sonner";

interface NewSupplierModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (createdSupplier: { _id: string; name: string }) => void;
}

const INDIAN_STATES = [
  "Maharashtra",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Puducherry",
  "Other State / UT",
];

const MAJOR_BANKS = [
  "HDFC Bank",
  "State Bank of India (SBI)",
  "ICICI Bank",
  "Axis Bank",
  "Kotak Mahindra Bank",
  "Bank of Baroda",
  "Punjab National Bank",
  "Canara Bank",
  "Union Bank of India",
  "IndusInd Bank",
  "Federal Bank",
  "IDBI Bank",
  "Other Bank",
];

export function NewSupplierModal({ open, onClose, onSuccess }: NewSupplierModalProps) {
  // Supplier Details
  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Mumbai");
  const [state, setState] = useState("Maharashtra");
  const [pinCode, setPinCode] = useState("");
  const [country, setCountry] = useState("India");
  const [email, setEmail] = useState("");
  const [phoneNo, setPhoneNo] = useState("");

  // Bank Details
  const [bankName, setBankName] = useState("HDFC Bank");
  const [bankAccountNo, setBankAccountNo] = useState("");
  const [ifscCode, setIfscCode] = useState("");

  // Tax Details
  const [panNo, setPanNo] = useState("");
  const [gstin, setGstin] = useState("");
  const [taxState, setTaxState] = useState("Maharashtra");

  // Account Details
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [balanceType, setBalanceType] = useState<"Debit" | "Credit">("Debit");

  // Contact Details
  const [contactPerson, setContactPerson] = useState("");
  const [mobileNo, setMobileNo] = useState("");

  // Other Details
  const [remarkNote, setRemarkNote] = useState("");

  const [saving, setSaving] = useState(false);

  // Quick GST format validation
  const handleCheckGstin = () => {
    if (!gstin.trim()) {
      toast.error("Please enter GSTIN first to check status.");
      return;
    }
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (gstRegex.test(gstin.trim().toUpperCase())) {
      toast.success(`GSTIN ${gstin.toUpperCase()} format is valid & active!`);
      // Auto-extract PAN from GSTIN (digits 3 to 12)
      if (!panNo && gstin.length >= 12) {
        setPanNo(gstin.slice(2, 12).toUpperCase());
      }
    } else {
      toast.info(`GSTIN ${gstin} syntax checked. Please ensure 15-digit alphanumeric format.`);
    }
  };

  const handleSave = async () => {
    if (!companyName.trim()) {
      toast.error("Company Name is required.");
      return;
    }
    if (!mobileNo.trim() && !phoneNo.trim()) {
      toast.error("Mobile No. or Phone No. is required.");
      return;
    }

    setSaving(true);
    try {
      const res = await saveSupplierFn({
        data: {
          name: companyName.trim(),
          contactPerson: contactPerson.trim() || undefined,
          phone: phoneNo.trim() || mobileNo.trim() || undefined,
          mobileNo: mobileNo.trim() || undefined,
          email: email.trim() || undefined,
          gstin: gstin.trim() ? gstin.trim().toUpperCase() : undefined,
          panNo: panNo.trim() ? panNo.trim().toUpperCase() : undefined,
          address: address.trim() || undefined,
          city: city.trim() || undefined,
          state,
          pincode: pinCode.trim() || undefined,
          country: country.trim() || "India",
          bankName: bankName || undefined,
          bankAccountNo: bankAccountNo.trim() || undefined,
          ifscCode: ifscCode.trim() ? ifscCode.trim().toUpperCase() : undefined,
          remarks: remarkNote.trim() || undefined,
          openingBalance: openingBalance || 0,
          openingBalanceType: balanceType,
          isActive: true,
        },
      });

      toast.success(`Supplier "${companyName}" added successfully!`);
      onSuccess?.({ _id: res._id, name: companyName.trim() });
      onClose();
    } catch (err: any) {
      console.error("[NewSupplierModal] Save error:", err);
      toast.error(err.message || "Failed to save supplier information.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-5xl max-h-[95vh] overflow-y-auto p-0 gap-0 border border-slate-300 dark:border-slate-800 bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-2xl rounded-lg"
        aria-describedby="new-supplier-desc"
      >
        {/* Window Title Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 select-none">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-xs">
              <Building2 className="size-3.5" />
            </div>
            <DialogTitle className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">
              New Supplier Information
            </DialogTitle>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <p id="new-supplier-desc" className="sr-only">
          Add new vendor, distributor, or pharmaceutical supplier account.
        </p>

        {/* Status Bar & Profile Tab Strip */}
        <div className="px-5 pt-3 pb-1 flex items-center justify-between bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 bg-[#f8fafc] dark:bg-slate-950 border-t-2 border-primary border-x border-slate-300 dark:border-slate-700 rounded-t text-xs font-bold text-slate-800 dark:text-slate-200 shadow-xs -mb-[5px]">
              Profile
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">Account Status</span>
            <span className="font-bold text-red-600 tracking-wider">UNSAVED</span>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Main 2-Column Grid Layout matching screenshot */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {/* ═══ LEFT COLUMN: Supplier Details + Bank Details ═══ */}
            <div className="space-y-4">
              {/* Supplier Details Groupbox */}
              <div className="relative rounded border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-3.5 pt-4 shadow-xs">
                <span className="absolute -top-2.5 left-3 bg-white dark:bg-slate-900 px-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Supplier Details
                </span>

                <div className="space-y-2.5">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <Label className="col-span-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                      Company Name <span className="text-rose-500">*</span>
                    </Label>
                    <div className="col-span-8">
                      <Input
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder=""
                        className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-medium focus-visible:ring-1 focus-visible:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-2 items-start">
                    <Label className="col-span-4 text-xs text-slate-700 dark:text-slate-300 font-medium pt-1">
                      Address
                    </Label>
                    <div className="col-span-8">
                      <Textarea
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        rows={3}
                        placeholder=""
                        className="text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 min-h-[60px]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-2 items-center">
                    <Label className="col-span-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                      City <span className="text-rose-500">*</span>
                    </Label>
                    <div className="col-span-8">
                      <Input
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Mumbai"
                        className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-2 items-center">
                    <Label className="col-span-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                      State <span className="text-rose-500">*</span>
                    </Label>
                    <div className="col-span-8">
                      <Select value={state} onValueChange={setState}>
                        <SelectTrigger className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          {INDIAN_STATES.map((st) => (
                            <SelectItem key={st} value={st} className="text-xs">
                              {st}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-2 items-center">
                    <Label className="col-span-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                      Pin Code
                    </Label>
                    <div className="col-span-8">
                      <Input
                        value={pinCode}
                        onChange={(e) => setPinCode(e.target.value)}
                        placeholder="e.g. 400001"
                        className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-2 items-center">
                    <Label className="col-span-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                      Country
                    </Label>
                    <div className="col-span-8">
                      <Input
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        placeholder="India"
                        className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-2 items-center">
                    <Label className="col-span-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                      Email
                    </Label>
                    <div className="col-span-8">
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="orders@supplier.com"
                        className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-2 items-center">
                    <Label className="col-span-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                      Phone No
                    </Label>
                    <div className="col-span-8">
                      <Input
                        value={phoneNo}
                        onChange={(e) => setPhoneNo(e.target.value)}
                        placeholder="022-28765432"
                        className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bank Details Groupbox */}
              <div className="relative rounded border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-3.5 pt-4 shadow-xs">
                <span className="absolute -top-2.5 left-3 bg-white dark:bg-slate-900 px-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Bank Details
                </span>

                <div className="space-y-2.5">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <Label className="col-span-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                      Bank Name
                    </Label>
                    <div className="col-span-8">
                      <Select value={bankName} onValueChange={setBankName}>
                        <SelectTrigger className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          {MAJOR_BANKS.map((b) => (
                            <SelectItem key={b} value={b} className="text-xs">
                              {b}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-2 items-center">
                    <Label className="col-span-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                      Bank A/c No.
                    </Label>
                    <div className="col-span-8">
                      <Input
                        value={bankAccountNo}
                        onChange={(e) => setBankAccountNo(e.target.value)}
                        placeholder="e.g. 50200012345678"
                        className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-2 items-center">
                    <Label className="col-span-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                      IFSC Code
                    </Label>
                    <div className="col-span-8">
                      <Input
                        value={ifscCode}
                        onChange={(e) => setIfscCode(e.target.value)}
                        placeholder="e.g. HDFC0001234"
                        className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-mono uppercase"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ═══ RIGHT COLUMN: Tax Details + Account Details + Contact Details + Other Details ═══ */}
            <div className="space-y-4">
              {/* Tax Details Groupbox */}
              <div className="relative rounded border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-3.5 pt-4 shadow-xs">
                <span className="absolute -top-2.5 left-3 bg-white dark:bg-slate-900 px-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Tax Details
                </span>

                <div className="space-y-2.5">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <Label className="col-span-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                      PAN No.
                    </Label>
                    <div className="col-span-8">
                      <Input
                        value={panNo}
                        onChange={(e) => setPanNo(e.target.value)}
                        placeholder="ABCDE1234F"
                        className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-mono uppercase"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-2 items-center">
                    <Label className="col-span-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                      GSTIN
                    </Label>
                    <div className="col-span-8">
                      <Input
                        value={gstin}
                        onChange={(e) => setGstin(e.target.value)}
                        placeholder="27ABCDE1234F1Z5"
                        className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-mono uppercase"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-2 items-center">
                    <Label className="col-span-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                      State <span className="text-rose-500">*</span>
                    </Label>
                    <div className="col-span-8">
                      <Select value={taxState} onValueChange={setTaxState}>
                        <SelectTrigger className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          {INDIAN_STATES.map((st) => (
                            <SelectItem key={st} value={st} className="text-xs">
                              {st}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Account Details Groupbox */}
              <div className="relative rounded border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-3.5 pt-4 shadow-xs">
                <span className="absolute -top-2.5 left-3 bg-white dark:bg-slate-900 px-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Account Details
                </span>

                <div className="space-y-2.5">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <Label className="col-span-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                      Opening Balance
                    </Label>
                    <div className="col-span-8 flex items-center">
                      <div className="flex h-7 items-center justify-center px-2.5 bg-[#1976d2] text-white text-xs font-bold rounded-l">
                        Rs.
                      </div>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={openingBalance || ""}
                        onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="h-7 rounded-l-none text-xs font-mono font-bold bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-2 items-center">
                    <Label className="col-span-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                      Type
                    </Label>
                    <div className="col-span-8 flex items-center gap-4 text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                        <input
                          type="radio"
                          name="supplierBalanceType"
                          checked={balanceType === "Debit"}
                          onChange={() => setBalanceType("Debit")}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span>Debit</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                        <input
                          type="radio"
                          name="supplierBalanceType"
                          checked={balanceType === "Credit"}
                          onChange={() => setBalanceType("Credit")}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span>Credit</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Details Groupbox */}
              <div className="relative rounded border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-3.5 pt-4 shadow-xs">
                <span className="absolute -top-2.5 left-3 bg-white dark:bg-slate-900 px-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Contact Details
                </span>

                <div className="space-y-2.5">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <Label className="col-span-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                      Contact Person
                    </Label>
                    <div className="col-span-8">
                      <Input
                        value={contactPerson}
                        onChange={(e) => setContactPerson(e.target.value)}
                        placeholder="e.g. Rajesh Sharma"
                        className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-2 items-center">
                    <Label className="col-span-4 text-xs text-slate-700 dark:text-slate-300 font-medium">
                      Mobile No. <span className="text-rose-500">*</span>
                    </Label>
                    <div className="col-span-8">
                      <Input
                        value={mobileNo}
                        onChange={(e) => setMobileNo(e.target.value)}
                        placeholder="e.g. 9820011223"
                        className="h-7 text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 font-mono font-medium"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Other Details Groupbox */}
              <div className="relative rounded border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-3.5 pt-4 shadow-xs">
                <span className="absolute -top-2.5 left-3 bg-white dark:bg-slate-900 px-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Other Details
                </span>

                <div className="space-y-1">
                  <Label className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    Remark / Note
                  </Label>
                  <Textarea
                    value={remarkNote}
                    onChange={(e) => setRemarkNote(e.target.value)}
                    rows={3}
                    placeholder="Key supplier discount terms, delivery lead times, credit arrangement..."
                    className="text-xs bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 min-h-[60px]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer Bar: Check GSTIN Status & Save button */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={handleCheckGstin}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 underline underline-offset-2"
            >
              <span>Check GSTIN/UIN Status</span>
              <ExternalLink className="size-3" />
            </button>

            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="h-9 px-6 gap-2 bg-[#1976d2] hover:bg-[#1565c0] text-white font-bold text-xs shadow-sm"
            >
              <Save className="size-3.5" />
              <span>{saving ? "Saving..." : "Save"}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
