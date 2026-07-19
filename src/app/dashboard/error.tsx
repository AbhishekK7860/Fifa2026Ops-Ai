'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Optionally log to an error reporting service here
    console.error('Dashboard Error:', error);
  }, [error]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-md">
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle className="text-lg">Dashboard Error</AlertTitle>
          <AlertDescription className="mt-2 text-sm">
            {error.message || 'An unexpected rendering error occurred in the dashboard.'}
          </AlertDescription>
        </Alert>
        
        <div className="flex justify-center space-x-4">
          <Button onClick={reset} variant="outline" className="bg-white dark:bg-slate-900">
            <RefreshCcw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <Button onClick={() => window.location.href = '/'} variant="default">
            Return to Upload
          </Button>
        </div>
      </div>
    </div>
  );
}
