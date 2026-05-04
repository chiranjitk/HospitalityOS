import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/tenant-context';

/**
 * Chain architecture metadata — describes the 6 GUI-controlled nftables chains.
 * Sourced from the nftables-helper constants but returned as a stable API.
 */
const CHAIN_ARCHITECTURE = [
  { name: 'firewallchains', table: 'inet mangle', hook: 'prerouting', description: 'Uplink filter (outbound guest)' },
  { name: 'firewallchainsdn', table: 'inet mangle', hook: 'postrouting', description: 'Downlink filter (inbound guest)' },
  { name: 'firewallchains_conn', table: 'inet mangle', hook: 'prerouting', description: 'Connection marking (uplink)' },
  { name: 'firewallchainsdn_conn', table: 'inet mangle', hook: 'postrouting', description: 'Connection marking (downlink)' },
  { name: 'frchainspre', table: 'inet nat', hook: 'prerouting', description: 'DNAT / Port Forward' },
  { name: 'frchainspost', table: 'inet nat', hook: 'postrouting', description: 'SNAT / Masquerade' },
] as const;

// GET /api/wifi/firewall/chain-architecture — Return chain metadata
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  return NextResponse.json({ success: true, data: { chains: CHAIN_ARCHITECTURE } });
}
