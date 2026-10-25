// index.js
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const http = require('http');
const cron = require('node-cron');
const { Redis } = require('@upstash/redis');

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
const { generateWelcomeCard } = require('./canvas_card');
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

// 🐾 นำเข้าระบบ Zen Pet จาก companion.js (แก้ไขชื่อให้ตรงกับcompanion.jsเรียบร้อย)
const {
  rollRandomPet,
  petShopCommand,
  handlePetShopCommand,
  setPetChannelCommand,
  setPetRoleCommand,
  handleSetPetRoleCommand,
  companionCommand,
  handleCompanionCommand,
  coinsCommand: petCoinsCommand,
  handleCoinsCommand: handlePetCoinsCommand,
  handleCompanionButton,
  petBattleCommand,
  handlePetBattleCommand,
  handleBattleButtons,
  petLeaderboardCommand,
  handlePetLeaderboardCommand
} = require('./companion');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// 🌐 HTTP Server รองรับทั้ง Health Check และ GitHub Webhook
const httpServer = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/github-webhook') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        
        if (data.commits && data.repository) {
          const repoName = data.repository.name;
          const commits = data.commits;
          
          let changelogText = commits.map(c => `+ ${c.message}`).join('\n');

          const embed = new EmbedBuilder()
            .setColor(COLORS.PRIMARY || '#2b2d31')
            .setImage('https://cdn.discordapp.com/attachments/1559878908348997774/1563825106504126534/1792915336456.jpg?ex=6adf091f&is=6addb79f&hm=627b17681285da8a04b3a97b7a150efad975c03ba69407e7f1a68a65f72f3003&')
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
                    await channel.send({ content: '<@&1551183125076508713>', embeds: [embed] });
                  }
                }
              } catch (err) {
                console.error('Error sending github log:', err);
              }
            }
          }
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success' }));
      } catch (e) {
        console.error('Webhook parse error:', e);
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad Request');
      }
    });
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running!\n');
  }
});
httpServer.listen(process.env.PORT || 3000);

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
    console.error('Error loading config from Redis:', e);
  }
  return {};
}

async function saveConfigs(configs) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      await redis.set('server_configs', JSON.stringify(configs));
    } catch (e) {
      console.error('Error saving config to Redis:', e);
    }
  }, 1500);
}

