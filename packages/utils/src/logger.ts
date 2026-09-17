type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};

const RESET = '\x1b[0m';

function formatTimestamp(): string {
  return new Date().toISOString();
}

function log(level: LogLevel, context: string, message: string, meta?: unknown): void {
  const color = LEVEL_COLORS[level];
  const ts = formatTimestamp();
  const prefix = `${color}[${level.toUpperCase()}]${RESET} ${ts} [${context}]`;

  if (meta !== undefined) {
    console.log(`${prefix} ${message}`, meta);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

export function createLogger(context: string) {
  return {
    debug: (msg: string, meta?: unknown) => log('debug', context, msg, meta),
    info: (msg: string, meta?: unknown) => log('info', context, msg, meta),
    warn: (msg: string, meta?: unknown) => log('warn', context, msg, meta),
    error: (msg: string, meta?: unknown) => log('error', context, msg, meta),
  };
}

export type Logger = ReturnType<typeof createLogger>;
