'use client';

import * as React from 'react';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboardStore } from '@/features/dashboard/store';
import { useAiAnalysis } from '@/features/ai-analysis/hooks';
import { Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

import { 
  CriticalAlertBanner, 
  GateTable, 
  GateCard, 
} from '@/features/dashboard/components';
import dynamic from 'next/dynamic';

const AnalysisCard = dynamic(() => import('@/features/ai-analysis/components/AnalysisCard').then(m => m.AnalysisCard), {
  loading: () => <div className="h-64 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl"><div className="w-8 h-8 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" /></div>
});

const QueueBarChart = dynamic(() => import('@/features/dashboard/components/QueueBarChart').then(m => m.QueueBarChart), {
  ssr: false,
  loading: () => <div className="h-64 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl"><div className="w-8 h-8 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" /></div>
});

const CapacityGaugeChart = dynamic(() => import('@/features/dashboard/components/CapacityGaugeChart').then(m => m.CapacityGaugeChart), {
  ssr: false,
  loading: () => <div className="h-64 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl"><div className="w-8 h-8 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" /></div>
});

const TimeSeriesChart = dynamic(() => import('@/features/dashboard/components/TimeSeriesChart').then(m => m.TimeSeriesChart), {
  ssr: false,
  loading: () => <div className="h-64 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl"><div className="w-8 h-8 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" /></div>
});

export default function DashboardPage() {
  const router = useRouter();
  
  const dataset = useDashboardStore(state => state.dataset);
  const rankedGates = useDashboardStore(state => state.rankedGates);
  const selectedGateId = useDashboardStore(state => state.selectedGateId);
  const selectGate = useDashboardStore(state => state.selectGate);
  
  const aiAnalyses = useDashboardStore(state => state.aiAnalyses);
  const isAnalyzing = useDashboardStore(state => state.isAnalyzing);
  const analysisMode = useDashboardStore(state => state.analysisMode);
  const getAnalysisKey = useDashboardStore(state => state.getAnalysisKey);
  const globalError = useDashboardStore(state => state.globalError);
  
  const { analyzeGate } = useAiAnalysis();
  
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [activeAnalysisKey, setActiveAnalysisKey] = useState<string | null>(null);

  const emptySubscribe = useCallback(() => () => {}, []);
  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  useEffect(() => {
    if (mounted && !dataset) {
      router.push('/');
    }
  }, [mounted, dataset, router]);

  const [prevGateId, setPrevGateId] = useState<string | null>(selectedGateId);
  if (selectedGateId !== prevGateId) {
    setPrevGateId(selectedGateId);
    setCurrentQuestion(null);
    setActiveAnalysisKey(null);
  }

  // Update active cache key asynchronously when question/gate changes
  useEffect(() => {
    let isCurrent = true;
    if (selectedGateId && currentQuestion) {
      getAnalysisKey(selectedGateId, currentQuestion).then(key => {
        if (isCurrent) setActiveAnalysisKey(key);
      });
    }
    return () => { isCurrent = false; };
  }, [selectedGateId, currentQuestion, getAnalysisKey]);

  // Stable handler — passed to memoized GateCard/GateTable children.
  // Must be above the early-return guard (Rules of Hooks).
  // Uses rankedGates + selectedGateId from closure (stable references) instead of
  // the post-early-return derived selectedGateRow variable.
  const handleNewQuestion = useCallback(async (q: string) => {
    if (!selectedGateId) return;
    const gateRow = rankedGates.find(rg => rg.gate.gate === selectedGateId)?.gate;
    if (!gateRow) return;
    setCurrentQuestion(q);
    await analyzeGate(gateRow, q);
  }, [selectedGateId, rankedGates, analyzeGate]);

  // Stable gate-select handler — above early return for hook ordering.
  const handleSelectGate = useCallback((gateId: string) => {
    selectGate(gateId);
  }, [selectGate]);

  if (!mounted || !dataset) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  const selectedGateRow = selectedGateId 
    ? rankedGates.find(rg => rg.gate.gate === selectedGateId)?.gate || null
    : null;
    
  const activeAnalysis = activeAnalysisKey ? aiAnalyses[activeAnalysisKey] : null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Skip-to-content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-emerald-600 focus:text-white focus:rounded-md focus:font-medium"
      >
        Skip to main content
      </a>
      <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-6">
        {/* Topbar */}
        <header className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800" role="banner">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">StadiumOps Dashboard</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Active dataset: <span className="font-semibold text-slate-700 dark:text-slate-300">dataset.csv</span> &bull; {dataset.rows.length} rows loaded
            </p>
          </div>
          <ThemeToggle />
        </header>

        <CriticalAlertBanner gates={rankedGates} />

        {/* Dashboard Grid */}
        <main id="main-content" className="grid grid-cols-1 lg:grid-cols-12 gap-8" role="main">
          
          {/* Left Column - Data Display */}
          <section aria-label="Gate overview" className="lg:col-span-5 xl:col-span-4 space-y-6">
            
            {/* Gate Cards Grid (Quick Overview) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" role="list" aria-label="Priority gate cards">
              {rankedGates.slice(0, 4).map(rg => (
                <div key={rg.gate.gate} role="listitem">
                  <GateCard 
                    gate={rg.gate} 
                    isSelected={selectedGateId === rg.gate.gate}
                    onClick={() => handleSelectGate(rg.gate.gate)}
                  />
                </div>
              ))}
            </div>

            {/* Full Gate Table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
              <h2 className="font-semibold mb-4 text-slate-900 dark:text-slate-100">All Gates Directory</h2>
              <GateTable 
                gates={rankedGates.map(rg => rg.gate)} 
                selectedGateId={selectedGateId}
                onRowClick={handleSelectGate} 
              />
            </div>

          </section>

          {/* Right Column - AI Insights & Visualizations */}
          <section aria-label="Analysis and charts" className="lg:col-span-7 xl:col-span-8 space-y-6">
            
            {/* Charts Area */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <QueueBarChart rankedGates={rankedGates} />
              <CapacityGaugeChart gate={selectedGateRow} />
            </div>
            
            <TimeSeriesChart rankedGates={rankedGates} />

            {/* AI Analysis Card */}
            {selectedGateRow ? (
              <AnalysisCard 
                result={activeAnalysis || null}
                mode={analysisMode}
                sourceData={selectedGateRow}
                onNewQuestion={handleNewQuestion}
                isAnalyzing={isAnalyzing}
                error={globalError}
              />
            ) : (
              <div
                role="status"
                aria-label="No gate selected"
                className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 h-64 p-6 flex flex-col items-center justify-center text-slate-500"
              >
                <p className="font-medium mb-1">No Gate Selected</p>
                <p className="text-sm">Select a gate from the list to begin AI analysis.</p>
              </div>
            )}

          </section>

        </main>
      </div>
    </div>
  );
}
