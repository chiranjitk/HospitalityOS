'use client';

/**
 * WiFi Network Topology Mini-Map
 *
 * A simplified SVG-based network topology visualization showing:
 * - WiFi gateway (central node) connected to NAS nodes
 * - Connected user count per NAS
 * - Health status color coding (green/yellow/red)
 * - Clickable nodes to navigate to NAS details
 * - "View Full Topology" button linking to network page
 * - Lightweight and responsive
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Network, ExternalLink, RefreshCw, Users, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────

interface NasNode {
  id: string;
  nasIp: string;
  name: string;
  shortname?: string;
  status: 'online' | 'offline' | 'degraded' | 'unknown';
  liveUserCount: number;
  type?: string;
}

interface TopologyData {
  nodes: NasNode[];
  totalUsers: number;
  onlineCount: number;
  offlineCount: number;
}

// ─── SVG Layout Constants ────────────────────────────────────────────────────

const SVG_WIDTH = 320;
const SVG_HEIGHT = 240;
const CENTER_X = SVG_WIDTH / 2;
const CENTER_Y = 55;
const GATEWAY_RADIUS = 28;
const NAS_RADIUS = 20;
const MAX_NAS_DISPLAY = 8; // Show max 8 NAS nodes in the mini-map

// ─── Color Helpers ──────────────────────────────────────────────────────────

function getStatusColor(status: string) {
  switch (status) {
    case 'online':
      return {
        fill: '#10b981',
        stroke: '#059669',
        glow: 'rgba(16, 185, 129, 0.3)',
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-600 dark:text-emerald-400',
      };
    case 'degraded':
      return {
        fill: '#f59e0b',
        stroke: '#d97706',
        glow: 'rgba(245, 158, 11, 0.3)',
        bg: 'bg-amber-500/10',
        text: 'text-amber-600 dark:text-amber-400',
      };
    case 'offline':
      return {
        fill: '#ef4444',
        stroke: '#dc2626',
        glow: 'rgba(239, 68, 68, 0.3)',
        bg: 'bg-red-500/10',
        text: 'text-red-600 dark:text-red-400',
      };
    default:
      return {
        fill: '#94a3b8',
        stroke: '#64748b',
        glow: 'rgba(148, 163, 184, 0.2)',
        bg: 'bg-muted/50',
        text: 'text-muted-foreground',
      };
  }
}

// ─── Calculate NAS node positions in a circle around the gateway ──────────────

function calculateNodePositions(count: number): Array<{ x: number; y: number }> {
  if (count === 0) return [];
  if (count === 1) return [{ x: CENTER_X, y: CENTER_Y + 90 }];

  const radius = Math.min(100, 40 + count * 10);
  const angleStep = (2 * Math.PI) / count;
  const startAngle = -Math.PI / 2; // Start from top

  return Array.from({ length: count }, (_, i) => {
    const angle = startAngle + i * angleStep;
    return {
      x: CENTER_X + radius * Math.cos(angle),
      y: CENTER_Y + radius * Math.sin(angle),
    };
  });
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function WifiTopologyMini() {
  const [data, setData] = useState<TopologyData>({
    nodes: [],
    totalUsers: 0,
    onlineCount: 0,
    offlineCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const fetchTopology = useCallback(async () => {
    try {
      const res = await fetch('/api/wifi/nas-health');
      const result = await res.json();

      if (result.success && result.data) {
        const nodes: NasNode[] = result.data.map((n: Record<string, unknown>) => ({
          id: n.id as string,
          nasIp: n.nasIp as string,
          name: n.name as string,
          shortname: n.nasIdentifier as string | undefined,
          status: n.status as NasNode['status'],
          liveUserCount: n.liveUserCount as number,
          type: n.type as string | undefined,
        }));

        const totalUsers = nodes.reduce((sum: number, n: NasNode) => sum + n.liveUserCount, 0);
        const onlineCount = nodes.filter((n: NasNode) => n.status === 'online' || n.status === 'degraded').length;
        const offlineCount = nodes.filter((n: NasNode) => n.status === 'offline').length;

        setData({
          nodes: nodes.slice(0, MAX_NAS_DISPLAY),
          totalUsers,
          onlineCount,
          offlineCount,
        });
      }
    } catch {
      // non-critical
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTopology();
    const interval = setInterval(fetchTopology, 30000);
    return () => clearInterval(interval);
  }, [fetchTopology]);

  const displayNodes = data.nodes;
  const positions = calculateNodePositions(displayNodes.length);

  // Handle node click — navigate to NAS details (switch to gateway/radius tab)
  const handleNodeClick = (node: NasNode) => {
    setSelectedNode(selectedNode === node.id ? null : node.id);
  };

  const handleViewFull = () => {
    // Dispatch event to parent to switch to network page
    // Using a custom event that the parent can listen for
    window.dispatchEvent(new CustomEvent('wifi:navigate', { detail: { page: 'network' } }));
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Network className="h-3.5 w-3.5 text-primary" />
            </div>
            Network Topology
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
              <Monitor className="h-2.5 w-2.5 mr-1" />
              {data.onlineCount}/{displayNodes.length}
            </Badge>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
              <Users className="h-2.5 w-2.5 mr-1" />
              {data.totalUsers}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-[240px] w-full rounded-lg" />
            <div className="flex gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        ) : displayNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Network className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-xs">No NAS gateways configured</p>
            <p className="text-[10px] mt-1">Add NAS clients in RADIUS &amp; Gateway settings</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* SVG Topology Map */}
            <div className="flex items-center justify-center bg-muted/30 rounded-lg p-2 border border-border/50">
              <svg
                width="100%"
                viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                className="max-w-[320px]"
                role="img"
                aria-label="Network topology showing gateway and NAS nodes"
              >
                <defs>
                  {/* Glow filter for nodes */}
                  <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  {/* Pulse animation for online nodes */}
                  <filter id="pulse-glow" x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Connection lines from gateway to each NAS */}
                {positions.map((pos, i) => {
                  const node = displayNodes[i];
                  const statusColor = getStatusColor(node.status);
                  return (
                    <line
                      key={`line-${node.id}`}
                      x1={CENTER_X}
                      y1={CENTER_Y}
                      x2={pos.x}
                      y2={pos.y}
                      stroke={statusColor.fill}
                      strokeWidth={node.liveUserCount > 0 ? 2 : 1}
                      strokeOpacity={node.liveUserCount > 0 ? 0.6 : 0.25}
                      strokeDasharray={node.status === 'offline' ? '4 4' : 'none'}
                    />
                  );
                })}

                {/* Gateway (central node) */}
                <g
                  transform={`translate(${CENTER_X}, ${CENTER_Y})`}
                  className="cursor-pointer"
                >
                  {/* Pulse ring */}
                  <circle
                    cx={0}
                    cy={0}
                    r={GATEWAY_RADIUS + 4}
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth={1.5}
                    opacity={0.3}
                  >
                    <animate attributeName="r" values={`${GATEWAY_RADIUS + 4};${GATEWAY_RADIUS + 10};${GATEWAY_RADIUS + 4}`} dur="3s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.3;0.1;0.3" dur="3s" repeatCount="indefinite" />
                  </circle>
                  {/* Main circle */}
                  <circle
                    cx={0}
                    cy={0}
                    r={GATEWAY_RADIUS}
                    fill="var(--primary)"
                    fillOpacity={0.15}
                    stroke="var(--primary)"
                    strokeWidth={2}
                  />
                  {/* Icon text (router symbol) */}
                  <text
                    x={0}
                    y={1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="var(--primary)"
                    fontSize={14}
                    fontWeight={600}
                  >
                    ⬡
                  </text>
                  {/* Label */}
                  <text
                    x={0}
                    y={GATEWAY_RADIUS + 14}
                    textAnchor="middle"
                    fill="var(--foreground)"
                    fontSize={8}
                    fontWeight={500}
                    opacity={0.7}
                  >
                    Gateway
                  </text>
                </g>

                {/* NAS Nodes */}
                {positions.map((pos, i) => {
                  const node = displayNodes[i];
                  const statusColor = getStatusColor(node.status);
                  const isHovered = hoveredNode === node.id;
                  const isSelected = selectedNode === node.id;

                  return (
                    <g
                      key={`node-${node.id}`}
                      transform={`translate(${pos.x}, ${pos.y})`}
                      className="cursor-pointer"
                      onClick={() => handleNodeClick(node)}
                      onMouseEnter={() => setHoveredNode(node.id)}
                      onMouseLeave={() => setHoveredNode(null)}
                    >
                      {/* Hover/selection ring */}
                      {(isHovered || isSelected) && (
                        <circle
                          cx={0}
                          cy={0}
                          r={NAS_RADIUS + 5}
                          fill="none"
                          stroke={statusColor.fill}
                          strokeWidth={1.5}
                          strokeOpacity={0.4}
                        />
                      )}

                      {/* Online pulse ring */}
                      {node.status === 'online' && (
                        <circle
                          cx={0}
                          cy={0}
                          r={NAS_RADIUS + 2}
                          fill="none"
                          stroke={statusColor.fill}
                          strokeWidth={1}
                          opacity={0.2}
                        >
                          <animate attributeName="r" values={`${NAS_RADIUS + 2};${NAS_RADIUS + 7};${NAS_RADIUS + 2}`} dur="2.5s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.2;0.05;0.2" dur="2.5s" repeatCount="indefinite" />
                        </circle>
                      )}

                      {/* Node circle */}
                      <circle
                        cx={0}
                        cy={0}
                        r={NAS_RADIUS}
                        fill={statusColor.fill}
                        fillOpacity={isHovered ? 0.25 : 0.15}
                        stroke={statusColor.fill}
                        strokeWidth={2}
                        filter={isHovered ? 'url(#node-glow)' : undefined}
                      />

                      {/* NAS icon placeholder (AP symbol) */}
                      <text
                        x={0}
                        y={-2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={statusColor.fill}
                        fontSize={11}
                        fontWeight={600}
                      >
                        ◎
                      </text>

                      {/* User count badge */}
                      {node.liveUserCount > 0 && (
                        <>
                          <circle
                            cx={NAS_RADIUS - 4}
                            cy={-NAS_RADIUS + 4}
                            r={8}
                            fill={statusColor.fill}
                            stroke="var(--background)"
                            strokeWidth={2}
                          />
                          <text
                            x={NAS_RADIUS - 4}
                            y={-NAS_RADIUS + 5}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="white"
                            fontSize={7}
                            fontWeight={700}
                          >
                            {node.liveUserCount > 99 ? '99+' : node.liveUserCount}
                          </text>
                        </>
                      )}

                      {/* NAS name label */}
                      <text
                        x={0}
                        y={NAS_RADIUS + 12}
                        textAnchor="middle"
                        fill="var(--foreground)"
                        fontSize={7}
                        fontWeight={500}
                        opacity={0.7}
                      >
                        {node.shortname || node.name || node.nasIp}
                      </text>

                      {/* Tooltip on hover (rendered above SVG via HTML) */}
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Selected node details */}
            {selectedNode && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border/50 text-xs">
                {(() => {
                  const node = displayNodes.find(n => n.id === selectedNode);
                  if (!node) return null;
                  const statusColor = getStatusColor(node.status);
                  return (
                    <>
                      <div className={cn('w-2 h-2 rounded-full', statusColor.bg)}>
                        <div className={cn('w-2 h-2 rounded-full', statusColor.fill.replace('#', ''))} style={{ backgroundColor: statusColor.fill }} />
                      </div>
                      <span className="font-medium">{node.name || node.shortname}</span>
                      <span className="text-muted-foreground">{node.nasIp}</span>
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                        {node.status}
                      </Badge>
                      <span className="text-muted-foreground">{node.liveUserCount} users</span>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Legend + View Full button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Legend */}
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] text-muted-foreground">Online</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-[10px] text-muted-foreground">Degraded</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-[10px] text-muted-foreground">Offline</span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] gap-1.5 rounded-lg"
                onClick={handleViewFull}
              >
                <ExternalLink className="h-3 w-3" />
                View Full Topology
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default WifiTopologyMini;
