import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AnalysisMode } from '@/types/analysis';

interface OfflineModeBannerProps {
  mode: AnalysisMode;
}

export const OfflineModeBanner: React.FC<OfflineModeBannerProps> = ({ mode }) => {
  if (mode !== 'offline') {
    return null;
  }

  return (
    <Alert variant="default" className="mb-4">
      <AlertTitle>Offline Analysis Mode</AlertTitle>
      <AlertDescription>
        Offline Analysis Mode — AI unavailable, showing rule-based analysis
      </AlertDescription>
    </Alert>
  );
};
