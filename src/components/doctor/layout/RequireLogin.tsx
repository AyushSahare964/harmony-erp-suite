import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useErp } from "@/lib/erp/store";

/**
 * Same login guard as Shell (src/components/erp/Shell.tsx): show the session loader while
 * checking, send logged-out visitors to /login, render children once signed in.
 */
export function RequireLogin({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoadingAuth } = useErp();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoadingAuth && !isAuthenticated) navigate({ to: "/login" });
  }, [isLoadingAuth, isAuthenticated, navigate]);

  if (isLoadingAuth) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-transparent">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">
            Loading your session…
          </p>
        </div>
      </div>
    );
  }
  if (!isAuthenticated) return null;
  return <>{children}</>;
}
