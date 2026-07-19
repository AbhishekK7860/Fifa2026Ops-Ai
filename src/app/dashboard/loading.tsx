'use client';

import { Loader2 } from 'lucide-react';

export default function DashboardLoading() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center space-y-4 bg-slate-50 dark:bg-slate-950">
      <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 animate-pulse">
        Loading StadiumOps Dashboard...
      </p>
    </div>
  );
}
