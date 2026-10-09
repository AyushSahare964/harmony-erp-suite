"use client";

import * as React from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface DatePickerProps {
  value?: string; // ISO date string: YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minDate?: string;
  maxDate?: string;
  showPresets?: boolean;
  disabled?: boolean;
  id?: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function parseISO(dateStr?: string): Date | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? null : date;
}

function formatISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplay(dateStr?: string): string {
  const d = parseISO(dateStr);
  if (!d) return "";
  return `${String(d.getDate()).padStart(2, "0")} ${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  className,
  minDate,
  maxDate,
  showPresets = true,
  disabled = false,
  id,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selectedDate = React.useMemo(() => parseISO(value), [value]);

  // View state: current viewed month & year in popover
  const initialDate = selectedDate || new Date();
  const [viewYear, setViewYear] = React.useState<number>(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = React.useState<number>(initialDate.getMonth());

  // Keep view aligned when popover opens or value changes
  React.useEffect(() => {
    if (selectedDate) {
      setViewYear(selectedDate.getFullYear());
      setViewMonth(selectedDate.getMonth());
    }
  }, [selectedDate, open]);

  // Generate comprehensive Year range (1950 to 2060)
  const yearOptions = React.useMemo(() => {
    const list: number[] = [];
    for (let y = 1950; y <= 2060; y++) {
      list.push(y);
    }
    return list;
  }, []);

  // Calendar matrix calculation
  const calendarDays = React.useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const startingDayOfWeek = firstDay.getDay(); // 0 (Sun) to 6 (Sat)
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days: Array<{
      date: Date;
      isCurrentMonth: boolean;
      iso: string;
      disabled: boolean;
    }> = [];

    // Trailing days from previous month
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(viewYear, viewMonth - 1, daysInPrevMonth - i);
      const iso = formatISO(d);
      days.push({
        date: d,
        isCurrentMonth: false,
        iso,
        disabled: Boolean((minDate && iso < minDate) || (maxDate && iso > maxDate)),
      });
    }

    // Days in current month
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(viewYear, viewMonth, day);
      const iso = formatISO(d);
      days.push({
        date: d,
        isCurrentMonth: true,
        iso,
        disabled: Boolean((minDate && iso < minDate) || (maxDate && iso > maxDate)),
      });
    }

    // Leading days from next month to fill full grid of 35 or 42 cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let day = 1; day <= remaining; day++) {
      const d = new Date(viewYear, viewMonth + 1, day);
      const iso = formatISO(d);
      days.push({
        date: d,
        isCurrentMonth: false,
        iso,
        disabled: Boolean((minDate && iso < minDate) || (maxDate && iso > maxDate)),
      });
    }

    return days;
  }, [viewYear, viewMonth, minDate, maxDate]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (iso: string) => {
    onChange(iso);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  const todayIso = formatISO(new Date());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <div
          id={id}
          role="button"
          tabIndex={disabled ? -1 : 0}
          className={cn(
            "flex h-8 w-full items-center justify-between rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs transition-colors hover:border-slate-300 dark:hover:border-slate-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 cursor-pointer select-none",
            disabled && "cursor-not-allowed opacity-50 bg-slate-100 dark:bg-slate-900",
            className
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <CalendarIcon className="size-3.5 text-slate-400 shrink-0" />
            <span className={cn("truncate font-medium", !value && "text-slate-400")}>
              {value ? formatDisplay(value) : placeholder}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {value && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                title="Clear date"
                className="p-0.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[280px] p-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl rounded-xl z-[90]"
      >
        {/* Month & Year Navigation Header with Direct Dropdowns */}
        <div className="flex items-center justify-between gap-1 mb-2">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 transition-colors"
            title="Previous month"
          >
            <ChevronLeft className="size-4" />
          </button>

          <div className="flex items-center gap-1.5">
            {/* Month Select */}
            <select
              value={viewMonth}
              onChange={(e) => setViewMonth(Number(e.target.value))}
              className="h-7 text-xs font-bold rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1.5 py-0 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              {MONTHS.map((m, idx) => (
                <option key={m} value={idx}>
                  {m}
                </option>
              ))}
            </select>

            {/* Year Select (Immediate jump to any year!) */}
            <select
              value={viewYear}
              onChange={(e) => setViewYear(Number(e.target.value))}
              className="h-7 text-xs font-bold rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1.5 py-0 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer font-mono"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 transition-colors"
            title="Next month"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* Day of Week Headers */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {WEEKDAYS.map((wd) => (
            <div key={wd} className="text-[10px] font-bold text-slate-400 py-0.5">
              {wd}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {calendarDays.map((d, index) => {
            const isSelected = value === d.iso;
            const isToday = d.iso === todayIso;

            return (
              <button
                key={`${d.iso}-${index}`}
                type="button"
                disabled={d.disabled}
                onClick={() => handleSelectDay(d.iso)}
                className={cn(
                  "size-8 rounded-md text-xs font-medium flex items-center justify-center transition-colors relative",
                  d.isCurrentMonth
                    ? "text-slate-800 dark:text-slate-200 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-800"
                    : "text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/40",
                  isSelected && "bg-blue-600 text-white font-bold hover:bg-blue-700 hover:text-white dark:bg-blue-600 dark:text-white shadow-xs",
                  isToday && !isSelected && "border border-blue-400 font-bold text-blue-600 dark:text-blue-400",
                  d.disabled && "opacity-25 cursor-not-allowed hover:bg-transparent"
                )}
              >
                {d.date.getDate()}
              </button>
            );
          })}
        </div>

        {/* Footer with Clear & Today shortcut */}
        <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium transition-colors"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => {
              onChange(todayIso);
              setOpen(false);
            }}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-bold transition-colors"
          >
            Today
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
