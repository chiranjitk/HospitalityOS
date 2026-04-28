/**
 * RRDtool Wrapper Library
 *
 * Provides TypeScript functions for creating, updating, and querying RRD files
 * using the compiled rrdtool binary.
 *
 * RRD binary: /home/z/my-project/StaySuite-HospitalityOS/rrdtool/bin/rrdtool
 * RRD storage: /home/z/my-project/StaySuite-HospitalityOS/data/rrd/
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);

// RRDtool binary path
const RRD_BIN = '/home/z/my-project/StaySuite-HospitalityOS/rrdtool/bin/rrdtool';

// Base directory for RRD files
const RRD_BASE = '/home/z/my-project/StaySuite-HospitalityOS/data/rrd';

// Environment for rrdtool (needs LD_LIBRARY_PATH for shared libs)
const RRD_ENV = {
  ...process.env,
  LD_LIBRARY_PATH: '/home/z/my-project/StaySuite-HospitalityOS/rrdtool/lib',
};

// Default step (60 seconds)
const DEFAULT_STEP = 60;

// Default data sources
const DEFAULT_DS = [
  'DS:ds_in:DERIVE:120:0:U',
  'DS:ds_out:DERIVE:120:0:U',
];

// Default RRAs: 1min→24h, 5min→7d, 1h→30d, 1day→1yr
const DEFAULT_RRAS = [
  'RRA:AVERAGE:0.5:1:1440',    // 1min avg, 24h
  'RRA:AVERAGE:0.5:5:2016',    // 5min avg, 7d
  'RRA:AVERAGE:0.5:60:720',    // 1hr avg, 30d
  'RRA:AVERAGE:0.5:1440:365',  // 1day avg, 1yr
  'RRA:MAX:0.5:1:1440',        // 1min max, 24h
  'RRA:MAX:0.5:5:2016',        // 5min max, 7d
];

export interface RRDDataSource {
  name: string;
  type: 'GAUGE' | 'COUNTER' | 'DERIVE' | 'ABSOLUTE';
  heartbeat?: number;
  min?: string;  // 'U' for unknown
  max?: string;
}

export interface RRDArchive {
  cf: 'AVERAGE' | 'MIN' | 'MAX' | 'LAST';
  xff?: number;
  steps: number;
  rows: number;
}

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

/**
 * Execute rrdtool command
 */
async function rrdExec(args: string[]): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync(RRD_BIN, args, {
      env: RRD_ENV,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for xport
    });
    if (stderr && !stdout) {
      throw new Error(stderr);
    }
    return stdout;
  } catch (err: any) {
    throw new Error(`rrdtool error: ${err.stderr || err.message}`);
  }
}

/**
 * Create an RRD file
 */
export async function createRRD(
  filePath: string,
  step: number = DEFAULT_STEP,
  dataSources: RRDDataSource[] = [
    { name: 'ds_in', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
    { name: 'ds_out', type: 'DERIVE', heartbeat: 120, min: '0', max: 'U' },
  ],
  archives: RRDArchive[] = [
    { cf: 'AVERAGE', steps: 1, rows: 1440 },
    { cf: 'AVERAGE', steps: 5, rows: 2016 },
    { cf: 'AVERAGE', steps: 60, rows: 720 },
    { cf: 'AVERAGE', steps: 1440, rows: 365 },
    { cf: 'MAX', steps: 1, rows: 1440 },
    { cf: 'MAX', steps: 5, rows: 2016 },
  ]
): Promise<void> {
  // Ensure directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const args = [
    'create',
    filePath,
    '--step', String(step),
    '--start', String(Math.floor(Date.now() / 1000) - step),
    ...dataSources.map(dsToString),
    ...archives.map(rraToString),
  ];

  await rrdExec(args);
}

/**
 * Update an RRD file with new data
 */
export async function updateRRD(
  filePath: string,
  timestamp: number,
  values: Record<string, number>
): Promise<void> {
  // Format: timestamp:value1:value2:...
  const valueStr = [timestamp, ...Object.values(values)].join(':');
  const args = ['update', filePath, valueStr];
  await rrdExec(args);
}

/**
 * Fetch data from an RRD file via xport --json
 * Returns structured JSON data
 */
