/**
 * Structured Logger (Feature #294)
 *
 * Centralized structured logger with JSON output.
 * Supports child loggers with context, request binding, and tracing.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  tenantId?: string;
  userId?: string;
  requestId?: string;
  error?: { name: string; message: string; stack?: string };
  metadata?: Record<string, unknown>;
  duration?: number;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

class Logger {
  private context?: string;
  private tenantId?: string;
  private userId?: string;
  private requestId?: string;
  private static requestIdCounter = 0;

  constructor(opts?: { context?: string; tenantId?: string; userId?: string; requestId?: string }) {
    this.context = opts?.context;
    this.tenantId = opts?.tenantId;
    this.userId = opts?.userId;
    this.requestId = opts?.requestId;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL];
  }

  private format(entry: LogEntry): string {
    if (process.env.NODE_ENV === 'production') {
      return JSON.stringify(entry);
    }
    // Pretty print for development
    const colorMap: Record<LogLevel, string> = {
      debug: '\x1b[36m', // cyan
      info: '\x1b[32m',  // green
      warn: '\x1b[33m',  // yellow
      error: '\x1b[31m', // red
      fatal: '\x1b[35m', // magenta
    };
    const reset = '\x1b[0m';
    const color = colorMap[entry.level];
    const ts = entry.timestamp.replace('T', ' ').replace('Z', '');
    const ctx = entry.context ? `[${entry.context}]` : '';
    const tid = entry.tenantId ? ` t=${entry.tenantId.slice(0, 8)}` : '';
    const dur = entry.duration ? ` ${entry.duration}ms` : '';
    let line = `${color}${entry.level.toUpperCase().padEnd(5)}${reset} ${ts}${ctx}${tid}${dur} ${entry.message}`;
    if (entry.error) {
      line += `\n  Error: ${entry.error.message}`;
      if (process.env.NODE_ENV !== 'production' && entry.error.stack) {
        line += `\n  Stack: ${entry.error.stack}`;
      }
    }
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      line += `\n  Meta: ${JSON.stringify(entry.metadata)}`;
    }
    return line;
  }

  private emit(level: LogLevel, message: string, meta?: Record<string, unknown>, error?: Error, duration?: number) {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    if (this.context) entry.context = this.context;
    if (this.tenantId) entry.tenantId = this.tenantId;
    if (this.userId) entry.userId = this.userId;
    if (this.requestId) entry.requestId = this.requestId;
    if (meta && Object.keys(meta).length > 0) entry.metadata = meta;
    if (duration !== undefined) entry.duration = duration;
    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        ...(process.env.NODE_ENV !== 'production' && error.stack ? { stack: error.stack } : {}),
      };
    }

    const formatted = this.format(entry);

    switch (level) {
      case 'debug':
        console.debug(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
        console.error(formatted);
        break;
      case 'fatal':
        console.error(formatted);
        break;
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.emit('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.emit('warn', message, meta);
  }

  error(message: string, error?: Error, meta?: Record<string, unknown>): void {
    this.emit('error', message, meta, error);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.emit('debug', message, meta);
  }

  fatal(message: string, error?: Error, meta?: Record<string, unknown>): void {
    this.emit('fatal', message, meta, error);
  }

  /** Create a child logger with a specific context */
  child(context: string): Logger {
    return new Logger({
      context,
      tenantId: this.tenantId,
      userId: this.userId,
      requestId: this.requestId,
    });
  }

  /** Create a logger bound to a specific request */
  withRequest(request: Request): Logger {
    const requestId = request.headers.get('x-request-id') || `auto-${++Logger.requestIdCounter}`;
    const tenantId = request.headers.get('x-tenant-id') || undefined;
    return new Logger({
      context: this.context,
      tenantId: tenantId || this.tenantId,
      requestId,
      userId: this.userId,
    });
  }

  /** Measure execution time of an async function */
  async measure<T>(message: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      this.info(message, { durationMs: Date.now() - start });
      return result;
    } catch (error) {
      this.error(message, error instanceof Error ? error : new Error(String(error)), { durationMs: Date.now() - start });
      throw error;
    }
  }
}

export const logger = new Logger();
export type { Logger, LogLevel, LogEntry };
