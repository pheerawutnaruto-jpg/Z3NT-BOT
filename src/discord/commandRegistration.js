const { REST } = require('discord.js');
const { debugLog } = require('../utils/debug');

function patchGuildCommandRegistration() {
  const originalPut = REST.prototype.put;

  REST.prototype.put = function(path, body) {
    const guildId = process.env.TEST_GUILD_ID;
    const pathText = String(path || '');

    if (guildId && pathText.includes('/applications/') && pathText.includes('/commands') && !pathText.includes('/guilds/')) {
      const match = pathText.match(/\/applications\/([^/]+)\/commands$/);
      if (match) {
        const applicationId = match[1];
        const guildPath = `/applications/${applicationId}/guilds/${guildId}/commands`;
        debugLog('Using guild command registration route', { guildId, path: guildPath });
        return originalPut.call(this, guildPath, body);
      }
    }

    return originalPut.call(this, path, body);
  };
}

async function registerCommands(client, commands, guildId = null) {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    if (guildId) {
      await rest.put(`/applications/${client.user.id}/guilds/${guildId}/commands`, { body: commands });
      debugLog('Registered guild commands', { guildId, count: commands.length });
      return { mode: 'guild', guildId };
    }

    await rest.put(`/applications/${client.user.id}/commands`, { body: commands });
    debugLog('Registered global commands', { count: commands.length });
    return { mode: 'global' };
  } catch (error) {
    console.error('Failed to register commands:', error);
    throw error;
  }
}

module.exports = {
  patchGuildCommandRegistration,
  registerCommands
};