export async function fetchRRD(
  filePath: string,
  cf: string = 'AVERAGE',
  start: number,
  end: number,
  resolution?: number
): Promise<{
  timestamps: number[];
  data: Record<string, number[]>;
  meta: { step: number; start: number; end: number; cf: string; dsNames: string[] };
}> {
  if (!fs.existsSync(filePath)) {
    return { timestamps: [], data: {}, meta: { step: 60, start, end, cf, dsNames: [] } };
  }

  const args: string[] = [
    'xport',
    '--json',
    '--start', String(start),
    '--end', String(end),
  ];

  if (resolution && resolution > 0) {
    args.push('--step', String(resolution));
  }

  args.push(
    'DEF:ds_in=' + filePath + ':ds_in:' + cf,
    'DEF:ds_out=' + filePath + ':ds_out:' + cf,
    'XPORT:ds_in:download',
    'XPORT:ds_out:upload',
  );

  const stdout = await rrdExec(args);

  try {
    const parsed = JSON.parse(stdout);
    const meta = parsed.meta || {};
    const dsNames: string[] = [];
    const data: Record<string, number[]> = {};

    if (parsed.meta && parsed.meta.legend) {
      parsed.meta.legend.forEach((name: string, idx: number) => {
        const key = idx === 0 ? 'in' : 'out';
        dsNames.push(key);
        data[key] = [];
      });
    }

    // Parse data columns
    // rrdtool xport --json: data rows contain DS values only (no timestamps)
    // Timestamps computed from meta.start + idx * meta.step
    if (parsed.data) {
      const timestamps: number[] = [];
      const metaStart = parsed.meta?.start ?? start;
      const metaStep = parsed.meta?.step ?? 60;
      parsed.data.forEach((row: number[], idx: number) => {
        timestamps.push(metaStart + idx * metaStep);
        for (let i = 0; i < dsNames.length; i++) {
          const key = dsNames[i];
          if (key && data[key]) {
            const val = row[i];
            if (val !== null && val !== undefined && !isNaN(Number(val))) {
              data[key].push(Number(val));
            } else {
              data[key].push(0);
            }
          }
        }
      });

      return {
        timestamps,
        data,
        meta: {
          step: meta.step || 60,
          start,
          end,
          cf,
          dsNames,
        },
      };
    }
  } catch (e) {
    console.error('[RRD] Failed to parse xport JSON:', e);
  }

  return { timestamps: [], data: {}, meta: { step: 60, start, end, cf, dsNames: [] } };
}

/**
 * Get RRD file info
 */
export async function infoRRD(filePath: string): Promise<Record<string, unknown> | null> {
  if (!fs.existsSync(filePath)) return null;

  const stdout = await rrdExec(['info', filePath]);
  const info: Record<string, unknown> = {};
  const currentDS: Record<string, unknown> = {};
  const currentRRA: Record<string, unknown> = {};
  let currentSection: 'ds' | 'rra' | 'global' = 'global';

  for (const line of stdout.split('\n')) {
    const match = line.match(/^(\w+)\[(\w+)\]\.(\w+) = (.+)$/);
    if (match) {
      const [, type, index, key, value] = match;
      if (type === 'ds') {
        currentSection = 'ds';
        if (!info['ds']) info['ds'] = {};
        if (!(info['ds'] as Record<string, unknown>)[index]) {
          (info['ds'] as Record<string, unknown>)[index] = {};
        }
        ((info['ds'] as Record<string, unknown>)[index] as Record<string, unknown>)[key] = parseRRDValue(value);
      } else if (type === 'rra') {
        currentSection = 'rra';
        if (!info['rra']) info['rra'] = [];
        const arr = info['rra'] as Record<string, unknown>[];
        if (!arr[parseInt(index)]) arr[parseInt(index)] = {};
        arr[parseInt(index)][key] = parseRRDValue(value);
      }
    } else {
      const gMatch = line.match(/^(\w+) = (.+)$/);
      if (gMatch) {
        info[gMatch[1]] = parseRRDValue(gMatch[2]);
      }
    }
  }

  return info;
}

function parseRRDValue(val: string): unknown {
  const stripped = val.trim();
  if (stripped.startsWith('"') && stripped.endsWith('"')) return stripped.slice(1, -1);
  if (stripped === 'NaN') return NaN;
  const num = Number(stripped);
  if (!isNaN(num) && stripped !== '') return num;
  return stripped;
}

/**
 * Ensure an RRD file exists, create if not
 */
export async function ensureRRD(
  filePath: string,
  step: number = DEFAULT_STEP,
  dataSources?: RRDDataSource[],
  archives?: RRDArchive[]
): Promise<boolean> {
  if (fs.existsSync(filePath)) return true;

  try {
    await createRRD(filePath, step, dataSources, archives);
    return true;
  } catch (err) {
    console.error(`[RRD] Failed to create ${filePath}:`, err);
    return false;
  }
}

/**
 * Get the RRD base path
 */
export function getRRDBasePath(): string {
  return RRD_BASE;
}

/**
 * Build user RRD file path
 */
export function userRRDPath(username: string): string {
  return path.join(RRD_BASE, 'users', `${username}.rrd`);
}

/**
 * Build interface RRD file path
 */
export function interfaceRRDPath(iface: string): string {
  return path.join(RRD_BASE, 'interfaces', `${iface}.rrd`);
}
