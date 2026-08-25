import { useState, useEffect } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Clock,
  ShieldAlert,
  Building2,
  Phone,
  Mail,
  User,
  CheckCircle2,
  RefreshCw,
  LogOut,
  Stethoscope,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AuthService, type UserProfile } from "@/lib/erp/auth";
import { useErp } from "@/lib/erp/store";

export const Route = createFileRoute("/pending-approval")({
  head: () => ({
    meta: [
      { title: "Registration Pending Approval — Harmony Pet Hospital" },
      {
        name: "description",
        content: "Staff account authorization preview and clinic approval status.",
      },
    ],
  }),
  component: PendingApprovalPage,
});

function PendingApprovalPage() {
  const navigate = useNavigate();
  const { login } = useErp();
  const [checking, setChecking] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string>("");
  const [userInfo, setUserInfo] = useState<UserProfile | null>(null);

  useEffect(() => {
    // Read pending user info from sessionStorage or localStorage
    try {
      const stored = sessionStorage.getItem("vetos.pending_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        setPendingEmail(parsed.email || "");
        setUserInfo(parsed);
      }
    } catch { /* ignore */ }
  }, []);

  const handleCheckStatus = async () => {
    if (!pendingEmail) {
      toast.info("No registered email found. Please login again.");
      navigate({ to: "/login" });
      return;
    }

    setChecking(true);
    try {
      const res = await AuthService.checkApprovalStatus(pendingEmail);
      if (res.found && res.user) {
        setUserInfo(res.user);
        if (res.status === "approved") {
          toast.success("🎉 Congratulations! Your staff account has been approved by the Clinic Administrator!");
          sessionStorage.removeItem("vetos.pending_user");
          navigate({ to: "/login" });
        } else if (res.status === "rejected") {
          toast.error("Your registration request was declined by the administrator.");
        } else {
          toast.info("Your application is still under review by the clinic administrator.");
        }
      } else {
        toast.error("Could not find your registration record.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to check approval status. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100/90 via-slate-50 to-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-900 relative overflow-hidden">
      {/* Background Decorative Rings */}
      <div className="absolute -top-40 -right-40 size-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 size-96 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-2xl bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/60 relative z-10"
      >
        {/* Clinic Branding Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-2xl bg-gradient-to-tr from-primary to-blue-600 flex items-center justify-center shadow-md shadow-primary/25">
              <Stethoscope className="size-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Harmony Pet Super-Specialty Hospital
                <Sparkles className="size-4 text-amber-500" />
              </h1>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <Building2 className="size-3.5" /> Koramangala Central Veterinary Campus
              </p>
            </div>
          </div>
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800 px-3 py-1 text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto">
            <Clock className="size-3.5 animate-spin text-amber-600" /> Pending Approval
          </Badge>
        </div>

        {/* Live Status Banner */}
        <div className="mt-6 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/80 p-4 sm:p-5 flex items-start gap-4">
          <div className="size-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldAlert className="size-5 text-amber-700" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-900">Registration Under Administrator Review</h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Your employee registration details have been securely stored in our hospital database. To maintain clinical compliance, access to the ERP is granted once verified by the <strong className="text-slate-800">Clinic Medical Director or System Administrator</strong>.
            </p>
          </div>
        </div>

        {/* Registered Staff Details */}
        <div className="mt-6 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Application Preview Details</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 text-xs">
            <div>
              <span className="text-slate-500 block">Applicant Name</span>
              <span className="font-semibold text-slate-900 text-sm mt-0.5 block">{userInfo?.fullName || "Registered Operator"}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Registered Email</span>
              <span className="font-semibold text-slate-900 text-sm mt-0.5 block font-mono">{userInfo?.email || pendingEmail || "operator@hospital.com"}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Requested Role</span>
              <span className="font-semibold text-primary mt-0.5 block capitalize">{userInfo?.roleName || "Doctor / Senior Vet"}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Department</span>
              <span className="font-semibold text-slate-700 mt-0.5 block">{userInfo?.department || "Clinical Care"}</span>
            </div>
            {userInfo?.licenseNumber && (
              <div>
                <span className="text-slate-500 block">VCI / Registration No.</span>
                <span className="font-semibold text-emerald-700 mt-0.5 block font-mono">{userInfo.licenseNumber}</span>
              </div>
            )}
            {userInfo?.qualification && (
              <div>
                <span className="text-slate-500 block">Qualifications</span>
                <span className="font-semibold text-slate-700 mt-0.5 block">{userInfo.qualification}</span>
              </div>
            )}
          </div>
        </div>

        {/* Verification Steps */}
        <div className="mt-6 border-t border-slate-100 pt-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Approval Workflow Steps</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 flex items-start gap-2.5">
              <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-900">1. Details Registered</p>
                <p className="text-[11px] text-emerald-700 mt-0.5">Profile stored in MongoDB</p>
              </div>
            </div>
            <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-3 flex items-start gap-2.5 shadow-xs">
              <Clock className="size-4 text-amber-600 shrink-0 mt-0.5 animate-spin" />
              <div>
                <p className="font-semibold text-amber-900">2. Admin Review</p>
                <p className="text-[11px] text-amber-700 mt-0.5">Role & permissions assigned</p>
              </div>
            </div>
            <div className="bg-slate-50/60 border border-slate-200 rounded-xl p-3 flex items-start gap-2.5 opacity-70">
              <ShieldCheck className="size-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-500">3. Dashboard Access</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Role-scoped ERP workspace</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 pt-6">
          <Button
            variant="outline"
            asChild
            className="text-xs text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-50 w-full sm:w-auto"
          >
            <Link to="/login">
              <LogOut className="size-3.5 mr-1.5" /> Back to Sign In
            </Link>
          </Button>

          <Button
            onClick={handleCheckStatus}
            disabled={checking}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs px-5 w-full sm:w-auto shadow-md shadow-primary/20"
          >
            {checking ? (
              <>
                <RefreshCw className="size-3.5 mr-2 animate-spin" /> Checking Database...
              </>
            ) : (
              <>
                <RefreshCw className="size-3.5 mr-2" /> Check Approval Status
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
