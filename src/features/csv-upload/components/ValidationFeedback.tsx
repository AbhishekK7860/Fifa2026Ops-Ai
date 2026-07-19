import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';
import type { ValidationResult } from '@/types/csv';

interface ValidationFeedbackProps {
  result: ValidationResult | null;
  error?: string | null;
}

export function ValidationFeedback({ result, error }: ValidationFeedbackProps) {
  if (error) {
    return (
      <Alert variant="destructive" className="mt-4">
        <XCircle className="h-4 w-4" />
        <AlertTitle>Upload Failed</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!result) return null;

  if (!result.valid) {
    return (
      <Alert variant="destructive" className="mt-4">
        <XCircle className="h-4 w-4" />
        <AlertTitle>Validation Errors Found</AlertTitle>
        <AlertDescription>
          <p className="mb-2 text-sm">Please fix the following issues in your CSV and try again:</p>
          <ScrollArea className="h-32 rounded-md border border-destructive/20 bg-destructive/5 p-2">
            <ul className="list-disc space-y-1 pl-4 text-xs">
              {result.errors.map((err, idx) => (
                <li key={idx}>
                  {err.row ? <span className="font-semibold">Row {err.row}: </span> : null}
                  {err.column ? <Badge variant="outline" className="mr-1 text-[10px]">{err.column}</Badge> : null}
                  {err.message}
                </li>
              ))}
            </ul>
          </ScrollArea>
        </AlertDescription>
      </Alert>
    );
  }

  if (result.warnings.length > 0) {
    return (
      <Alert variant="default" className="mt-4 border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200">
        <AlertTriangle className="h-4 w-4 stroke-amber-600 dark:stroke-amber-400" />
        <AlertTitle>Dataset Loaded with Warnings</AlertTitle>
        <AlertDescription>
          <p className="mb-2 text-sm">The data was loaded successfully, but some anomalies were detected:</p>
          <ScrollArea className="h-24 rounded-md border border-amber-500/20 bg-amber-500/5 p-2">
            <ul className="list-disc space-y-1 pl-4 text-xs">
              {result.warnings.map((warn, idx) => (
                <li key={idx}>
                  {warn.row ? <span className="font-semibold">Row {warn.row}: </span> : null}
                  {warn.column ? <Badge variant="outline" className="mr-1 border-amber-500/30 text-[10px]">{warn.column}</Badge> : null}
                  {warn.message}
                </li>
              ))}
            </ul>
          </ScrollArea>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="mt-4 border-emerald-500/50 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200">
      <CheckCircle2 className="h-4 w-4 stroke-emerald-600 dark:stroke-emerald-400" />
      <AlertTitle>Success</AlertTitle>
      <AlertDescription className="text-sm">
        Dataset validated and loaded successfully. 
      </AlertDescription>
    </Alert>
  );
}
