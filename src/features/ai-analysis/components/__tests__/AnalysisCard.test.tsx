import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnalysisCard } from '../AnalysisCard';
import { AIAnalysisResult } from '@/types/analysis';
import { GateRow } from '@/types/csv';

describe('AnalysisCard', () => {
  const dummyData: GateRow = {
    gate: 'Gate A',
    capacity: 1000,
    currentVisitors: 500,
    queueLength: 50,
    volunteerCount: 5,
    status: 'normal',
    transportDelay: 0,
    weather: 'Clear',
    medicalIncidents: 0
  };

  const dummyResult: AIAnalysisResult = {
    observation: 'Test observation',
    reasoning: 'Test reasoning',
    recommendedAction: 'Test action',
    expectedImpact: 'Test impact',
    confidence: { score: 85, basis: 'Test basis' },
    multilingualAnnouncement: { en: 'English Announcement', es: 'Spanish Announcement', fr: 'French Announcement' },
    sourceDataRefs: ['ref1', 'ref2']
  };

  it('renders quick action buttons when result is null', () => {
    render(<AnalysisCard result={null} mode="ai" sourceData={dummyData} onNewQuestion={vi.fn()} isAnalyzing={false} />);
    expect(screen.getByText(/Select an action to analyze Gate A:/i)).toBeInTheDocument();
    expect(screen.getByText('Analyze Crowd Risk')).toBeInTheDocument();
  });

  it('renders all sections when result is present', () => {
    render(<AnalysisCard result={dummyResult} mode="ai" sourceData={dummyData} onNewQuestion={vi.fn()} isAnalyzing={false} />);
    
    // 1. Observation
    expect(screen.getByText('Test observation')).toBeInTheDocument();
    // 2. Reasoning
    expect(screen.getByText('Test reasoning')).toBeInTheDocument();
    // 3. Recommended Action
    expect(screen.getByText('Test action')).toBeInTheDocument();
    // 4. Expected Impact
    expect(screen.getByText('Test impact')).toBeInTheDocument();
    
    // 5. Announcements (English tab default)
    expect(screen.getByText('English Announcement')).toBeInTheDocument();
    
    // 6. Source Data (details element)
    expect(screen.getByText('Source Data')).toBeInTheDocument();
    expect(screen.getByText('ref1')).toBeInTheDocument();
    expect(screen.getByText('ref2')).toBeInTheDocument();
  });

  it('renders confidence badge properly with high score', () => {
    render(<AnalysisCard result={dummyResult} mode="ai" sourceData={dummyData} onNewQuestion={vi.fn()} isAnalyzing={false} />);
    const badge = screen.getByText(/85/);
    expect(badge).toBeInTheDocument();
  });

  it('renders offline label when mode is offline', () => {
    render(<AnalysisCard result={dummyResult} mode="offline" sourceData={dummyData} onNewQuestion={vi.fn()} isAnalyzing={false} />);
    expect(screen.getAllByText(/Offline Analysis Mode/i).length).toBeGreaterThan(0);
  });
});
