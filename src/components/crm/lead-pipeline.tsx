'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Flame,
  Thermometer,
  Snowflake,
  DollarSign,
  TrendingUp,
  Target,
  UserPlus,
  Mail,
  Globe,
  Phone,
  Star,
} from 'lucide-react';

type Stage = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';

interface Lead {
  id: string;
  name: string;
  company: string;
  source: string;
  score: number;
  value: number;
  stage: Stage;
  lastActivity: string;
  contact: string;
}

const stageConfig: { key: Stage; label: string; color: string; icon: typeof Users }[] = [
  { key: 'new', label: 'New Lead', color: 'from-blue-500 to-blue-600', icon: UserPlus },
  { key: 'contacted', label: 'Contacted', color: 'from-cyan-500 to-cyan-600', icon: Phone },
  { key: 'qualified', label: 'Qualified', color: 'from-yellow-500 to-amber-500', icon: Thermometer },
  { key: 'proposal', label: 'Proposal Sent', color: 'from-orange-500 to-orange-600', icon: Mail },
  { key: 'negotiation', label: 'Negotiation', color: 'from-violet-500 to-purple-600', icon: Target },
  { key: 'won', label: 'Won', color: 'from-emerald-500 to-green-600', icon: Star },
  { key: 'lost', label: 'Lost', color: 'from-gray-400 to-gray-500', icon: Users },
];

const leads: Lead[] = [
  { id: '1', name: 'Sarah Mitchell', company: 'TechCorp Inc.', source: 'Website', score: 95, value: 45000, stage: 'proposal', lastActivity: '2 hours ago', contact: 'sarah@techcorp.com' },
  { id: '2', name: 'James Rodriguez', company: 'Global Events Co.', source: 'Referral', score: 88, value: 78000, stage: 'negotiation', lastActivity: '4 hours ago', contact: '+1 555-0142' },
  { id: '3', name: 'Emily Chen', company: 'Wedding Bliss', source: 'Google Ads', score: 82, value: 32000, stage: 'qualified', lastActivity: '1 day ago', contact: 'emily@weddingbliss.com' },
  { id: '4', name: 'Michael Brown', company: 'Summit Finance', source: 'LinkedIn', score: 76, value: 55000, stage: 'contacted', lastActivity: '3 hours ago', contact: 'm.brown@summit.com' },
  { id: '5', name: 'Lisa Thompson', company: 'Adventures Ltd.', source: 'OTA', score: 91, value: 28000, stage: 'won', lastActivity: 'Yesterday', contact: 'lisa@adventures.com' },
  { id: '6', name: 'David Kim', company: 'NexGen Pharma', source: 'Website', score: 67, value: 120000, stage: 'proposal', lastActivity: '5 hours ago', contact: 'd.kim@nexgen.com' },
  { id: '7', name: 'Anna Kowalski', company: 'EuroTravel AG', source: 'Trade Show', score: 45, value: 18000, stage: 'new', lastActivity: 'Just now', contact: 'anna@eurotravel.de' },
  { id: '8', name: 'Robert Wilson', company: 'City Tours Inc.', source: 'Referral', score: 34, value: 8000, stage: 'lost', lastActivity: '5 days ago', contact: '+44 20-1234' },
  { id: '9', name: 'Priya Sharma', company: 'Taj Hotels Group', source: 'LinkedIn', score: 85, value: 95000, stage: 'negotiation', lastActivity: '1 hour ago', contact: 'priya@tajgroup.com' },
  { id: '10', name: 'Carlos Mendez', company: 'SOL Events', source: 'Google Ads', score: 58, value: 15000, stage: 'qualified', lastActivity: '2 days ago', contact: 'carlos@solevents.mx' },
  { id: '11', name: 'Sophie Laurent', company: 'Parisian Getaways', source: 'OTA', score: 72, value: 42000, stage: 'contacted', lastActivity: '6 hours ago', contact: 'sophie@parisian.fr' },
  { id: '12', name: 'Tom Anderson', company: 'Anderson Consulting', source: 'Website', score: 63, value: 25000, stage: 'new', lastActivity: '30 min ago', contact: 'tom@andersonco.com' },
  { id: '13', name: 'Yuki Tanaka', company: 'Sakura Tours', source: 'Trade Show', score: 90, value: 68000, stage: 'won', lastActivity: '3 days ago', contact: 'yuki@sakura.jp' },
];

const sourceIcons: Record<string, typeof Globe> = {
  Website: Globe,
  Referral: Users,
  'Google Ads': TrendingUp,
  LinkedIn: Target,
  OTA: Globe,
  'Trade Show': Star,
};

