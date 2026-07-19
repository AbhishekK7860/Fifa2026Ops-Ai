import { CsvUploadZone } from '@/features/csv-upload/components/CsvUploadZone';
import { ShieldCheck, Zap, ServerOff } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center p-4">
      {/* Skip-to-content link for keyboard users */}
      <a
        href="#upload-section"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-emerald-600 focus:text-white focus:rounded-md focus:font-medium"
      >
        Skip to upload
      </a>
      <main className="w-full max-w-4xl space-y-12 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-8 duration-700">
        
        {/* Hero Section */}
        <header className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 rounded-2xl mb-4" aria-hidden="true">
            <ShieldCheck className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            StadiumOps <span className="text-emerald-600 dark:text-emerald-400">AI</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Intelligent decision support for FIFA World Cup 2026 stadium volunteers.
            Upload your operational data to instantly identify bottlenecks and receive actionable insights.
          </p>
        </header>

        {/* Upload Zone */}
        <section id="upload-section" aria-label="Dataset upload" className="bg-white dark:bg-slate-900 p-6 md:p-10 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800">
          <CsvUploadZone />
        </section>

        {/* Feature highlights */}
        <section aria-label="Features" className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center pt-8">
          <div className="space-y-2 p-4 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
            <div className="w-12 h-12 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4" aria-hidden="true">
              <Zap className="w-6 h-6" />
            </div>
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Real-Time Insights</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Instantly analyze crowd flow, queue lengths, and capacity metrics.
            </p>
          </div>
          
          <div className="space-y-2 p-4 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
            <div className="w-12 h-12 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4" aria-hidden="true">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Enterprise Security</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Strict PII redaction and prompt-injection defense built-in.
            </p>
          </div>
          
          <div className="space-y-2 p-4 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
            <div className="w-12 h-12 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center mx-auto mb-4" aria-hidden="true">
              <ServerOff className="w-6 h-6" />
            </div>
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Offline Resilience</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Seamlessly falls back to deterministic rule-based analysis if AI is down.
            </p>
          </div>
        </section>

      </main>
    </div>
  );
}
