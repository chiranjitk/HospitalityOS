'use client';

import dynamic from 'next/dynamic';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, Star, Shield } from 'lucide-react';

const WiFiRevenueDashboard = dynamic(
  () => import('@/components/wifi/wifi-revenue-dashboard'),
  { ssr: false }
);

const WiFiSatisfactionSurveys = dynamic(
  () => import('@/components/wifi/wifi-satisfaction-surveys'),
  { ssr: false }
);

const WiFiSLAMonitoring = dynamic(
  () => import('@/components/wifi/wifi-sla-monitoring'),
  { ssr: false }
);

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto p-4 md:p-6 lg:p-8">
        <div className="space-y-6">
          <Tabs defaultValue="revenue">
            <TabsList>
              <TabsTrigger value="revenue" className="gap-1.5">
                <DollarSign className="h-4 w-4" />
                Revenue Analytics
              </TabsTrigger>
              <TabsTrigger value="satisfaction" className="gap-1.5">
                <Star className="h-4 w-4" />
                Satisfaction Surveys
              </TabsTrigger>
              <TabsTrigger value="sla" className="gap-1.5">
                <Shield className="h-4 w-4" />
                SLA Monitoring
              </TabsTrigger>
            </TabsList>

            <TabsContent value="revenue">
              <WiFiRevenueDashboard />
            </TabsContent>

            <TabsContent value="satisfaction">
              <WiFiSatisfactionSurveys />
            </TabsContent>

            <TabsContent value="sla">
              <WiFiSLAMonitoring />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
