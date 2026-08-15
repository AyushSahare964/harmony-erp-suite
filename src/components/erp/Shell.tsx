import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, ChevronDown, LogOut, Menu, Search, Stethoscope, X } from "lucide-react";
import { useState, type ReactNode } from "react";
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
  const { role } = useErp();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const seen = new Set<string>();
  const navItems = roleModules(role).filter((c) => {
    if (seen.has(c.module)) return false;
    seen.add(c.module);
    return true;
  });

  return (
    <div className="flex h-full w-[260px] flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex flex-col items-center gap-2 border-b border-sidebar-border px-5 py-6">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Stethoscope className="size-6" />
        </span>
        <p className="text-lg font-bold tracking-tight">VetOS ERP</p>
        <p className="text-xs text-muted-foreground">Clinic Suite</p>
        <p className="text-[0.68rem] font-medium text-primary">v1.0 — Production</p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <p className="section-label px-2 pb-2">Navigation</p>
        <nav className="space-y-0.5">
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

      <div className="border-t border-sidebar-border px-5 py-4">
        <p className="section-label">{role.id === "platform" ? "Environment" : "Branch"}</p>
        <p className="mt-1.5 text-sm font-semibold leading-tight">{role.scope}</p>
        <p className="text-xs text-muted-foreground">{role.scopeCaption}</p>
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-success">
          <span className="size-2 rounded-full bg-success" />
          Connected
        </p>
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
    "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[0.82rem] font-medium transition-colors",
    active
      ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
      : "text-sidebar-foreground hover:bg-muted",
  );
  const inner = (
    <>
      {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-primary" />}
      <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
      <span className="truncate">{label}</span>
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
  const { role, roleId, setRoleId } = useErp();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card px-4 lg:px-6">
      <button className="lg:hidden" onClick={onMenu} aria-label="Open navigation">
        <Menu className="size-5" />
      </button>

      <h2 className="truncate text-[0.95rem] font-bold">{title}</h2>

      <div className="relative mx-auto hidden w-full max-w-md md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search pets, owners, invoices…"
          className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button className="relative rounded-lg p-2 hover:bg-muted" aria-label="Notifications">
          <Bell className="size-[1.05rem]" />
          <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[0.6rem] font-bold text-destructive-foreground">
            5
          </span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-left hover:bg-muted">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-[0.68rem] font-bold text-primary-foreground">
              {role.initials}
            </span>
            <span className="hidden sm:block">
              <span className="block text-xs font-semibold leading-tight">{role.person}</span>
              <span className="block text-[0.68rem] leading-tight text-muted-foreground">{role.name}</span>
            </span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>Switch role</DropdownMenuLabel>
            {ROLE_ORDER.map((id: RoleId) => (
              <DropdownMenuItem
                key={id}
                onSelect={() => setRoleId(id)}
                className={cn("text-sm", id === roleId && "font-semibold text-primary")}
              >
                <span className="flex-1">{ROLES[id].name}</span>
                <span className="text-xs text-muted-foreground">{ROLES[id].initials}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-sm text-destructive">
              <LogOut className="size-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export function Shell({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="sticky top-0 hidden h-screen shrink-0 lg:block">
        <Sidebar />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0">
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
          <button
            className="absolute right-4 top-4 rounded-lg bg-card p-2"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X className="size-5" />
          </button>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} onMenu={() => setOpen(true)} />
        <main className="flex-1 px-4 py-6 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
