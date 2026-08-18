/**
 * @file logger.mjs
 * @description Structured JSON logging utility for SIMShield.
 */

function formatLog(level, message, context = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context
  };
  return JSON.stringify(logEntry);
}

export const logger = Object.freeze({
  info(message, context = {}) {
    console.log(formatLog('INFO', message, context));
  },
  warn(message, context = {}) {
    console.warn(formatLog('WARN', message, context));
  },
  error(message, error = null, context = {}) {
    const errorDetails = error instanceof Error
      ? { errorName: error.name, errorMessage: error.message, stack: error.stack }
      : { error };
    console.error(formatLog('ERROR', message, { ...errorDetails, ...context }));
  },
  debug(message, context = {}) {
    if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
      console.debug(formatLog('DEBUG', message, context));
    }
  }
});
