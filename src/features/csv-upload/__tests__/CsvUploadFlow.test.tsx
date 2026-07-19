import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CsvUploadZone } from '../components/CsvUploadZone';
import { useDashboardStore } from '@/features/dashboard/store';
import { useRouter } from 'next/navigation';
import { expect, test, vi, beforeEach, describe } from 'vitest';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

describe('CsvUploadZone End-to-End Flow', () => {
  const mockPush = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    useDashboardStore.setState({ dataset: null, uploadMeta: null });
    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({ push: mockPush });
    global.fetch = vi.fn();
  });

  test('full upload to dashboard flow', async () => {
    // 1. Mock the API response exactly as the real route returns it
    const mockApiResponse = {
      validationResult: {
        valid: true,
        errors: [],
        warnings: [],
        rows: [{ gate: 'Gate A', status: 'normal', capacity: 100, currentVisitors: 50, queueLength: 5, volunteerCount: 2, medicalIncidents: 0, transportDelay: 0, weather: 'Sunny' }],
        rowCount: 1
      },
      datasetHash: 'abc123hash',
      meta: {
        filename: 'test.csv',
        rowCount: 1,
        loadedAt: new Date().toISOString(),
        hasTimestamp: false
      }
    };
    
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse
    });

    render(<CsvUploadZone />);

    // 2. Select a file
    const fileInput = screen.getByTestId('csv-file-input');
    const file = new File(['gate,status\nGate A,normal'], 'test.csv', { type: 'text/csv' });
    const user = userEvent.setup();
    await user.upload(fileInput, file);

    // 3. Wait for the upload process to finish and UI to update
    await waitFor(() => {
      expect(screen.getByText(/Dataset validated and loaded successfully/i)).toBeInTheDocument();
    });

    // 4. Verify Zustand store was updated correctly
    const storeState = useDashboardStore.getState();
    expect(storeState.dataset).toBeDefined();
    expect(storeState.dataset?.rows).toHaveLength(1);
    expect(storeState.dataset?.rows[0].gate).toBe('Gate A');
    expect(storeState.uploadMeta?.filename).toBe('test.csv');
    expect(storeState.uploadMeta?.datasetHash).toBe('abc123hash');

    // 5. Verify redirect to dashboard
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });
});
