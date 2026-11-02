const { validateEnv, getGuildId } = require('./config/env');
const { debugLog } = require('./utils/debug');
const { patchGuildCommandRegistration } = require('./commandRegistration');

validateEnv();
patchGuildCommandRegistration();

debugLog('Bootstrapping bot', {
  guildId: getGuildId(),
  port: process.env.PORT || '3000'
});

require('../index.js');
