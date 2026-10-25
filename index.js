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

// 🐾 นำเข้าฟังก์ชันระบบสัตว์เลี้ยงจาก companion.js
const {
  rollRandomPet,
  petShopCommand,
  handlePetShopCommand,
  companionCommand,
  handleCompanionCommand,
  setPetChannelCommand,
  handleCompanionButton,
  petBattleCommand,
  handlePetBattleCommand,
  handleBattleButtons,
  petProfileCommand,
  handlePetProfileCommand,
  petLeaderboardCommand,
  handlePetLeaderboardCommand
} = require('./companion');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running!\n');
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

// 🛡️ Helper: สร้างโครงสร้างเริ่มต้นของเซิร์ฟเวอร์
function ensureGuildConfig(guildId) {
  if (!serverConfigs[guildId]) {
    serverConfigs[guildId] = {};
  }
  const config = serverConfigs[guildId];

  if (config.welcomeEnabled === undefined) config.welcomeEnabled = false;
  if (config.channelId === undefined) config.channelId = null;
  if (config.autoroleEnabled === undefined) config.autoroleEnabled = false;
  if (config.autoroleId === undefined) config.autoroleId = null;

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
  if (!config.embed) {
    config.embed = { description: '**𑣲⋆ 𝙉𝙀𝙒 𝙈𝙚𝙢𝙗𝙚𝙧!** ✨\n🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}** ครับ!' };
  }
  if (!config.autoClear) {
    config.autoClear = { enabled: false, time: '06:00', channelId: null };
  }
  if (!config.mediaGuardChannels) config.mediaGuardChannels = [];
  if (config.showcaseChannelId === undefined) config.showcaseChannelId = null;

  return config;
}

// ⏳ ลูปเช็กเวลาฟักไข่สัตว์เลี้ยงอัตโนมัติ
function startHatchChecker() {
  setInterval(async () => {
    try {
      let serverConfigs = await loadConfigs();
      let updated = false;

      for (const guildId in serverConfigs) {
        const guildData = serverConfigs[guildId];
        if (!guildData || !guildData.levels) continue;

        for (const userId in guildData.levels) {
          const userData = guildData.levels[userId];
          const petEgg = userData?.petEgg;
          
          if (petEgg && petEgg.hasEgg && !petEgg.isHatched) {
            petEgg.remainingSeconds = Math.max(0, (petEgg.remainingSeconds || 60) - 10);
            updated = true;

            if (petEgg.remainingSeconds <= 0) {
              petEgg.isHatched = true;
              
              const hatchedPetData = rollRandomPet();
              petEgg.hatchedPet = hatchedPetData;
              petEgg.petLevel = 1;
              petEgg.petXp = 0;

              const targetChannelId = guildData.petChannelId;
              if (targetChannelId) {
                try {
                  const guild = await client.guilds.fetch(guildId);
                  const channel = await guild.channels.fetch(targetChannelId);

                  if (channel) {
                    const embed = new EmbedBuilder()
                      .setTitle(`✨ ${hatchedPetData.name}`)
                      .setDescription(
                        `Rarity: ${'⭐'.repeat(hatchedPetData.stars)} (${hatchedPetData.type})\n` +
                        `Claims: 1\n` +
                        `${hatchedPetData.baseOrb} 🔮`
                      )
                      .setColor(0x00FF99)
                      .setImage(hatchedPetData.image)
                      .setFooter({ text: 'ZEN PET • Companion System' });

                    await channel.send({
                      content: `<@${userId}> 🎉 ไข่ของคุณฟักเป็นตัวแล้ว!`,
                      embeds: [embed]
                    });
                  }
                } catch (err) {
                  console.error(`ส่งข้อความแจ้งเตือนฟักไข่ล้มเหลว:`, err);
                }
              }
            }
          }
        }
      }

      if (updated) {
        await redis.set('server_configs', JSON.stringify(serverConfigs));
      }
    } catch (e) {
      console.error('Error in hatch checker loop:', e);
    }
  }, 10000);
}

let activeCronJobs = {};
const spamTracker = new Map();

