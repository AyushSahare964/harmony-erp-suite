import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { 
  KeyRound, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft, 
  ArrowRight,
  ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import { resetPasswordFn } from "@/lib/mongodb/serverFns/auth";
import { CLINIC_CONFIG } from "@/lib/config/clinicConfig";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (s: Record<string, unknown>) => ({ 
    token: typeof s["token"] === "string" ? s["token"].trim() : "" 
  }),
  head: () => ({ 
    meta: [{ title: `${CLINIC_CONFIG.shortName} — Reset Password` }] 
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();

  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  // Password requirements calculation
  const hasMinLen = pw.length >= 8;
  const hasNumberOrSymbol = /\d|[^a-zA-Z0-9]/.test(pw);
  const hasUpperLower = /[a-z]/.test(pw) && /[A-Z]/.test(pw);

  const strengthScore = [hasMinLen, hasNumberOrSymbol, hasUpperLower].filter(Boolean).length;
  const isMatch = Boolean(confirm && pw === confirm);
  const isMismatch = Boolean(confirm && pw !== confirm);

  const getStrengthMeta = () => {
    if (!pw) return { label: "", color: "bg-slate-200", width: "0%" };
    if (strengthScore === 1) return { label: "Weak", color: "bg-rose-500", width: "33%" };
    if (strengthScore === 2) return { label: "Fair", color: "bg-amber-500", width: "66%" };
    return { label: "Strong", color: "bg-emerald-500", width: "100%" };
  };

  const strengthMeta = getStrengthMeta();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasMinLen) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }

    if (pw !== confirm) {
      toast.error("Passwords do not match. Please re-check.");
      return;
    }

    setLoading(true);
    try {
      const res = await resetPasswordFn({ data: { token, newPassword: pw } });
      if (res.success) {
        toast.success(res.message || "Password updated successfully! Please sign in.");
        navigate({ to: "/login" });
      } else {
        toast.error(res.message || "Reset link is invalid or has expired.");
      }
    } catch {
      toast.error("Something went wrong. Please request a new password reset link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-100/90 via-slate-50 to-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-10 select-none">
      
      {/* Brand Header */}
      <div className="mb-6 flex items-center justify-between w-full max-w-md px-2">
        <Link to="/" className="flex items-center gap-2.5 group">
          <img
            src={CLINIC_CONFIG.logoPath}
            alt={CLINIC_CONFIG.shortName}
            className="h-10 w-auto object-contain"
          />
          <div>
            <span className="text-base font-bold tracking-tight text-navy">{CLINIC_CONFIG.shortName}</span>
            <span className="block text-[0.65rem] text-muted-foreground leading-none">{CLINIC_CONFIG.doctorName}</span>
          </div>
        </Link>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200/90 shadow-xl shadow-slate-200/50 p-6 sm:p-8 space-y-6">
        
        {/* Card Header */}
        <div className="space-y-2">
          <div className="inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <KeyRound className="size-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-navy">Choose a new password</h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {token
              ? "Create a strong, secure password for your clinic staff account. You'll be automatically signed out of other active sessions."
              : "This password reset link is invalid or has expired."}
          </p>
        </div>

        {token ? (
          <form onSubmit={submit} className="space-y-4">
            
            {/* New Password Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                New Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showPw ? "text" : "password"}
                  required
                  minLength={8}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder="Enter at least 8 characters"
                  className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-10 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  title={showPw ? "Hide password" : "Show password"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-slate-100"
                >
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>

              {/* Strength Indicator */}
              {pw && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[0.68rem]">
                    <span className="text-muted-foreground">Password strength</span>
                    <span className={cn(
                      "font-semibold",
                      strengthScore === 1 && "text-rose-600",
                      strengthScore === 2 && "text-amber-600",
                      strengthScore >= 3 && "text-emerald-600"
                    )}>
                      {strengthMeta.label}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full transition-all duration-300 rounded-full", strengthMeta.color)}
                      style={{ width: strengthMeta.width }}
                    />
                  </div>
                </div>
              )}

              {/* Requirement Checkpoints */}
              <div className="flex flex-wrap gap-2 pt-1">
                <span className={cn(
                  "inline-flex items-center gap-1 text-[0.68rem] transition-colors",
                  hasMinLen ? "text-emerald-600 font-medium" : "text-muted-foreground"
                )}>
                  <CheckCircle2 className={cn("size-3", hasMinLen ? "text-emerald-500" : "text-slate-300")} />
                  8+ characters
                </span>
                <span className={cn(
                  "inline-flex items-center gap-1 text-[0.68rem] transition-colors",
                  hasNumberOrSymbol ? "text-emerald-600 font-medium" : "text-muted-foreground"
                )}>
                  <CheckCircle2 className={cn("size-3", hasNumberOrSymbol ? "text-emerald-500" : "text-slate-300")} />
                  Number or symbol
                </span>
              </div>
            </div>

            {/* Confirm New Password Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-foreground">
                  Confirm New Password <span className="text-rose-500">*</span>
                </label>
                {confirm && (
                  <span className={cn(
                    "text-[0.68rem] font-medium transition-colors",
                    isMatch && "text-emerald-600",
                    isMismatch && "text-rose-500"
                  )}>
                    {isMatch ? "✓ Passwords match" : "Passwords do not match"}
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showConfirm ? "text" : "password"}
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter your new password"
                  className={cn(
                    "h-10 w-full rounded-lg border bg-background pl-9 pr-10 text-xs outline-none focus:ring-1 transition-all font-mono",
                    isMismatch
                      ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500"
                      : "border-input focus:border-primary focus:ring-primary"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  title={showConfirm ? "Hide password" : "Show password"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-slate-100"
                >
                  {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !hasMinLen || (confirm.length > 0 && !isMatch)}
              className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-xs font-bold text-primary-foreground shadow-xs transition-all hover:bg-primary-hover active:scale-[0.99] disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Updating password…</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="size-4" />
                  <span>Update password</span>
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* Error State when token is missing or malformed */
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900">
              <AlertCircle className="size-4 shrink-0 text-amber-600 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-950">Link Invalid or Expired</p>
                <p className="text-[0.7rem] text-amber-800 leading-normal">
                  Password reset links are single-use and automatically expire after 30 minutes. Please request a fresh reset link from the login page.
                </p>
              </div>
            </div>

            <Link
              to="/login"
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Request a new reset link
            </Link>
          </div>
        )}

        {/* Footer Navigation */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline transition-all"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to sign in</span>
          </Link>
        </div>
      </div>

      {/* Security footnote */}
      <p className="mt-6 text-center text-[0.68rem] text-muted-foreground flex items-center gap-1.5">
        <ShieldCheck className="size-3.5 text-slate-400" />
        <span>Protected by VetOS ERP Clinic Security & End-to-End Encryption</span>
      </p>
    </div>
  );
}
