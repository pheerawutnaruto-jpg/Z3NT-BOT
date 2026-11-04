process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const http = require('http');
const { Redis } = require('@upstash/redis');

const { validateEnv, getGuildId } = require('./src/config/env');
const { debugLog, debugError } = require('./src/utils/debug');

validateEnv();
const TEST_GUILD_ID = getGuildId();

const { IMAGES, COLORS } = require('./constants');
const { getSecurityDashboardContent, handleSecurityMessage } = require('./security');
const {
  handleLeveling,
  handleCommandLeveling,
  levelCommand,
  handleLevelCommand,
  leaderboardCommand,
  handleLeaderboardCommand,
  setLevelCommand,
  handleSetLevelCommand,
  getLevelDashboardContent,
  startVoiceXpCron,
  pendingRoleRewardImages
} = require('./level');
const { setupQuestCommand, handleSetupQuestCommand, handleQuestButton } = require('./quest');
const {
  setupShopCommand,
  handleSetupShopCommand,
  boostStatusCommand,
  handleBoostStatusCommand,
  coinsCommand,
  addCoinsCommand,
  handleCoinsCommand,
  handleAddCoinsCommand,
  handleShopButton
} = require('./shop');
const { setupArtistCommand, handleSetupArtistCommand, handleArtistButton, handleArtistModalSubmit } = require('./artist_card');
const { setupMediaGuardCommand, handleSetupMediaGuardCommand, handleMediaGuardMessage } = require('./media_guard');
const { setupOrderTicketCommand, handleSetupOrderTicketCommand, handleOrderTicketSelect, handleOrderPaymentButton, handleCloseTicketButton } = require('./order_ticket');
const { isServerPremium, grantPremiumCommand, handleGrantPremiumCommand } = require('./license');
const {
  setupCinemaCommand,
  cinemaBroadcastCommand,
  handleSetupCinemaCommand,
  handleCinemaBroadcastCommand,
  handleCinemaButton,
  handleCinemaSelect,
  handleCinemaModal
} = require('./cinema');
const {
  autoCinemaCommand,
  handleAutoCinemaCommand,
  handleAutoCinemaButton,
  handleAutoCinemaSelect,
  handleAutoCinemaModal,
  loadAllAutoCinemaCrons
} = require('./auto_cinema');
const {
  setupShowcaseCommand,
  handleSetupShowcaseCommand,
  handleShowcaseMessage
} = require('./media_showcase');
const {
  petShopCommand,
  handlePetShopCommand,
  setPetChannelCommand,
  handleSetPetChannelCommand,
  setPetRoleCommand,
  handleSetPetRoleCommand,
  petCommand,
  handlePetCommand,
  handleCompanionButton,
  petBattleCommand,
  handlePetBattleCommand,
  handleBattleButtons,
  petLeaderboardCommand,
  handlePetLeaderboardCommand,
  startPetHatchCron
} = require('./companion');

// นำเข้าโมดูล Welcome/Autorole และ Utility ที่แยกออกไป
const { setWelcomeCommand, setAutoroleCommand, handleWelcomeAutoroleCommands, handleWelcomeAutoroleInteraction, handleGuildMemberAdd } = require('./welcome_autorole');
const { utilityCommands, loadAllAutoClearCrons, handleUtilityCommands } = require('./utility');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const bootHealth = {
  startedAt: Date.now(),
  readyAt: null,
  ready: false,
  guildCount: 0,
  lastInteractionAt: null,
  lastCommandName: null,
};

