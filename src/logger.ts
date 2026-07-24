const colors = {
  reset: '\x1b[0m',
  info: '\x1b[36m', // Cyan
  success: '\x1b[32m', // Green
  warn: '\x1b[33m', // Yellow
  error: '\x1b[31m', // Red
  debug: '\x1b[90m', // Gray
  timestamp: '\x1b[35m', // Magenta
};

function getTimestamp(): string {
  const now = new Date();
  return now.toISOString().replace(/T/, ' ').replace(/\..+/, '');
}

export const logger = {
  info(message: string, context?: string) {
    const ctx = context ? ` [${context}]` : '';
    console.log(`${colors.timestamp}[${getTimestamp()}]${colors.reset} ${colors.info}[INFO]${colors.reset}${ctx} ${message}`);
  },

  success(message: string, context?: string) {
    const ctx = context ? ` [${context}]` : '';
    console.log(`${colors.timestamp}[${getTimestamp()}]${colors.reset} ${colors.success}[SUCCESS]${colors.reset}${ctx} ${message}`);
  },

  warn(message: string, context?: string) {
    const ctx = context ? ` [${context}]` : '';
    console.warn(`${colors.timestamp}[${getTimestamp()}]${colors.reset} ${colors.warn}[WARN]${colors.reset}${ctx} ${message}`);
  },

  error(message: string | Error, context?: string) {
    const ctx = context ? ` [${context}]` : '';
    const msg = message instanceof Error ? message.stack || message.message : message;
    console.error(`${colors.timestamp}[${getTimestamp()}]${colors.reset} ${colors.error}[ERROR]${colors.reset}${ctx} ${msg}`);
  },

  debug(message: string, context?: string) {
    const ctx = context ? ` [${context}]` : '';
    console.log(`${colors.timestamp}[${getTimestamp()}]${colors.reset} ${colors.debug}[DEBUG]${colors.reset}${ctx} ${message}`);
  }
};
export type Logger = typeof logger;
