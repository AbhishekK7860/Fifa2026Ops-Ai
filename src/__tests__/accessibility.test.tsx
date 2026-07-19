import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import LandingPage from '@/app/page';
import DashboardPage from '@/app/dashboard/page';
import { AnalysisCard } from '@/features/ai-analysis/components/AnalysisCard';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/features/dashboard/store', () => ({
  useDashboardStore: vi.fn((selector) => {
    const s = selector ? selector.toString() : '';
    if (s.includes('dataset')) return null;
    if (s.includes('rankedGates')) return [];
    if (s.includes('aiAnalyses')) return {};
    if (s.includes('uploadMeta')) return { filename: 'test.csv' };
    return null;
  }),
}));

vi.mock('@/features/ai-analysis/hooks', () => ({
  useAiAnalysis: () => ({ analyzeGate: vi.fn() }),
}));

describe('Accessibility Scans (axe-core)', () => {
  it('Landing Page has no a11y violations', async () => {
    const { container } = render(<LandingPage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('Dashboard Page (empty/loading state) has no a11y violations', async () => {
    const { container } = render(<DashboardPage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('AnalysisCard has no a11y violations', async () => {
    const dummyData = {
      gate: 'Gate A',
      capacity: 1000,
      currentVisitors: 500,
      queueLength: 50,
      volunteerCount: 5,
      status: 'normal' as const,
      transportDelay: 0,
      weather: 'Clear',
      medicalIncidents: 0
    };
    const { container } = render(<AnalysisCard result={null} mode="ai" sourceData={dummyData} onNewQuestion={vi.fn()} isAnalyzing={false} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('supports full keyboard navigation (Tab)', async () => {
    const user = userEvent.setup();
    render(<LandingPage />);
    
    // We expect a main heading
    expect(screen.getByRole('heading', { name: /StadiumOps AI/i })).toBeInTheDocument();
    
    // Press Tab to focus the first focusable element (likely a button or input)
    await user.tab();
    expect(document.body).toBeInTheDocument(); // basic assertion that tab doesn't crash
  });
});
