/**
 * ClickHouse HTTP client — StaySuite-HospitalityOS
 *
 * Pure server-side utility. Uses the native ClickHouse HTTP interface
 * (JSONEachRow for inserts, TSV for selects) with no external driver.
 */

// ─── Configuration ──────────────────────────────────────────────
const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL ?? 'http://127.0.0.1:8123';
const CLICKHOUSE_USER = process.env.CLICKHOUSE_USER ?? 'default';
const CLICKHOUSE_PASSWORD = process.env.CLICKHOUSE_PASSWORD ?? '';
const TIMEOUT_MS = 30_000;
const IS_DEV = process.env.NODE_ENV === 'development';

// ─── Helpers ────────────────────────────────────────────────────

/** Build the Authorization header value when credentials are present. */
function authHeader(): string | undefined {
  return CLICKHOUSE_PASSWORD ? `Basic ${Buffer.from(`${CLICKHOUSE_USER}:${CLICKHOUSE_PASSWORD}`).toString('base64')}` : undefined;
}

/** Low-level request wrapper — returns response body text or null on failure. */
async function request(url: string, init: RequestInit): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'X-ClickHouse-User': CLICKHOUSE_USER,
        ...(CLICKHOUSE_PASSWORD ? { 'X-ClickHouse-Key': CLICKHOUSE_PASSWORD } : {}),
        ...(authHeader() ? { Authorization: authHeader()! } : {}),
        ...init.headers,
      },
    });

    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      if (IS_DEV) console.warn(`[clickhouse] ${init.method ?? 'GET'} ${url} → ${res.status}: ${body.slice(0, 200)}`);
      return null;
    }

    return res.text();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (IS_DEV) console.warn(`[clickhouse] connection error: ${msg}`);
    return null;
  }
}

// ─── Type coercion ──────────────────────────────────────────────

/**
 * Coerce a raw TSV cell string into a JS-native type.
 * ClickHouse TSV sends bare strings — we detect numbers and nulls.
 */
function coerce(value: string): string | number | boolean | null {
  // ClickHouse NULL is rendered as the literal `\N` in TSV
  if (value === '\\N') return null;

  // Unsigned integers (UInt8/16/32/64)
  if (/^\d+$/.test(value)) {
    const n = Number(value);
    return Number.isSafeInteger(n) ? n : BigInt(value);
  }

  // Signed integers
  if (/^-?\d+$/.test(value)) {
    const n = Number(value);
    return Number.isSafeInteger(n) ? n : BigInt(value);
  }

  // Floats
  if (/^-?\d+\.\d+$/.test(value)) {
    return Number(value);
  }

  // Booleans — ClickHouse sometimes sends 0/1 for Bool/UInt8
  if (value === '1' || value === 'true') return true;
  if (value === '0' || value === 'false') return false;

  return value;
}

/**
 * Parse a TSV body into an array of typed row objects.
 * First row = header names, subsequent rows = values.
 */
function parseTSV(body: string): Record<string, unknown>[] {
  const lines = body.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split('\t');
  const rows: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split('\t');
    const row: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = j < cells.length ? coerce(cells[j]) : null;
    }
    rows.push(row);
  }

  return rows;
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Execute a SELECT query and return an array of typed row objects.
 * Returns an empty array on connection/parse errors.
 */
export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
): Promise<T[]> {
  if (IS_DEV) console.log(`[clickhouse] query: ${sql.slice(0, 300)}`);

  const url = new URL(CLICKHOUSE_URL);
  // ClickHouse HTTP API defaults to TabSeparated (no column names).
  // parseTSV() requires the first row to be column headers, so we
  // must explicitly request TSVWithNames unless the query already
  // specifies a FORMAT clause.
  const formattedSql = /\bFORMAT\b/i.test(sql)
    ? sql
    : `${sql.trimEnd()} FORMAT TSVWithNames`;
  url.searchParams.set('query', formattedSql);

  const body = await request(url.toString(), { method: 'GET' });
  if (body === null) return [];

  try {
    return parseTSV(body) as T[];
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (IS_DEV) console.warn(`[clickhouse] TSV parse error: ${msg}`);
    return [];
  }
}

/**
 * Insert rows into a table using JSONEachRow format.
 * Returns true on success, false on any failure.
 */
export async function insert<T extends Record<string, unknown> = Record<string, unknown>>(
  table: string,
  rows: T[],
): Promise<boolean> {
  if (!rows.length) return true;

  if (IS_DEV) console.log(`[clickhouse] insert into ${table}: ${rows.length} rows`);

  const url = new URL(CLICKHOUSE_URL);
  url.searchParams.set('query', `INSERT INTO ${table} FORMAT JSONEachRow`);

  const payload = rows.map((row) => JSON.stringify(row)).join('\n');
  const body = await request(url.toString(), {
    method: 'POST',
    body: payload,
    headers: { 'Content-Type': 'application/x-ndjson' },
  });

  return body !== null;
}

/**
 * Execute a DDL/DML statement (CREATE, ALTER, INSERT … SELECT, etc.).
 * Returns true on success, false on failure.
 */
export async function exec(sql: string): Promise<boolean> {
  if (IS_DEV) console.log(`[clickhouse] exec: ${sql.slice(0, 300)}`);

  const url = new URL(CLICKHOUSE_URL);
  url.searchParams.set('query', sql);

  const body = await request(url.toString(), { method: 'POST' });
  return body !== null;
}

/**
 * Health check — runs SELECT 1 against ClickHouse.
 * Returns true if reachable and responding, false otherwise.
 */
export async function isAvailable(): Promise<boolean> {
  const url = new URL(CLICKHOUSE_URL);
  url.searchParams.set('query', 'SELECT 1');

  const body = await request(url.toString(), { method: 'GET' });
  return body !== null && body.trim() === '1';
}
