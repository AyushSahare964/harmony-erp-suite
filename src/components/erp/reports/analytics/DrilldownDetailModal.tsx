import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type DrilldownTarget } from "./analyticsTypes";

interface Props {
  target: DrilldownTarget | null;
  onClose: () => void;
}

export function DrilldownDetailModal({ target, onClose }: Props) {
  if (!target) return null;

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl border-border bg-card shadow-2xl p-0">
        <div className="border-b border-border p-5 bg-muted/20">
          <DialogHeader className="p-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  {target.title}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Detailed record inspection &amp; underlying transaction log
                </DialogDescription>
              </div>
              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                {target.type}
              </Badge>
            </div>
          </DialogHeader>
        </div>

        <div className="p-5 space-y-4">
          {Array.isArray(target.data) && target.data.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground border-b border-border text-left font-bold uppercase tracking-wider text-[10px]">
                    {Object.keys(target.data[0] || {}).map((col) => (
                      <th key={col} className="px-3 py-2">
                        {col.replace(/([A-Z])/g, " $1").trim()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {target.data.map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-muted/30 transition-colors">
                      {Object.values(row).map((val: any, cIdx: number) => (
                        <td key={cIdx} className="px-3 py-2 text-foreground font-medium whitespace-nowrap">
                          {typeof val === "object" ? JSON.stringify(val) : String(val ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : typeof target.data === "object" && target.data !== null ? (
            <div className="grid grid-cols-2 gap-3 p-4 bg-muted/20 rounded-xl border border-border text-xs">
              {Object.entries(target.data).map(([k, v]) => (
                <div key={k} className="space-y-0.5">
                  <p className="text-muted-foreground uppercase text-[10px] font-bold">
                    {k.replace(/([A-Z])/g, " $1").trim()}
                  </p>
                  <p className="font-bold text-foreground">
                    {typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic py-6 text-center">
              No underlying records to display.
            </p>
          )}

          <div className="flex justify-end pt-2">
            <Button size="sm" variant="outline" onClick={onClose} className="h-8 text-xs font-semibold">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
