import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { 
  Bell, 
  ChevronDown, 
  LogOut, 
  Menu, 
  Search, 
  Stethoscope, 
  X, 
  UserCircle, 
  LogIn, 
  Shield, 
  Sparkles,
  Building2,
  PawPrint,
  Phone,
} from "lucide-react";
import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ROLES, ROLE_ORDER, roleModules, type RoleId } from "@/lib/erp/config";
import { useErp } from "@/lib/erp/store";
import { getIcon } from "./icon";
import { CLINIC_CONFIG } from "@/lib/config/clinicConfig";
import { getMongoStatusFn, type MongoStatusRow } from "@/lib/mongodb/serverFns/status";
import { listPetsWithOwnersFn } from "@/lib/mongodb/serverFns/crm";
import { listRemindersFn, settleReminderFn, type BillingReminderRow } from "@/lib/mongodb/serverFns/reminders";
import { todayIST, formatDisplayDate } from "@/lib/utils/dateUtils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function Sidebar({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  const { role, currentUser } = useErp();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mongoStatus, setMongoStatus] = useState<MongoStatusRow | null>(null);

  useEffect(() => {
    getMongoStatusFn()
      .then(setMongoStatus)
      .catch(() => setMongoStatus({ connected: false, readyState: 0, databaseName: "vetos_erp", host: "Atlas", latencyMs: 0, error: "Offline" }));
  }, []);

  // Hidden from the sidebar by request — the routes/dashboard cards still exist,
  // this only removes them from left-nav navigation.
  const HIDDEN_SIDEBAR_MODULES = new Set(["hrms", "marketing", "pharmacy", "communication", "integrations", "billing-suite"]);

  const seen = new Set<string>();
  const navItems = roleModules(role).filter((c) => {
    if (HIDDEN_SIDEBAR_MODULES.has(c.module)) return false;
    if (seen.has(c.module)) return false;
    seen.add(c.module);
    return true;
  });

  return (
    <div className="flex h-full w-[260px] flex-col border-r border-sidebar-border bg-sidebar select-none">
      <div className="flex flex-col items-center gap-2 border-b border-sidebar-border px-5 py-5">
        <Link to="/" className="flex flex-col items-center gap-2 group">
          <motion.div
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-center"
          >
            <img
              src={CLINIC_CONFIG.logoPath}
              alt={CLINIC_CONFIG.shortName}
              className="h-14 w-auto object-contain"
            />
          </motion.div>
          <div className="text-center">
            <p className="text-sm font-bold tracking-tight text-navy leading-tight">{CLINIC_CONFIG.shortName}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{CLINIC_CONFIG.doctorName}</p>
          </div>
        </Link>
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[0.65rem] font-bold text-primary">
          <Sparkles className="size-2.5" /> v1.0 Production
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
        <p className="section-label px-2 pb-2">Navigation</p>
        <nav className="space-y-1">
          <NavRow icon="LayoutGrid" label="Home Dashboard" active={pathname === "/"} onNavigate={onNavigate} />
          {navItems.map((item) => (
            <NavRow
              key={item.module}
              module={item.module}
              icon={item.icon}
              label={item.title.replace(/\s*\(.*\)$/, "")}
              active={pathname === `/m/${item.module}`}
              onNavigate={onNavigate}
            />
          ))}
        </nav>
      </div>

      <div className="border-t border-sidebar-border px-5 py-4 bg-sidebar/50">
        <div className="flex items-center justify-between">
          <p className="section-label">{role.id === "platform" ? "Environment" : "Branch"}</p>
          <span className="flex items-center gap-1 text-[0.65rem] font-bold text-success">
            <span className="size-1.5 rounded-full bg-success animate-pulse" />
            Online
          </span>
        </div>
        <p className="mt-1 text-sm font-semibold leading-tight text-foreground truncate">{role.scope}</p>
        <p className="text-xs text-muted-foreground truncate">{role.scopeCaption}</p>
        
        {currentUser?.specialty && (
          <p className="mt-1.5 inline-block rounded bg-muted px-1.5 py-0.5 text-[0.68rem] font-medium text-muted-foreground">
            Focus: {currentUser.specialty}
          </p>
        )}

        {/* MongoDB Connection Status */}
        <div className="mt-3 flex items-center justify-between border-t border-sidebar-border/60 pt-2.5 text-[0.65rem]">
          <span className="text-muted-foreground font-mono">MongoDB Atlas</span>
          <span className={`inline-flex items-center gap-1 font-semibold ${
            mongoStatus?.connected ? "text-success" : "text-warning"
          }`}>
            <span className={`size-1.5 rounded-full ${
              mongoStatus?.connected ? "bg-success animate-pulse" : "bg-warning"
            }`} />
            {mongoStatus?.connected ? `Connected (${mongoStatus.latencyMs}ms)` : "Connecting…"}
          </span>
        </div>
      </div>
    </div>
  );
}

