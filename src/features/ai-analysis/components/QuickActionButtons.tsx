import React from 'react';
import { Button } from '@/components/ui/button';

interface QuickActionButtonsProps {
  onActionSelect: (prompt: string) => void;
  isAnalyzing: boolean;
}

export const QuickActionButtons: React.FC<QuickActionButtonsProps> = ({ onActionSelect, isAnalyzing }) => {
  const actions = [
    "Analyze Crowd Risk",
    "Suggest Volunteer Redeployment",
    "Generate Public Announcement",
    "Assess Medical Readiness",
    "Evaluate Transport Impact",
    "Prioritize Gate Response"
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-4">
      {actions.map((action) => (
        <Button
          key={action}
          variant="outline"
          onClick={() => onActionSelect(action)}
          disabled={isAnalyzing}
          className="h-auto py-2 px-3 whitespace-normal text-left justify-start text-sm"
        >
          {action}
        </Button>
      ))}
    </div>
  );
};
