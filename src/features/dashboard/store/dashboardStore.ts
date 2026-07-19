import { create } from 'zustand';
import type { ValidationResult, RankedGate } from '@/types/csv';
import type { AIAnalysisResult, AnalysisMode } from '@/types/analysis';
import { rankGates } from '../utils/gateRanking';
import { sha256 } from '@/lib/helpers/hashUtils';

export interface UploadMeta {
  filename: string;
  timestamp: number;
  rowCount: number;
  datasetHash: string;
}

interface DashboardState {
  dataset: ValidationResult | null;
  rankedGates: RankedGate[];
  selectedGateId: string | null;
  uploadMeta: UploadMeta | null;
  aiAnalyses: Record<string, AIAnalysisResult>;
  isAnalyzing: boolean;
  analysisMode: AnalysisMode;
  globalError: string | null;

  // Actions
  setDataset: (dataset: ValidationResult, filename: string, datasetHash: string) => void;
  selectGate: (gateId: string | null) => void;
  setAnalysisLoading: (loading: boolean) => void;
  cacheAnalysis: (gateId: string, question: string, result: AIAnalysisResult, mode: AnalysisMode) => Promise<void>;
  getAnalysisKey: (gateId: string, question: string) => Promise<string>;
  setAnalysisMode: (mode: AnalysisMode) => void;
  setGlobalError: (error: string | null) => void;
  clearDataset: () => void;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  dataset: null,
  rankedGates: [],
  selectedGateId: null,
  uploadMeta: null,
  aiAnalyses: {},
  isAnalyzing: false,
  analysisMode: 'ai',
  globalError: null,

  setDataset: (dataset: ValidationResult, filename: string, datasetHash: string) => {
    // Rank gates immediately on load
    const ranked = rankGates(dataset.rows);
    set({
      dataset,
      rankedGates: ranked,
      selectedGateId: null, // clear selection on new dataset
      aiAnalyses: {}, // clear cache on new dataset
      isAnalyzing: false,
      globalError: null,
      uploadMeta: {
        filename,
        timestamp: Date.now(),
        rowCount: dataset.rows.length,
        datasetHash
      }
    });
  },

  selectGate: (gateId) => set({ selectedGateId: gateId }),

  setAnalysisLoading: (loading) => set({ isAnalyzing: loading }),

  getAnalysisKey: async (gateId: string, question: string) => {
    const hash = get().uploadMeta?.datasetHash || 'unknown';
    // Incorporate the question hash per Phase 3 / Phase 4 update
    const questionHash = await sha256(question);
    return `${hash}|${gateId}|${questionHash}`;
  },

  cacheAnalysis: async (gateId, question, result, mode) => {
    const key = await get().getAnalysisKey(gateId, question);
    set((state) => ({
      aiAnalyses: {
        ...state.aiAnalyses,
        [key]: result
      },
      analysisMode: mode,
      isAnalyzing: false
    }));
  },

  setAnalysisMode: (mode) => set({ analysisMode: mode }),

  setGlobalError: (error) => set({ globalError: error }),

  clearDataset: () => set({
    dataset: null,
    rankedGates: [],
    selectedGateId: null,
    uploadMeta: null,
    aiAnalyses: {},
    isAnalyzing: false,
    analysisMode: 'ai',
    globalError: null
  })
}));