interface NavRowProps {
  module?: string | undefined;
  icon: string;
  label: string;
  active: boolean;
  onNavigate?: (() => void) | undefined;
}

function NavRow({ module, icon, label, active, onNavigate }: NavRowProps) {
  const Icon = getIcon(icon);
  const className = cn(
    "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[0.82rem] font-medium transition-colors duration-150",
    active
      ? "font-semibold text-sidebar-accent-foreground"
      : "text-sidebar-foreground hover:bg-muted/70",
  );
  
  const inner = (
    <>
      {active && (
        <motion.span
          layoutId="sidebar-active-pill"
          className="absolute inset-0 rounded-lg bg-sidebar-accent"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      )}
      {active && (
        <motion.span 
          layoutId="sidebar-active-bar"
          className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-primary z-10" 
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      )}
      <Icon className={cn("size-4 shrink-0 z-10 relative", active ? "text-primary" : "text-muted-foreground")} />
      <span className="truncate z-10 relative">{label}</span>
    </>
  );

  if (module) {
    return (
      <Link
        to="/m/$moduleId"
        params={{ moduleId: module }}
        onClick={onNavigate}
        className={className}
      >
        {inner}
      </Link>
    );
  }

  return (
    <Link to="/" onClick={onNavigate} className={className}>
      {inner}
    </Link>
  );
}

