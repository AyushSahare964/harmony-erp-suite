import { useState, useEffect, useCallback } from "react";
import { ChevronDown, Calendar, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  todayIST,
  presetDateRange,
  formatDisplayDate,
  parseDisplayDate,
  isValidDisplayDate,
  type DatePreset,
  type DateRange,
} from "@/lib/utils/dateUtils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type { DatePreset, DateRange };

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  /** Allow future dates in the To picker. Default false. */
  allowFuture?: boolean;
  /** Override the default preset list */
  presets?: DatePreset[];
  /** Compact single-row mode */
  compact?: boolean;
  className?: string;
}

const PRESET_LABELS: Record<DatePreset, string> = {
  TODAY: "Today",
  YESTERDAY: "Yesterday",
  THIS_WEEK: "This Week",
  LAST_7: "Last 7 Days",
  THIS_MONTH: "This Month (MTD)",
  LAST_MONTH: "Last Month",
  LAST_30: "Last 30 Days",
  THIS_QUARTER: "This Quarter",
  THIS_FY: "This Financial Year",
  LAST_FY: "Last Financial Year",
  CUSTOM: "Custom",
};

const DEFAULT_PRESETS: DatePreset[] = [
  "TODAY", "YESTERDAY", "THIS_WEEK", "LAST_7",
  "THIS_MONTH", "LAST_MONTH", "LAST_30",
  "THIS_QUARTER", "THIS_FY", "LAST_FY",
];

/** Build the default DateRange (This Month MTD) */
export function defaultDateRange(): DateRange {
  const { from, to } = presetDateRange("THIS_MONTH");
  return { from, to, preset: "THIS_MONTH" };
}

export function DateRangeFilter({
  value,
  onChange,
  allowFuture = false,
  presets = DEFAULT_PRESETS,
  compact = false,
  className,
}: DateRangeFilterProps) {
  // Local text inputs (DD/MM/YYYY)
  const [fromText, setFromText] = useState(formatDisplayDate(value.from));
  const [toText, setToText] = useState(formatDisplayDate(value.to));
  const [fromErr, setFromErr] = useState("");
  const [toErr, setToErr] = useState("");

  // Sync text inputs when value changes from outside
  useEffect(() => {
    setFromText(formatDisplayDate(value.from));
    setToText(formatDisplayDate(value.to));
    setFromErr("");
    setToErr("");
  }, [value.from, value.to]);

  const applyCustomRange = useCallback(
    (fromIso: string, toIso: string) => {
      if (!fromIso || !toIso) return;
      if (fromIso > toIso) {
        setToErr("'To' must be on or after 'From'");
        return;
      }
      const todayStr = todayIST();
      if (!allowFuture && toIso > todayStr) {
        setToErr("Future dates not allowed");
        return;
      }
      setFromErr("");
      setToErr("");
      onChange({ from: fromIso, to: toIso, preset: "CUSTOM" });
    },
    [onChange, allowFuture]
  );

  const handleFromBlur = () => {
    if (!fromText) { setFromErr("Required"); return; }
    if (!isValidDisplayDate(fromText)) { setFromErr("Invalid date (DD/MM/YYYY)"); return; }
    const iso = parseDisplayDate(fromText);
    setFromErr("");
    applyCustomRange(iso, value.to);
  };

  const handleToBlur = () => {
    if (!toText) { setToErr("Required"); return; }
    if (!isValidDisplayDate(toText)) { setToErr("Invalid date (DD/MM/YYYY)"); return; }
    const iso = parseDisplayDate(toText);
    setToErr("");
    applyCustomRange(value.from, iso);
  };

  const handlePreset = (preset: DatePreset) => {
    const { from, to } = presetDateRange(preset);
    setFromErr("");
    setToErr("");
    onChange({ from, to, preset });
  };

  return (
    <div className={cn("flex flex-wrap items-start gap-2", compact && "flex-col sm:flex-row", className)}>
      {/* Preset dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-8 items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
          >
            <Calendar className="size-3.5 text-primary shrink-0" />
            {PRESET_LABELS[value.preset]}
            <ChevronDown className="size-3 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[180px]">
          {presets.map((p) => (
            <DropdownMenuItem
              key={p}
              onClick={() => handlePreset(p)}
              className={cn(
                "text-xs cursor-pointer",
                value.preset === p && "font-semibold text-primary bg-primary/5"
              )}
            >
              {PRESET_LABELS[p]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* From */}
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-8">From</span>
          <input
            type="text"
            value={fromText}
            onChange={(e) => { setFromText(e.target.value); onChange({ ...value, preset: "CUSTOM" }); }}
            onBlur={handleFromBlur}
            placeholder="DD/MM/YYYY"
            maxLength={10}
            suppressHydrationWarning
            className={cn(
              "h-8 w-28 rounded-lg border bg-card px-2 text-xs font-mono outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10",
              fromErr ? "border-destructive" : "border-input"
            )}
          />
        </div>
        {fromErr && <p className="text-[10px] text-destructive ml-9">{fromErr}</p>}
      </div>

      {/* To */}
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-5">To</span>
          <input
            type="text"
            value={toText}
            onChange={(e) => { setToText(e.target.value); onChange({ ...value, preset: "CUSTOM" }); }}
            onBlur={handleToBlur}
            placeholder="DD/MM/YYYY"
            maxLength={10}
            suppressHydrationWarning
            className={cn(
              "h-8 w-28 rounded-lg border bg-card px-2 text-xs font-mono outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10",
              toErr ? "border-destructive" : "border-input"
            )}
          />
        </div>
        {toErr && <p className="text-[10px] text-destructive ml-6">{toErr}</p>}
      </div>

      {/* Range label (tooltip-style) */}
      {!compact && (
        <span className="self-center text-[10px] text-muted-foreground font-mono hidden sm:block">
          {formatDisplayDate(value.from)} – {formatDisplayDate(value.to)}
        </span>
      )}
    </div>
  );
}
