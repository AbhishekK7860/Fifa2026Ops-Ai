import { RankedGate } from "@/types/csv";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface CriticalAlertBannerProps {
  gates: RankedGate[];
}

export function CriticalAlertBanner({ gates }: CriticalAlertBannerProps) {
  const criticalGates = gates.filter((g) => g.gate.status === "critical");

  if (criticalGates.length === 0) {
    return null;
  }

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Critical Alert</AlertTitle>
      <AlertDescription>
        The following gates are currently in a critical state:{" "}
        <span className="font-bold">
          {criticalGates.map((g) => g.gate.gate).join(", ")}
        </span>
      </AlertDescription>
    </Alert>
  );
}
