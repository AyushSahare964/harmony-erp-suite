import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  UserPlus,
  Mail,
  Lock,
  Phone,
  Shield,
  Building2,
  Award,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AuthService } from "@/lib/erp/auth";
import type { RoleId } from "@/lib/erp/config";

interface Props {
  open: boolean;
  onClose: () => void;
  onAdded: (employee: any) => void;
}

export function AddEmployeeModal({ open, onClose, onAdded }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "Password@123",
    phone: "",
    roleId: "doctor" as RoleId,
    department: "Clinical OPD & Surgery",
    specialty: "Canine" as any,
    licenseNumber: "",
    qualification: "",
    clinicName: "Harmony Pet Super-Specialty Hospital",
    branch: "Central Hospital · Koramangala",
  });

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim() || !form.email.trim() || !form.password) {
      toast.error("Please fill in employee name, email, and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await AuthService.createStaffMember(form);
      if (res.success) {
        toast.success(res.message);
        onAdded(res.user || form);
        onClose();
      } else {
        toast.error(res.message || "Failed to create staff member.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error creating staff record.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-xl rounded-2xl bg-white border border-border shadow-2xl overflow-hidden dark:bg-slate-900"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-slate-50/80 px-6 py-4 dark:bg-slate-800/60">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <UserPlus className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-navy dark:text-white flex items-center gap-2">
                  Add New Hospital Employee
                  <Sparkles className="size-3.5 text-primary" />
                </h2>
                <p className="text-xs text-muted-foreground">
                  Direct administrative creation with instant approved access.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Full Name *</label>
                <Input
                  required
                  placeholder="Dr. Rajesh Mehra"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Staff Work Email *</label>
                <Input
                  type="email"
                  required
                  placeholder="rajesh.mehra@vetos.cloud"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Initial Temporary Password *</label>
                <Input
                  type="password"
                  required
                  placeholder="Password@123"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Contact Phone</label>
                <Input
                  placeholder="+91 98000 12345"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Assigned Role *</label>
                <select
                  value={form.roleId}
                  onChange={(e) => {
                    const r = e.target.value as RoleId;
                    let dept = form.department;
                    if (r === "doctor") dept = "Clinical OPD & Surgery";
                    if (r === "admin") dept = "Veterinary Administration";
                    if (r === "reception") dept = "Patient Admittance & Triage";
                    if (r === "accounts") dept = "Finance & Taxation";
                    setForm({ ...form, roleId: r, department: dept });
                  }}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary font-medium"
                >
                  <option value="doctor">🩺 Doctor / Senior Vet (Clinical Practice)</option>
                  <option value="admin">🛡️ Clinic Administrator (Full Control)</option>
                  <option value="reception">📋 Receptionist & Triage Lead</option>
                  <option value="accounts">💳 Accounts & Billing Manager</option>
                  <option value="platform">⚡ Platform Systems Administrator</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Department</label>
                <Input
                  placeholder="Clinical OPD & Surgery"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">VCI / License Registration No.</label>
                <Input
                  placeholder="VCI-KAR-2024-9182"
                  value={form.licenseNumber}
                  onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Qualifications / Degrees</label>
                <Input
                  placeholder="BVSc & AH, MVSc (Orthopedics)"
                  value={form.qualification}
                  onChange={(e) => setForm({ ...form, qualification: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Specialty Focus</label>
                <select
                  value={form.specialty}
                  onChange={(e) => setForm({ ...form, specialty: e.target.value as any })}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary"
                >
                  <option value="Canine">Canine</option>
                  <option value="Feline">Feline</option>
                  <option value="Surgery">Surgery & Ortho</option>
                  <option value="Avian">Avian / Exotic</option>
                  <option value="General Practice">General Practice</option>
                  <option value="Administration">Administration</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Hospital Campus</label>
                <Input
                  disabled
                  value="Harmony Pet Super-Specialty Hospital"
                  className="h-9 text-xs bg-slate-50 text-muted-foreground"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 border-t border-border pt-4 mt-6">
              <Button type="button" variant="outline" onClick={onClose} className="h-9 text-xs">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs px-5 shadow-sm"
              >
                {loading ? "Creating Profile..." : "Create & Authorize Employee"}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