function ensureGuildConfig(guildId) {
  if (!serverConfigs[guildId]) {
    serverConfigs[guildId] = {};
  }
  const config = serverConfigs[guildId];

  if (config.welcomeEnabled === undefined) config.welcomeEnabled = false;
  if (config.channelId === undefined) config.channelId = null;
  if (config.autoroleEnabled === undefined) config.autoroleEnabled = false;
  if (config.autoroleId === undefined) config.autoroleId = null;
  if (config.devLogChannelId === undefined) config.devLogChannelId = null;

  if (!config.security) {
    config.security = {
      enabled: false, antiLink: true, antiSpam: true, antiMrBeast: true,
      spamCount: 3, spamSeconds: 6, timeoutSeconds: 60,
      actions: {
        invite: { timeout: true, kick: false, ban: false },
        spam: { timeout: true, kick: false, ban: false },
        mrbeast: { timeout: true, kick: false, ban: false }
      },
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
  if (!config.levelConfig.roleRewardMessage) {
    config.levelConfig.roleRewardMessage = '👑 ยินดีด้วยคุณ {user} ได้รับยศพิเศษ {role} เนื่องในโอกาสอัปถึง Level {level}!';
  }
  if (!config.levelConfig.roleRewards) config.levelConfig.roleRewards = {};
  if (!config.embed) {
    config.embed = { description: '**𑣲⋆ 𝙉𝙀𝙒 𝙈𝙚𝙢1𝙚𝙧!** ✨\n🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}** ครับ!' };
  }
  if (!config.autoClear) {
    config.autoClear = { enabled: false, time: '06:00', channelId: null };
  }
  if (!config.mediaGuardChannels) config.mediaGuardChannels = [];
  if (config.showcaseChannelId === undefined) config.showcaseChannelId = null;

  return config;
}

let activeCronJobs = {};
const spamTracker = new Map();

client.once('ready', async () => {
  serverConfigs = await loadConfigs();
  console.log(`Bot Online แล้วจ้า: ${client.user.tag}`);

  startVoiceXpCron(client, serverConfigs, saveConfigs);
  loadAllAutoCinemaCrons(client, serverConfigs);

  const commands = [
    new SlashCommandBuilder().setName('ping').setDescription('เช็กความเร็วและสถานะของบอท'),
    new SlashCommandBuilder().setName('set-welcome').setDescription('เปิดแผงควบคุมระบบต้อนรับ (Welcome Dashboard)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('set-autorole').setDescription('ตั้งค่าระบบแจกยศอัตโนมัติสำหรับสมาชิกใหม่').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('set-security').setDescription('เปิดแผงควบคุมระบบป้องกันความปลอดภัยขั้นสูง').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('bot-info').setDescription('✨ แสดงข้อมูลและหน้าพรีเซนต์แนะนำตัวของ Zen Bot'),
    new SlashCommandBuilder()
      .setName('set-dev-log')
      .setDescription('🛠️ ตั้งค่าห้องสำหรับรับแจ้งเตือน Live GitHub Dev Stream')
      .addChannelOption(option => option.setName('channel').setDescription('เลือกห้องรับแจ้งเตือนโค้ดอัปเดต').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
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
    companionCommand,
    petBattleCommand,
    petLeaderboardCommand,
    setPetChannelCommand,
    setPetRoleCommand,
    new SlashCommandBuilder().setName('clear').setDescription('ลบข้อความในแชทจำนวน 1-100 ข้อความ')
      .addIntegerOption(option => option.setName('amount').setDescription('จำนวนข้อความที่ต้องการลบ (1-100)').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    new SlashCommandBuilder().setName('set-autoclear').setDescription('💎 [PREMIUM] ตั้งเวลาระบบลบข้อความอัตโนมัติ')
      .addStringOption(option => option.setName('time').setDescription('ระบุเวลาในรูปแบบ HH:MM เช่น 06:00').setRequired(true))
      .addChannelOption(option => option.setName('channel').setDescription('เลือกห้องที่ต้องการให้ลบข้อความอัตโนมัติ').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  ].map(command => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('ลงทะเบียนคำสั่งทั้งหมดสำเร็จเรียบร้อย!');
  } catch (error) {
    console.error(error);
  }

  for (const guildId in serverConfigs) {
    const config = serverConfigs[guildId];
    if (config?.autoClear?.enabled && config.autoClear.time && config.autoClear.channelId) {
      setupCronJob(guildId, config.autoClear.time, config.autoClear.channelId);
    }
  }
});

function setupCronJob(guildId, timeStr, channelId) {
  if (activeCronJobs[guildId]) {
    activeCronJobs[guildId].stop();
    delete activeCronJobs[guildId];
  }

  const [hour, minute] = (timeStr || '').split(':');
  if (!hour || !minute) return;

  const cronExpression = `${minute} ${hour} * * *`;

  activeCronJobs[guildId] = cron.schedule(cronExpression, async () => {
    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return;
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (channel && channel.isTextBased()) {
        const fetched = await channel.messages.fetch({ limit: 100 });
        await channel.bulkDelete(fetched, true);
        console.log(`✅ ลบข้อความอัตโนมัติเวลา ${timeStr} สำเร็จในห้อง #${channel.name}`);
      }
    } catch (err) {
      console.error(`❌ เกิดข้อผิดพลาดในการลบข้อความอัตโนมัติ (Guild: ${guildId}):`, err);
    }
  }, { timezone: "Asia/Bangkok" });
}

client.on('messageCreate', async message => {
  const guildId = message.guild?.id;
  if (!guildId || message.author.bot) return;

  const config = ensureGuildConfig(guildId);

  const hasPremium = await isServerPremium(guildId, serverConfigs);
  if (hasPremium) {
    const isMediaBlocked = handleMediaGuardMessage(message, serverConfigs);
    if (isMediaBlocked) return;
  }

  const isBlocked = await handleSecurityMessage(message, config, spamTracker);
  if (isBlocked) return;

  const isShowcaseHandled = await handleShowcaseMessage(message, serverConfigs);
  if (isShowcaseHandled) return;

  handleLeveling(message, serverConfigs, saveConfigs, client);
});

client.on('guildMemberAdd', async member => {
  if (member.user.bot) return;

  const guildId = member.guild.id;
  const config = ensureGuildConfig(guildId);

  if (config.autoroleEnabled && config.autoroleId) {
    try {
      const role = await member.guild.roles.fetch(config.autoroleId);
      if (role) {
        await member.roles.add(role);
      }
    } catch (err) {
      console.error('Autorole error:', err);
    }
  }

  if (!config.welcomeEnabled || !config.channelId) return;

  try {
    const channel = await member.guild.channels.fetch(config.channelId);
    if (!channel) return;

    const attachment = await generateWelcomeCard(member);
    const defaultDesc = '**𑣲⋆ 𝙉𝙀𝙒 𝙈𝙚𝙢𝙗𝙚𝙧!** ✨\n🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}** ครับ!';
    const finalDesc = (config.embed?.description || defaultDesc)
      .replace('{user}', `${member}`)
      .replace('{server}', member.guild.name);

    await channel.send({ content: finalDesc, files: [attachment] });
  } catch (err) {
    console.error('Send welcome error:', err);
  }
});

client.on('interactionCreate', async interaction => {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const config = ensureGuildConfig(guildId);

  const petBtnHandled = await handleCompanionButton(interaction, loadConfigs, saveConfigs);
  if (petBtnHandled) return;

  const battleHandled = await handleBattleButtons(interaction, loadConfigs, saveConfigs);
  if (battleHandled) return;

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
        new ButtonBuilder()
          .setLabel('💎 สนใจติดต่อซื้อระบบพรีเมียม')
          .setStyle(ButtonStyle.Link)
          .setURL('https://discord.gg/your-invite-link')
      );

      return await interaction.reply({
        content: '❌ คำสั่งนี้ใช้ได้เฉพาะเซิร์ฟเวอร์พรีเมียมเท่านั้น',
        components: [row],
        ephemeral: true
      });
    }
  }

  if (interaction.isChatInputCommand()) {
    handleCommandLeveling(interaction, serverConfigs, saveConfigs, client);

    const cmd = interaction.commandName;

    if (cmd === 'pet-shop') return await handlePetShopCommand(interaction);
    if (cmd === 'companion') return await handleCompanionCommand(interaction, serverConfigs, saveConfigs, client);
    if (cmd === 'pet-battle') return await handlePetBattleCommand(interaction, serverConfigs, client);
    if (cmd === 'pet-leaderboard') return await handlePetLeaderboardCommand(interaction, serverConfigs);
    if (cmd === 'set-pet-channel') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
      }
      const channel = interaction.options.getChannel('channel');
      config.petChannelId = channel.id;
      await saveConfigs(serverConfigs);
      return await interaction.reply({ content: `✅ ตั้งค่าห้องแจ้งเตือนสัตว์เลี้ยงเรียบร้อยที่: ${channel}`, ephemeral: true });
    }
    if (cmd === 'set-pet-role') return await handleSetPetRoleCommand(interaction, serverConfigs, saveConfigs);
    if (cmd === 'set-dev-log') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
      }
      const channel = interaction.options.getChannel('channel');
      config.devLogChannelId = channel.id;
      await saveConfigs(serverConfigs);
      return await interaction.reply({ content: `✅ ตั้งค่าห้องรับแจ้งเตือน GitHub Dev Stream เรียบร้อยที่: ${channel}`, ephemeral: true });
    }

    const adminCommands = [
      'setup-quest', 'setup-in-game-shop', 'setup-order-ticket', 'add-coins',
      'grant-premium', 'setup-artist-card', 'setup-media-guard', 'setup-showcase',
      'cinema-setup', 'cinema-broadcast', 'auto-cinema', 'set-level', 'set-security',
      'set-autoclear', 'set-welcome', 'set-autorole', 'set-role-reward', 'set-dev-log',
      'pet-shop', 'set-pet-channel', 'set-pet-role'
    ];

    if (adminCommands.includes(cmd)) {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return await interaction.reply({ content: '❌ เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้นถึงจะใช้คำสั่งนี้ได้!', ephemeral: true });
      }
    }

    if (cmd === 'ping') {
      return await interaction.reply({ content: 'Pong! 🏓 บอททำงานระบบ Slash Command ปกติบน Render ครับ 🚀', ephemeral: true });
    }
    if (cmd === 'bot-info') {
      const embed = new EmbedBuilder()
        .setTitle('🤖 𝙕𝙀𝙉 𝘽𝙊𝙏 • OFFICIAL PRESENTATION')
        .setDescription(
          '**ระบบจัดการและปกป้องเซิร์ฟเวอร์แบบครบวงจร** ✨\n\n' +
          '🚀 **ฟีเจอร์เด่นภายในบอท:**\n' +
          '> 🛡️ **Advanced Security:** ระบบป้องกันลิงก์สแปม และบอทหลอกลวงพร้อมบทลงโทษอัตโนมัติ\n' +
          '> 📊 **Leveling & Voice XP:** ระบบเก็บเลเวลทั้งแชทและห้องเสียง พร้อมการ์ดโปรไฟล์ Canvas สุดพรีเมียม\n' +
          '> 🎬 **Zen Cinema:** ระบบจัดการรอบฉายหนังอัตโนมัติ (Coming Soon & Now Showing) พร้อมระบบขายตั๋วหักเหรียญ\n' +
          '> 🛒 **Automated Store:** ระบบร้านค้าสกิน/ยศ และระบบห้องออร์เดอร์พร้อมใบเสร็จอัตโนมัติ\n' +
          '> 🎨 **Artist Showcase:** ระบบห้องโชว์ผลงานพร้อมรีแอคชันอัตโนมัติ\n' +
          '> 🎁 **Daily Quest:** เควสต์สุ่มแจก Zen Coins ฟรีทุก 19 ชั่วโมง (แบบ 50/50)\n' +
          '> 🐾 **Zen Pet System:** ระบบเลี้ยงสัตว์ ฟักไข่ และลานประลองชิง Orbs สุดมันส์!\n' +
          '> 🛠️ **Dev Stream:** ระบบสตรีมโค้ดและรายงาน Commit สดจาก GitHub เข้าห้องดิสคอร์ด\n\n' +
          '💎 สนใจใช้งานระบบพรีเมียมติดต่อผู้พัฒนาบอทได้เลยครับ!'
        )
        .setColor(COLORS.PRIMARY)
        .setImage(IMAGES.BOT_PRESENTATION)
        .setTimestamp()
        .setFooter({ text: 'Powered by Zen Bot Technology' });

      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }
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
    if (cmd === 'cinema-broadcast') return await handleSetupCinemaBroadcastCommand(interaction, serverConfigs);
    if (cmd === 'auto-cinema') return await handleAutoCinemaCommand(interaction, serverConfigs);
    if (cmd === 'set-level') return await handleSetLevelCommand(interaction, serverConfigs);
    if (cmd === 'set-security') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
      return await interaction.reply({ ...getSecurityDashboardContent(config), ephemeral: true });
    }
    if (cmd === 'clear') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) return await interaction.reply({ content: '❌ คุณไม่มีสิทธิ์จัดการข้อความ', ephemeral: true });
      const amount = interaction.options.getInteger('amount');
      if (amount < 1 || amount > 100) return await interaction.reply({ content: '⚠️ กรุณาระบุจำนวน 1-100', ephemeral: true });
      await interaction.deferReply({ ephemeral: true });
      try {
        const messages = await interaction.channel.messages.fetch({ limit: amount });
        await interaction.channel.bulkDelete(messages, true);
        await interaction.editReply({ content: `🧹 ลบข้อความจำนวน **${amount}** เรียบร้อย!` });
      } catch (err) {
        await interaction.editReply({ content: '❌ เกิดข้อผิดพลาด ไม่สามารถลบข้อความเก่าเกิน 14 วันได้!' });
      }
      return;
    }
    if (cmd === 'set-autoclear') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return await interaction.reply({ content: '❌ ต้องเป็น Administrator', ephemeral: true });
      const timeInput = interaction.options.getString('time');
      const channelInput = interaction.options.getChannel('channel');
      if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeInput)) return await interaction.reply({ content: '❌ รูปแบบเวลาไม่ถูกต้อง (HH:MM)', ephemeral: true });
      config.autoClear = { enabled: true, time: timeInput, channelId: channelInput.id };
      await saveConfigs(serverConfigs);
      setupCronJob(guildId, timeInput, channelInput.id);
      return await interaction.reply({ content: `✅ ตั้งค่า Auto-Clear สำเร็จ (${timeInput})`, ephemeral: true });
    }
    if (cmd === 'set-welcome') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return await interaction.reply({ content: '❌ เฉพาะ Administrator', ephemeral: true });
      return await sendDashboard(interaction);
    }
    if (cmd === 'set-autorole') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return await interaction.reply({ content: '❌ เฉพาะ Administrator', ephemeral: true });
      return await sendAutoroleDashboard(interaction);
    }
  }

  if (interaction.isButton()) {
    const id = interaction.customId;

    const adminActionIds = [
      'toggle_welcome', 'toggle_autorole', 'toggle_level', 'toggle_voice_xp',
      'edit_voice_amount', 'edit_level_rate', 'edit_level_card', 'edit_level_messages',
      'set_role_reward', 'delete_role_reward', 'edit_welcome_msg', 'test_welcome',
      'sec_toggle_main', 'sec_toggle_link', 'sec_toggle_spam', 'sec_toggle_mrbeast',
      'sec_config_time', 'sec_reset'
    ];

    if (adminActionIds.includes(id) || id.startsWith('sec_')) {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return await interaction.reply({ content: '❌ เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้นถึงจะกดใช้งานปุ่มตั้งค่านี้ได้!', ephemeral: true });
      }
    }

    if (await handleCinemaButton(interaction, serverConfigs, saveConfigs)) return;
    if (await handleAutoCinemaButton(interaction, serverConfigs, saveConfigs, client)) return;
    if (await handleOrderPaymentButton(interaction)) return;
    if (await handleCloseTicketButton(interaction)) return;
    if (await handleQuestButton(interaction, serverConfigs, saveConfigs)) return;
    if (await handleShopButton(interaction, serverConfigs, saveConfigs)) return;
    if (await handleArtistButton(interaction, serverConfigs)) return;

    const modalButtons = [
      'edit_voice_amount', 'edit_level_rate', 'edit_level_card',
      'edit_level_messages', 'set_role_reward', 'delete_role_reward',
      'sec_config_time', 'edit_welcome_msg', 'test_welcome'
    ];

    if (!modalButtons.includes(id)) {
      await interaction.deferUpdate().catch(() => {});
    }

    if (id === 'toggle_welcome') {
      config.welcomeEnabled = !config.welcomeEnabled;
      await saveConfigs(serverConfigs);
      return await interaction.editReply(getDashboardContent(config));
    }
    if (id === 'toggle_autorole') {
      config.autoroleEnabled = !config.autoroleEnabled;
      await saveConfigs(serverConfigs);
      return await interaction.editReply(getAutoroleDashboardContent(config));
    }
    if (id === 'toggle_level') {
      config.levelConfig.enabled = !config.levelConfig.enabled;
      await saveConfigs(serverConfigs);
      return await interaction.editReply(getLevelDashboardContent(config));
    }
    if (id === 'toggle_voice_xp') {
      config.levelConfig.voiceXpEnabled = !config.levelConfig.voiceXpEnabled;
      await saveConfigs(serverConfigs);
      return await interaction.editReply(getLevelDashboardContent(config));
    }
    if (id === 'edit_voice_amount') {
      const modal = new ModalBuilder().setCustomId('voiceAmountModal').setTitle('ตั้งค่า XP ห้องเสียง');
      const amountInput = new TextInputBuilder().setCustomId('voiceXp').setLabel('XP ต่อ 1 นาที').setStyle(TextInputStyle.Short).setValue(config.levelConfig.voiceXpAmount?.toString() || '10').setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
      return await interaction.showModal(modal);
    }
    if (id === 'edit_level_rate') {
      const modal = new ModalBuilder().setCustomId('levelRateModal').setTitle('ตั้งค่าเรต XP');
      const minInput = new TextInputBuilder().setCustomId('minXp').setLabel('XP ต่ำสุด').setStyle(TextInputStyle.Short).setValue(config.levelConfig.minXp.toString()).setRequired(true);
      const maxInput = new TextInputBuilder().setCustomId('maxXp').setLabel('XP สูงสุด').setStyle(TextInputStyle.Short).setValue(config.levelConfig.maxXp.toString()).setRequired(true);
      const cmdInput = new TextInputBuilder().setCustomId('cmdXp').setLabel('XP จากคำสั่ง /').setStyle(TextInputStyle.Short).setValue(config.levelConfig.cmdXp?.toString() || '20').setRequired(true);
      const multInput = new TextInputBuilder().setCustomId('multiplier').setLabel('ตัวคูณเลเวลอัป').setStyle(TextInputStyle.Short).setValue(config.levelConfig.xpMultiplier.toString()).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(minInput), new ActionRowBuilder().addComponents(maxInput), new ActionRowBuilder().addComponents(cmdInput), new ActionRowBuilder().addComponents(multInput));
      return await interaction.showModal(modal);
    }
    if (id === 'edit_level_card') {
      const modal = new ModalBuilder().setCustomId('levelCardModal').setTitle('ตกแต่งการ์ด Level');
      const titleInput = new TextInputBuilder().setCustomId('cardTitle').setLabel('Title').setStyle(TextInputStyle.Short).setValue(config.levelConfig.cardTitle || '').setRequired(true);
      const descInput = new TextInputBuilder().setCustomId('cardDesc').setLabel('Description').setStyle(TextInputStyle.Paragraph).setValue(config.levelConfig.cardDescription || '').setRequired(true);
      const colorInput = new TextInputBuilder().setCustomId('embedColor').setLabel('Hex Color').setStyle(TextInputStyle.Short).setValue(config.levelConfig.embedColor || COLORS.PRIMARY).setRequired(true);
      const imageInput = new TextInputBuilder().setCustomId('statsCardImg').setLabel('Image URL').setStyle(TextInputStyle.Short).setValue(config.levelConfig.statsCardImageUrl || '').setRequired(false);
      modal.addComponents(new ActionRowBuilder().addComponents(titleInput), new ActionRowBuilder().addComponents(descInput), new ActionRowBuilder().addComponents(colorInput), new ActionRowBuilder().addComponents(imageInput));
      return await interaction.showModal(modal);
    }
    if (id === 'edit_level_messages') {
      const modal = new ModalBuilder().setCustomId('levelMessagesModal').setTitle('ตั้งค่าข้อความเลเวลอัปและแจกยศ');
      const msgInput = new TextInputBuilder().setCustomId('levelMsg').setLabel('ข้อความเลเวลอัป ({user}, {level})').setStyle(TextInputStyle.Paragraph).setValue(config.levelConfig.levelUpMessage || '').setRequired(true);
      const rewardMsgInput = new TextInputBuilder().setCustomId('roleRewardMsg').setLabel('ข้อความแจกยศ ({user}, {role}, {level})').setStyle(TextInputStyle.Paragraph).setValue(config.levelConfig.roleRewardMessage || '').setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(msgInput), new ActionRowBuilder().addComponents(rewardMsgInput));
      return await interaction.showModal(modal);
    }
    if (id === 'set_role_reward') {
      const modal = new ModalBuilder().setCustomId('roleRewardModal').setTitle('ตั้งค่ายศรางวัลตามเลเวล');
      const levelInput = new TextInputBuilder().setCustomId('targetLevel').setLabel('ระบุเลเวล (เช่น 5)').setStyle(TextInputStyle.Short).setRequired(true);
      const imageInput = new TextInputBuilder().setCustomId('rewardImage').setLabel('Image URL (คั่นด้วยคอมมา , เพื่อสุ่มหลายรูป)').setStyle(TextInputStyle.Short).setRequired(false);
      modal.addComponents(new ActionRowBuilder().addComponents(levelInput), new ActionRowBuilder().addComponents(imageInput));
      return await interaction.showModal(modal);
    }
    if (id === 'delete_role_reward') {
      const modal = new ModalBuilder().setCustomId('deleteRoleRewardModal').setTitle('ลบยศรางวัลตามเลเวล');
      const levelInput = new TextInputBuilder().setCustomId('targetLevel').setLabel('ระบุเลเวลที่ต้องการลบยศรางวัล (เช่น 5)').setStyle(TextInputStyle.Short).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(levelInput));
      return await interaction.showModal(modal);
    }
    if (id === 'edit_welcome_msg') {
      const modal = new ModalBuilder().setCustomId('editWelcomeMsgModal').setTitle('แก้ไขข้อความต้อนรับ');
      const descInput = new TextInputBuilder()
        .setCustomId('welcomeDesc')
        .setLabel('ข้อความต้อนรับ (ใช้ {user} และ {server} ได้)')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(config.embed?.description || '**𑣲⋆ 𝙉𝙀𝙒 𝙈𝙚𝙢𝙗𝙚𝙧!** ✨\n🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}** ครับ!')
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(descInput));
      return await interaction.showModal(modal);
    }
    if (id === 'test_welcome') {
      if (!config.channelId) {
        return await interaction.reply({ content: '❌ กรุณาเลือกช่องสำหรับส่งข้อความต้อนรับก่อนกดทดสอบครับ!', ephemeral: true });
      }
      await interaction.reply({ content: `🔄 กำลังส่งการ์ดต้อนรับทดสอบ...`, ephemeral: true });
      try {
        const channel = await interaction.guild.channels.fetch(config.channelId);
        if (channel) {
          const attachment = await generateWelcomeCard(interaction.member);
          const defaultDesc = '**𑣲⋆ 𝙉𝙀𝙒 𝙈𝙚𝙢𝙗𝙚𝙧!** ✨\n🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}** ครับ!';
          const finalDesc = (config.embed?.description || defaultDesc)
            .replace('{user}', `${interaction.user}`)
            .replace('{server}', interaction.guild.name);
          await channel.send({ content: finalDesc, files: [attachment] });
        }
      } catch (err) {
        console.error('Test welcome error:', err);
      }
      return;
    }

    if (id === 'sec_toggle_main') config.security.enabled = !config.security.enabled;
    else if (id === 'sec_toggle_link') config.security.antiLink = !config.security.antiLink;
    else if (id === 'sec_toggle_spam') config.security.antiSpam = !config.security.antiSpam;
    else if (id === 'sec_toggle_mrbeast') config.security.antiMrBeast = !config.security.antiMrBeast;
    else if (id === 'sec_config_time') {
      const modal = new ModalBuilder().setCustomId('secTimeModal').setTitle('ตั้งค่าเวลาสแปม');
      const countInput = new TextInputBuilder().setCustomId('spamCount').setLabel('จำนวนข้อความ').setStyle(TextInputStyle.Short).setValue(config.security.spamCount.toString()).setRequired(true);
      const secInput = new TextInputBuilder().setCustomId('spamSec').setLabel('ภายในกี่วินาที').setStyle(TextInputStyle.Short).setValue(config.security.spamSeconds.toString()).setRequired(true);
      const timeoutInput = new TextInputBuilder().setCustomId('timeoutSec').setLabel('ระงับกี่วินาที (เช่น 60)').setStyle(TextInputStyle.Short).setValue(config.security.timeoutSeconds.toString()).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(countInput), new ActionRowBuilder().addComponents(secInput), new ActionRowBuilder().addComponents(timeoutInput));
      return await interaction.showModal(modal);
    } else if (id === 'sec_reset') {
      config.security = {
        enabled: false, antiLink: true, antiSpam: true, antiMrBeast: true, spamCount: 3, spamSeconds: 6, timeoutSeconds: 60,
        actions: { invite: { timeout: true, kick: false, ban: false }, spam: { timeout: true, kick: false, ban: false }, mrbeast: { timeout: true, kick: false, ban: false } },
        ignoredChannels: []
      };
    }

    await saveConfigs(serverConfigs);
    if (id.startsWith('sec_')) return await interaction.editReply(getSecurityDashboardContent(config));
  }

  if (interaction.isStringSelectMenu()) {
    if (await handleOrderTicketSelect(interaction, serverConfigs)) return;

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({ content: '❌ เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้น', ephemeral: true });
    }

    await interaction.deferUpdate().catch(() => {});
    if (interaction.customId === 'act_invite_select') {
      const vals = interaction.values;
      config.security.actions.invite.timeout = vals.includes('timeout');
      config.security.actions.invite.kick = vals.includes('kick');
      config.security.actions.invite.ban = vals.includes('ban');
      await saveConfigs(serverConfigs);
      return await interaction.editReply(getSecurityDashboardContent(config));
    }
    if (interaction.customId === 'act_spam_select') {
      const vals = interaction.values;
      config.security.actions.spam.timeout = vals.includes('timeout');
      config.security.actions.spam.kick = vals.includes('kick');
      config.security.actions.spam.ban = vals.includes('ban');
      await saveConfigs(serverConfigs);
      return await interaction.editReply(getSecurityDashboardContent(config));
    }
  }

  if (interaction.isChannelSelectMenu()) {
    if (await handleCinemaSelect(interaction, serverConfigs, saveConfigs)) return;
    if (await handleAutoCinemaSelect(interaction, serverConfigs, saveConfigs, client)) return;

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({ content: '❌ เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้น', ephemeral: true });
    }

    await interaction.deferUpdate().catch(() => {});
    if (interaction.customId === 'select_channel') {
      config.channelId = interaction.values[0];
      await saveConfigs(serverConfigs);
      return await interaction.editReply(getDashboardContent(config));
    }
    if (interaction.customId === 'select_level_channel') {
      config.levelConfig.channelId = interaction.values[0];
      await saveConfigs(serverConfigs);
      return await interaction.editReply(getLevelDashboardContent(config));
    }
    if (interaction.customId === 'sec_select_ignored') {
      config.security.ignoredChannels = interaction.values;
      await saveConfigs(serverConfigs);
      return await interaction.editReply(getSecurityDashboardContent(config));
    }
  }

  if (interaction.isRoleSelectMenu()) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({ content: '❌ เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้น', ephemeral: true });
    }

    await interaction.deferUpdate().catch(() => {});
    if (interaction.customId === 'select_autorole') {
      config.autoroleId = interaction.values[0];
      config.autoroleEnabled = true;
      await saveConfigs(serverConfigs);
      return await interaction.editReply(getAutoroleDashboardContent(config));
    }
    if (interaction.customId.startsWith('select_reward_role_')) {
      const levelNum = interaction.customId.replace('select_reward_role_', '');
      const selectedRoleId = interaction.values[0];
      const imageUrl = pendingRoleRewardImages.get(`${interaction.user.id}_${levelNum}`) || '';

      if (!config.levelConfig.roleRewards) config.levelConfig.roleRewards = {};

      for (const [lvl, data] of Object.entries(config.levelConfig.roleRewards)) {
        const rId = typeof data === 'object' ? data.roleId : data;
        if (rId === selectedRoleId) {
          delete config.levelConfig.roleRewards[lvl];
        }
      }

      config.levelConfig.roleRewards[levelNum] = { roleId: selectedRoleId, imageUrl: imageUrl };
      await saveConfigs(serverConfigs);
      pendingRoleRewardImages.delete(`${interaction.user.id}_${levelNum}`);

      return await interaction.editReply({
        content: `✅ ตั้งค่ายศรางวัลสำเร็จ! ยศ <@&${selectedRoleId}> ถูกย้ายมาอยู่ที่ Level ${levelNum} เรียบร้อยแล้ว`,
        ...getLevelDashboardContent(config)
      });
    }
  }

  if (interaction.isModalSubmit()) {
    if (await handleCinemaModal(interaction, serverConfigs, saveConfigs)) return;
    if (await handleAutoCinemaModal(interaction, serverConfigs, saveConfigs, client)) return;
    if (await handleArtistModalSubmit(interaction, serverConfigs, saveConfigs)) return;

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({ content: '❌ เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้น', ephemeral: true });
    }

    if (interaction.customId === 'editWelcomeMsgModal') {
      if (!config.embed) config.embed = {};
      config.embed.description = interaction.fields.getTextInputValue('welcomeDesc');
      await saveConfigs(serverConfigs);
      return await interaction.reply({ content: '✅ บันทึกข้อความต้อนรับเรียบร้อยแล้ว!', ephemeral: true });
    }
    if (interaction.customId === 'secTimeModal') {
      config.security.spamCount = Math.max(1, parseInt(interaction.fields.getTextInputValue('spamCount')) || 3);
      config.security.spamSeconds = Math.max(1, parseInt(interaction.fields.getTextInputValue('spamSec')) || 6);
      config.security.timeoutSeconds = Math.max(1, parseInt(interaction.fields.getTextInputValue('timeoutSec')) || 60);
      await saveConfigs(serverConfigs);
      return await interaction.reply({ content: '✅ บันทึกค่าเวลาความปลอดภัยเรียบร้อยแล้ว!', ephemeral: true });
    }
    if (interaction.customId === 'voiceAmountModal') {
      config.levelConfig.voiceXpAmount = Math.max(1, parseInt(interaction.fields.getTextInputValue('voiceXp')) || 10);
      await saveConfigs(serverConfigs);
      return await interaction.reply({ content: '✅ บันทึกจำนวน XP ห้องเสียงเรียบร้อยแล้ว!', ephemeral: true });
    }
    if (interaction.customId === 'levelRateModal') {
      let minVal = Math.max(1, parseInt(interaction.fields.getTextInputValue('minXp')) || 15);
      let maxVal = Math.max(1, parseInt(interaction.fields.getTextInputValue('maxXp')) || 25);
      if (minVal > maxVal) [minVal, maxVal] = [maxVal, minVal];

      const cmdVal = Math.max(0, parseInt(interaction.fields.getTextInputValue('cmdXp')) || 20);
      const multVal = Math.max(10, parseInt(interaction.fields.getTextInputValue('multiplier')) || 100);

      config.levelConfig.minXp = minVal;
      config.levelConfig.maxXp = maxVal;
      config.levelConfig.cmdXp = cmdVal;
      config.levelConfig.xpMultiplier = multVal;
      await saveConfigs(serverConfigs);
      return await interaction.reply({ content: '✅ บันทึกเรต XP เรียบร้อยแล้ว!', ephemeral: true });
    }
    if (interaction.customId === 'levelCardModal') {
      config.levelConfig.cardTitle = interaction.fields.getTextInputValue('cardTitle');
      config.levelConfig.cardDescription = interaction.fields.getTextInputValue('cardDesc');
      let colorVal = interaction.fields.getTextInputValue('embedColor').trim();
      if (!colorVal.startsWith('#')) colorVal = '#' + colorVal;
      config.levelConfig.embedColor = colorVal;
      config.levelConfig.statsCardImageUrl = interaction.fields.getTextInputValue('statsCardImg');
      await saveConfigs(serverConfigs);
      return await interaction.reply({ content: '✅ บันทึกการ์ด Level เรียบร้อยแล้ว!', ephemeral: true });
    }
    if (interaction.customId === 'levelMessagesModal') {
      config.levelConfig.levelUpMessage = interaction.fields.getTextInputValue('levelMsg');
      config.levelConfig.roleRewardMessage = interaction.fields.getTextInputValue('roleRewardMsg');
      await saveConfigs(serverConfigs);
      return await interaction.reply({ content: '✅ บันทึกข้อความเรียบร้อยแล้ว!', ephemeral: true });
    }
    if (interaction.customId === 'roleRewardModal') {
      const targetLevel = interaction.fields.getTextInputValue('targetLevel').trim();
      const rewardImage = interaction.fields.getTextInputValue('rewardImage') || '';
      if (isNaN(targetLevel) || parseInt(targetLevel) < 1) {
        return await interaction.reply({ content: '❌ กรุณากรอกเป็นตัวเลขเลเวลที่ถูกต้อง (ตั้งแต่ 1 ขึ้นไป)!', ephemeral: true });
      }
      pendingRoleRewardImages.set(`${interaction.user.id}_${targetLevel}`, rewardImage);
      const roleSelectMenu = new RoleSelectMenuBuilder().setCustomId(`select_reward_role_${targetLevel}`).setPlaceholder(`👑 เลือกยศ Level ${targetLevel}`);
      const row = new ActionRowBuilder().addComponents(roleSelectMenu);
      return await interaction.reply({ content: `📌 กรุณาเลือกยศสำหรับ Level ${targetLevel}:`, components: [row], ephemeral: true });
    }
    if (interaction.customId === 'deleteRoleRewardModal') {
      const targetLevel = interaction.fields.getTextInputValue('targetLevel').trim();
      if (!config.levelConfig.roleRewards || !config.levelConfig.roleRewards[targetLevel]) {
        return await interaction.reply({ content: `❌ ไม่พบข้อมูลยศรางวัลสำหรับ Level ${targetLevel} ครับ!`, ephemeral: true });
      }
      delete config.levelConfig.roleRewards[targetLevel];
      await saveConfigs(serverConfigs);
      return await interaction.reply({ content: `✅ ลบยศรางวัลของ **Level ${targetLevel}** เรียบร้อยแล้ว!`, ephemeral: true });
    }
  }
});

