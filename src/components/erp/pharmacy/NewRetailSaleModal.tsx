import { useState, useEffect, useMemo } from "react";
import {
  Pill,
  Search,
  Trash2,
  CheckCircle2,
  ShoppingBag,
  Bone,
  Tag,
  Beef,
  AlertCircle,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { listPetsWithOwnersFn } from "@/lib/mongodb/serverFns/crm";
import { cn } from "@/lib/utils";
import { useInventory } from "@/components/erp/inventory/useInventoryStore";
import type { MedicineCategory } from "@/components/erp/inventory/useInventoryStore";

interface CartItem {
  id: string;
  itemCode: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  gstRate: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaleCompleted?: (sale: any) => void;
}

const POS_CATEGORIES: Array<{ key: string; label: string; icon?: React.ReactNode }> = [
  { key: "All",                label: "All Items" },
  { key: "Medicine",           label: "Medicine",           icon: <Pill className="size-3" /> },
  { key: "Animal Food",        label: "Animal Food",        icon: <Beef className="size-3" /> },
  { key: "Animal Accessories", label: "Animal Accessories", icon: <Tag className="size-3" /> },
  { key: "Food",               label: "Food",               icon: <Bone className="size-3" /> },
  { key: "Accessory",          label: "Accessory",          icon: <Tag className="size-3" /> },
  { key: "Consumable",         label: "Consumable" },
];

export function NewRetailSaleModal({ open, onClose, onSaleCompleted }: Props) {
  // Inventory store — live stock
  const {
    medicines,
    getTotalQty,
    getStockStatus,
    recordSale,
  } = useInventory();

  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [searchItemQuery, setSearchItemQuery] = useState("");

  // Customer / Patient Info
  const [customerType, setCustomerType] = useState<"walkin" | "registered">("walkin");
  const [customerName, setCustomerName] = useState("Walk-in Retail Customer");
  const [customerPhone, setCustomerPhone] = useState("");
  const [pets, setPets] = useState<any[]>([]);
  const [selectedPet, setSelectedPet] = useState<any | null>(null);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMode, setPaymentMode] = useState<"UPI" | "Cash" | "Card">("UPI");
  const [trxRef, setTrxRef] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      void loadPets();
      setCart([]);
    }
  }, [open]);

  const loadPets = async () => {
    try {
      const petsData = await listPetsWithOwnersFn();
      setPets(petsData || []);
    } catch (e) {
      console.error(e);
    }
  };

  // Use live inventory from store instead of server fetch
  const inventory = useMemo(
    () => medicines.filter((m) => m.status === "Active"),
    [medicines]
  );

  const filteredItems = useMemo(() => {
    const q = searchItemQuery.toLowerCase().trim();
    return inventory.filter((it) => {
      const matchCat = activeCategory === "All" || it.category === activeCategory;
      const matchQ =
        !q ||
        it.name.toLowerCase().includes(q) ||
        it.id.toLowerCase().includes(q) ||
        it.genericName.toLowerCase().includes(q) ||
        it.brand?.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [inventory, activeCategory, searchItemQuery]);

  const addToCart = (item: typeof inventory[0]) => {
    const availableStock = getTotalQty(item.id);
    setCart((prev) => {
      const existing = prev.find((c) => c.itemCode === item.id);
      const currentQty = existing ? existing.quantity : 0;
      if (currentQty >= availableStock) {
        toast.error(`Only ${availableStock} units available in stock for "${item.name}"`);
        return prev;
      }
      if (existing) {
        return prev.map((c) =>
          c.itemCode === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [
        ...prev,
        {
          id: String(Date.now()),
          itemCode: item.id,
          name: item.name,
          category: item.category,
          unit: item.unit,
          quantity: 1,
          unitPrice: item.defaultSalePrice,
          discountPercent: 0,
          gstRate: item.gstRate || 0,
        },
      ];
    });
    toast.success(`Added ${item.name} to cart`);
  };

  const updateCartQty = (id: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((c) => c.id !== id));
      return;
    }
    // Validate against live stock
    const cartItem = cart.find((c) => c.id === id);
    if (cartItem) {
      const avail = getTotalQty(cartItem.itemCode);
      if (qty > avail) {
        toast.error(`Only ${avail} units in stock for "${cartItem.name}"`);
        return;
      }
    }
    setCart((prev) =>
      prev.map((c) => (c.id === id ? { ...c, quantity: qty } : c))
    );
  };

  const updateCartDiscount = (id: string, disc: number) => {
    setCart((prev) =>
      prev.map((c) => (c.id === id ? { ...c, discountPercent: Math.min(100, Math.max(0, disc)) } : c))
    );
  };

  const removeCartItem = (id: string) => {
    setCart((prev) => prev.filter((c) => c.id !== id));
  };

  // Cart summary
  const totals = useMemo(() => {
    let subtotal = 0;
    let totalGst = 0;

    for (const item of cart) {
      const gross = item.quantity * item.unitPrice;
      const net = gross * (1 - item.discountPercent / 100);
      subtotal += net;
      if (item.gstRate > 0) {
        totalGst += (net * item.gstRate) / 100;
      }
    }

    const grandTotal = Math.round(subtotal + totalGst);
    return { subtotal, gst: totalGst, grandTotal };
  }, [cart]);

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast.error("Cart is empty. Please add items from inventory.");
      return;
    }
    // Final stock validation
    for (const c of cart) {
      const avail = getTotalQty(c.itemCode);
      if (c.quantity > avail) {
        toast.error(`Insufficient stock: only ${avail} of "${c.name}" available.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const billNo = `RET-${Math.floor(400 + Math.random() * 600)}`;
      // Deduct stock via FEFO for each cart line (synchronous)
      for (const c of cart) {
        const result = recordSale({ medicineId: c.itemCode, qty: c.quantity, sourceRef: billNo, actor: "POS" });
        if (!result.ok) {
          toast.error(result.error || `Failed to deduct stock for ${c.name}`);
          setSubmitting(false);
          return;
        }
      }
      const newSale = {
        bill: billNo,
        item: cart.map((c) => `${c.name} (x${c.quantity})`).join(", "),
        category: cart[0]?.category || "Medicine",
        items: cart,
        qty: cart.reduce((acc, c) => acc + c.quantity, 0),
        amount: totals.grandTotal,
        subtotal: totals.subtotal,
        gst: totals.gst,
        payment: paymentMode,
        trxRef: trxRef || undefined,
        customer: customerType === "registered" && selectedPet ? `${selectedPet.owner?.name} (${selectedPet.name})` : customerName,
        customerPhone: customerType === "registered" && selectedPet ? selectedPet.owner?.phone : customerPhone,
        date: new Date().toISOString().slice(0, 10),
        status: "Completed",
      };
      toast.success(`Retail Bill ${billNo} generated & payment of ₹${totals.grandTotal} collected!`);
      onSaleCompleted?.(newSale);
      setCart([]);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Checkout failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-5xl border-border bg-card shadow-2xl p-0 gap-0">
        {/* Header */}
        <div className="border-b border-border p-5 bg-muted/20 flex items-center justify-between">
          <DialogHeader className="p-0">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-xs">
                <ShoppingBag className="size-5" />
              </span>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Point of Sale (POS) — Pharmacy &amp; Pet Accessories
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Direct counter billing synced live with inventory stock and pricing
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border">
          {/* Left Column: Live Inventory Catalogue Selector (7 Cols) */}
          <div className="lg:col-span-7 p-5 space-y-4">
            {/* Category Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-2.5">
              {POS_CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1",
                    activeCategory === cat.key
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {cat.icon}
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Live Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search live stock by item name, SKU code (e.g. M-0001), brand..."
                value={searchItemQuery}
                onChange={(e) => setSearchItemQuery(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>

            {/* Inventory Items Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto p-1">
              {filteredItems.map((item) => {
                const availQty = getTotalQty(item.id);
                const stockStatus = getStockStatus(item.id);
                const isOutOfStock = availQty === 0;
                return (
                  <div
                    key={item.id}
                    onClick={() => !isOutOfStock && addToCart(item)}
                    className={cn(
                      "rounded-xl border border-border bg-card p-3 transition-all flex flex-col justify-between space-y-2 shadow-2xs group",
                      isOutOfStock
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:border-primary/40 hover:bg-primary-soft/20 cursor-pointer"
                    )}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {item.id}
                        </span>
                        <Badge variant="outline" className={cn(
                          "text-[9px] py-0 font-bold",
                          item.category === "Animal Accessories" ? "bg-violet-500/10 text-violet-700 border-violet-500/30" :
                          item.category === "Animal Food"        ? "bg-amber-500/10 text-amber-600 border-amber-500/30" :
                          item.category === "Accessory"          ? "bg-purple-500/10 text-purple-600 border-purple-500/30" :
                          item.category === "Food"               ? "bg-amber-500/10 text-amber-600 border-amber-500/30" :
                          "bg-primary/10 text-primary border-primary/30"
                        )}>
                          {item.category}
                        </Badge>
                      </div>
                      <h5 className="text-xs font-bold text-foreground mt-1 line-clamp-1 group-hover:text-primary transition-colors">
                        {item.name}
                      </h5>
                      {item.brand && (
                        <p className="text-[10px] text-muted-foreground">{item.brand}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      {/* Stock indicator */}
                      <div className="flex items-center gap-1">
                        {isOutOfStock ? (
                          <span className="flex items-center gap-1 text-[10px] text-destructive font-semibold">
                            <AlertCircle className="size-3" /> Out of Stock
                          </span>
                        ) : stockStatus === "Low" ? (
                          <span className="text-[10px] text-warning font-semibold">⚠ Low: {availQty} left</span>
                        ) : (
                          <span className="text-[10px] text-success font-semibold">✓ In Stock: {availQty}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-border/50 text-xs">
                        <span className="text-[10px] text-muted-foreground font-mono">
                          Per {item.unit} · GST {item.gstRate}%
                        </span>
                        <span className="font-mono font-bold text-sm text-foreground">
                          ₹{item.defaultSalePrice.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredItems.length === 0 && (
                <div className="col-span-2 py-12 text-center text-xs text-muted-foreground">
                  No inventory items match your search.
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Customer Info, Cart & Instant Payment (5 Cols) */}
          <div className="lg:col-span-5 p-5 space-y-4 bg-muted/10 flex flex-col justify-between">
            <div className="space-y-4">
              {/* Customer Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground">Customer Type</Label>
                  <div className="flex gap-2 text-xs">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        checked={customerType === "walkin"}
                        onChange={() => setCustomerType("walkin")}
                      />
                      <span>Walk-in</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        checked={customerType === "registered"}
                        onChange={() => setCustomerType("registered")}
                      />
                      <span>CRM Patient</span>
                    </label>
                  </div>
                </div>

                {customerType === "walkin" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Customer Name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="text-xs h-8"
                    />
                    <Input
                      placeholder="Mobile No."
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="text-xs h-8 font-mono"
                    />
                  </div>
                ) : (
                  <Select
                    value={selectedPet?.petId || ""}
                    onValueChange={(val) => {
                      const p = pets.find((item) => item.petId === val);
                      setSelectedPet(p || null);
                    }}
                  >
                    <SelectTrigger className="text-xs h-8 bg-card">
                      <SelectValue placeholder="Select patient..." />
                    </SelectTrigger>
                    <SelectContent>
                      {pets.map((p) => (
                        <SelectItem key={p.petId} value={p.petId}>
                          {p.name} ({p.owner?.name} · {p.petId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Cart Items List */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                    <ShoppingBag className="size-3.5 text-primary" /> Active Cart ({cart.length})
                  </Label>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    Subtotal: ₹{totals.subtotal.toFixed(2)}
                  </span>
                </div>

                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-lg border border-border bg-card text-xs flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground truncate">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          ₹{item.unitPrice} x {item.quantity} = ₹{(item.quantity * item.unitPrice).toFixed(2)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.id, item.quantity - 1)}
                          className="size-6 rounded bg-muted hover:bg-muted/80 flex items-center justify-center font-bold text-xs"
                        >
                          -
                        </button>
                        <span className="font-mono font-bold px-1">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.id, item.quantity + 1)}
                          className="size-6 rounded bg-muted hover:bg-muted/80 flex items-center justify-center font-bold text-xs"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => removeCartItem(item.id)}
                          className="text-muted-foreground hover:text-destructive p-1"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {cart.length === 0 && (
                    <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                      Click items from inventory on the left to add to cart
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Mode Selection */}
              <div className="space-y-1.5 pt-2 border-t border-border">
                <Label className="text-xs font-semibold">Payment Mode</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["UPI", "Cash", "Card"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPaymentMode(mode)}
                      className={cn(
                        "py-1.5 text-xs font-bold rounded-lg border transition-all",
                        paymentMode === mode
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-card text-foreground border-border hover:bg-muted"
                      )}
                    >
                      {mode === "UPI" ? "📱 UPI" : mode === "Cash" ? "💵 Cash" : "💳 Card"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Total & Checkout Button */}
            <div className="pt-3 border-t border-border space-y-3">
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal:</span>
                  <span className="font-mono font-semibold">₹{totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>GST Taxes:</span>
                  <span className="font-mono font-semibold">+₹{totals.gst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-foreground border-t border-border/60 pt-1">
                  <span>Grand Total:</span>
                  <span className="text-base font-mono font-black text-primary">₹{totals.grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <Button
                size="lg"
                onClick={handleCheckout}
                disabled={submitting || cart.length === 0}
                className="w-full font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs h-10 gap-1.5"
              >
                <CheckCircle2 className="size-4" /> Finalize &amp; Collect ₹{totals.grandTotal} ✓
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
