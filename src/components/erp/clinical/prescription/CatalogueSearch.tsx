import React, { useState, useEffect, useMemo, useRef } from "react";
import { Search, Loader2, Plus, Check, AlertCircle, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getItemsFn } from "@/lib/mongodb/serverFns/inventory";
import { useInventory } from "@/components/erp/inventory/useInventoryStore";

export type CatalogueType = "medicine" | "food" | "accessory";

export interface CatalogueSearchProps {
  type: CatalogueType;
  placeholder?: string;
  onSelect: (item: any) => void;
  excludeCodes?: string[];
  catalogItems?: any[];
  className?: string;
  autoClearOnSelect?: boolean;
  /** When false, the "+ Add custom" fallback button is hidden. Use false for stock-bound sections (Immediate, Injectable). Default true. */
  allowCustomAdd?: boolean;
}

/**
 * Filter items strictly by catalogue category to ensure strict catalogue separation.
 * Guardrail: Medicine search NEVER returns Food/Accessories, and vice-versa.
 */
export function filterByCatalogueType(items: any[], type: CatalogueType): any[] {
  if (!items || !Array.isArray(items)) return [];

  return items.filter((item) => {
    const pType = String(item.productType || "").toUpperCase();
    const cat = String(item.category || "").toLowerCase();

    if (type === "medicine") {
      // Must NOT be food or accessory
      if (pType === "FOOD" || pType === "ACCESSORY") return false;
      if (cat.includes("food") || cat.includes("accessory") || cat.includes("accessories")) return false;
      // Must be medicine / vaccine / pharmacy
      return (
        pType === "MEDICINE" ||
        cat === "medicine" ||
        cat === "vaccine" ||
        item.lineType === "Pharmacy" ||
        item.lineType === "Vaccine" ||
        (!pType && !cat)
      );
    }

    if (type === "food") {
      // Must NOT be medicine or accessory
      if (pType === "MEDICINE" || pType === "ACCESSORY") return false;
      if (cat.includes("medicine") || cat.includes("vaccine") || cat.includes("accessory") || cat.includes("accessories")) return false;
      // Must be food
      return (
        pType === "FOOD" ||
        cat === "food" ||
        cat === "animal food" ||
        item.lineType === "Food"
      );
    }

    if (type === "accessory") {
      // Must NOT be medicine or food
      if (pType === "MEDICINE" || pType === "FOOD") return false;
      if (cat.includes("medicine") || cat.includes("vaccine") || cat.includes("food")) return false;
      // Must be accessory
      return (
        pType === "ACCESSORY" ||
        cat === "accessory" ||
        cat === "animal accessories" ||
        item.lineType === "Accessory"
      );
    }

    return false;
  });
}

export function CatalogueSearch({
  type,
  placeholder,
  onSelect,
  excludeCodes = [],
  catalogItems,
  className,
  autoClearOnSelect = true,
  allowCustomAdd = true,
}: CatalogueSearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverItems, setServerItems] = useState<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const inventoryStore = useInventory();

  // Debounce input 250ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch items from server for this specific catalogue type
  useEffect(() => {
    let active = true;
    const loadItems = async () => {
      setLoading(true);
      try {
        const serverType =
          type === "medicine" ? "MEDICINE" : type === "food" ? "FOOD" : "ACCESSORY";
        const result = await getItemsFn({ data: { type: serverType, status: "Active" } });
        if (active && result && result.length > 0) {
          setServerItems(result);
        }
      } catch (err) {
        // Fallback to local store or seed items
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadItems();
    return () => {
      active = false;
    };
  }, [type]);

  // Combined pool of catalogue items for this type
  const availableItems = useMemo(() => {
    // 1. If server items returned, start with them
    let pool: any[] = serverItems.length > 0 ? [...serverItems] : [];

    // 2. If store has items, combine them
    if (pool.length === 0) {
      if (type === "medicine" && inventoryStore.medicinesList.length > 0) {
        pool = [...inventoryStore.medicinesList];
      } else if (type === "food" && inventoryStore.foodList.length > 0) {
        pool = [...inventoryStore.foodList];
      } else if (type === "accessory" && inventoryStore.accessoriesList.length > 0) {
        pool = [...inventoryStore.accessoriesList];
      }
    }

    // 3. Fallback to passed catalogItems
    if (pool.length === 0 && catalogItems && catalogItems.length > 0) {
      pool = [...catalogItems];
    }

    // Strictly enforce catalogue type filter
    return filterByCatalogueType(pool, type);
  }, [serverItems, inventoryStore, catalogItems, type]);

  // Filter by search query & exclude already selected items
  const filteredResults = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    const excludeSet = new Set(excludeCodes.map((c) => String(c).toLowerCase()));

    return availableItems.filter((item) => {
      const code = String(item.itemCode || item.id || "").toLowerCase();
      if (code && excludeSet.has(code)) return false;

      const name = String(item.name || "").toLowerCase();
      const generic = String(item.genericName || "").toLowerCase();
      const brand = String(item.brand || "").toLowerCase();
      const sku = String(item.sku || "").toLowerCase();

      if (!q) return true;
      return (
        name.includes(q) ||
        generic.includes(q) ||
        brand.includes(q) ||
        code.includes(q) ||
        sku.includes(q)
      );
    });
  }, [availableItems, debouncedQuery, excludeCodes]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectItem = (item: any) => {
    onSelect(item);
    if (autoClearOnSelect) {
      setQuery("");
      setDebouncedQuery("");
    }
    setIsOpen(false);
  };

  const defaultPlaceholder =
    type === "medicine"
      ? "Search medicine by name, generic, or brand..."
      : type === "food"
      ? "Search food item by brand, formula, or pack..."
      : "Search accessory by name or category...";

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative flex items-center">
        <Search className="absolute left-3 size-4 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder || defaultPlaceholder}
          className="pl-9 pr-9 h-10 bg-background text-sm rounded-lg border-border focus-visible:ring-2 focus-visible:ring-primary/20"
        />
        {loading && (
          <Loader2 className="absolute right-3 size-4 text-muted-foreground animate-spin pointer-events-none" />
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95">
          {filteredResults.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              {debouncedQuery ? (
                <span>No {type} items found matching &ldquo;{debouncedQuery}&rdquo; in Inventory.</span>
              ) : (
                <span>No available {type} items found.</span>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {filteredResults.slice(0, 20).map((item) => {
                const itemCode = item.itemCode || item.id;
                const price = item.defaultSalePrice ?? item.mrp ?? 0;
                const stock = item.currentStock ?? 0;

                return (
                  <button
                    key={itemCode || item.name}
                    type="button"
                    onClick={() => handleSelectItem(item)}
                    className="w-full flex items-center justify-between p-2.5 hover:bg-muted/60 transition-colors text-left text-xs rounded-md group"
                  >
                    <div className="flex items-start gap-2.5 min-w-0 pr-3">
                      <div className="size-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <Plus className="size-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-foreground truncate">{item.name}</span>
                          {itemCode && (
                            <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.2 rounded">
                              {itemCode}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                          {item.brand && <span>Brand: {item.brand}</span>}
                          {item.genericName && <span>· {item.genericName}</span>}
                          {item.unit && <span>· Unit: {item.unit}</span>}
                          {item.medicineDetails?.strength && (
                            <span>· {item.medicineDetails.strength}</span>
                          )}
                          {item.foodDetails?.packSize && (
                            <span>· {item.foodDetails.packSize}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-bold text-foreground font-mono block">
                        ₹{Number(price).toFixed(2)}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-mono",
                          stock > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                        )}
                      >
                        {stock > 0 ? `${stock} in stock` : "Available"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