function getDashboardContent(config) {
  const channelName = config.channelId ? `<#${config.channelId}>` : 'ยังไม่ได้เลือกช่อง';
  const statusText = config.welcomeEnabled ? '✅ เปิดอยู่' : '❌ ปิดอยู่';
  const msgPreview = config.embed?.description || '**𑣲⋆ 𝙉𝙀𝙒 𝙈𝙚𝙢1𝙚𝙧!** ✨\n🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}** ครับ!';

  const embed = new EmbedBuilder()
    .setTitle('⚙️ ตั้งค่าระบบต้อนรับ (Welcome Canvas)')
    .setDescription('ระบบจะส่งข้อความต้อนรับพร้อมรูปการ์ด Canvas อัตโนมัติเมื่อมีสมาชิกใหม่เข้าเซิร์ฟเวอร์')
    .setColor(COLORS.DISCORD_BLURPLE)
    .addFields(
      { name: '📥 สถานะ', value: statusText, inline: true },
      { name: '📢 ห้องต้อนรับ', value: channelName, inline: true },
      { name: '💬 ข้อความต้อนรับ', value: msgPreview, inline: false }
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('toggle_welcome').setLabel(config.welcomeEnabled ? 'ปิดระบบ' : 'เปิดระบบ').setStyle(config.welcomeEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('edit_welcome_msg').setLabel('✏️ แก้ไขข้อความต้อนรับ').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('test_welcome').setLabel('🚀 ทดสอบส่งการ์ด').setStyle(ButtonStyle.Secondary)
  );
  const channelRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder().setCustomId('select_channel').setPlaceholder('📂 เลือกห้องต้อนรับ').addChannelTypes(ChannelType.GuildText)
  );
  return { embeds: [embed], components: [row1, channelRow] }
}

