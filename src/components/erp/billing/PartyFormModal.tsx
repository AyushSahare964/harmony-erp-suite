import { useState, useEffect } from "react";
import {
  X,
  Save,
  Building2,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
import { STATE_CODES } from "@/lib/finance/stateCodes";
import { saveSupplierFn } from "@/lib/mongodb/serverFns/masters";
import { createOwnerFn } from "@/lib/mongodb/serverFns/crm";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface PartyRow {
  _id?: string;
  partyId?: string;
  partyType?: "SUPPLIER" | "CLIENT" | "BOTH";
  displayName?: string;
  billingAddress?: string;
  city?: string;
  stateCode?: string;
  pin?: string;
  country?: string;
  email?: string;
  phone?: string;
  pan?: string;
  gstin?: string;
  openingBalance?: number;
  openingType?: "DR" | "CR";
  contactPerson?: string;
  mobile?: string;
  bankName?: string;
  bankAccount?: string;
  bankIfsc?: string;
  remark?: string;
}

interface PartyFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (party: PartyRow) => void;
  partyType?: "SUPPLIER" | "CLIENT" | "BOTH";
  initialData?: Partial<PartyRow> | null;
}

export function PartyFormModal({
  open,
  onClose,
  onSuccess,
  partyType = "SUPPLIER",
  initialData,
}: PartyFormModalProps) {
  const isSupplier = partyType === "SUPPLIER";
  const title = isSupplier ? "New Supplier Information" : "New Client Information";

  // Form State
  const [displayName, setDisplayName] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [city, setCity] = useState("Mumbai");
  const [stateCode, setStateCode] = useState("27"); // 27 = Maharashtra default
  const [pin, setPin] = useState("");
  const [country, setCountry] = useState("India");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Tax Details
  const [pan, setPan] = useState("");
  const [gstin, setGstin] = useState("");
  const [taxStateCode, setTaxStateCode] = useState("27");

  // Account Details
  const [openingBalance, setOpeningBalance] = useState<number | "">("");
  const [openingType, setOpeningType] = useState<"DR" | "CR">("DR");

  // Contact Details
  const [contactPerson, setContactPerson] = useState("");
  const [mobile, setMobile] = useState("");

  // Bank Details
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");

  // Other Details
  const [remark, setRemark] = useState("");

  // Status
  const [isSaved, setIsSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (initialData) {
        setDisplayName(initialData.displayName || "");
        setBillingAddress(initialData.billingAddress || "");
        setCity(initialData.city || "Mumbai");
        setStateCode(initialData.stateCode || "27");
        setPin(initialData.pin || "");
        setCountry(initialData.country || "India");
        setEmail(initialData.email || "");
        setPhone(initialData.phone || "");
        setPan(initialData.pan || "");
        setGstin(initialData.gstin || "");
        setTaxStateCode(initialData.stateCode || "27");
        setOpeningBalance(initialData.openingBalance || "");
        setOpeningType(initialData.openingType || "DR");
        setContactPerson(initialData.contactPerson || "");
        setMobile(initialData.mobile || "");
        setBankName(initialData.bankName || "");
        setBankAccount(initialData.bankAccount || "");
        setBankIfsc(initialData.bankIfsc || "");
        setRemark(initialData.remark || "");
        setIsSaved(true);
      } else {
        // Reset defaults
        setDisplayName("");
        setBillingAddress("");
        setCity("Mumbai");
        setStateCode("27");
        setPin("");
        setCountry("India");
        setEmail("");
        setPhone("");
        setPan("");
        setGstin("");
        setTaxStateCode("27");
        setOpeningBalance("");
        setOpeningType("DR");
        setContactPerson("");
        setMobile("");
        setBankName("");
        setBankAccount("");
        setBankIfsc("");
        setRemark("");
        setIsSaved(false);
      }
    }
  }, [open, initialData]);

  // Sync stateCode to taxStateCode
  const handleStateChange = (val: string) => {
    setStateCode(val);
    setTaxStateCode(val);
  };

  const handleGstinChange = (val: string) => {
    const upper = val.toUpperCase().trim();
    setGstin(upper);
    if (upper.length >= 2) {
      const st = upper.substring(0, 2);
      if (STATE_CODES.some((s) => s.code === st)) {
        setStateCode(st);
        setTaxStateCode(st);
      }
    }
    if (upper.length >= 12) {
      const derivedPan = upper.substring(2, 12);
      if (/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(derivedPan)) {
        setPan(derivedPan);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error(isSupplier ? "Company Name is required" : "Client Name is required");
      return;
    }
    if (!mobile.trim() || mobile.trim().length < 10) {
      toast.error("Valid 10-digit mobile number is required");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        partyId: initialData?.partyId,
        partyType,
        displayName: displayName.trim(),
        billingAddress: billingAddress.trim(),
        city: city.trim(),
        stateCode,
        pin: pin.trim(),
        country,
        email: email.trim(),
        phone: phone.trim(),
        pan: pan.trim().toUpperCase(),
        gstin: gstin.trim().toUpperCase(),
        openingBalance: Number(openingBalance) || 0,
        openingType,
        contactPerson: contactPerson.trim(),
        mobile: mobile.trim(),
        bankName: bankName.trim(),
        bankAccount: bankAccount.trim(),
        bankIfsc: bankIfsc.trim().toUpperCase(),
        remark: remark.trim(),
        isActive: true,
      };

      if (isSupplier) {
        await saveSupplierFn({
          data: {
            _id: initialData?._id,
            name: displayName.trim(),
            contactPerson: contactPerson.trim() || undefined,
            phone: mobile.trim(),
            email: email.trim() || undefined,
            gstin: gstin.trim().toUpperCase() || undefined,
            address: billingAddress.trim() || undefined,
            creditDays: 30,
            openingBalance: Number(openingBalance) || 0,
            openingBalanceType: openingType === "CR" ? "Cr" : "Dr",
            isActive: true,
          },
        });
      } else {
        await createOwnerFn({
          data: {
            name: displayName.trim(),
            phone: mobile.trim(),
            email: email.trim() || undefined,
            address: billingAddress.trim() || undefined,
            city: city.trim() || "Mumbai",
            notes: remark.trim() || undefined,
            outstandingBalance: Number(openingBalance) || 0,
          },
        });
      }

      toast.success(`${isSupplier ? "Supplier" : "Client"} saved successfully!`);
      setIsSaved(true);
      onSuccess?.(payload as any);
      onClose();
    } catch (err: any) {
      console.error("[PartyFormModal] Save failed:", err);
      toast.error(err.message || "Failed to save information");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden border-border bg-card shadow-2xl rounded-2xl">
        {/* Modal Window Header */}
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Building2 className="size-4" />
            </div>
            <h2 className="text-sm font-bold text-foreground tracking-tight">{title}</h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Account Status:</span>
              <span
                className={cn(
                  "font-bold uppercase tracking-wider text-[11px]",
                  isSaved ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 font-black animate-pulse"
                )}
              >
                {isSaved ? "SAVED" : "UNSAVED"}
              </span>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Tab Strip */}
        <div className="border-b border-border bg-muted/20 px-6 pt-2">
          <div className="inline-flex border-b-2 border-primary pb-2 text-xs font-bold text-primary">
            Profile
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Column: Supplier Details & Bank Details */}
            <div className="space-y-4">
              {/* Groupbox: Supplier / Client Details */}
              <fieldset className="rounded-xl border border-border bg-card/60 p-4 space-y-3 relative">
                <legend className="px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {isSupplier ? "Supplier Details" : "Client Details"}
                </legend>

                {/* Company Name */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-foreground">
                    {isSupplier ? "Company Name *" : "Full Name *"}
                  </Label>
                  <Input
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={isSupplier ? "e.g. Marvel Vet Pharmaceuticals" : "e.g. Rajesh Patil"}
                    className="h-8 text-xs bg-background"
                  />
                </div>

                {/* Address */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-foreground">Address</Label>
                  <Textarea
                    rows={2}
                    value={billingAddress}
                    onChange={(e) => setBillingAddress(e.target.value)}
                    placeholder="Street, locality, area..."
                    className="text-xs bg-background min-h-[58px]"
                  />
                </div>

                {/* City & State */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-foreground">City *</Label>
                    <Input
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Mumbai"
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-foreground">State *</Label>
                    <Select value={stateCode} onValueChange={handleStateChange}>
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {STATE_CODES.map((s) => (
                          <SelectItem key={s.code} value={s.code}>
                            {s.name} ({s.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Pin Code & Country */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-foreground">Pin Code</Label>
                    <Input
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      placeholder="400001"
                      className="h-8 text-xs font-mono bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-foreground">Country</Label>
                    <Input
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                </div>

                {/* Email & Phone */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-foreground">Email</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="accounts@marvelvet.com"
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-foreground">Phone No</Label>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="022-28765432"
                      className="h-8 text-xs font-mono bg-background"
                    />
                  </div>
                </div>
              </fieldset>

              {/* Groupbox: Bank Details */}
              <fieldset className="rounded-xl border border-border bg-card/60 p-4 space-y-3 relative">
                <legend className="px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Bank Details
                </legend>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-foreground">Bank Name</Label>
                  <Input
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. HDFC Bank Ltd"
                    className="h-8 text-xs bg-background"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-foreground">Bank A/c No.</Label>
                    <Input
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      placeholder="50200012345678"
                      className="h-8 text-xs font-mono bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-foreground">IFSC Code</Label>
                    <Input
                      value={bankIfsc}
                      onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                      placeholder="HDFC0000123"
                      className="h-8 text-xs font-mono bg-background"
                    />
                  </div>
                </div>
              </fieldset>
            </div>

            {/* Right Column: Tax Details, Account Details, Contact Details, Other Details */}
            <div className="space-y-4">
              {/* Groupbox: Tax Details */}
              <fieldset className="rounded-xl border border-border bg-card/60 p-4 space-y-3 relative">
                <legend className="px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Tax Details
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-foreground">PAN No.</Label>
                    <Input
                      value={pan}
                      onChange={(e) => setPan(e.target.value.toUpperCase())}
                      placeholder="ABCDE1234F"
                      className="h-8 text-xs font-mono bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-foreground">GSTIN</Label>
                    <Input
                      value={gstin}
                      onChange={(e) => handleGstinChange(e.target.value)}
                      placeholder="27ABCDE1234F1Z5"
                      className="h-8 text-xs font-mono bg-background"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-foreground">State *</Label>
                  <Select value={taxStateCode} onValueChange={handleStateChange}>
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {STATE_CODES.map((s) => (
                        <SelectItem key={s.code} value={s.code}>
                          {s.name} ({s.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </fieldset>

              {/* Groupbox: Account Details */}
              <fieldset className="rounded-xl border border-border bg-card/60 p-4 space-y-3 relative">
                <legend className="px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Account Details
                </legend>
                <div className="flex items-center gap-3">
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs font-medium text-foreground">Opening Balance</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                        Rs.
                      </span>
                      <Input
                        type="number"
                        step="any"
                        value={openingBalance}
                        onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || "")}
                        placeholder="0.00"
                        className="h-8 pl-10 text-xs font-mono bg-background"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-foreground">Type</Label>
                    <div className="flex items-center gap-3 h-8">
                      <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                        <input
                          type="radio"
                          name="openingType"
                          checked={openingType === "DR"}
                          onChange={() => setOpeningType("DR")}
                          className="size-3.5 text-primary"
                        />
                        <span>Debit</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                        <input
                          type="radio"
                          name="openingType"
                          checked={openingType === "CR"}
                          onChange={() => setOpeningType("CR")}
                          className="size-3.5 text-primary"
                        />
                        <span>Credit</span>
                      </label>
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* Groupbox: Contact Details */}
              <fieldset className="rounded-xl border border-border bg-card/60 p-4 space-y-3 relative">
                <legend className="px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Contact Details
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-foreground">Contact Person</Label>
                    <Input
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      placeholder="e.g. Amit Sharma"
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-foreground">Mobile No. *</Label>
                    <Input
                      required
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="9820012345"
                      className="h-8 text-xs font-mono bg-background"
                    />
                  </div>
                </div>
              </fieldset>

              {/* Groupbox: Other Details */}
              <fieldset className="rounded-xl border border-border bg-card/60 p-4 space-y-2 relative">
                <legend className="px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Other Details
                </legend>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-foreground">Remark / Note</Label>
                  <Textarea
                    rows={2}
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder="Credit period 30 days, special discounts..."
                    className="text-xs bg-background min-h-[50px]"
                  />
                </div>
              </fieldset>
            </div>
          </div>

          {/* Footer Bar */}
          <div className="flex items-center justify-between border-t border-border pt-3">
            <button
              type="button"
              onClick={() => {
                if (gstin) {
                  window.open(`https://services.gst.gov.in/services/searchtp?gstin=${gstin}`, "_blank");
                } else {
                  toast.info("Enter a GSTIN to verify status on GST Portal");
                }
              }}
              className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
            >
              <span>Check GSTIN/UIN Status</span>
              <ExternalLink className="size-3" />
            </button>

            <Button
              type="submit"
              disabled={submitting}
              className="h-9 px-6 text-xs font-bold gap-1.5 shadow-md bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Save className="size-4" />
              <span>{submitting ? "Saving..." : "Save"}</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
