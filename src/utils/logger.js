// Simple leveled logger with runtime level control.
// Use environment variable LOG_LEVEL to control verbosity: debug|info|warn|error
// Default behavior: in production, default to 'error' (only severe); otherwise 'info'.
const levelNames = {
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR'
};

const levelPriority = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function timestamp() {
  return new Date().toISOString();
}

const envLevel = (process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'error' : 'info')).toLowerCase();
const currentPriority = levelPriority[envLevel] || levelPriority.error;

function shouldLog(level) {
  const p = levelPriority[level] || levelPriority.info;
  return p >= currentPriority;
}

function format(level, ...args) {
  const label = levelNames[level] || 'LOG';
  // Use console.error for error level, otherwise console.log
  const out = level === 'error' ? console.error : console.log;
  out(`[${timestamp()}] [${label}]`, ...args);
}

module.exports = {
  debug: (...args) => { if (shouldLog('debug')) format('debug', ...args); },
  info: (...args) => { if (shouldLog('info')) format('info', ...args); },
  warn: (...args) => { if (shouldLog('warn')) format('warn', ...args); },
  error: (...args) => { if (shouldLog('error')) format('error', ...args); }
};
