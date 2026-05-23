'use client';

import SaaSPlans from '@/components/billing/saas-plans';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <main className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
        <SaaSPlans />
      </main>
    </div>
  );
}
