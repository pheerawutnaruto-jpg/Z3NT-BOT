function debugLog(message, meta = {}) {
  const timestamp = new Date().toISOString();
  const safeMeta = meta && typeof meta === 'object' ? meta : { value: meta };

  if (Object.keys(safeMeta).length === 0) {
    console.log(`[${timestamp}] ${message}`);
    return;
  }

  console.log(`[${timestamp}] ${message}`, JSON.stringify(safeMeta));
}

function debugError(message, error = {}) {
  const timestamp = new Date().toISOString();
  const safeError = error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : error;

  console.error(`[${timestamp}] ${message}`, JSON.stringify(safeError));
}

module.exports = {
  debugLog,
  debugError
};
