import { useDashboardStore } from '@/features/dashboard/store';
import type { AIAnalysisResult } from '@/types/analysis';
import type { GateRow } from '@/types/csv';

export function useAiAnalysis() {
  const { 
    uploadMeta, 
    aiAnalyses, 
    setAnalysisLoading, 
    cacheAnalysis, 
    setGlobalError,
    getAnalysisKey 
  } = useDashboardStore();

  const analyzeGate = async (gateRow: GateRow, question: string) => {
    if (!uploadMeta?.datasetHash) {
      setGlobalError('Dataset hash missing. Cannot perform analysis.');
      return;
    }

    try {
      setAnalysisLoading(true);

      const cacheKey = await getAnalysisKey(gateRow.gate, question);
      
      if (aiAnalyses[cacheKey]) {
        // Already cached, just simulate a tiny delay for UX then return
        await new Promise(r => setTimeout(r, 400));
        setAnalysisLoading(false);
        // The UI component reads from the store automatically, so we're done here
        return;
      }

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gateRow,
          question,
          datasetHash: uploadMeta.datasetHash
        })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to analyze gate data');
      }

      await cacheAnalysis(gateRow.gate, question, data.result as AIAnalysisResult, data.mode);
      
    } catch (err: unknown) {
      console.error(err);
      // Let the global UI error boundary handle this or show a toast in a real app
      // For this spec, we just set the offline mode banner via fallback inside the API route.
      // If the route itself 500s or network fails, we fall back to offline local rule if we had it client side,
      // but Phase 3 built the offline fallback *server-side*.
      // So if fetch fails completely (network error), we might want to handle it.
      setGlobalError(err instanceof Error ? err.message : 'Unknown analysis error');
      setAnalysisLoading(false);
    }
  };

  return { analyzeGate };
}
