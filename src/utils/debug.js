function debugLog(message, meta = {}) {
  const timestamp = new Date().toISOString();
  if (Object.keys(meta).length === 0) {
    console.log(`[${timestamp}] ${message}`);
    return;
  }

  console.log(`[${timestamp}] ${message}`, JSON.stringify(meta));
}

module.exports = {
  debugLog
};