const getScoreBadge = (score: number) => {
  if (score >= 80) return { label: 'Hot', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', icon: Flame };
  if (score >= 50) return { label: 'Warm', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300', icon: Thermometer };
  return { label: 'Cold', className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300', icon: Snowflake };
};

export default function LeadPipeline() {
  const [selectedStage, setSelectedStage] = useState<Stage | 'all'>('all');

  const filteredLeads = selectedStage === 'all' ? leads : leads.filter((l) => l.stage === selectedStage);

  const leadsByStage = stageConfig.map((stage) => ({
    ...stage,
    leads: leads.filter((l) => l.stage === stage.key),
    totalValue: leads.filter((l) => l.stage === stage.key).reduce((s, l) => s + l.value, 0),
  }));

  const hotLeads = leads.filter((l) => l.score >= 80).length;
  const warmLeads = leads.filter((l) => l.score >= 50 && l.score < 80).length;
  const coldLeads = leads.filter((l) => l.score < 50).length;
  const totalPipelineValue = leads.filter((l) => l.stage !== 'won' && l.stage !== 'lost').reduce((s, l) => s + l.value, 0);
  const wonValue = leads.filter((l) => l.stage === 'won').reduce((s, l) => s + l.value, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-teal-600 dark:text-teal-400" />
            Lead Pipeline
          </h2>
          <p className="text-muted-foreground">
            Track and manage sales leads through your conversion funnel
          </p>
        </div>
        <Button className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white">
          <UserPlus className="h-4 w-4 mr-2" />
          Add Lead
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Flame className="h-4 w-4 text-red-500" />
              <p className="text-xs font-medium text-muted-foreground">Hot</p>
            </div>
            <p className="text-xl font-bold">{hotLeads}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950 dark:to-yellow-950">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Thermometer className="h-4 w-4 text-amber-500" />
              <p className="text-xs font-medium text-muted-foreground">Warm</p>
            </div>
            <p className="text-xl font-bold">{warmLeads}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-950 dark:to-sky-950">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Snowflake className="h-4 w-4 text-cyan-500" />
              <p className="text-xs font-medium text-muted-foreground">Cold</p>
            </div>
            <p className="text-xl font-bold">{coldLeads}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-950">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-violet-500" />
              <p className="text-xs font-medium text-muted-foreground">Pipeline</p>
            </div>
            <p className="text-xl font-bold">${(totalPipelineValue / 1000).toFixed(0)}k</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950 dark:to-green-950">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Star className="h-4 w-4 text-emerald-500" />
              <p className="text-xs font-medium text-muted-foreground">Won</p>
            </div>
            <p className="text-xl font-bold">${(wonValue / 1000).toFixed(0)}k</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950 dark:to-cyan-950">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-teal-500" />
              <p className="text-xs font-medium text-muted-foreground">Total</p>
            </div>
            <p className="text-xl font-bold">{leads.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Stage Filter */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={selectedStage === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedStage('all')}
          className={selectedStage === 'all' ? 'bg-teal-600 hover:bg-teal-700' : ''}
        >
          All ({leads.length})
        </Button>
        {stageConfig.map((stage) => {
          const StageIcon = stage.icon;
          const count = leads.filter((l) => l.stage === stage.key).length;
          return (
            <Button
              key={stage.key}
              variant={selectedStage === stage.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedStage(stage.key)}
              className={selectedStage === stage.key ? 'bg-teal-600 hover:bg-teal-700' : ''}
            >
              <StageIcon className="h-3 w-3 mr-1" />
              {stage.label} ({count})
            </Button>
          );
        })}
      </div>

      {/* Pipeline Board */}
      <div className="space-y-4">
        {(selectedStage === 'all' ? leadsByStage : leadsByStage.filter((s) => s.key === selectedStage)).map((stage) => {
          const StageIcon = stage.icon;
          return (
            <Card key={stage.key} className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-gradient-to-r ${stage.color}`}>
                      <StageIcon className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{stage.label}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {stage.leads.length} leads · ${stage.totalValue.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {stage.leads.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No leads in this stage</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {stage.leads.map((lead) => {
                      const scoreInfo = getScoreBadge(lead.score);
                      const SourceIcon = sourceIcons[lead.source] || Globe;
                      return (
                        <div
                          key={lead.id}
                          className="p-4 rounded-lg border hover:shadow-md hover:border-teal-200 dark:hover:border-teal-800 transition-all cursor-pointer"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-semibold text-sm">{lead.name}</p>
                              <p className="text-xs text-muted-foreground">{lead.company}</p>
                            </div>
                            <Badge className={scoreInfo.className}>
                              <scoreInfo.icon className="h-3 w-3 mr-1" />
                              {lead.score}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              <SourceIcon className="h-3 w-3 mr-1" />
                              {lead.source}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                              ${lead.value.toLocaleString()}
                            </span>
                            <span className="text-xs text-muted-foreground">{lead.lastActivity}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
