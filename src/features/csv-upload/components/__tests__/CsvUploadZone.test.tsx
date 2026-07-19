import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CsvUploadZone } from '../CsvUploadZone';
import { useRouter } from 'next/navigation';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/features/dashboard/store', () => ({
  useDashboardStore: vi.fn((selector) => {
    if (selector.toString().includes('setDataset')) return vi.fn();
    return null;
  }),
}));

describe('CsvUploadZone', () => {
  const mockRouterPush = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({ push: mockRouterPush } as unknown as ReturnType<typeof useRouter>);
    global.fetch = vi.fn();
  });

  it('rejects wrong MIME types on client side', async () => {
    render(<CsvUploadZone />);
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([''], 'test.pdf', { type: 'application/pdf' });
    
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(screen.getByText(/Invalid file type|not accepted/i)).toBeInTheDocument();
    });
  });

  it('displays validation errors from server', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        errors: [{ type: 'MISSING_COLUMNS', message: 'Gate column is missing' }]
      })
    } as unknown as Response);

    render(<CsvUploadZone />);
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['dummy content'], 'test.csv', { type: 'text/csv' });
    
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(screen.getByText(/Gate column is missing/)).toBeInTheDocument();
    });
  });
});
