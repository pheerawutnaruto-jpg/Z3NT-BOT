const requiredEnv = ['DISCORD_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'];

function getEnv(name) {
  return process.env[name];
}

function validateEnv() {
  const missing = requiredEnv.filter((key) => !getEnv(key));

  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }

  return {
    DISCORD_TOKEN: getEnv('DISCORD_TOKEN'),
    TEST_GUILD_ID: getEnv('TEST_GUILD_ID') || null,
    PORT: getEnv('PORT') || '3000',
    UPSTASH_REDIS_REST_URL: getEnv('UPSTASH_REDIS_REST_URL'),
    UPSTASH_REDIS_REST_TOKEN: getEnv('UPSTASH_REDIS_REST_TOKEN')
  };
}

function getGuildId() {
  return process.env.TEST_GUILD_ID || null;
}

module.exports = {
  getEnv,
  validateEnv,
  getGuildId
};
