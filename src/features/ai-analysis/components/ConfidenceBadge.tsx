import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ConfidenceBadgeProps {
  score: number;
  basis: string;
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({ score, basis }) => {
  let colorClass = 'bg-red-500 hover:bg-red-600';
  if (score >= 70) {
    colorClass = 'bg-green-500 hover:bg-green-600';
  } else if (score >= 40) {
    colorClass = 'bg-amber-500 hover:bg-amber-600';
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge className={colorClass}>
            Confidence: {score}%
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{basis}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
