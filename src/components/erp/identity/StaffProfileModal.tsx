import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  User,
  Mail,
  Phone,
  Building2,
  Shield,
  Stethoscope,
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  Save,
  AlertTriangle,
  FileBadge,
  Calendar,
  Key,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AuthService } from "@/lib/erp/auth";
import type { RoleId } from "@/lib/erp/config";

interface Props {
  open: boolean;
  staff: any | null;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted?: () => void;
}

export function StaffProfileModal({ open, staff, onClose, onUpdated, onDeleted }: Props) {
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form State
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roleId, setRoleId] = useState<RoleId>("doctor");
  const [department, setDepartment] = useState("Clinical OPD & Surgery");
  const [specialty, setSpecialty] = useState<any>("General Practice");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [qualification, setQualification] = useState("");
  const [clinicName, setClinicName] = useState("VetCare Specialty Pet Hospital");
  const [branch, setBranch] = useState("Central Avenue, Nagpur");
  const [approvalStatus, setApprovalStatus] = useState<"approved" | "pending" | "rejected">("approved");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (staff) {
      setFullName(staff.fullName || "");
      setEmail(staff.email || "");
      setPhone(staff.phone || "");
      setRoleId(staff.roleId || "doctor");
      setDepartment(staff.department || "Clinical OPD & Surgery");
      setSpecialty(staff.specialty || "General Practice");
      setLicenseNumber(staff.licenseNumber || "");
      setQualification(staff.qualification || "");
      setClinicName(staff.clinicName || "VetCare Specialty Pet Hospital");
      setBranch(staff.branch || "Central Avenue, Nagpur");
      setApprovalStatus(staff.approvalStatus || "approved");
      setIsActive(staff.isActive !== undefined ? staff.isActive : true);
      setShowDeleteConfirm(false);
    }
  }, [staff]);

  if (!open || !staff) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      toast.error("Staff name and email are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await AuthService.updateStaff({
        userId: staff.id,
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        roleId,
        department: department.trim(),
        specialty,
        licenseNumber: licenseNumber.trim(),
        qualification: qualification.trim(),
        clinicName: clinicName.trim(),
        branch: branch.trim(),
        approvalStatus,
        isActive,
      });

      if (res.success) {
        toast.success(res.message || "Profile updated successfully!");
        onUpdated();
        onClose();
      } else {
        toast.error(res.message || "Failed to update staff profile.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error updating staff profile in database.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      const res = await AuthService.deleteStaff({ userId: staff.id });
      if (res.success) {
        toast.success(res.message || "Staff member removed from database.");
        if (onDeleted) onDeleted();
        onUpdated();
        onClose();
      } else {
        toast.error(res.message || "Failed to delete staff member.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error deleting staff member from database.");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-navy/60 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-white border border-border shadow-2xl overflow-hidden dark:bg-slate-900 my-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-slate-50/90 px-6 py-4 dark:bg-slate-800/80 shrink-0">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm">
                {staff.initials || "ST"}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-navy dark:text-white">
                    {staff.fullName}
                  </h2>
                  {approvalStatus === "approved" && (
                    <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1">
                      <CheckCircle2 className="size-3" /> Active
                    </Badge>
                  )}
                  {approvalStatus === "pending" && (
                    <Badge className="bg-amber-500/15 text-amber-800 border-amber-500/30 text-[10px] font-semibold flex items-center gap-1">
                      <Clock className="size-3" /> Pending Review
                    </Badge>
                  )}
                  {approvalStatus === "rejected" && (
                    <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px] font-semibold flex items-center gap-1">
                      <XCircle className="size-3" /> Declined
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  ID: {staff.id} · {staff.roleName || staff.roleId}
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

          {/* Form Body - Scrollable */}
          <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs scrollbar-thin">
            {/* Personal Details */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-navy uppercase tracking-wider dark:text-white flex items-center gap-1.5 border-b border-border pb-1.5">
                <User className="size-3.5 text-primary" /> Personal & Contact Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-foreground block mb-1">
                    Full Name *
                  </label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Dr. Sanskruti Ruyarkar"
                    className="h-9 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-foreground block mb-1">
                    Email Address *
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. sanskruti@example.com"
                    className="h-9 text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-foreground block mb-1">
                    Contact Phone
                  </label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98222 33445"
                    className="h-9 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-foreground block mb-1">
                    Branch / Facility
                  </label>
                  <Input
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="Central Avenue, Nagpur"
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Role & Access Scope */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-navy uppercase tracking-wider dark:text-white flex items-center gap-1.5 border-b border-border pb-1.5">
                <Shield className="size-3.5 text-primary" /> ERP Role & Department Scope
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-foreground block mb-1">
                    Assigned ERP Role *
                  </label>
                  <select
                    value={roleId}
                    onChange={(e) => setRoleId(e.target.value as RoleId)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs outline-none focus:border-primary font-medium"
                  >
                    <option value="doctor">🩺 Doctor / Senior Vet</option>
                    <option value="admin">🛡️ Clinic Administrator</option>
                    <option value="reception">📋 Front Desk Receptionist</option>
                    <option value="accounts">💳 Accounts & Finance Manager</option>
                    <option value="platform">⚡ Platform Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-foreground block mb-1">
                    Hospital Department
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs outline-none focus:border-primary font-medium"
                  >
                    <option value="Clinical OPD & Surgery">Clinical OPD & Surgery</option>
                    <option value="Veterinary Administration">Veterinary Administration</option>
                    <option value="Patient Admittance & Triage">Patient Admittance & Triage</option>
                    <option value="Finance & Taxation">Finance & Taxation</option>
                    <option value="Clinical Care">Clinical Care</option>
                    <option value="Laboratory & Diagnostics">Laboratory & Diagnostics</option>
                    <option value="Boarding & Hydrotherapy">Boarding & Hydrotherapy</option>
                    <option value="General Operations">General Operations</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-foreground block mb-1">
                    Clinical Specialty
                  </label>
                  <select
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs outline-none focus:border-primary font-medium"
                  >
                    <option value="General Practice">General Practice</option>
                    <option value="Canine">Canine</option>
                    <option value="Feline">Feline</option>
                    <option value="Surgery">Surgery</option>
                    <option value="Avian">Avian</option>
                    <option value="Exotic">Exotic</option>
                    <option value="Administration">Administration</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Medical Credentials */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-navy uppercase tracking-wider dark:text-white flex items-center gap-1.5 border-b border-border pb-1.5">
                <Award className="size-3.5 text-primary" /> Credentials & Licensure
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-foreground block mb-1">
                    Registration / License Number
                  </label>
                  <Input
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    placeholder="e.g. VCI-MAH-2024-8842"
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-foreground block mb-1">
                    Qualifications & Degrees
                  </label>
                  <Input
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    placeholder="e.g. BVSc & AH, MVSc (Surgery)"
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Account Status & Authorization */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-navy uppercase tracking-wider dark:text-white flex items-center gap-1.5 border-b border-border pb-1.5">
                <Key className="size-3.5 text-primary" /> Account Authorization & Status
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-border">
                <div>
                  <label className="text-[11px] font-semibold text-foreground block mb-1">
                    Approval Status
                  </label>
                  <select
                    value={approvalStatus}
                    onChange={(e) => setApprovalStatus(e.target.value as any)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs outline-none focus:border-primary font-medium"
                  >
                    <option value="approved">🟢 Approved & Active</option>
                    <option value="pending">🟡 Pending Review</option>
                    <option value="rejected">🔴 Declined</option>
                  </select>
                </div>
                <div className="flex flex-col justify-center">
                  <label className="text-[11px] font-semibold text-foreground block mb-1">
                    Account Active State
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="checkbox"
                      id="isActiveToggle"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="size-4 rounded text-primary focus:ring-primary accent-primary"
                    />
                    <label htmlFor="isActiveToggle" className="text-xs text-foreground font-medium cursor-pointer">
                      Allow this staff member to log in to VetOS ERP
                    </label>
                  </div>
                </div>
              </div>
              {staff.createdAt && (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1">
                  <Calendar className="size-3" />
                  <span>Account Registered: {new Date(staff.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  {staff.approvedBy && <span>· Approved by: {staff.approvedBy}</span>}
                </div>
              )}
            </div>

            {/* Delete Confirmation Warning Box */}
            {showDeleteConfirm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 space-y-3"
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="size-4 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-destructive">
                      Permanently Delete Staff Member?
                    </h4>
                    <p className="text-[11px] text-destructive/90 mt-0.5">
                      This will remove <strong>{staff.fullName}</strong> ({staff.email}) from MongoDB Atlas and revoke all ERP system access. This action cannot be undone.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 justify-end pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="h-7 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={deleteLoading}
                    onClick={handleDelete}
                    className="h-7 text-xs font-bold shadow-xs"
                  >
                    {deleteLoading ? (
                      <>
                        <Clock className="size-3 mr-1 animate-spin" /> Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="size-3 mr-1" /> Confirm Permanent Delete
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Footer Action Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-border shrink-0">
              <div>
                {!showDeleteConfirm && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive font-semibold"
                  >
                    <Trash2 className="size-3.5 mr-1" /> Delete Staff Member
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={loading}
                  className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-xs"
                >
                  {loading ? (
                    <>
                      <Clock className="size-3.5 mr-1 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save className="size-3.5 mr-1" /> Save Changes to Database
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
