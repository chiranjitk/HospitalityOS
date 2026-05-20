/**
 * System Metrics RRD Support
 *
 * Extends the base RRD library to create, update, and query RRD files
 * for system-level metrics: CPU, memory, disk, per-interface traffic,
 * load average, swap, disk I/O, thermal, network errors, TCP connections,
 * per-core CPU, active sessions, and auth statistics.
 *
 * RRD storage: data/rrd/system/{cpu,memory,disk,{iface},load,swap,disk-io,
 *              thermal,network-errors,tcp-connections,cpu-percore,
 *              active-sessions,auth-stats}.rrd
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { getRRDBasePath, getRRDBinPath, getRRDLibPath, type RRDDataSource, type RRDArchive } from './index';

const execFileAsync = promisify(execFile);

// rrdtool binary and environment — inherited from base library (env-configurable)
const RRD_BIN = getRRDBinPath();
const RRD_ENV = {
  ...process.env,
  LD_LIBRARY_PATH: getRRDLibPath(),
};
const DEFAULT_STEP = 60;

// ─── Constants ───────────────────────────────────────────────────────────────

const SYSTEM_RRD_DIR = path.join(getRRDBasePath(), 'system');

// Same RRAs as the existing bandwidth collector (1min→24h, 5min→7d, 1hr→30d, 1day→1yr)
const SYSTEM_RRAS: RRDArchive[] = [
  { cf: 'AVERAGE', steps: 1, rows: 1440 },    // 1min avg, 24h
  { cf: 'AVERAGE', steps: 5, rows: 2016 },    // 5min avg, 7d
  { cf: 'AVERAGE', steps: 60, rows: 720 },    // 1hr avg, 30d
  { cf: 'AVERAGE', steps: 1440, rows: 365 },  // 1day avg, 1yr
  { cf: 'MAX', steps: 1, rows: 1440 },        // 1min max, 24h
  { cf: 'MAX', steps: 5, rows: 2016 },        // 5min max, 7d
];

// Resolution mapping for time ranges
const RANGE_RESOLUTIONS: Record<string, number> = {
  '1h': 60,
  '6h': 300,
  '24h': 300,
  '7d': 3600,
  '30d': 3600,
  '90d': 86400,
  '1y': 86400,
};

// ─── Helper: rrdtool exec ────────────────────────────────────────────────────

async function rrdExec(args: string[]): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync(RRD_BIN, args, {
      env: RRD_ENV,
      maxBuffer: 10 * 1024 * 1024,
    });
    if (stderr && !stdout) {
      throw new Error(stderr);
    }
    return stdout;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`rrdtool error: ${message}`);
  }
}

// ─── Helper: DS/RRA string formatting (matches base library) ─────────────────

function dsToString(ds: RRDDataSource): string {
  const hb = ds.heartbeat ?? 120;
  const min = ds.min ?? '0';
  const max = ds.max ?? 'U';
  return `DS:${ds.name}:${ds.type}:${hb}:${min}:${max}`;
}

function rraToString(rra: RRDArchive): string {
  const xff = rra.xff ?? 0.5;
  return `RRA:${rra.cf}:${xff}:${rra.steps}:${rra.rows}`;
}

// ─── DS definitions for each RRD type ────────────────────────────────────────

const CPU_DS: RRDDataSource[] = [
  { name: 'usage', type: 'GAUGE', heartbeat: 120, min: '0', max: '100' },
];

const MEMORY_DS: RRDDataSource[] = [
  { name: 'used', type: 'GAUGE', heartbeat: 120, min: '0', max: 'U' },
  { name: 'percent', type: 'GAUGE', heartbeat: 120, min: '0', max: '100' },
];

const DISK_DS: RRDDataSource[] = [
  { name: 'used', type: 'GAUGE', heartbeat: 120, min: '0', max: 'U' },
  { name: 'percent', type: 'GAUGE', heartbeat: 120, min: '0', max: '100' },
];

function interfaceDS(iface: string): RRDDataSource[] {
  return [
    { name: 'rx', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
    { name: 'tx', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
  ];
}

// ─── New DS definitions for 9 additional RRDs ───────────────────────────────

// 1. Load Average
const LOAD_DS: RRDDataSource[] = [
  { name: 'load1', type: 'GAUGE', heartbeat: 120, min: '0', max: 'U' },
  { name: 'load5', type: 'GAUGE', heartbeat: 120, min: '0', max: 'U' },
  { name: 'load15', type: 'GAUGE', heartbeat: 120, min: '0', max: 'U' },
];

// 2. Swap
const SWAP_DS: RRDDataSource[] = [
  { name: 'used', type: 'GAUGE', heartbeat: 120, min: '0', max: 'U' },
  { name: 'percent', type: 'GAUGE', heartbeat: 120, min: '0', max: '100' },
];

// 3. Disk I/O
const DISK_IO_DS: RRDDataSource[] = [
  { name: 'reads', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
  { name: 'writes', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
  { name: 'read_bytes', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
  { name: 'write_bytes', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
];

// 4. Thermal
const THERMAL_DS: RRDDataSource[] = [
  { name: 'cpu_temp', type: 'GAUGE', heartbeat: 120, min: '0', max: '150' },
];

// 5. Network Errors
const NET_ERRORS_DS: RRDDataSource[] = [
  { name: 'rx_err', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
  { name: 'tx_err', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
  { name: 'rx_drop', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
  { name: 'tx_drop', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
  { name: 'rx_pkt', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
  { name: 'tx_pkt', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
];

// 6. TCP Connections
const TCP_CONN_DS: RRDDataSource[] = [
  { name: 'established', type: 'GAUGE', heartbeat: 120, min: '0', max: 'U' },
  { name: 'time_wait', type: 'GAUGE', heartbeat: 120, min: '0', max: 'U' },
  { name: 'close_wait', type: 'GAUGE', heartbeat: 120, min: '0', max: 'U' },
  { name: 'syn_recv', type: 'GAUGE', heartbeat: 120, min: '0', max: 'U' },
];

// 7. CPU Per-Core (dynamically generated based on coreCount)
function cpuPerCoreDS(coreCount: number): RRDDataSource[] {
  const ds: RRDDataSource[] = [];
  for (let i = 0; i < coreCount; i++) {
    ds.push({
      name: `cpu${i}`,
      type: 'GAUGE',
      heartbeat: 120,
      min: '0',
      max: '100',
    });
  }
  return ds;
}

// 8. Active Sessions
const ACTIVE_SESSIONS_DS: RRDDataSource[] = [
  { name: 'count', type: 'GAUGE', heartbeat: 120, min: '0', max: 'U' },
];

// 9. Auth Stats
const AUTH_STATS_DS: RRDDataSource[] = [
  { name: 'accept', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
  { name: 'reject', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
];

// ─── Public API ──────────────────────────────────────────────────────────────

export interface SystemGraphResult {
  timestamps: number[];
  data: Record<string, number[]>;
  meta: {
    step: number;
    start: number;
    end: number;
    cf: string;
    dsNames: string[];
    type: string;
    name?: string;
    range: string;
  };
}

/**
 * Ensure all system RRD files exist, creating them if necessary.
 * Call once at startup or when new interfaces are detected.
 */
