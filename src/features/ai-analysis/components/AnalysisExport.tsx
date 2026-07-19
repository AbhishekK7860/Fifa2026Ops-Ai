import React from 'react';
import { Button } from '@/components/ui/button';
import { AIAnalysisResult } from '@/types/analysis';
import { Download, FileJson } from 'lucide-react';

interface AnalysisExportProps {
  result: AIAnalysisResult;
}

export const AnalysisExport: React.FC<AnalysisExportProps> = ({ result }) => {
  const handlePdfExport = async () => {
    // Dynamically import jspdf to avoid bloating the initial bundle
    const jspdfModule = await import('jspdf');
    const JsPDF = jspdfModule.default;
    const doc = new JsPDF();
    let y = 20;
    const lineHeight = 7;
    const margin = 20;
    const maxWidth = 170;

    doc.setFontSize(16);
    doc.text('AI Analysis Report', margin, y);
    y += 15;

    doc.setFontSize(12);

    const addSection = (title: string, content: string) => {
      doc.setFont('helvetica', 'bold');
      doc.text(title, margin, y);
      y += lineHeight;

      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(content, maxWidth);
      doc.text(lines, margin, y);
      y += lines.length * lineHeight + 5;
      
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    };

    addSection('Observation:', result.observation);
    addSection('Reasoning:', result.reasoning);
    addSection('Recommended Action:', result.recommendedAction);
    addSection('Expected Impact:', result.expectedImpact);
    
    addSection('Public Announcement (English):', result.multilingualAnnouncement.en);
    addSection('Public Announcement (Spanish):', result.multilingualAnnouncement.es);
    addSection('Public Announcement (French):', result.multilingualAnnouncement.fr);

    doc.save('ai-analysis-report.pdf');
  };

  const handleJsonExport = () => {
    const dataStr = JSON.stringify(result, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai-analysis-report.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex gap-2">
      <Button onClick={handlePdfExport} variant="secondary">
        <Download className="mr-2 h-4 w-4" />
        Export PDF
      </Button>
      <Button onClick={handleJsonExport} variant="secondary">
        <FileJson className="mr-2 h-4 w-4" />
        Export JSON
      </Button>
    </div>
  );
};
