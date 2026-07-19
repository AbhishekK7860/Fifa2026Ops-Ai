import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardPage from '@/app/dashboard/page';
import { useDashboardStore } from '@/features/dashboard/store';
import { useRouter } from 'next/navigation';
import { expect, test, vi, beforeEach, describe } from 'vitest';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// Mock ResizeObserver for Recharts
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('Analysis Flow End-to-End', () => {
  const mockPush = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Seed the store with a loaded dataset
    useDashboardStore.setState({ 
      dataset: {
        valid: true,
        errors: [],
        warnings: [],
        rows: [{ gate: 'Gate A', status: 'normal', capacity: 100, currentVisitors: 50, queueLength: 5, volunteerCount: 2, medicalIncidents: 0, transportDelay: 0, weather: 'Sunny' }],
        rowCount: 1
      },
      rankedGates: [
        { gate: { gate: 'Gate A', status: 'normal', capacity: 100, currentVisitors: 50, queueLength: 5, volunteerCount: 2, medicalIncidents: 0, transportDelay: 0, weather: 'Sunny' }, priorityScore: 10, rank: 1 }
      ],
      selectedGateId: null,
      uploadMeta: {
        filename: 'test.csv',
        timestamp: Date.now(),
        rowCount: 1,
        datasetHash: 'abc123hash'
      },
      aiAnalyses: {},
      isAnalyzing: false,
      analysisMode: 'ai',
      globalError: null
    });
    
    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({ push: mockPush });
    global.fetch = vi.fn();
  });

  test('full gate selection and quick action flow', async () => {
    const user = userEvent.setup();
    
    // 1. Mock the API response for the exact contract
    const mockApiResponse = {
      result: {
        observation: "Gate A is normal",
        reasoning: "Wait times are low.",
        action: "No action needed.", // Wait, it's recommendedAction and expectedImpact!
        recommendedAction: "No action needed.",
        expectedImpact: "Smooth operations.",
        confidence: { score: 95, basis: "Clear data" },
        multilingualAnnouncement: {
          en: "All clear.",
          es: "Todo claro.",
          fr: "Tout est clair."
        },
        sourceDataRefs: ["gate: Gate A"]
      },
      mode: "ai",
      generatedAt: new Date().toISOString(),
      gateId: "Gate A",
      question: "Analyze Crowd Risk"
    };
    
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (_url, init) => {
      // Validate the exact request payload keys
      const body = JSON.parse(init.body as string);
      expect(body).toHaveProperty('gateRow');
      expect(body.gateRow.gate).toBe('Gate A');
      expect(body).toHaveProperty('question');
      expect(body).toHaveProperty('datasetHash');
      expect(body.datasetHash).toBe('abc123hash');

      return {
        ok: true,
        json: async () => mockApiResponse
      };
    });

    render(<DashboardPage />);

    // 2. Click the gate row in the directory
    // Find the cell in the table by role
    const cell = screen.getByRole('cell', { name: 'Gate A' });
    await user.click(cell);

    // 3. Ensure AnalysisCard fallback state is rendered
    expect(await screen.findByText(/Select an action to analyze Gate A/i)).toBeInTheDocument();

    // 4. Click a quick action
    const actionBtn = screen.getByRole('button', { name: /Analyze Crowd Risk/i });
    await user.click(actionBtn);

    // 5. Wait for the API response to render
    await waitFor(() => {
      expect(screen.getByText('Gate A is normal')).toBeInTheDocument();
      expect(screen.getByText('Wait times are low.')).toBeInTheDocument();
      expect(screen.getByText('No action needed.')).toBeInTheDocument();
      expect(screen.getByText('Smooth operations.')).toBeInTheDocument();
    });

    // 6. Verify Zustand store updated
    const state = useDashboardStore.getState();
    const analyses = Object.values(state.aiAnalyses);
    expect(analyses.length).toBe(1);
    expect(analyses[0].observation).toBe("Gate A is normal");
  });
});