function getAutoroleDashboardContent(config) {
  const roleName = config.autoroleId ? `<@&${config.autoroleId}>` : 'ยังไม่ได้เลือกยศ';
  const statusText = config.autoroleEnabled ? '✅ เปิดอยู่' : '❌ ปิดอยู่';
  const embed = new EmbedBuilder()
    .setTitle('🛡️ ตั้งค่าระบบ Autorole')
    .setDescription('เมื่อเลือกยศด้านล่าง ระบบจะเปิดใช้งานการแจกยศอัตโนมัติให้ทันที (หรือกดปุ่มเพื่อปิดชั่วคราว)')
    .setColor(COLORS.DISCORD_BLURPLE)
    .addFields(
      { name: '📥 สถานะ', value: statusText, inline: true },
      { name: '👑 ยศที่จะได้รับ', value: roleName, inline: true }
    );
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('toggle_autorole').setLabel(config.autoroleEnabled ? '🔴 ปิดระบบชั่วคราว' : '🟢 เปิดระบบ').setStyle(config.autoroleEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
  );
  const roleRow = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder().setCustomId('select_autorole').setPlaceholder('👑 เลือกยศแจกสมาชิกใหม่ (เลือกแล้วเปิดระบบทันที)')
  );
  return { embeds: [embed], components: [row1, roleRow] };
}

async function sendDashboard(target) {
  const channel = target.channel || target;
  const config = ensureGuildConfig(target.guildId);
  const payload = getDashboardContent(config);
  if (target.reply) {
    await target.reply({ ...payload, ephemeral: true });
  } else {
    await channel.send(payload);
  }
}

async function sendAutoroleDashboard(target) {
  const channel = target.channel || target;
  const config = ensureGuildConfig(target.guildId);
  const payload = getAutoroleDashboardContent(config);
  if (target.reply) {
    await target.reply({ ...payload, ephemeral: true });
  } else {
    await channel.send(payload);
  }
}

client.login(process.env.DISCORD_TOKEN);
