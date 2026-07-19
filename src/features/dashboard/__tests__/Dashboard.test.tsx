import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardPage from '@/app/dashboard/page';
import { useDashboardStore } from '@/features/dashboard/store';
import { useRouter } from 'next/navigation';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/features/dashboard/store', () => ({
  useDashboardStore: vi.fn(),
}));

vi.mock('@/features/ai-analysis/hooks', () => ({
  useAiAnalysis: () => ({ analyzeGate: vi.fn() }),
}));

describe('Dashboard Page', () => {
  const mockRouterPush = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({ push: mockRouterPush } as unknown as ReturnType<typeof useRouter>);
  });

  it('redirects to landing page if dataset is empty', () => {
    // Mock store to return null dataset
    vi.mocked(useDashboardStore).mockImplementation((selector: unknown) => {
      const s = String(selector);
      if (s.includes('dataset')) return null;
      if (s.includes('rankedGates')) return [];
      if (s.includes('aiAnalyses')) return {};
      return null;
    });

    render(<DashboardPage />);
    expect(mockRouterPush).toHaveBeenCalledWith('/');
  });

  it('renders dashboard with critical alert banner when dataset is loaded', () => {
    const mockDataset = { rows: [
      { gate: "Gate A", status: "critical", capacity: 1000, currentVisitors: 900 }
    ] };
    const mockRankedGates = [
      { gate: mockDataset.rows[0], score: 90 }
    ];

    vi.mocked(useDashboardStore).mockImplementation((selector: unknown) => {
      const s = String(selector);
      if (s.includes('dataset')) return mockDataset;
      if (s.includes('rankedGates')) return mockRankedGates;
      if (s.includes('selectedGateId')) return null;
      if (s.includes('selectGate')) return vi.fn();
      if (s.includes('aiAnalyses')) return {};
      if (s.includes('isAnalyzing')) return false;
      if (s.includes('analysisMode')) return 'ai';
      if (s.includes('getAnalysisKey')) return vi.fn().mockResolvedValue('key123');
      return null;
    });

    render(<DashboardPage />);
    
    // Check header
    expect(screen.getByText('StadiumOps Dashboard')).toBeInTheDocument();
    
    // Check critical banner (Gate A should be in the critical banner)
    expect(screen.getAllByText(/Gate A/).length).toBeGreaterThan(0);
    
    // Check empty state for AnalysisCard
    expect(screen.getByText('No Gate Selected')).toBeInTheDocument();
  });
});