export async function ensureSystemRRDs(
  interfaces?: string[],
  coreCount?: number
): Promise<void> {
  if (!fs.existsSync(SYSTEM_RRD_DIR)) {
    fs.mkdirSync(SYSTEM_RRD_DIR, { recursive: true });
  }

  const now = Math.floor(Date.now() / 1000);
  const cores = coreCount ?? 1;

  // CPU RRD
  await ensureSingleRRD(
    path.join(SYSTEM_RRD_DIR, 'cpu.rrd'),
    CPU_DS,
    now
  );

  // Memory RRD
  await ensureSingleRRD(
    path.join(SYSTEM_RRD_DIR, 'memory.rrd'),
    MEMORY_DS,
    now
  );

  // Disk RRD
  await ensureSingleRRD(
    path.join(SYSTEM_RRD_DIR, 'disk.rrd'),
    DISK_DS,
    now
  );

  // Per-interface RRDs
  if (interfaces) {
    for (const iface of interfaces) {
      await ensureSingleRRD(
        path.join(SYSTEM_RRD_DIR, `${iface}.rrd`),
        interfaceDS(iface),
        now
      );
    }
  }

  // 1. Load Average RRD
  await ensureSingleRRD(
    path.join(SYSTEM_RRD_DIR, 'load.rrd'),
    LOAD_DS,
    now
  );

  // 2. Swap RRD
  await ensureSingleRRD(
    path.join(SYSTEM_RRD_DIR, 'swap.rrd'),
    SWAP_DS,
    now
  );

  // 3. Disk I/O RRD
  await ensureSingleRRD(
    path.join(SYSTEM_RRD_DIR, 'disk-io.rrd'),
    DISK_IO_DS,
    now
  );

  // 4. Thermal RRD
  await ensureSingleRRD(
    path.join(SYSTEM_RRD_DIR, 'thermal.rrd'),
    THERMAL_DS,
    now
  );

  // 5. Network Errors RRD
  await ensureSingleRRD(
    path.join(SYSTEM_RRD_DIR, 'network-errors.rrd'),
    NET_ERRORS_DS,
    now
  );

  // 6. TCP Connections RRD
  await ensureSingleRRD(
    path.join(SYSTEM_RRD_DIR, 'tcp-connections.rrd'),
    TCP_CONN_DS,
    now
  );

  // 7. CPU Per-Core RRD (dynamic based on core count)
  await ensureSingleRRD(
    path.join(SYSTEM_RRD_DIR, 'cpu-percore.rrd'),
    cpuPerCoreDS(cores),
    now
  );

  // 8. Active Sessions RRD
  await ensureSingleRRD(
    path.join(SYSTEM_RRD_DIR, 'active-sessions.rrd'),
    ACTIVE_SESSIONS_DS,
    now
  );

  // 9. Auth Stats RRD
  await ensureSingleRRD(
    path.join(SYSTEM_RRD_DIR, 'auth-stats.rrd'),
    AUTH_STATS_DS,
    now
  );
}

