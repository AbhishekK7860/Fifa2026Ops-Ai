'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, Loader2, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ValidationFeedback } from './ValidationFeedback';
import { useDashboardStore } from '@/features/dashboard/store';
import { validateMimeTypeClientSide } from '../utils/mimeValidator';
import type { ValidationResult } from '@/types/csv';

export function CsvUploadZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const setDataset = useDashboardStore(state => state.setDataset);

  const processFile = async (file: File) => {
    setUploadError(null);
    setValidationResult(null);
    setIsUploading(true);

    try {
      // 1. Client-side UX validation
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('File exceeds 2MB limit.');
      }
      const mimeCheck = validateMimeTypeClientSide(file);
      if (!mimeCheck.valid) {
        throw new Error(mimeCheck.message || 'Invalid file type.');
      }

      // 2. Upload to server for parsing and deep validation
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 422 && data.errors) {
          // Validation failed
          setValidationResult({
            valid: false,
            errors: data.errors,
            warnings: data.warnings || [],
            rows: [],
            rowCount: 0
          });
          return;
        }
        throw new Error(data.error || 'Upload failed');
      }

      // 3. Success - Store in Zustand
      const dataset = data.validationResult as ValidationResult;
      const meta = data.meta as { filename: string; rowCount: number };
      
      setValidationResult(dataset);
      setDataset(dataset, meta.filename, data.datasetHash);

      // Short delay so user can see the green success banner before redirecting
      setTimeout(() => {
        router.push('/dashboard');
      }, 800);

    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleLoadDemo = async () => {
    try {
      setIsUploading(true);
      setUploadError(null);
      setValidationResult(null);

      // Fetch the public demo file
      const res = await fetch('/demo-data.csv');
      if (!res.ok) throw new Error('Failed to load demo dataset');
      const blob = await res.blob();
      const file = new File([blob], 'demo-data.csv', { type: 'text/csv' });
      
      await processFile(file);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div 
        className={`relative flex flex-col items-center justify-center w-full h-64 p-6 border-2 border-dashed rounded-xl transition-colors duration-200 ${
          isDragging 
            ? 'border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10' 
            : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-900/50'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept=".csv,text/csv,text/plain" 
          onChange={handleFileSelect}
          disabled={isUploading}
          aria-label="Upload CSV file"
          data-testid="csv-file-input"
        />
        
        {isUploading ? (
          <div className="flex flex-col items-center text-slate-600 dark:text-slate-400">
            <Loader2 className="w-12 h-12 mb-4 animate-spin text-emerald-500" />
            <p className="text-sm font-medium">Validating and parsing dataset...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-slate-600 dark:text-slate-400 pointer-events-none">
            <UploadCloud className={`w-12 h-12 mb-4 transition-colors ${isDragging ? 'text-emerald-500' : 'text-slate-400'}`} />
            <p className="mb-2 text-lg font-semibold text-slate-700 dark:text-slate-300">
              Click to upload or drag and drop
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">CSV files only (Max 2MB, up to 500 rows)</p>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-center gap-4">
        <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-800"></div>
        <span className="text-xs text-slate-400 uppercase font-semibold tracking-wider">or</span>
        <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-800"></div>
      </div>

      <div className="mt-6 flex justify-center">
        <Button 
          variant="outline" 
          size="lg" 
          onClick={handleLoadDemo} 
          disabled={isUploading}
          className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 w-full"
        >
          <PlayCircle className="w-4 h-4 mr-2 text-emerald-500" />
          Load Demo Dataset
        </Button>
      </div>

      <ValidationFeedback result={validationResult} error={uploadError} />
    </div>
  );
}
