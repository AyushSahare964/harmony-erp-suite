import { useState, useEffect } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { 
  Eye, 
  EyeOff, 
  Lock, 
  Mail, 
  Stethoscope, 
  UserCheck, 
  UserPlus, 
  ArrowRight,
  Database
} from "lucide-react";
import { toast } from "sonner";
import { useErp } from "@/lib/erp/store";
import { AuthService, type RegisterPayload, type UserProfile } from "@/lib/erp/auth";
import { ROLES, type RoleId } from "@/lib/erp/config";
import { PetShowcase } from "@/components/erp/PetShowcase";
import { CLINIC_CONFIG } from "@/lib/config/clinicConfig";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: `${CLINIC_CONFIG.shortName} — Staff Sign In` },
      {
        name: "description",
        content: "Professional veterinary clinic operator sign in and profile creation portal.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { login, register, currentUser, isAuthenticated, isLoadingAuth } = useErp();
  const [seeding, setSeeding] = useState(false);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  // Register state
  const [regData, setRegData] = useState<RegisterPayload>({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    clinicName: "Harmony Pet Hospital",
    branch: "Central Hospital · Koramangala",
    roleId: "admin",
    licenseNumber: "",
    department: "Clinical Care",
    specialty: "General Practice",
  });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(true);

  const demoStaff = AuthService.getDemoStaffList();

  // Redirect if already authenticated (wait for cookie hydration first)
  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated) {
      navigate({ to: "/" });
    }
  }, [isLoadingAuth, isAuthenticated, navigate]);

  const handleSeedDemo = async () => {
    setSeeding(true);
    try {
      const res = await AuthService.seedDemoUsers();
      toast.success(res.message);
    } catch {
      toast.error("Seed failed — check your MongoDB connection.");
    } finally {
      setSeeding(false);
    }
  };

  const handleQuickLogin = async (staff: UserProfile & { _password?: string }) => {
    const pwd = staff._password || "12345678";
    setLoginEmail(staff.email);
    setLoginPassword(pwd);
    setLoading(true);
    try {
      const res = await login({ email: staff.email, password: pwd, rememberMe: true });
      if (res.success) {
        toast.success(`Logged in as ${staff.fullName}`);
        navigate({ to: "/" });
      } else if (res.pendingApproval) {
        toast.info(res.message || "Your account is pending administrator approval.");
        try {
          sessionStorage.setItem("vetos.pending_user", JSON.stringify(res.user || staff));
        } catch { /* ignore */ }
        navigate({ to: "/pending-approval" });
      } else {
        toast.error(res.message || "Failed to sign in — ensure credentials are seeded in MongoDB");
      }
    } catch {
      toast.error("An error occurred during authentication");
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      toast.error("Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await login({
        email: loginEmail,
        password: loginPassword,
        rememberMe,
      });

      if (res.success) {
        toast.success(res.message || "Login successful!");
        navigate({ to: "/" });
      } else if (res.pendingApproval) {
        toast.info(res.message || "Your account is awaiting clinic administrator approval.");
        try {
          sessionStorage.setItem("vetos.pending_user", JSON.stringify(res.user || { email: loginEmail }));
        } catch { /* ignore */ }
        navigate({ to: "/pending-approval" });
      } else {
        toast.error(res.message || "Invalid credentials.");
      }
    } catch {
      toast.error("Server connection error.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!regData.fullName.trim() || !regData.email.trim() || !regData.password) {
      toast.error("Please fill in your name, email, and password.");
      return;
    }

    if (regData.password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    if (!agreedTerms) {
      toast.error("Please accept the clinic data policy.");
      return;
    }

    setLoading(true);
    try {
      const res = await register(regData);
      if (res.success || res.pendingApproval) {
        toast.success("Application submitted! Redirecting to preview...");
        try {
          sessionStorage.setItem(
            "vetos.pending_user",
            JSON.stringify(res.user || {
              fullName: regData.fullName,
              email: regData.email,
              roleId: regData.roleId,
              roleName: ({
                doctor: "Doctor / Senior Vet",
                admin: "Clinic Administrator",
                reception: "Reception & Front Desk",
                accounts: "Accounts & Billing Manager",
                platform: "Platform Systems Administrator",
              } as Record<string, string>)[regData.roleId] || regData.roleId,
              department: regData.department,
              licenseNumber: regData.licenseNumber,
              qualification: regData.qualification,
            })
          );
        } catch { /* ignore */ }
        navigate({ to: "/pending-approval" });
      } else {
        toast.error(res.message || "Registration failed.");
      }
    } catch {
      toast.error("Could not complete registration.");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-100/90 via-slate-50 to-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-10">
      
      {/* Brand Header above card */}
      <div className="mb-6 flex items-center justify-between w-full max-w-4xl px-2">
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

        <div className="flex items-center gap-2">
          <button
            onClick={handleSeedDemo}
            disabled={seeding}
            title="Seed demo staff users into MongoDB Atlas"
            className="inline-flex items-center gap-1 text-[0.68rem] font-semibold text-emerald-600 bg-white border border-emerald-200/80 px-2.5 py-1 rounded-full shadow-2xs hover:bg-emerald-50 transition-colors disabled:opacity-50"
          >
            <Database className="size-3" />
            {seeding ? "Seeding…" : "MongoDB Atlas"}
          </button>
        </div>
      </div>

      {/* Main Centered Professional Action Card */}
      <div className="w-full max-w-4xl rounded-2xl bg-white border border-slate-200/90 shadow-xl shadow-slate-200/50 overflow-hidden grid grid-cols-1 md:grid-cols-12">
        
        {/* LEFT COLUMN: CONTINUOUS PET ANIMATION SLIDER PREVIEW */}
        <div className="hidden md:block md:col-span-5 lg:col-span-5 border-r border-slate-100">
          <PetShowcase />
        </div>

        {/* RIGHT COLUMN: ACTION WINDOW (LOGIN & REGISTRATION) */}
        <div className="md:col-span-7 lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between bg-white">
          <div className="space-y-5">
            
            {/* Minimal Clean Tab Switcher */}
            <div className="flex rounded-lg bg-slate-100 p-1 border border-slate-200/60 max-w-[260px]">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all",
                  mode === "login"
                    ? "bg-white text-navy shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <UserCheck className="size-3.5" />
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setMode("register")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all",
                  mode === "register"
                    ? "bg-white text-navy shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <UserPlus className="size-3.5" />
                Register
              </button>
            </div>

            {/* TAB: SIGN IN */}
            {mode === "login" ? (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div>
                  <h1 className="text-lg font-bold text-navy">Welcome back</h1>
                  <p className="text-xs text-muted-foreground">
                    Sign in to access clinical modules and patient records.
                  </p>
                </div>

                <form onSubmit={handleLoginSubmit} className="space-y-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-foreground">Email</label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="email"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="staff@vetos.cloud"
                        className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-foreground">Password</label>
                      <button
                        type="button"
                        onClick={() => toast.info("Admin password: '12345678'  ·  Dev password: 'ayush@123'")}
                        className="text-[0.7rem] text-primary hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-9 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-0.5">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="size-3.5 rounded border-input text-primary focus:ring-primary"
                      />
                      <span>Remember session</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-primary text-xs font-bold text-primary-foreground shadow-xs transition-all hover:bg-primary-hover active:scale-[0.99] disabled:opacity-60"
                  >
                    {loading ? (
                      <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <span>Sign In</span>
                        <ArrowRight className="size-3.5" />
                      </>
                    )}
                  </button>
                </form>

              </div>
            ) : (
              /* TAB: CREATE OPERATOR PROFILE */
              <div className="space-y-3.5 animate-in fade-in duration-150">
                <div>
                  <h1 className="text-lg font-bold text-navy">Create Profile</h1>
                  <p className="text-xs text-muted-foreground">
                    Register operator profile to access ERP features.
                  </p>
                </div>

                <form onSubmit={handleRegisterSubmit} className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <label className="block text-[0.68rem] font-semibold text-foreground">Full Name *</label>
                      <input
                        type="text"
                        required
                        value={regData.fullName}
                        onChange={(e) => setRegData({ ...regData, fullName: e.target.value })}
                        placeholder="Dr. Rajesh Mehra"
                        className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-xs outline-none focus:border-primary"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <label className="block text-[0.68rem] font-semibold text-foreground">Work Email *</label>
                      <input
                        type="email"
                        required
                        value={regData.email}
                        onChange={(e) => setRegData({ ...regData, email: e.target.value })}
                        placeholder="rajesh@clinic.com"
                        className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-xs outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <label className="block text-[0.68rem] font-semibold text-foreground">Password *</label>
                      <input
                        type="password"
                        required
                        value={regData.password}
                        onChange={(e) => setRegData({ ...regData, password: e.target.value })}
                        placeholder="••••••••"
                        className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-xs outline-none focus:border-primary"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <label className="block text-[0.68rem] font-semibold text-foreground">Confirm Password *</label>
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-xs outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <label className="block text-[0.68rem] font-semibold text-foreground">Clinic Name</label>
                      <input
                        type="text"
                        value={regData.clinicName}
                        onChange={(e) => setRegData({ ...regData, clinicName: e.target.value })}
                        placeholder="Harmony Pet Hospital"
                        className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-xs outline-none focus:border-primary"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <label className="block text-[0.68rem] font-semibold text-foreground">Requested Role</label>
                      <select
                        value={regData.roleId}
                        onChange={(e) => setRegData({ ...regData, roleId: e.target.value as RoleId })}
                        className="h-8 w-full rounded-lg border border-input bg-background px-2 text-xs outline-none focus:border-primary font-medium"
                      >
                        <option value="doctor">🩺 Doctor / Senior Vet</option>
                        <option value="admin">🛡️ Clinic Admin</option>
                        <option value="reception">📋 Reception & Triage</option>
                        <option value="accounts">💳 Accounts & Billing</option>
                        <option value="platform">⚡ Platform Administrator</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <label className="block text-[0.68rem] font-semibold text-foreground">Qualification / Degrees</label>
                      <input
                        type="text"
                        value={regData.qualification || ""}
                        onChange={(e) => setRegData({ ...regData, qualification: e.target.value })}
                        placeholder="BVSc & AH, MVSc"
                        className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-xs outline-none focus:border-primary"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <label className="block text-[0.68rem] font-semibold text-foreground">License / VCI Registration No.</label>
                      <input
                        type="text"
                        value={regData.licenseNumber}
                        onChange={(e) => setRegData({ ...regData, licenseNumber: e.target.value })}
                        placeholder="VCI-KAR-2024-881"
                        className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-xs outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  <div className="pt-0.5">
                    <label className="flex items-center gap-1.5 cursor-pointer text-[0.68rem] text-muted-foreground select-none">
                      <input
                        type="checkbox"
                        checked={agreedTerms}
                        onChange={(e) => setAgreedTerms(e.target.checked)}
                        className="size-3.5 rounded border-input text-primary focus:ring-primary"
                      />
                      <span>I agree to clinic data policy</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-primary text-xs font-bold text-primary-foreground shadow-xs transition-all hover:bg-primary-hover active:scale-[0.99] disabled:opacity-60"
                  >
                    {loading ? (
                      <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <span>Create Operator Account</span>
                        <ArrowRight className="size-3.5" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Bottom Card Footer */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[0.68rem] text-muted-foreground">
            {isAuthenticated && currentUser ? (
              <>
                <span>Signed in as <strong>{currentUser.fullName}</strong></span>
                <Link to="/" className="text-primary font-bold hover:underline">
                  Launch Console →
                </Link>
              </>
            ) : (
              <>
                <span>VetOS Clinic Management</span>
                <span className="text-slate-400">Local Auth · MongoDB Ready</span>
              </>
            )}
          </div>

        </div>
      </div>

      {/* Page Footer */}
      <p className="mt-6 text-[0.72rem] text-slate-500">
        By signing in you agree to the VetOS Clinic Compliance & Privacy Code
      </p>
    </div>
  );
}
