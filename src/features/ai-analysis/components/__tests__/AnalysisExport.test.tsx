import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AnalysisExport } from '../AnalysisExport';
import { AIAnalysisResult } from '@/types/analysis';

// Mock jspdf for the PDF export test
const mockSave = vi.fn();
const mockText = vi.fn();
const mockAddPage = vi.fn();
const mockSetFont = vi.fn();
const mockSetFontSize = vi.fn();
const mockSplitTextToSize = vi.fn().mockImplementation((text) => [text]);

vi.mock('jspdf', () => {
  return {
    default: vi.fn().mockImplementation(function() {
      return {
        save: mockSave,
        text: mockText,
        addPage: mockAddPage,
        setFont: mockSetFont,
        setFontSize: mockSetFontSize,
        splitTextToSize: mockSplitTextToSize,
      };
    }),
  };
});

describe('AnalysisExport', () => {
  const dummyResult: AIAnalysisResult = {
    observation: 'Test observation',
    reasoning: 'Test reasoning',
    recommendedAction: 'Test action',
    expectedImpact: 'Test impact',
    confidence: { score: 85, basis: 'Test basis' },
    multilingualAnnouncement: { en: 'EN', es: 'ES', fr: 'FR' },
    sourceDataRefs: ['ref1', 'ref2']
  };

  let createObjectURLMock: any;
  let revokeObjectURLMock: any;

  beforeEach(() => {
    // Mock URL methods for JSON export
    createObjectURLMock = vi.fn().mockReturnValue('blob:test-url');
    revokeObjectURLMock = vi.fn();
    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('triggers PDF download via jspdf when Export PDF button is clicked', async () => {
    render(<AnalysisExport result={dummyResult} />);
    
    const pdfButton = screen.getByText('Export PDF');
    expect(pdfButton).toBeInTheDocument();

    fireEvent.click(pdfButton);

    // Wait for the dynamic import and the save method to be called
    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith('ai-analysis-report.pdf');
    });
    expect(mockText).toHaveBeenCalled();
  });

  it('triggers JSON Blob download when Export JSON button is clicked', () => {
    render(<AnalysisExport result={dummyResult} />);
    
    // Find the Export JSON button
    const jsonButton = screen.getByText('Export JSON');
    expect(jsonButton).toBeInTheDocument();

    // Mock HTMLAnchorElement click
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    // Click the button
    fireEvent.click(jsonButton);

    // Verify Blob creation
    expect(createObjectURLMock).toHaveBeenCalled();
    
    // Verify click
    expect(clickSpy).toHaveBeenCalled();
    
    // Verify cleanup
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:test-url');
  });
});