function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [pets, setPets] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Load all pets once on first focus
  const load = async () => {
    if (loaded) return;
    try {
      const data = await listPetsWithOwnersFn();
      setPets(data ?? []);
      setLoaded(true);
    } catch (_) { /* silent */ }
  };

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    return pets.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.petId?.toLowerCase().includes(q) ||
      p.breed?.toLowerCase().includes(q) ||
      p.species?.toLowerCase().includes(q) ||
      p.owner?.name?.toLowerCase().includes(q) ||
      p.owner?.phone?.includes(q)
    ).slice(0, 8);
  }, [pets, query]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const showDropdown = focused && query.trim().length > 0;

  return (
    <div ref={ref} className="relative mx-auto hidden w-full max-w-md md:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground z-10" />
      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => { setFocused(true); void load(); }}
        placeholder="Search patients, owners, pet IDs…"
        className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
      />
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full mt-2 z-50 rounded-xl border border-border bg-card shadow-xl overflow-hidden"
          >
            {results.length === 0 ? (
              <div className="px-4 py-3 text-xs text-muted-foreground italic">No matching patients found.</div>
            ) : (
              <div className="divide-y divide-border/50 max-h-80 overflow-y-auto">
                {results.map(p => (
                  <div
                    key={p.petId}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setFocused(false);
                      setQuery("");
                      void navigate({ to: "/m/$moduleId", params: { moduleId: "crm-pets" }, search: { petId: p.petId, petName: p.name } as any });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.currentTarget as HTMLDivElement).click();
                    }}
                    className="px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-bold">
                          {p.species === "Feline" ? "C" : "D"}
                        </span>
                        <div>
                          <p className="text-xs font-bold text-foreground leading-tight">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground">{p.breed} · {p.species}</p>
                        </div>
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{p.petId}</span>
                    </div>
                    {p.owner && (
                      <div className="mt-1.5 text-[10px] text-muted-foreground flex items-center gap-1">
                        <PawPrint className="size-2.5 text-muted-foreground" />
                        <span className="font-medium text-foreground">{p.owner.name}</span>
                        {p.owner.phone && (
                          <><span className="mx-0.5">·</span><Phone className="size-2.5" /><span>{p.owner.phone}</span></>
                        )}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {[
                        { label: "Patient Record", module: "crm-pets" },
                        { label: "Billing", module: "billing" },
                        { label: "Lab", module: "laboratory" },
                        { label: "Boarding", module: "boarding" },
                      ].map(lnk => (
                        <button
                          key={lnk.module}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFocused(false);
                            setQuery("");
                            void navigate({ to: "/m/$moduleId", params: { moduleId: lnk.module }, search: { petId: p.petId, petName: p.name } as any });
                          }}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-primary/30 bg-primary/5 text-primary hover:bg-primary/15 transition-colors cursor-pointer"
                        >
                          {lnk.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Topbar({ title, onMenu }: { title: string; onMenu: () => void }) {
  const navigate = useNavigate();
  const { role, roleId, setRoleId, currentUser, logout } = useErp();

  const [reminders, setReminders] = useState<BillingReminderRow[]>([]);
  const loadReminders = () => {
    listRemindersFn()
      .then((rows) => setReminders(rows.filter((r) => r.status === "Pending")))
      .catch(() => {});
  };
  useEffect(() => {
    loadReminders();
    const interval = setInterval(loadReminders, 60_000); // keep the badge fresh across a long shift
    return () => clearInterval(interval);
  }, []);

  const sortedReminders = [...reminders].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  const today = todayIST();
  const overdueCount = reminders.filter((r) => r.scheduledDate < today).length;

  const handleQuickSettle = async (reminderId: string) => {
    setReminders((prev) => prev.filter((r) => r.reminderId !== reminderId));
    try {
      await settleReminderFn({ data: { reminderId } });
      toast.success("Reminder marked as settled!");
    } catch {
      toast.error("Could not update reminder");
      loadReminders();
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out of staff terminal session.");
    navigate({ to: "/login" });
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/90 backdrop-blur-md px-4 lg:px-6">
      <button className="lg:hidden p-1.5 rounded-lg hover:bg-muted" onClick={onMenu} aria-label="Open navigation" suppressHydrationWarning>
        <Menu className="size-5" />
      </button>

      <motion.h2 
        key={title}
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        className="truncate text-[0.95rem] font-bold text-navy"
      >
        {title}
      </motion.h2>

      <GlobalSearch />

      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative rounded-lg p-2 hover:bg-muted transition-colors"
              aria-label={`Notifications${reminders.length ? ` (${reminders.length} pending)` : ""}`}
              suppressHydrationWarning
            >
              <Bell className="size-[1.05rem]" />
              {reminders.length > 0 && (
                <span
                  className={cn(
                    "absolute right-1 top-1 flex size-4 items-center justify-center rounded-full text-[0.6rem] font-bold text-destructive-foreground",
                    overdueCount > 0 ? "bg-destructive" : "bg-amber-500"
                  )}
                >
                  {reminders.length > 9 ? "9+" : reminders.length}
                </span>
              )}
            </motion.button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-2">
            <DropdownMenuLabel className="flex items-center justify-between text-xs font-bold">
              <span>Billing Reminders</span>
              {overdueCount > 0 && (
                <span className="rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-[10px] font-bold">
                  {overdueCount} overdue
                </span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {sortedReminders.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No pending reminders — you're all caught up.
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-1">
                {sortedReminders.slice(0, 8).map((r) => {
                  const isOverdue = r.scheduledDate < today;
                  return (
                    <div
                      key={r.reminderId}
                      className="rounded-lg p-2 hover:bg-muted/60 transition-colors text-xs space-y-1"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">
                            {r.petName} · {r.ownerName}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {r.reminderType} · ₹{r.dueAmount.toLocaleString("en-IN")}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded",
                            isOverdue ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600"
                          )}
                        >
                          {isOverdue ? "Overdue" : formatDisplayDate(r.scheduledDate)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleQuickSettle(r.reminderId)}
                        className="text-[11px] font-semibold text-primary hover:underline"
                      >
                        Mark settled
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="text-xs font-semibold text-primary cursor-pointer justify-center">
              <Link to="/m/$moduleId" params={{ moduleId: "billing" }}>View all in Billing Desk</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-left hover:bg-muted transition-colors outline-none focus:ring-2 focus:ring-primary/20">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-[0.68rem] font-bold text-primary-foreground shadow-xs">
              {currentUser?.initials || role.initials}
            </span>
            <span className="hidden sm:block">
              <span className="block text-xs font-semibold leading-tight truncate max-w-[130px]">
                {currentUser?.fullName || role.person}
              </span>
              <span className="block text-[0.68rem] leading-tight text-muted-foreground truncate max-w-[130px]">
                {currentUser?.roleName?.split("/")[0] || role.name}
              </span>
            </span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 p-2">
            <div className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200/80">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm">
                {currentUser?.initials || role.initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-navy truncate">
                  {currentUser?.fullName || role.person}
                </p>
                <p className="text-[0.68rem] text-muted-foreground truncate font-mono">
                  {currentUser?.email || `${role.id}@vetos.cloud`}
                </p>
                <span className="inline-block mt-1 rounded-full bg-primary/10 px-2 py-0.5 text-[0.62rem] font-bold text-primary">
                  {currentUser?.roleName?.split("/")[0] || role.name}
                </span>
              </div>
            </div>

            <div className="px-2 py-2.5 space-y-1.5 text-[0.72rem] text-slate-600 dark:text-slate-400 border-b border-border my-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Department:</span>
                <span className="font-semibold text-foreground">
                  {currentUser?.department || (currentUser?.roleId === "admin" ? "Clinical Administration & Surgery" : role.scope)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Registration / VCI:</span>
                <span className="font-mono font-semibold text-emerald-600">
                  {currentUser?.licenseNumber || (currentUser?.fullName?.includes("Dixit") ? "M.S.V.C.-8648" : "VCI-ACTIVE")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Qualification:</span>
                <span className="font-medium text-foreground truncate max-w-[155px]" title={currentUser?.qualification || (currentUser?.fullName?.includes("Dixit") ? CLINIC_CONFIG.doctorQualifications : "Veterinary Specialist")}>
                  {currentUser?.qualification || (currentUser?.fullName?.includes("Dixit") ? "B.V.Sc & AH, M.V.Sc, PGDAW" : "Veterinary Specialist")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Clinic:</span>
                <span className="font-medium text-foreground truncate max-w-[155px]" title={currentUser?.clinicName || CLINIC_CONFIG.fullName}>
                  {currentUser?.clinicName || CLINIC_CONFIG.shortName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Branch:</span>
                <span className="font-medium text-foreground truncate max-w-[155px]">
                  {currentUser?.branch || "Nagpur Main Clinic"}
                </span>
              </div>
            </div>

            <DropdownMenuItem asChild className="text-xs cursor-pointer rounded-lg py-2 mt-1">
              <Link to="/login" className="flex items-center gap-2">
                <LogIn className="size-3.5 text-primary" />
                <span>Switch / Sign In Operator</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem 
              onClick={handleLogout}
              className="text-xs text-destructive cursor-pointer flex items-center gap-2 rounded-lg py-2"
            >
              <LogOut className="size-3.5" />
              <span>Log out session</span>
            </DropdownMenuItem>
          </DropdownMenuContent>

        </DropdownMenu>
      </div>
    </header>
  );
}

export function Shell({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAuthenticated, isLoadingAuth, role } = useErp();
  const navigate = useNavigate();

  // Scroll to top smoothly on feature/route transition
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);

  // Guard every Shell-wrapped page: unauthenticated visitors go to /login first.
  useEffect(() => {
    if (!isLoadingAuth && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [isLoadingAuth, isAuthenticated, navigate]);

  // Guard module routes by role: the sidebar only ever links to modules in
  // roleModules(role), but until now nothing stopped a direct URL visit to a
  // module outside that list. Reuse the same mapping the sidebar nav uses.
  const moduleId = pathname.startsWith("/m/") ? pathname.slice(3).split("/")[0] : null;
  const isModuleAllowed = !moduleId || roleModules(role).some((c) => c.module === moduleId);

  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated && moduleId && !isModuleAllowed) {
      toast.error("That module isn't part of your role's access.");
      navigate({ to: "/" });
    }
  }, [isLoadingAuth, isAuthenticated, moduleId, isModuleAllowed, navigate]);

  if (isLoadingAuth || !isAuthenticated || (moduleId && !isModuleAllowed)) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="sticky top-0 hidden h-screen shrink-0 lg:block">
        <Sidebar />
      </aside>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-navy/40 backdrop-blur-xs" 
              onClick={() => setOpen(false)} 
            />
            <motion.div 
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute inset-y-0 left-0 shadow-2xl"
            >
              <Sidebar onNavigate={() => setOpen(false)} />
            </motion.div>
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute right-4 top-4 rounded-lg bg-card p-2 shadow-md"
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
              suppressHydrationWarning
            >
              <X className="size-5" />
            </motion.button>
          </div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} onMenu={() => setOpen(true)} />
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="flex-1 px-4 py-6 lg:px-6"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
