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
  Building2
} from "lucide-react";
import { useState, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ROLES, ROLE_ORDER, roleModules, type RoleId } from "@/lib/erp/config";
import { useErp } from "@/lib/erp/store";
import { getIcon } from "./icon";
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

  const seen = new Set<string>();
  const navItems = roleModules(role).filter((c) => {
    if (seen.has(c.module)) return false;
    seen.add(c.module);
    return true;
  });

  return (
    <div className="flex h-full w-[260px] flex-col border-r border-sidebar-border bg-sidebar select-none">
      <div className="flex flex-col items-center gap-2 border-b border-sidebar-border px-5 py-6">
        <Link to="/" className="flex flex-col items-center gap-1.5 group">
          <motion.span 
            whileHover={{ scale: 1.08, rotate: [0, -5, 5, 0] }}
            transition={{ duration: 0.3 }}
            className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md transition-shadow group-hover:shadow-primary/30"
          >
            <Stethoscope className="size-6" />
          </motion.span>
          <p className="text-lg font-bold tracking-tight text-navy">VetOS ERP</p>
          <p className="text-xs text-muted-foreground">Clinic Management Suite</p>
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

function Topbar({ title, onMenu }: { title: string; onMenu: () => void }) {
  const navigate = useNavigate();
  const { role, roleId, setRoleId, currentUser, logout } = useErp();

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out of staff terminal session.");
    navigate({ to: "/login" });
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/90 backdrop-blur-md px-4 lg:px-6">
      <button className="lg:hidden p-1.5 rounded-lg hover:bg-muted" onClick={onMenu} aria-label="Open navigation">
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

      <div className="relative mx-auto hidden w-full max-w-md md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search pets, owners, invoices, records…"
          className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative rounded-lg p-2 hover:bg-muted transition-colors" 
          aria-label="Notifications"
        >
          <Bell className="size-[1.05rem]" />
          <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[0.6rem] font-bold text-destructive-foreground">
            5
          </span>
        </motion.button>

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
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-xs font-bold leading-none text-navy">
                  {currentUser?.fullName || role.person}
                </p>
                <p className="text-[0.7rem] leading-none text-muted-foreground truncate">
                  {currentUser?.email || `${role.id}@vetos.cloud`}
                </p>
                {currentUser?.licenseNumber && (
                  <p className="text-[0.65rem] text-primary font-medium">
                    Reg: {currentUser.licenseNumber}
                  </p>
                )}
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuLabel className="text-[0.7rem] uppercase text-muted-foreground font-bold">
              Switch Role View
            </DropdownMenuLabel>
            {ROLE_ORDER.map((id: RoleId) => (
              <DropdownMenuItem
                key={id}
                onSelect={() => setRoleId(id)}
                className={cn("text-xs cursor-pointer", id === roleId && "font-semibold text-primary bg-primary-soft/50")}
              >
                <span className="flex-1">{ROLES[id].name}</span>
                <span className="text-[0.65rem] text-muted-foreground">{ROLES[id].initials}</span>
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            <DropdownMenuItem asChild className="text-xs cursor-pointer">
              <Link to="/login" className="flex items-center gap-2">
                <LogIn className="size-3.5 text-primary" />
                <span>Switch / Sign In Operator</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem 
              onClick={handleLogout}
              className="text-xs text-destructive cursor-pointer flex items-center gap-2"
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

  // Scroll to top smoothly on feature/route transition
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);

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
