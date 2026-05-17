'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const GuestStayReport = dynamic(
  () => import('@/components/reports/guest-stay-report'),
  {
    loading: () => (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 dark:text-emerald-400" />
          <p className="text-muted-foreground text-sm">Loading Guest Stay Report...</p>
        </div>
      </div>
    ),
    ssr: false,
  }
);

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
        <GuestStayReport />
      </div>
    </div>
  );
}
