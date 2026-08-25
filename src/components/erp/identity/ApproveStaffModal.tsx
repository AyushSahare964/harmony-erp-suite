import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ShieldCheck,
  User,
  Mail,
  Building2,
  Stethoscope,
  Sparkles,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AuthService } from "@/lib/erp/auth";
import type { RoleId } from "@/lib/erp/config";

interface Props {
  open: boolean;
  staff: any | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function ApproveStaffModal({ open, staff, onClose, onUpdated }: Props) {
  const [loading, setLoading] = useState(false);
  const [roleId, setRoleId] = useState<RoleId>(staff?.roleId || "doctor");
  const [department, setDepartment] = useState(staff?.department || "Clinical OPD & Surgery");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  if (!open || !staff) return null;

  const handleApprove = async () => {
    setLoading(true);
    try {
      const res = await AuthService.approveStaff({
        userId: staff.id,
        roleId,
        department,
      });
      if (res.success) {
        toast.success(res.message);
        onUpdated();
        onClose();
      } else {
        toast.error(res.message || "Failed to approve staff.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error approving registration.");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      const res = await AuthService.rejectStaff({
        userId: staff.id,
        reason: rejectReason || "Registration declined by administrator.",
      });
      if (res.success) {
        toast.success("Staff application declined.");
        onUpdated();
        onClose();
      } else {
        toast.error("Failed to reject application.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error rejecting registration.");
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
          className="relative w-full max-w-lg rounded-2xl bg-white border border-border shadow-2xl overflow-hidden dark:bg-slate-900"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-slate-50/80 px-6 py-4 dark:bg-slate-800/60">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-navy dark:text-white flex items-center gap-2">
                  Review & Authorize Staff Access
                </h2>
                <p className="text-xs text-muted-foreground">
                  Verify applicant identity and assign ERP permission scope.
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

          <div className="p-6 space-y-4">
            {/* Applicant Summary Card */}
            <div className="bg-slate-50 dark:bg-slate-800/80 border border-border rounded-xl p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-navy dark:text-white">{staff.fullName}</span>
                <span className="font-mono text-muted-foreground">{staff.email}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-muted-foreground pt-1 border-t border-border/60">
                <div>
                  <span>Phone: </span>
                  <span className="font-semibold text-foreground">{staff.phone || "—"}</span>
                </div>
                <div>
                  <span>Registration/License: </span>
                  <span className="font-semibold text-emerald-600 font-mono">{staff.licenseNumber || "—"}</span>
                </div>
                <div>
                  <span>Qualification: </span>
                  <span className="font-semibold text-foreground">{staff.qualification || "—"}</span>
                </div>
                <div>
                  <span>Specialty: </span>
                  <span className="font-semibold text-foreground">{staff.specialty || "General Practice"}</span>
                </div>
              </div>
            </div>

            {!showRejectForm ? (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Assigned ERP Role & Access Scope *
                    </label>
                    <select
                      value={roleId}
                      onChange={(e) => setRoleId(e.target.value as RoleId)}
                      className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary font-medium"
                    >
                      <option value="doctor">🩺 Doctor / Senior Vet (Clinical OPD & Surgery)</option>
                      <option value="admin">🛡️ Clinic Administrator (Full Control)</option>
                      <option value="reception">📋 Reception & Front Desk (Admittance & Triage)</option>
                      <option value="accounts">💳 Accounts & Billing Manager (Finance & Invoices)</option>
                      <option value="platform">⚡ Platform Systems Administrator</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Department Assignment
                    </label>
                    <Input
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="Clinical OPD & Surgery"
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-4 mt-6">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowRejectForm(true)}
                    className="text-xs text-destructive hover:bg-destructive/10"
                  >
                    <XCircle className="size-3.5 mr-1.5" /> Decline Request
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" onClick={onClose} className="h-9 text-xs">
                      Cancel
                    </Button>
                    <Button
                      onClick={handleApprove}
                      disabled={loading}
                      className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 shadow-sm"
                    >
                      <CheckCircle2 className="size-3.5 mr-1.5" />
                      {loading ? "Authorizing..." : "Approve & Grant ERP Access"}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              /* Rejection Reason Form */
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-xs font-semibold text-destructive block mb-1">
                    Decline Reason (Visible to applicant)
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g. License verification incomplete, please contact hospital HR."
                    rows={3}
                    className="w-full rounded-lg border border-destructive/40 bg-background p-2.5 text-xs outline-none focus:border-destructive"
                  />
                </div>

                <div className="flex items-center justify-between border-t border-border pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowRejectForm(false)}
                    className="text-xs text-muted-foreground"
                  >
                    Back to Approval
                  </Button>

                  <Button
                    onClick={handleReject}
                    disabled={loading}
                    className="h-9 bg-destructive hover:bg-destructive/90 text-white font-bold text-xs px-5 shadow-sm"
                  >
                    {loading ? "Declining..." : "Confirm Decline"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
