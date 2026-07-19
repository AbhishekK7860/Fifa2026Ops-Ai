import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AIAnalysisResult, AnalysisMode } from '@/types/analysis';
import { GateRow } from '@/types/csv';
import { Button } from '@/components/ui/button';
import { QuickActionButtons } from './QuickActionButtons';
import { OfflineModeBanner } from './OfflineModeBanner';
import { ConfidenceBadge } from './ConfidenceBadge';
import { MultilingualAnnouncement } from './MultilingualAnnouncement';
import { AnalysisExport } from './AnalysisExport';
interface AnalysisCardProps {
  result: AIAnalysisResult | null;
  mode: AnalysisMode;
  sourceData: GateRow;
  onNewQuestion: (q: string) => void;
  isAnalyzing: boolean;
  error?: string | null;
}

export const AnalysisCard: React.FC<AnalysisCardProps> = ({
  result,
  mode,
  sourceData,
  onNewQuestion,
  isAnalyzing,
  error
}) => {
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl font-bold">
            AI Analysis
          </CardTitle>
          {result && (
            <ConfidenceBadge 
              score={result.confidence.score} 
              basis={result.confidence.basis} 
            />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <OfflineModeBanner mode={mode} />
        
        {!result ? (
          <div>
            <p className="text-sm text-muted-foreground mb-2">Select an action to analyze {sourceData.gate}:</p>
            {error && (
              <div className="bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 p-3 rounded-md border border-rose-200 dark:border-rose-900 text-sm mb-3">
                {error}
              </div>
            )}
            <QuickActionButtons onActionSelect={onNewQuestion} isAnalyzing={isAnalyzing} />
          </div>
        ) : (
          <div className="space-y-6" aria-live="polite" aria-atomic="true">
            <div>
              <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-1">Observation</h4>
              <p className="text-sm">{result.observation}</p>
            </div>
            
            <div>
              <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-1">Reasoning</h4>
              <p className="text-sm">{result.reasoning}</p>
            </div>
            
            <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
              <h4 className="font-semibold text-sm uppercase tracking-wider text-primary mb-1">Recommended Action</h4>
              <p className="text-sm font-medium">{result.recommendedAction}</p>
            </div>
            
            <div>
              <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-1">Expected Impact</h4>
              <p className="text-sm">{result.expectedImpact}</p>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-2">Announcements</h4>
              <MultilingualAnnouncement 
                announcement={{
                  english: result.multilingualAnnouncement.en,
                  spanish: result.multilingualAnnouncement.es,
                  french: result.multilingualAnnouncement.fr
                }} 
              />
            </div>

            <Separator />
            
            <details className="group border rounded-lg p-3">
              <summary className="font-semibold text-sm cursor-pointer list-none flex justify-between items-center text-muted-foreground">
                Source Data
                <span className="transition group-open:rotate-180">
                  <svg fill="none" height="24" shapeRendering="geometricPrecision" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="24"><path d="M6 9l6 6 6-6"></path></svg>
                </span>
              </summary>
              <div className="mt-3 text-xs text-muted-foreground">
                <ul className="list-disc pl-5 space-y-1">
                  {result.sourceDataRefs.map((ref, idx) => (
                    <li key={idx}>{ref}</li>
                  ))}
                </ul>
                <div className="mt-4 pt-4 border-t">
                  <p><strong>Gate:</strong> {sourceData.gate}</p>
                  <p><strong>Status:</strong> {sourceData.status}</p>
                  <p><strong>Visitors:</strong> {sourceData.currentVisitors} / {sourceData.capacity}</p>
                </div>
              </div>
            </details>
          </div>
        )}
      </CardContent>
      {result && (
        <CardFooter className="flex justify-between items-center">
          <Button variant="outline" onClick={() => onNewQuestion("Generate a new analysis")} disabled={isAnalyzing}>
            Refresh Analysis
          </Button>
          <AnalysisExport result={result} />
        </CardFooter>
      )}
    </Card>
  );
};