client.once('ready', async () => {
  serverConfigs = await loadConfigs();
  console.log(`Bot Online แล้วจ้า: ${client.user.tag}`);

  startVoiceXpCron(client, serverConfigs, saveConfigs);
  loadAllAutoCinemaCrons(client, serverConfigs);
  startHatchChecker(); // เริ่มลูปฟักไข่

  const commands = [
    new SlashCommandBuilder().setName('ping').setDescription('เช็กความเร็วและสถานะของบอท'),
    new SlashCommandBuilder().setName('set-welcome').setDescription('เปิดแผงควบคุมระบบต้อนรับ').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('set-autorole').setDescription('ตั้งค่าระบบแจกยศอัตโนมัติ').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('set-security').setDescription('เปิดแผงควบคุมระบบป้องกัน').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('bot-info').setDescription('✨ แสดงข้อมูลและหน้าพรีเซนต์แนะนำตัวของ Zen Bot'),
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
    // 🐾 เพิ่มคำสั่งระบบสัตว์เลี้ยง Zen Pet
    petShopCommand,
    companionCommand,
    setPetChannelCommand,
    new SlashCommandBuilder().setName('name-pet').setDescription('🏷️ ตั้งชื่อให้กับคู่หูวิญญาณของคุณ').addStringOption(option => option.setName('name').setDescription('ชื่อใหม่').setRequired(true)),
    petBattleCommand,
    petProfileCommand,
    petLeaderboardCommand,
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
});

function setupCronJob(guildId, timeStr, channelId) {
  if (activeCronJobs[guildId]) {
    activeCronJobs[guildId].stop();
    delete activeCronJobs[guildId];
  }

  const [hour, minute] = (timeStr || '').split(':');
  if (!hour || !minute) return;

  activeCronJobs[guildId] = cron.schedule(`${minute} ${hour} * * *`, async () => {
    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return;
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (channel && channel.isTextBased()) {
        const fetched = await channel.messages.fetch({ limit: 100 });
        await channel.bulkDelete(fetched, true);
      }
    } catch (err) {
      console.error(`❌ เกิดข้อผิดพลาดในการลบข้อความอัตโนมัติ:`, err);
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

  handleLeveling(message, serverConfigs, saveConfigs);
});

client.on('guildMemberAdd', async member => {
  if (member.user.bot) return;

  const guildId = member.guild.id;
  const config = ensureGuildConfig(guildId);

  if (config.autoroleEnabled && config.autoroleId) {
    try {
      const role = await member.guild.roles.fetch(config.autoroleId);
      if (role) await member.roles.add(role);
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
  serverConfigs = await loadConfigs(); // โหลดข้อมูลสดเสมอ

  const premiumCommands = [
    'setup-quest', 'setup-in-game-shop', 'coins', 'setup-order-ticket',
    'add-coins', 'setup-media-guard', 'setup-showcase', 'set-autoclear',
    'setup-artist-card', 'boost-status', 'cinema-setup', 'cinema-broadcast',
    'auto-cinema'
  ];

  if (interaction.isChatInputCommand() && premiumCommands.includes(interaction.commandName)) {
    const hasPremium = await isServerPremium(guildId, serverConfigs);
    if (!hasPremium) {
      return await interaction.reply({ content: '❌ คำสั่งนี้ใช้ได้เฉพาะเซิร์ฟเวอร์พรีเมียมเท่านั้น', ephemeral: true });
    }
  }

  if (interaction.isChatInputCommand()) {
    handleCommandLeveling(interaction, serverConfigs, saveConfigs);

    const cmd = interaction.commandName;

    const adminCommands = [
      'setup-quest', 'setup-in-game-shop', 'setup-order-ticket', 'add-coins',
      'grant-premium', 'setup-artist-card', 'setup-media-guard', 'setup-showcase',
      'cinema-setup', 'cinema-broadcast', 'auto-cinema', 'set-level', 'set-security',
      'set-autoclear', 'set-welcome', 'set-autorole', 'pet-shop', 'set-pet-channel'
    ];

    if (adminCommands.includes(cmd)) {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return await interaction.reply({ content: '❌ เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้นถึงจะใช้คำสั่งนี้ได้!', ephemeral: true });
      }
    }

    if (cmd === 'ping') return await interaction.reply({ content: 'Pong! 🏓 บอททำงานปกติบน Render ครับ 🚀', ephemeral: true });
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

    // 🐾 จัดการคำสั่ง Zen Pet
    if (cmd === 'pet-shop') return await handlePetShopCommand(interaction);
    if (cmd === 'companion') return await handleCompanionCommand(interaction, serverConfigs);
    if (cmd === 'pet-battle') return await handlePetBattleCommand(interaction, serverConfigs);
    if (cmd === 'pet-profile') return await handlePetProfileCommand(interaction, serverConfigs);
    if (cmd === 'pet-leaderboard') return await handlePetLeaderboardCommand(interaction, serverConfigs);
    if (cmd === 'set-pet-channel') {
      const channel = interaction.options.getChannel('channel');
      if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
      serverConfigs[guildId].petChannelId = channel.id;
      await saveConfigs(serverConfigs);
      return await interaction.reply({ content: `✅ ตั้งค่าห้องแจ้งเตือนสัตว์เลี้ยงเรียบร้อยที่: ${channel}`, ephemeral: true });
    }
    if (cmd === 'name-pet') {
      const userId = interaction.user.id;
      const newName = interaction.options.getString('name');
      const userData = serverConfigs[guildId]?.levels?.[userId];
      if (!userData || !userData.petEgg || !userData.petEgg.hasEgg || !userData.petEgg.isHatched) {
        return await interaction.reply({ content: '❌ คุณยังไม่มีสัตว์เลี้ยงที่ฟักเป็นตัว!', ephemeral: true });
      }
      if (!userData.petEgg.hatchedPet) userData.petEgg.hatchedPet = {};
      userData.petEgg.hatchedPet.name = newName;
      await saveConfigs(serverConfigs);
      return await interaction.reply({ content: `✅ เปลี่ยนชื่อคู่หูของคุณเป็น **"${newName}"** เรียบร้อยแล้ว!`, ephemeral: true });
    }
  }

  if (interaction.isButton()) {
    // 🐾 จัดการปุ่ม Zen Pet (ซื้อไข่ / ประลอง)
    const eggHandled = await handleCompanionButton(interaction, loadConfigs, saveConfigs);
    if (eggHandled) return;

    const battleHandled = await handleBattleButtons(interaction, loadConfigs, saveConfigs);
    if (battleHandled) return;

    // ปุ่มอื่นๆ ของบอทเดิม
    if (await handleCinemaButton(interaction, serverConfigs, saveConfigs)) return;
    if (await handleAutoCinemaButton(interaction, serverConfigs, saveConfigs, client)) return;
    if (await handleOrderPaymentButton(interaction)) return;
    if (await handleCloseTicketButton(interaction)) return;
    if (await handleQuestButton(interaction, serverConfigs, saveConfigs)) return;
    if (await handleShopButton(interaction, serverConfigs, saveConfigs)) return;
    if (await handleArtistButton(interaction, serverConfigs)) return;
  }
  
  // (จัดการส่วน Select Menu และ Modal อื่นๆ ของบอทเดิมตามปกติ...)
});

client.login(process.env.DISCORD_TOKEN);
