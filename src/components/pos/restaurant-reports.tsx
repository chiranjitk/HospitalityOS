'use client';

import { useTranslations } from 'next-intl';

import { useState, useEffect, useCallback } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { usePropertyId } from '@/hooks/use-property';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, BarChart3, DollarSign, ShoppingCart, UtensilsCrossed, Grid3X3, Users } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function RestaurantReports() {
const t = useTranslations('pos');
  const { propertyId } = usePropertyId();
  const { formatCurrency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [overview, setOverview] = useState<any>(null);
  const [sales, setSales] = useState<any>(null);
  const [menuStats, setMenuStats] = useState<any>(null);
  const [tableStats, setTableStats] = useState<any>(null);

  const fetchReport = useCallback(async (type: string) => {
    if (!propertyId) return;
    try {
      const res = await fetch(`/api/restaurant-reports?propertyId=${propertyId}&type=${type}`);
      const data = await res.json();
      if (data.success) {
        switch (type) {
          case 'overview': setOverview(data.data); break;
          case 'sales': setSales(data.data); break;
          case 'menu': setMenuStats(data.data); break;
          case 'tables': setTableStats(data.data); break;
        }
      }
    } catch (e) { console.error(e); }
  }, [propertyId]);

  useEffect(() => {
    Promise.all([fetchReport('overview'), fetchReport('sales'), fetchReport('menu'), fetchReport('tables')]).finally(() => setLoading(false));
  }, [fetchReport]);

  if (!propertyId) return <div className="flex flex-col items-center justify-center h-64 text-muted-foreground"><BarChart3 className="h-12 w-12 mb-4" /><p>No Property Selected</p></div>;
  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  const maxRevenue = overview?.dailyRevenue?.length > 0 ? Math.max(...overview.dailyRevenue.map((d: any) => d._sum.totalAmount || 0), 1) : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Restaurant Reports</h1>
        <p className="text-muted-foreground">Analytics and reporting for your restaurant operations</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview"><BarChart3 className="h-4 w-4 mr-1" />Overview</TabsTrigger>
          <TabsTrigger value="sales"><DollarSign className="h-4 w-4 mr-1" />Sales</TabsTrigger>
          <TabsTrigger value="menu"><UtensilsCrossed className="h-4 w-4 mr-1" />Menu</TabsTrigger>
          <TabsTrigger value="tables"><Grid3X3 className="h-4 w-4 mr-1" />Tables</TabsTrigger>
          <TabsTrigger value="staff"><Users className="h-4 w-4 mr-1" />Staff</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Revenue</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(overview?.totalRevenue || 0)}</div></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Orders</CardTitle><ShoppingCart className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{overview?.totalOrders || 0}</div></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Avg Order Value</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(overview?.avgOrderValue || 0)}</div></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Table Occupancy</CardTitle><Grid3X3 className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{overview?.tableOccupancyRate || 0}%</div></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Revenue Trend</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-end gap-1 h-48">
                {overview?.dailyRevenue?.slice(-14).map((d: any, i: number) => {
                  const val = d._sum.totalAmount || 0;
                  const pct = (val / maxRevenue) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full bg-emerald-500 rounded-t-sm transition-all" style={{ height: `${Math.max(pct, 2)}%` }} title={formatCurrency(val)} />
                      <span className="text-[10px] text-muted-foreground">{new Date(d.createdAt).getDate()}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Top Selling Items</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {overview?.topItems?.map((item: any, i: number) => {
                  const maxUnits = Math.max(...(overview.topItems || []).map((t: any) => t.revenue), 1);
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-5 text-sm text-muted-foreground">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{item.name}</span>
                          <span>{formatCurrency(item.revenue)}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(item.revenue / maxUnits) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card><CardHeader><CardTitle>Revenue by Order Type</CardTitle></CardHeader><CardContent>
              <div className="space-y-3">
                {sales?.byOrderType?.map((t: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded border">
                    <div className="flex items-center gap-2"><Badge variant="outline" className="capitalize">{t.type.replace('_', ' ')}</Badge><span className="text-sm text-muted-foreground">{t.count} orders</span></div>
                    <span className="font-semibold">{formatCurrency(t.total)}</span>
                  </div>
                ))}
              </div>
            </CardContent></Card>
            <Card><CardHeader><CardTitle>Sales Summary</CardTitle></CardHeader><CardContent>
              <div className="space-y-3">
                <div className="flex justify-between p-2 rounded border"><span className="text-sm">Total Revenue</span><span className="font-bold">{formatCurrency(sales?.byOrderType?.reduce((s: number, t: any) => s + t.total, 0) || 0)}</span></div>
                <div className="flex justify-between p-2 rounded border"><span className="text-sm">Total Orders</span><span className="font-bold">{sales?.byOrderType?.reduce((s: number, t: any) => s + t.count, 0) || 0}</span></div>
              </div>
            </CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="menu" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card><CardHeader><CardTitle>Category Performance</CardTitle></CardHeader><CardContent>
              <div className="space-y-2">
                {menuStats?.categoryPerformance?.map((c: any, i: number) => {
                  const maxCat = Math.max(...(menuStats.categoryPerformance || []).map((x: any) => x.revenue), 1);
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-sm"><span>{c.name}</span><span className="font-medium">{formatCurrency(c.revenue)}</span></div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-teal-500 rounded-full" style={{ width: `${(c.revenue / maxCat) * 100}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            </CardContent></Card>
            <Card><CardHeader><CardTitle>Ghost Items (Never Ordered)</CardTitle></CardHeader><CardContent>
              <ScrollArea className="max-h-64">
                {menuStats?.ghostItems?.length > 0 ? (
                  <div className="space-y-1">
                    {menuStats.ghostItems.map((item: any, i: number) => (
                      <div key={i} className="flex justify-between p-2 text-sm rounded border"><span>{item.name}</span><span className="text-muted-foreground">{formatCurrency(item.price)}</span></div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground text-center py-4">All items have been ordered</p>}
              </ScrollArea>
            </CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="tables" className="space-y-6 mt-6">
          <div className="grid gap-4 grid-cols-3">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Avg Dining Duration</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{tableStats?.avgDiningDuration || 0} min</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Most Used</CardTitle></CardHeader><CardContent><div className="text-lg font-bold">Table {tableStats?.mostUsed?.[0]?.number || 'N/A'}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Least Used</CardTitle></CardHeader><CardContent><div className="text-lg font-bold">Table {tableStats?.leastUsed?.[0]?.number || 'N/A'}</div></CardContent></Card>
          </div>
          <Card><CardHeader><CardTitle>Table Turnover</CardTitle></CardHeader><CardContent>
            <ScrollArea className="max-h-80">
              <div className="space-y-1">
                {tableStats?.tableTurnover?.map((t: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 text-sm rounded border hover:bg-muted/50">
                    <span className="font-medium">Table {t.number} <span className="text-muted-foreground">({t.capacity} seats)</span></span>
                    <div className="flex items-center gap-4">
                      <span>{t.orderCount} orders</span>
                      <span className="font-medium">{formatCurrency(t.totalRevenue)}</span>
                      {t.avgDuration > 0 && <span className="text-muted-foreground">~{t.avgDuration}min</span>}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="staff" className="space-y-6 mt-6">
          <Card><CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Staff Reports</p>
            <p className="text-sm">Staff performance tracking requires staff assignment data. Set up staff assignments in the Staff Assignment section.</p>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
