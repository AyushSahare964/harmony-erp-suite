import { useEffect, useState } from "react";
import { BadgePercent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listDiscountSchemesFn, type DiscountSchemeRow } from "@/lib/mongodb/serverFns/discountSchemes";
import { ongoingSchemes } from "@/lib/utils/discountSchemes";
import { formatDisplayDate } from "@/lib/utils/dateUtils";

interface Props {
  /** Apply the scheme % to every discount-enabled line (food, diet, accessories). */
  onApply: (percent: number) => void;
  disabled?: boolean;
}

/** Highlights ongoing discount schemes to the doctor. Renders nothing if none (or on fetch error). */
export function ActiveSchemeBanner({ onApply, disabled }: Props) {
  const [active, setActive] = useState<DiscountSchemeRow[]>([]);

  useEffect(() => {
    listDiscountSchemesFn()
      .then((all) => setActive(ongoingSchemes(all)))
      .catch(() => setActive([]));
  }, []);

  if (active.length === 0) return null;

  return (
    <div className="space-y-2">
      {active.map((s) => (
        <div
          key={s._id}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-green-500/40 bg-green-50 px-4 py-3 text-green-900"
        >
          <BadgePercent className="size-5 shrink-0 text-green-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">
              Offer running: {s.name} - {s.discountPercent}% off
            </p>
            <p className="text-xs">
              Valid till {formatDisplayDate(s.endDate)}
              {s.description ? ` · ${s.description}` : ""}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            className="border-green-600/50 bg-white text-green-800 hover:bg-green-100"
            onClick={() => onApply(s.discountPercent)}
          >
            Apply {s.discountPercent}% to food &amp; accessories
          </Button>
        </div>
      ))}
    </div>
  );
}
