import { memo } from "react";
import { GateRow } from "@/types/csv";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface GateTableProps {
  gates: GateRow[];
  onRowClick?: (gateId: string) => void;
  selectedGateId?: string | null;
}

export const GateTable = memo(function GateTable({ gates, onRowClick, selectedGateId }: GateTableProps) {
  const statusColorMap = {
    normal: "bg-emerald-600 text-white hover:bg-emerald-700",
    busy: "bg-amber-400 text-slate-950 hover:bg-amber-500",
    critical: "bg-rose-600 text-white hover:bg-rose-700",
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Gate</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Queue</TableHead>
            <TableHead className="text-right">Capacity</TableHead>
            <TableHead className="text-right">Visitors</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {gates.map((gate) => (
            <TableRow
              key={gate.gate}
              className={cn(
                "cursor-pointer",
                selectedGateId === gate.gate && "bg-muted"
              )}
              onClick={() => onRowClick?.(gate.gate)}
            >
              <TableCell className="font-medium">{gate.gate}</TableCell>
              <TableCell>
                <Badge className={statusColorMap[gate.status]}>
                  {gate.status.charAt(0).toUpperCase() + gate.status.slice(1)}
                </Badge>
              </TableCell>
              <TableCell className="text-right">{gate.queueLength}</TableCell>
              <TableCell className="text-right">{gate.capacity}</TableCell>
              <TableCell className="text-right">{gate.currentVisitors}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
});
