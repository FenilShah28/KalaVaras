/**
 * Minimal frontend logger.
 * In production, logs are suppressed. In development, they appear in DevTools.
 */
const isDev = import.meta.env.DEV;

export const logger = {
  info: (msg: string, ...args: unknown[]) => {
    if (isDev) console.info(`[KalaVaras] ${msg}`, ...args);
  },
  warn: (msg: string, ...args: unknown[]) => {
    if (isDev) console.warn(`[KalaVaras] ${msg}`, ...args);
  },
  error: (msg: string, ...args: unknown[]) => {
    console.error(`[KalaVaras] ${msg}`, ...args); // Always log errors
  },
};