const httpServer = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    const uptimeSeconds = Math.max(0, Math.floor((Date.now() - bootHealth.startedAt) / 1000));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: bootHealth.ready ? 'ok' : 'starting',
      ready: bootHealth.ready,
      uptimeSeconds,
      guildCount: bootHealth.guildCount,
      lastInteractionAt: bootHealth.lastInteractionAt,
      lastCommandName: bootHealth.lastCommandName,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  if (req.method === 'POST' && req.url === '/github-webhook') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        if (data.commits && data.repository) {
          const repoName = data.repository.name;
          const commits = data.commits;
          const changelogText = commits.map(c => `+ ${c.message}`).join('\n');
          const embed = new EmbedBuilder()
            .setColor(COLORS.PRIMARY || '#2b2d31')
            .setImage('https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExbzJudGQ0bWtubTFsOG5mMWk5ZXdydXhwMjJnejZxOHVjeWtrdGlrYiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/O7BtZQ0ceoVz4pDdC7/giphy.gif')
            .setTitle('🚀 New Release')
            .setDescription('A new update has been published.')
            .addFields(
              { name: '🟢 Announcement Bot', value: `**Version:**\n\`${repoName}\``, inline: false },
              { name: 'Changelog:', value: `\`\`\`diff\n${changelogText}\n\`\`\``, inline: false },
              { name: 'Released:', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            );

          for (const [guildId, config] of Object.entries(serverConfigs)) {
            if (config.devLogChannelId) {
              try {
                const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
                if (guild) {
                  const channel = await guild.channels.fetch(config.devLogChannelId).catch(() => null);
                  if (channel && channel.isTextBased()) {
                    await channel.send({ content: '<@&1560731553766707241>', embeds: [embed] });
                  }
                }
              } catch (err) {
                debugError('Error sending github log', err);
              }
            }
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success' }));
      } catch (e) {
        debugError('Webhook parse error', e);
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad Request');
      }
    });
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running!\n');
  }
});

httpServer.listen(process.env.PORT || 3000, () => {
  debugLog('HTTP health endpoint listening', { port: process.env.PORT || 3000 });
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

let serverConfigs = {};
let saveTimeout = null;

async function loadConfigs() {
  try {
    const data = await redis.get('server_configs');
    if (data) {
      return typeof data === 'string' ? JSON.parse(data) : data;
    }
  } catch (e) {
    debugError('Error loading config from Redis', e);
  }
  return {};
}

async function saveConfigs(configs) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      await redis.set('server_configs', JSON.stringify(configs));
    } catch (e) {
      debugError('Error saving config to Redis', e);
    }
  }, 1500);
}

function ensureGuildConfig(guildId) {
  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  const config = serverConfigs[guildId];
  if (!config.security) {
    config.security = {
      enabled: false, antiLink: true, antiSpam: true, antiMrBeast: true,
      spamCount: 3, spamSeconds: 6, timeoutSeconds: 60,
      actions: { invite: { timeout: true, kick: false, ban: false }, spam: { timeout: true, kick: false, ban: false }, mrbeast: { timeout: true, kick: false, ban: false } },
      ignoredChannels: []
    };
  }
  if (!config.levels) config.levels = {};
  if (!config.levelConfig) {
    config.levelConfig = {
      enabled: true, minXp: 15, maxXp: 25, cmdXp: 20, xpMultiplier: 100, channelId: null,
      levelUpMessage: 'ยินดีด้วยคุณ {user}! เลเวลอัปขึ้นเป็น **Level {level}** แล้ว!',
      roleRewardMessage: '👑 ยินดีด้วยคุณ {user} ได้รับยศพิเศษ {role} เนื่องในโอกาสอัปถึง Level {level}!',
      cardTitle: '📊 𝙕𝙀𝙉 𝘽𝙊𝙏 • STATS CARD',
      cardDescription: 'การ์ดข้อมูลเลเวลของ **{user}**',
      embedColor: COLORS.PRIMARY,
      statsCardImageUrl: '',
      voiceXpEnabled: false, voiceXpAmount: 10, roleRewards: {}
    };
  }
  if (!config.mediaGuardChannels) config.mediaGuardChannels = [];
  if (config.showcaseChannelId === undefined) config.showcaseChannelId = null;
  return config;
}

const spamTracker = new Map();

client.once('ready', async () => {
  serverConfigs = await loadConfigs();
  console.log(`Bot Online แล้วจ้า: ${client.user.tag}`);
  bootHealth.ready = true;
  bootHealth.readyAt = Date.now();
  bootHealth.guildCount = client.guilds.cache.size;

  startVoiceXpCron(client, serverConfigs, saveConfigs);
  startPetHatchCron(client, serverConfigs, saveConfigs);
  loadAllAutoCinemaCrons(client, serverConfigs);
  loadAllAutoClearCrons(client, serverConfigs);

  const commands = [
    setWelcomeCommand,
    setAutoroleCommand,
    ...utilityCommands,
    new SlashCommandBuilder().setName('set-security').setDescription('เปิดแผงควบคุมระบบป้องกันความปลอดภัยขั้นสูง').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    levelCommand,
    leaderboardCommand,
    setupQuestCommand,
    setupShopCommand,
    setupOrderTicketCommand,
    coinsCommand,
    addCoinsCommand,
    grantPremiumCommand,
    boostStatusCommand,
    setupArtistCommand,
    setupMediaGuardCommand,
    setupShowcaseCommand,
    setLevelCommand,
    setupCinemaCommand,
    cinemaBroadcastCommand,
    autoCinemaCommand,
    petShopCommand,
    petCommand,
    petBattleCommand,
    petLeaderboardCommand,
    setPetChannelCommand,
    setPetRoleCommand
  ].map(command => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    if (TEST_GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(client.user.id, TEST_GUILD_ID), { body: commands });
    } else {
      await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    }
  } catch (error) {
    debugError('Command register failed', error);
  }
});

