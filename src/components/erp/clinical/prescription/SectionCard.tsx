import React, { useState } from "react";
import { ChevronDown, ChevronUp, Check, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface SectionCardProps {
  id?: string | undefined;
  icon?: React.ReactNode | undefined;
  title: string;
  subtitle?: string | undefined;
  status?: SaveStatus | undefined;
  lastSavedAt?: string | undefined;
  isDirty?: boolean | undefined;
  onSave?: (() => Promise<void> | void) | undefined;
  saveLabel?: string | undefined;
  children: React.ReactNode;
  collapsible?: boolean | undefined;
  defaultExpanded?: boolean | undefined;
  className?: string | undefined;
  isLocked?: boolean | undefined;
  lockedReason?: string | undefined;
}

export function SectionCard({
  id,
  icon,
  title,
  subtitle,
  status = "idle",
  lastSavedAt,
  isDirty = false,
  onSave,
  saveLabel = "Save ✓",
  children,
  collapsible = true,
  defaultExpanded = true,
  className,
  isLocked = false,
  lockedReason,
}: SectionCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const formattedSavedTime = React.useMemo(() => {
    if (!lastSavedAt) return null;
    try {
      const d = new Date(lastSavedAt);
      if (isNaN(d.getTime())) return lastSavedAt;
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return lastSavedAt;
    }
  }, [lastSavedAt]);

  const renderStatusBadge = () => {
    if (status === "saving") {
      return (
        <Badge variant="outline" className="h-6 gap-1 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 text-[10px] font-semibold animate-pulse">
          <Loader2 className="size-3 animate-spin" />
          <span>Saving…</span>
        </Badge>
      );
    }
    if (status === "error") {
      return (
        <Badge variant="outline" className="h-6 gap-1 bg-destructive/10 text-destructive border-destructive/30 text-[10px] font-bold">
          <AlertCircle className="size-3" />
          <span>Save failed · Retry</span>
        </Badge>
      );
    }
    if (isDirty) {
      return (
        <Badge variant="outline" className="h-6 gap-1 bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 text-[10px] font-semibold">
          <span className="size-1.5 rounded-full bg-amber-500 animate-ping" />
          <span>Unsaved changes</span>
        </Badge>
      );
    }
    if (formattedSavedTime || status === "saved") {
      return (
        <Badge variant="outline" className="h-6 gap-1 bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 text-[10px] font-semibold">
          <Check className="size-3 text-emerald-600" />
          <span>Saved {formattedSavedTime || ""}</span>
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="h-6 text-[10px] text-muted-foreground bg-muted/40 border-border font-medium">
        Not saved yet
      </Badge>
    );
  };

  return (
    <div
      id={id}
      className={cn(
        "rounded-xl border border-border bg-card shadow-2xs transition-all",
        isDirty && "border-amber-300/80 dark:border-amber-700/60 shadow-xs",
        className
      )}
    >
      {/* Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border/70 bg-muted/20 rounded-t-xl">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="text-primary shrink-0">{icon}</span>}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2 truncate">
              <span>{title}</span>
            </h3>
            {subtitle && (
              <p className="text-[11px] text-muted-foreground line-clamp-1">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Action Controls & Status Chip */}
        <div className="flex items-center gap-2 shrink-0">
          {renderStatusBadge()}

          {onSave && !isLocked && (
            <Button
              type="button"
              size="sm"
              variant={isDirty ? "default" : "outline"}
              disabled={!isDirty || status === "saving"}
              onClick={() => onSave()}
              className={cn(
                "h-7 text-xs font-bold gap-1 transition-all",
                isDirty
                  ? "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
                  : "text-muted-foreground border-border hover:bg-muted/40"
              )}
            >
              {status === "saving" ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Check className="size-3" />
              )}
              <span>{saveLabel}</span>
            </Button>
          )}

          {collapsible && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title={expanded ? "Collapse section" : "Expand section"}
            >
              {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Lock Banner if settled */}
      {isLocked && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-800 dark:text-amber-200 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="size-3.5 shrink-0" />
          <span>{lockedReason || "Bill is settled. Billable section is locked for editing."}</span>
        </div>
      )}

      {/* Card Body */}
      {expanded && <div className="p-4 space-y-3">{children}</div>}
    </div>
  );
}
