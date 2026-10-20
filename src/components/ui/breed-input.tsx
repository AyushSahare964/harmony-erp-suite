import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Free-text input with a suggestion list styled like SelectContent (a native <datalist> can't be themed). */
export function BreedInput({
  value,
  onChange,
  options,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> & {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const [open, setOpen] = React.useState(false);
  const q = value.trim().toLowerCase();
  const shown = options.filter((o) => o.toLowerCase().includes(q) && o.toLowerCase() !== q);

  return (
    <div className="relative">
      <Input
        {...props}
        autoComplete="off"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className={className}
      />
      {open && shown.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95">
          {shown.map((b) => (
            <div
              key={b}
              // mousedown, not click: fires before the input's blur closes the list
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(b);
                setOpen(false);
              }}
              className={cn("cursor-default select-none rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground")}
            >
              {b}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