/**
 * Create a single RRD file if it doesn't exist.
 */
async function ensureSingleRRD(
  filePath: string,
  dataSources: RRDDataSource[],
  now: number
): Promise<void> {
  if (fs.existsSync(filePath)) return;

  try {
    const args = [
      'create',
      filePath,
      '--step', String(DEFAULT_STEP),
      '--start', String(now - DEFAULT_STEP),
      ...dataSources.map(dsToString),
      ...SYSTEM_RRAS.map(rraToString),
    ];
    await rrdExec(args);
  } catch (err) {
    console.error(`[SystemRRD] Failed to create ${filePath}:`, err);
  }
}

/**
 * Update all system RRD files with the latest metrics.
 */
export async function updateSystemRRDs(
  cpuPercent: number,
  cpuPerCore: number[],
  ramUsed: number,
  ramPercent: number,
  diskUsed: number,
  diskPercent: number,
  interfaces: Array<{ name: string; rxBytes: number; txBytes: number }>,
  loadAvg: [number, number, number],
  swapUsed: number,
  swapPercent: number,
  diskIO: { reads: number; writes: number; readBytes: number; writeBytes: number },
  thermal: number | null,
  netErrors: { rxErr: number; txErr: number; rxDrop: number; txDrop: number; rxPkt: number; txPkt: number },
  tcpConn: { established: number; timeWait: number; closeWait: number; synRecv: number },
  activeSessions: number,
  authStats: { accept: number; reject: number }
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  // CPU
  try {
    await updateSingleRRD(
      path.join(SYSTEM_RRD_DIR, 'cpu.rrd'),
      now,
      { usage: cpuPercent }
    );
  } catch (err) {
    console.error('[SystemRRD] Failed to update CPU:', err);
  }

  // Memory
  try {
    await updateSingleRRD(
      path.join(SYSTEM_RRD_DIR, 'memory.rrd'),
      now,
      { used: ramUsed, percent: ramPercent }
    );
  } catch (err) {
    console.error('[SystemRRD] Failed to update memory:', err);
  }

  // Disk
  try {
    await updateSingleRRD(
      path.join(SYSTEM_RRD_DIR, 'disk.rrd'),
      now,
      { used: diskUsed, percent: diskPercent }
    );
  } catch (err) {
    console.error('[SystemRRD] Failed to update disk:', err);
  }

  // Per-interface
  for (const iface of interfaces) {
    try {
      await ensureSingleRRD(
        path.join(SYSTEM_RRD_DIR, `${iface.name}.rrd`),
        interfaceDS(iface.name),
        now
      );
      await updateSingleRRD(
        path.join(SYSTEM_RRD_DIR, `${iface.name}.rrd`),
        now,
        { rx: iface.rxBytes, tx: iface.txBytes }
      );
    } catch (err) {
      console.error(`[SystemRRD] Failed to update interface ${iface.name}:`, err);
    }
  }

  // 1. Load Average
  try {
    await updateSingleRRD(
      path.join(SYSTEM_RRD_DIR, 'load.rrd'),
      now,
      { load1: loadAvg[0], load5: loadAvg[1], load15: loadAvg[2] }
    );
  } catch (err) {
    console.error('[SystemRRD] Failed to update load:', err);
  }

  // 2. Swap
  try {
    await updateSingleRRD(
      path.join(SYSTEM_RRD_DIR, 'swap.rrd'),
      now,
      { used: swapUsed, percent: swapPercent }
    );
  } catch (err) {
    console.error('[SystemRRD] Failed to update swap:', err);
  }

  // 3. Disk I/O
  try {
    await updateSingleRRD(
      path.join(SYSTEM_RRD_DIR, 'disk-io.rrd'),
      now,
      { reads: diskIO.reads, writes: diskIO.writes, read_bytes: diskIO.readBytes, write_bytes: diskIO.writeBytes }
    );
  } catch (err) {
    console.error('[SystemRRD] Failed to update disk-io:', err);
  }

  // 4. Thermal (write 0 if null / no sensor)
  try {
    await updateSingleRRD(
      path.join(SYSTEM_RRD_DIR, 'thermal.rrd'),
      now,
      { cpu_temp: thermal ?? 0 }
    );
  } catch (err) {
    console.error('[SystemRRD] Failed to update thermal:', err);
  }

  // 5. Network Errors
  try {
    await updateSingleRRD(
      path.join(SYSTEM_RRD_DIR, 'network-errors.rrd'),
      now,
      { rx_err: netErrors.rxErr, tx_err: netErrors.txErr, rx_drop: netErrors.rxDrop, tx_drop: netErrors.txDrop, rx_pkt: netErrors.rxPkt, tx_pkt: netErrors.txPkt }
    );
  } catch (err) {
    console.error('[SystemRRD] Failed to update network-errors:', err);
  }

  // 6. TCP Connections
  try {
    await updateSingleRRD(
      path.join(SYSTEM_RRD_DIR, 'tcp-connections.rrd'),
      now,
      { established: tcpConn.established, time_wait: tcpConn.timeWait, close_wait: tcpConn.closeWait, syn_recv: tcpConn.synRecv }
    );
  } catch (err) {
    console.error('[SystemRRD] Failed to update tcp-connections:', err);
  }

  // 7. CPU Per-Core
  try {
    const coreValues: Record<string, number> = {};
    for (let i = 0; i < cpuPerCore.length; i++) {
      coreValues[`cpu${i}`] = cpuPerCore[i];
    }
    await updateSingleRRD(
      path.join(SYSTEM_RRD_DIR, 'cpu-percore.rrd'),
      now,
      coreValues
    );
  } catch (err) {
    console.error('[SystemRRD] Failed to update cpu-percore:', err);
  }

  // 8. Active Sessions
  try {
    await updateSingleRRD(
      path.join(SYSTEM_RRD_DIR, 'active-sessions.rrd'),
      now,
      { count: activeSessions }
    );
  } catch (err) {
    console.error('[SystemRRD] Failed to update active-sessions:', err);
  }

  // 9. Auth Stats
  try {
    await updateSingleRRD(
      path.join(SYSTEM_RRD_DIR, 'auth-stats.rrd'),
      now,
      { accept: authStats.accept, reject: authStats.reject }
    );
  } catch (err) {
    console.error('[SystemRRD] Failed to update auth-stats:', err);
  }
}

