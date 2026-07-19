import { memo } from "react";
import { GateRow } from "@/types/csv";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface GateCardProps {
  gate: GateRow;
  isSelected: boolean;
  onClick: () => void;
}

export const GateCard = memo(function GateCard({ gate, isSelected, onClick }: GateCardProps) {
  const statusColorMap = {
    normal: "bg-emerald-600 text-white hover:bg-emerald-700",
    busy: "bg-amber-400 text-slate-950 hover:bg-amber-500",
    critical: "bg-rose-600 text-white hover:bg-rose-700",
  };

  const statusLabel = { normal: 'Normal', busy: 'Busy', critical: 'Critical' };

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md focus-within:ring-2 focus-within:ring-primary",
        isSelected && "ring-2 ring-primary border-primary"
      )}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      tabIndex={0}
      role="button"
      aria-pressed={isSelected}
      aria-label={`${gate.gate}, ${statusLabel[gate.status]} status${isSelected ? ', selected' : ''}`}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-bold">{gate.gate}</CardTitle>
        <Badge className={statusColorMap[gate.status]}>
          {gate.status.charAt(0).toUpperCase() + gate.status.slice(1)}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Queue Length:</span>
            <span className="font-medium">{gate.queueLength}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Capacity:</span>
            <span className="font-medium">{gate.capacity}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current Visitors:</span>
            <span className="font-medium">{gate.currentVisitors}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
