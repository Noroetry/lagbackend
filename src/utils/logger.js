const levels = {
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
  debug: 'DEBUG'
};

function timestamp() {
  return new Date().toISOString();
}

function format(level, ...args) {
  const label = levels[level] || 'LOG';
  console.log(`[${timestamp()}] [${label}]`, ...args);
}

module.exports = {
  info: (...args) => format('info', ...args),
  warn: (...args) => format('warn', ...args),
  error: (...args) => format('error', ...args),
  debug: (...args) => {
    if (process.env.NODE_ENV === 'development') {
      format('debug', ...args);
    }
  }
};