/**
 * Update a single RRD file with timestamped values.
 */
async function updateSingleRRD(
  filePath: string,
  timestamp: number,
  values: Record<string, number>
): Promise<void> {
  const valueStr = [timestamp, ...Object.values(values)].join(':');
  await rrdExec(['update', filePath, valueStr]);
}

/**
 * Fetch graph data from a system RRD.
 *
 * @param type   - 'cpu' | 'memory' | 'disk' | 'interface' | 'cpu-percore' |
 *                 'load' | 'swap' | 'disk-io' | 'thermal' | 'network-errors' |
 *                 'tcp' | 'active-sessions' | 'auth-stats'
 * @param name   - interface name (required when type = 'interface')
 * @param range  - '1h' | '6h' | '24h' | '7d' | '30d' | '1y'
 */
export async function fetchSystemGraph(
  type: string,
  name: string,
  range: string
): Promise<SystemGraphResult> {
  const now = Math.floor(Date.now() / 1000);
  const rangeSeconds: Record<string, number> = {
    '1h': 3600,
    '6h': 21600,
    '24h': 86400,
    '7d': 604800,
    '30d': 2592000,
    '90d': 7776000,
    '1y': 31536000,
  };

  const seconds = rangeSeconds[range] || 86400;
  const start = now - seconds;
  const resolution = RANGE_RESOLUTIONS[range] || 300;
  const cf = 'AVERAGE';

  // Determine file path and DEF/XPORT definitions based on type
  let filePath: string;
  let defXportArgs: string[];
  let dsNames: string[];

  switch (type) {
    case 'cpu':
      filePath = path.join(SYSTEM_RRD_DIR, 'cpu.rrd');
      defXportArgs = [
        `DEF:usage=${filePath}:usage:${cf}`,
        'XPORT:usage:CPU Usage %',
      ];
      dsNames = ['usage'];
      break;

    case 'memory':
      filePath = path.join(SYSTEM_RRD_DIR, 'memory.rrd');
      defXportArgs = [
        `DEF:used=${filePath}:used:${cf}`,
        `DEF:percent=${filePath}:percent:${cf}`,
        'XPORT:used:Memory Used (bytes)',
        'XPORT:percent:Memory Usage %',
      ];
      dsNames = ['used', 'percent'];
      break;

    case 'disk':
      filePath = path.join(SYSTEM_RRD_DIR, 'disk.rrd');
      defXportArgs = [
        `DEF:used=${filePath}:used:${cf}`,
        `DEF:percent=${filePath}:percent:${cf}`,
        'XPORT:used:Disk Used (bytes)',
        'XPORT:percent:Disk Usage %',
      ];
      dsNames = ['used', 'percent'];
      break;

    case 'interface':
      if (!name) {
        return {
          timestamps: [],
          data: {},
          meta: { step: resolution, start, end: now, cf, dsNames: [], type, range },
        };
      }
      filePath = path.join(SYSTEM_RRD_DIR, `${name}.rrd`);
      defXportArgs = [
        `DEF:rx=${filePath}:rx:${cf}`,
        `DEF:tx=${filePath}:tx:${cf}`,
        'XPORT:rx:RX Bytes',
        'XPORT:tx:TX Bytes',
      ];
      dsNames = ['rx', 'tx'];
      break;

    case 'load':
      filePath = path.join(SYSTEM_RRD_DIR, 'load.rrd');
      defXportArgs = [
        `DEF:load1=${filePath}:load1:${cf}`,
        `DEF:load5=${filePath}:load5:${cf}`,
        `DEF:load15=${filePath}:load15:${cf}`,
        'XPORT:load1:Load 1min',
        'XPORT:load5:Load 5min',
        'XPORT:load15:Load 15min',
      ];
      dsNames = ['load1', 'load5', 'load15'];
      break;

    case 'swap':
      filePath = path.join(SYSTEM_RRD_DIR, 'swap.rrd');
      defXportArgs = [
        `DEF:used=${filePath}:used:${cf}`,
        `DEF:percent=${filePath}:percent:${cf}`,
        'XPORT:used:Swap Used (bytes)',
        'XPORT:percent:Swap Usage %',
      ];
      dsNames = ['used', 'percent'];
      break;

    case 'disk-io':
      filePath = path.join(SYSTEM_RRD_DIR, 'disk-io.rrd');
      defXportArgs = [
        `DEF:reads=${filePath}:reads:${cf}`,
        `DEF:writes=${filePath}:writes:${cf}`,
        `DEF:read_bytes=${filePath}:read_bytes:${cf}`,
        `DEF:write_bytes=${filePath}:write_bytes:${cf}`,
        'XPORT:reads:Read Operations',
        'XPORT:writes:Write Operations',
        'XPORT:read_bytes:Read Bytes',
        'XPORT:write_bytes:Write Bytes',
      ];
      dsNames = ['reads', 'writes', 'read_bytes', 'write_bytes'];
      break;

    case 'thermal':
      filePath = path.join(SYSTEM_RRD_DIR, 'thermal.rrd');
      defXportArgs = [
        `DEF:cpu_temp=${filePath}:cpu_temp:${cf}`,
        'XPORT:cpu_temp:CPU Temperature',
      ];
      dsNames = ['cpu_temp'];
      break;

    case 'network-errors':
      filePath = path.join(SYSTEM_RRD_DIR, 'network-errors.rrd');
      defXportArgs = [
        `DEF:rx_err=${filePath}:rx_err:${cf}`,
        `DEF:tx_err=${filePath}:tx_err:${cf}`,
        `DEF:rx_drop=${filePath}:rx_drop:${cf}`,
        `DEF:tx_drop=${filePath}:tx_drop:${cf}`,
        `DEF:rx_pkt=${filePath}:rx_pkt:${cf}`,
        `DEF:tx_pkt=${filePath}:tx_pkt:${cf}`,
        'XPORT:rx_err:RX Errors',
        'XPORT:tx_err:TX Errors',
        'XPORT:rx_drop:RX Drops',
        'XPORT:tx_drop:TX Drops',
        'XPORT:rx_pkt:RX Packets',
        'XPORT:tx_pkt:TX Packets',
      ];
      dsNames = ['rx_err', 'tx_err', 'rx_drop', 'tx_drop', 'rx_pkt', 'tx_pkt'];
      break;

    case 'tcp':
      filePath = path.join(SYSTEM_RRD_DIR, 'tcp-connections.rrd');
      defXportArgs = [
        `DEF:established=${filePath}:established:${cf}`,
        `DEF:time_wait=${filePath}:time_wait:${cf}`,
        `DEF:close_wait=${filePath}:close_wait:${cf}`,
        `DEF:syn_recv=${filePath}:syn_recv:${cf}`,
        'XPORT:established:Established',
        'XPORT:time_wait:Time Wait',
        'XPORT:close_wait:Close Wait',
        'XPORT:syn_recv:SYN Recv',
      ];
      dsNames = ['established', 'time_wait', 'close_wait', 'syn_recv'];
      break;

    case 'cpu-percore': {
      filePath = path.join(SYSTEM_RRD_DIR, 'cpu-percore.rrd');
      // Dynamically determine DS names from rrdtool info
      dsNames = await getDSNamesFromRRD(filePath);
      if (dsNames.length === 0) {
        return {
          timestamps: [],
          data: {},
          meta: { step: resolution, start, end: now, cf, dsNames: [], type, range },
        };
      }
      defXportArgs = [];
      for (const dsName of dsNames) {
        defXportArgs.push(`DEF:${dsName}=${filePath}:${dsName}:${cf}`);
      }
      for (const dsName of dsNames) {
        defXportArgs.push(`XPORT:${dsName}:${dsName}`);
      }
      break;
    }

    case 'active-sessions':
      filePath = path.join(SYSTEM_RRD_DIR, 'active-sessions.rrd');
      defXportArgs = [
        `DEF:count=${filePath}:count:${cf}`,
        'XPORT:count:Active Sessions',
      ];
      dsNames = ['count'];
      break;

    case 'auth-stats':
      filePath = path.join(SYSTEM_RRD_DIR, 'auth-stats.rrd');
      defXportArgs = [
        `DEF:accept=${filePath}:accept:${cf}`,
        `DEF:reject=${filePath}:reject:${cf}`,
        'XPORT:accept:Auth Accept',
        'XPORT:reject:Auth Reject',
      ];
      dsNames = ['accept', 'reject'];
      break;

    default:
      return {
        timestamps: [],
        data: {},
        meta: { step: resolution, start, end: now, cf, dsNames: [], type, range },
      };
  }

  // File may not exist yet
  if (!fs.existsSync(filePath)) {
    return {
      timestamps: [],
      data: {},
      meta: { step: resolution, start, end: now, cf, dsNames, type, name: name || undefined, range },
    };
  }

  try {
    const args: string[] = [
      'xport',
      '--json',
      '--start', String(start),
      '--end', String(now),
      '--step', String(resolution),
      ...defXportArgs,
    ];

    const stdout = await rrdExec(args);
    const parsed = JSON.parse(stdout);

    const data: Record<string, number[]> = {};
    for (const name of dsNames) {
      data[name] = [];
    }

    const timestamps: number[] = [];

    // rrdtool xport --json returns:
    //   { meta: { start, end, step, ... }, data: [[val1, val2, ...], ...] }
    // Note: timestamps are NOT included in data rows — compute from meta.start + idx * step
    if (parsed.data && Array.isArray(parsed.data)) {
      const metaStart = parsed.meta?.start ?? start;
      const metaStep = parsed.meta?.step ?? resolution;
      for (let idx = 0; idx < parsed.data.length; idx++) {
        const row = parsed.data[idx];
        timestamps.push(metaStart + idx * metaStep);
        for (let i = 0; i < dsNames.length; i++) {
          const val = row[i];
          if (val !== null && val !== undefined && !isNaN(Number(val))) {
            data[dsNames[i]].push(Number(val));
          } else {
            data[dsNames[i]].push(0);
          }
        }
      }
    }

    return {
      timestamps,
      data,
      meta: {
        step: resolution,
        start,
        end: now,
        cf,
        dsNames,
        type,
        name: name || undefined,
        range,
      },
    };
  } catch (err) {
    console.error(`[SystemRRD] Failed to fetch ${type} graph:`, err);
    return {
      timestamps: [],
      data: {},
      meta: { step: resolution, start, end: now, cf, dsNames, type, name: name || undefined, range },
    };
  }
}

