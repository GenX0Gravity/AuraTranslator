/**
 * Structured logger for Cloud Logging compatibility.
 * Outputs JSON-formatted logs that Cloud Logging can parse with severity levels.
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

interface LogEntry {
  severity: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

function log(severity: LogLevel, message: string, meta: Record<string, unknown> = {}): void {
  const entry: LogEntry = {
    severity,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
    // Cloud Logging structured format
    console.log(JSON.stringify(entry));
  } else {
    // Developer-friendly format
    const prefix = `[${severity}] ${entry.timestamp}`;
    if (severity === 'ERROR' || severity === 'CRITICAL') {
      console.error(prefix, message, Object.keys(meta).length > 0 ? meta : '');
    } else if (severity === 'WARNING') {
      console.warn(prefix, message, Object.keys(meta).length > 0 ? meta : '');
    } else {
      console.log(prefix, message, Object.keys(meta).length > 0 ? meta : '');
    }
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => log('DEBUG', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log('INFO', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log('WARNING', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log('ERROR', message, meta),
  critical: (message: string, meta?: Record<string, unknown>) => log('CRITICAL', message, meta),
};