client.on('messageCreate', async message => {
  const guildId = message.guild?.id;
  if (!guildId || message.author.bot) return;
  const config = ensureGuildConfig(guildId);

  const hasPremium = await isServerPremium(guildId, serverConfigs);
  if (hasPremium && handleMediaGuardMessage(message, serverConfigs)) return;
  if (await handleSecurityMessage(message, config, spamTracker)) return;
  if (await handleShowcaseMessage(message, serverConfigs)) return;

  handleLeveling(message, serverConfigs, saveConfigs, client);
});

client.on('guildMemberAdd', async member => {
  await handleGuildMemberAdd(member, serverConfigs);
});

client.on('interactionCreate', async interaction => {
  bootHealth.lastInteractionAt = Date.now();
  if (interaction.isChatInputCommand()) bootHealth.lastCommandName = interaction.commandName;

  const guildId = interaction.guildId;
  if (!guildId) return;
  const config = ensureGuildConfig(guildId);

  if (await handleCompanionButton(interaction, serverConfigs, saveConfigs)) return;
  if (await handleBattleButtons(interaction, serverConfigs, saveConfigs)) return;
  if (await handleCinemaButton(interaction, serverConfigs, saveConfigs)) return;
  if (await handleAutoCinemaButton(interaction, serverConfigs, saveConfigs, client)) return;
  if (await handleOrderPaymentButton(interaction)) return;
  if (await handleCloseTicketButton(interaction)) return;
  if (await handleQuestButton(interaction, serverConfigs, saveConfigs)) return;
  if (await handleShopButton(interaction, serverConfigs, saveConfigs)) return;
  if (await handleArtistButton(interaction, serverConfigs)) return;
  if (await handleWelcomeAutoroleInteraction(interaction, serverConfigs, saveConfigs)) return;

  const premiumCommands = [
    'setup-quest', 'setup-in-game-shop', 'coins', 'setup-order-ticket',
    'add-coins', 'setup-media-guard', 'setup-showcase', 'set-autoclear',
    'setup-artist-card', 'boost-status', 'cinema-setup', 'cinema-broadcast',
    'auto-cinema'
  ];

  if (interaction.isChatInputCommand() && premiumCommands.includes(interaction.commandName)) {
    const hasPremium = await isServerPremium(guildId, serverConfigs);
    if (!hasPremium) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('💎 สนใจติดต่อซื้อระบบพรีเมียม').setStyle(ButtonStyle.Link).setURL('https://discord.gg/your-invite-link')
      );
      return await interaction.reply({ content: '❌ คำสั่งนี้ใช้ได้เฉพาะเซิร์ฟเวอร์พรีเมียมเท่านั้น', components: [row], ephemeral: true });
    }
  }

  if (interaction.isChatInputCommand()) {
    handleCommandLeveling(interaction, serverConfigs, saveConfigs, client);
    const cmd = interaction.commandName;

    if (await handleUtilityCommands(interaction, serverConfigs, saveConfigs, client)) return;
    if (cmd === 'set-welcome' || cmd === 'set-autorole') return await handleWelcomeAutoroleCommands(interaction, serverConfigs);

    if (cmd === 'level') return await handleLevelCommand(interaction, serverConfigs);
    if (cmd === 'leaderboard') return await handleLeaderboardCommand(interaction, serverConfigs);
    if (cmd === 'setup-quest') return await handleSetupQuestCommand(interaction);
    if (cmd === 'setup-in-game-shop') return await handleSetupShopCommand(interaction);
    if (cmd === 'setup-order-ticket') return await handleSetupOrderTicketCommand(interaction);
    if (cmd === 'coins') return await handleCoinsCommand(interaction, serverConfigs);
    if (cmd === 'grant-premium') return await handleGrantPremiumCommand(interaction, serverConfigs, saveConfigs);
    if (cmd === 'add-coins') return await handleAddCoinsCommand(interaction, serverConfigs, saveConfigs);
    if (cmd === 'boost-status') return await handleBoostStatusCommand(interaction, serverConfigs);
    if (cmd === 'setup-artist-card') return await handleSetupArtistCommand(interaction);
    if (cmd === 'setup-media-guard') return await handleSetupMediaGuardCommand(interaction, serverConfigs, saveConfigs);
    if (cmd === 'setup-showcase') return await handleSetupShowcaseCommand(interaction, serverConfigs, saveConfigs);
    if (cmd === 'cinema-setup') return await handleSetupCinemaCommand(interaction);
    if (cmd === 'cinema-broadcast') return await handleCinemaBroadcastCommand(interaction, serverConfigs);
    if (cmd === 'auto-cinema') return await handleAutoCinemaCommand(interaction, serverConfigs);
    if (cmd === 'set-level') return await handleSetLevelCommand(interaction, serverConfigs);

    if (cmd === 'pet-shop') return await handlePetShopCommand(interaction);
    if (cmd === 'set-pet-channel') return await handleSetPetChannelCommand(interaction, serverConfigs, saveConfigs);
    if (cmd === 'set-pet-role') return await handleSetPetRoleCommand(interaction, serverConfigs, saveConfigs);
    if (cmd === 'pet') return await handlePetCommand(interaction, serverConfigs, saveConfigs, client);
    if (cmd === 'pet-battle') return await handlePetBattleCommand(interaction, serverConfigs, client);
    if (cmd === 'pet-leaderboard') return await handlePetLeaderboardCommand(interaction, serverConfigs);

    if (cmd === 'set-security') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
      return await interaction.reply({ ...getSecurityDashboardContent(config), ephemeral: true });
    }
  }

  if (interaction.isStringSelectMenu() && !interaction.customId.startsWith('order')) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
    await interaction.deferUpdate().catch(() => {});
    const vals = interaction.values;
    if (interaction.customId === 'act_invite_select') {
      config.security.actions.invite.timeout = vals.includes('timeout');
      config.security.actions.invite.kick = vals.includes('kick');
      config.security.actions.invite.ban = vals.includes('ban');
    } else if (interaction.customId === 'act_spam_select') {
      config.security.actions.spam.timeout = vals.includes('timeout');
      config.security.actions.spam.kick = vals.includes('kick');
      config.security.actions.spam.ban = vals.includes('ban');
    }
    await saveConfigs(serverConfigs);
    return await interaction.editReply(getSecurityDashboardContent(config));
  }

  if (interaction.isChannelSelectMenu() && interaction.customId === 'sec_select_ignored') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return;
    await interaction.deferUpdate().catch(() => {});
    config.security.ignoredChannels = interaction.values;
    await saveConfigs(serverConfigs);
    return await interaction.editReply(getSecurityDashboardContent(config));
  }

  if (interaction.isButton() && interaction.customId.startsWith('sec_')) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({ content: '❌ เฉพาะผู้ดูแลระบบเท่านั้น', ephemeral: true });
    }
    await interaction.deferUpdate().catch(() => {});
    const id = interaction.customId;
    if (id === 'sec_toggle_main') config.security.enabled = !config.security.enabled;
    else if (id === 'sec_toggle_link') config.security.antiLink = !config.security.antiLink;
    else if (id === 'sec_toggle_spam') config.security.antiSpam = !config.security.antiSpam;
    else if (id === 'sec_toggle_mrbeast') config.security.antiMrBeast = !config.security.antiMrBeast;
    else if (id === 'sec_reset') {
      config.security = {
        enabled: false, antiLink: true, antiSpam: true, antiMrBeast: true, spamCount: 3, spamSeconds: 6, timeoutSeconds: 60,
        actions: { invite: { timeout: true, kick: false, ban: false }, spam: { timeout: true, kick: false, ban: false }, mrbeast: { timeout: true, kick: false, ban: false } },
        ignoredChannels: []
      };
    }
    await saveConfigs(serverConfigs);
    return await interaction.editReply(getSecurityDashboardContent(config));
  }
});

client.login(process.env.DISCORD_TOKEN);