/**
 * Extract DS names from an existing RRD file using rrdtool info.
 * Returns an empty array if the file doesn't exist or parsing fails.
 */
async function getDSNamesFromRRD(filePath: string): Promise<string[]> {
  if (!fs.existsSync(filePath)) return [];

  try {
    const stdout = await rrdExec(['info', filePath]);
    const dsNames: string[] = [];
    // rrdtool info outputs lines like: ds[cpu0].index = 0
    const dsRegex = /^ds\[([^\]]+)\]\.index\s*=/m;
    let match;
    while ((match = dsRegex.exec(stdout)) !== null) {
      dsNames.push(match[1]);
    }
    return dsNames;
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Pool Bandwidth RRD ───────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const POOL_RRD_DIR = path.join(getRRDBasePath(), 'pools');

const POOL_BW_DS: RRDDataSource[] = [
  { name: 'download', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
  { name: 'upload', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
];

/**
 * Ensure a pool RRD file exists, creating it if necessary.
 * Pool IDs are UUIDs — the full UUID is used as filename.
 *
 * @param poolId - BandwidthPool UUID from database
 */
export async function ensurePoolRRD(poolId: string): Promise<void> {
  if (!fs.existsSync(POOL_RRD_DIR)) {
    fs.mkdirSync(POOL_RRD_DIR, { recursive: true });
  }

  const filePath = path.join(POOL_RRD_DIR, `${poolId}.rrd`);
  if (fs.existsSync(filePath)) return;

  try {
    const now = Math.floor(Date.now() / 1000);
    const args = [
      'create',
      filePath,
      '--step', String(DEFAULT_STEP),
      '--start', String(now - DEFAULT_STEP),
      ...POOL_BW_DS.map(dsToString),
      ...SYSTEM_RRAS.map(rraToString),
    ];
    await rrdExec(args);
  } catch (err) {
    console.error(`[PoolRRD] Failed to create ${filePath}:`, err);
  }
}

/**
 * Update a pool RRD file with delta bandwidth values (bytes/sec).
 *
 * @param poolId    - BandwidthPool UUID from database
 * @param download  - Download delta bytes since last poll
 * @param upload    - Upload delta bytes since last poll
 */
export async function updatePoolRRD(poolId: string, download: number, upload: number): Promise<void> {
  const filePath = path.join(POOL_RRD_DIR, `${poolId}.rrd`);
  if (!fs.existsSync(filePath)) return;

  try {
    const now = Math.floor(Date.now() / 1000);
    const valueStr = `${now}:${download}:${upload}`;
    await rrdExec(['update', filePath, valueStr]);
  } catch (err) {
    console.error(`[PoolRRD] Failed to update ${poolId}:`, err);
  }
}

/**
 * Fetch historical bandwidth data for a pool from its RRD file.
 *
 * @param poolId - BandwidthPool UUID from database
 * @param range  - Time range: '1h' | '6h' | '24h' | '7d' | '30d' | '90d' | '1y'
 * @returns SystemGraphResult with download/upload data series (bytes/sec)
 */
export async function fetchPoolGraph(poolId: string, range: string): Promise<SystemGraphResult> {
  const now = Math.floor(Date.now() / 1000);
  const rangeSeconds: Record<string, number> = {
    '1h': 3600,
    '6h': 21600,
    '24h': 86400,
    '7d': 604800,
    '30d': 2592000,
    '90d': 7776000,
    '1y': 31536000,
  };

  const seconds = rangeSeconds[range] || 86400;
  const start = now - seconds;
  const resolution = RANGE_RESOLUTIONS[range] || 300;
  const cf = 'AVERAGE';
  const dsNames = ['download', 'upload'];

  // Try multiple candidate paths (same pattern as user-graph)
  const candidates = [
    path.join(POOL_RRD_DIR, `${poolId}.rrd`),
    path.join(getRRDBasePath(), 'pools', `${poolId}.rrd`),
  ];

  // Also try short-id variant (first 8 chars of UUID)
  const shortId = poolId.replace(/-/g, '').substring(0, 8);
  candidates.push(
    path.join(POOL_RRD_DIR, `${shortId}.rrd`),
    path.join(getRRDBasePath(), 'pools', `${shortId}.rrd`),
  );

  let filePath = '';
  for (const candidate of candidates) {
    if (/*turbopackIgnore: true*/ fs.existsSync(candidate)) {
      filePath = candidate;
      break;
    }
  }

  if (!filePath) {
    return {
      timestamps: [],
      data: { download: [], upload: [] },
      meta: { step: resolution, start, end: now, cf, dsNames, type: 'pool', name: poolId, range },
    };
  }

  try {
    const args: string[] = [
      'xport',
      '--json',
      '--start', String(start),
      '--end', String(now),
      '--step', String(resolution),
      `DEF:download=${filePath}:download:${cf}`,
      `DEF:upload=${filePath}:upload:${cf}`,
      'XPORT:download:Download',
      'XPORT:upload:Upload',
    ];

    const stdout = await rrdExec(args);
    const parsed = JSON.parse(stdout);

    const data: Record<string, number[]> = {
      download: [],
      upload: [],
    };
    const timestamps: number[] = [];

    if (parsed.data && Array.isArray(parsed.data)) {
      const metaStart = parsed.meta?.start ?? start;
      const metaStep = parsed.meta?.step ?? resolution;
      for (let idx = 0; idx < parsed.data.length; idx++) {
        const row = parsed.data[idx];
        timestamps.push(metaStart + idx * metaStep);
        for (let i = 0; i < dsNames.length; i++) {
          const val = row[i];
          if (val !== null && val !== undefined && !isNaN(Number(val))) {
            data[dsNames[i]].push(Number(val));
          } else {
            data[dsNames[i]].push(0);
          }
        }
      }
    }

    return {
      timestamps,
      data,
      meta: {
        step: resolution,
        start,
        end: now,
        cf,
        dsNames,
        type: 'pool',
        name: poolId,
        range,
      },
    };
  } catch (err) {
    console.error(`[PoolRRD] Failed to fetch graph for ${poolId}:`, err);
    return {
      timestamps: [],
      data: { download: [], upload: [] },
      meta: { step: resolution, start, end: now, cf, dsNames, type: 'pool', name: poolId, range },
    };
  }
}
