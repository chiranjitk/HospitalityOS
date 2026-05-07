'use client';

import { useState } from 'react';
import BEOManagement from '@/components/events/beo-management';
import DepositSchedules from '@/components/billing/deposit-schedules';
import RoomTypeChange from '@/components/pms/room-type-change';
import PurchaseRequisition from '@/components/inventory/purchase-requisition';
import SmartLockManagement from '@/components/iot/smart-lock-management';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Wallet, ArrowRightLeft, ClipboardList, Lock } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState('beo');

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">SS</span>
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">StaySuite HospitalityOS</h1>
                <p className="text-xs text-muted-foreground -mt-0.5">Operations Dashboard</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="beo" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">BEO Management</span>
              <span className="sm:hidden">BEO</span>
            </TabsTrigger>
            <TabsTrigger value="deposits" className="gap-2">
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">Deposit Schedules</span>
              <span className="sm:hidden">Deposits</span>
            </TabsTrigger>
            <TabsTrigger value="room-changes" className="gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Room Type Changes</span>
              <span className="sm:hidden">Rooms</span>
            </TabsTrigger>
            <TabsTrigger value="purchase-req" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Purchase Requisition</span>
              <span className="sm:hidden">Requisition</span>
            </TabsTrigger>
            <TabsTrigger value="smart-locks" className="gap-2">
              <Lock className="h-4 w-4" />
              <span className="hidden sm:inline">Smart Locks</span>
              <span className="sm:hidden">Locks</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="beo">
            <BEOManagement />
          </TabsContent>

          <TabsContent value="deposits">
            <DepositSchedules />
          </TabsContent>

          <TabsContent value="room-changes">
            <RoomTypeChange />
          </TabsContent>

          <TabsContent value="purchase-req">
            <PurchaseRequisition />
          </TabsContent>

          <TabsContent value="smart-locks">
            <SmartLockManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
