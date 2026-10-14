const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const http = require('http');
const cron = require('node-cron');
const { Redis } = require('@upstash/redis');
const { getSecurityDashboardContent, handleSecurityMessage } = require('./security');
const { 
  handleLeveling, 
  handleCommandLeveling, 
  levelCommand, 
  handleLevelCommand, 
  leaderboardCommand, 
  handleLeaderboardCommand, 
  resetLevelsCommand,
  handleResetLevelsCommand,
  setLevelCommand, 
  handleSetLevelCommand, 
  getLevelDashboardContent, 
  startVoiceXpCron, 
  pendingRoleRewardImages 
} = require('./level');

// เชื่อมต่อ Upstash Redis จาก Environment Variables
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
  try {
    await redis.set('server_configs', JSON.stringify(configs));
  } catch (e) {
    console.error('Error saving config to Redis:', e);
  }
}

let activeCronJobs = {};
const spamTracker = new Map();

client.once('ready', async () => {
  serverConfigs = await loadConfigs();
  console.log(`Bot Online แล้วจ้า: ${client.user.tag}`);

  startVoiceXpCron(client, serverConfigs, saveConfigs);

  const commands = [
    new SlashCommandBuilder().setName('ping').setDescription('เช็กความเร็วและสถานะของบอท'),
    new SlashCommandBuilder().setName('set-welcom').setDescription('เปิดแผงควบคุมระบบต้อนรับ (Welcome Dashboard)'),
    new SlashCommandBuilder().setName('set-autorole').setDescription('ตั้งค่าระบบแจกยศอัตโนมัติสำหรับสมาชิกใหม่'),
    new SlashCommandBuilder().setName('set-security').setDescription('เปิดแผงควบคุมระบบป้องกันความปลอดภัยขั้นสูง'),
    levelCommand,
    leaderboardCommand,
    resetLevelsCommand,
    setLevelCommand,
    new SlashCommandBuilder().setName('clear').setDescription('ลบข้อความในแชทจำนวน 1-100 ข้อความ')
      .addIntegerOption(option => option.setName('amount').setDescription('จำนวนข้อความที่ต้องการลบ (1-100)').setRequired(true)),
    new SlashCommandBuilder().setName('set-autoclear').setDescription('ตั้งเวลาระบบลบข้อความอัตโนมัติ')
      .addStringOption(option => option.setName('time').setDescription('ระบุเวลาในรูปแบบ HH:MM เช่น 06:00').setRequired(true))
      .addChannelOption(option => option.setName('channel').setDescription('เลือกห้องที่ต้องการให้ลบข้อความอัตโนมัติ').addChannelTypes(ChannelType.GuildText).setRequired(true)),
  ].map(command => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('ลงทะเบียนคำสั่งสำเร็จเรียบร้อย!');
  } catch (error) {
    console.error(error);
  }

  for (const guildId in serverConfigs) {
    const config = serverConfigs[guildId];
    if (config && config.autoClear && config.autoClear.enabled && config.autoClear.time && config.autoClear.channelId) {
      setupCronJob(guildId, config.autoClear.time, config.autoClear.channelId);
    }
  }
});

function setupCronJob(guildId, timeStr, channelId) {
  if (activeCronJobs[guildId]) {
    activeCronJobs[guildId].stop();
    delete activeCronJobs[guildId];
  }

  const [hour, minute] = timeStr.split(':');
  if (!hour || !minute) return;

  const cronExpression = `${minute} ${hour} * * *`;

  activeCronJobs[guildId] = cron.schedule(cronExpression, async () => {
    try {
      const guild = await client.guilds.fetch(guildId);
      if (!guild) return;
      const channel = await guild.channels.fetch(channelId);
      if (channel && channel.isTextBased()) {
        const fetched = await channel.messages.fetch({ limit: 100 });
        await channel.bulkDelete(fetched, true);
        console.log(`✅ ลบข้อความอัตโนมัติเวลา ${timeStr} สำเร็จในห้อง #${channel.name}`);
      }
    } catch (err) {
      console.error(`❌ เกิดข้อผิดพลาดในการลบข้อความอัตโนมัติ (Guild: ${guildId}):`, err);
    }
  }, { timezone: "Asia/Bangkok" });

  console.log(`⏰ ตั้งเวลา Auto-Clear สำเร็จสำหรับ Guild ${guildId} เวลา ${timeStr} ในห้องช่อง ID: ${channelId}`);
}

client.on('messageCreate', async message => {
  const guildId = message.guild?.id;
  const config = serverConfigs[guildId];

  const isBlocked = handleSecurityMessage(message, config, spamTracker);
  if (isBlocked) return;

  handleLeveling(message, serverConfigs, saveConfigs);
});

client.on('guildMemberAdd', async member => {
  const guildId = member.guild.id;
  const config = serverConfigs[guildId];

  if (!config) return;

  if (config.autoroleEnabled && config.autoroleId) {
    try {
      const role = await member.guild.roles.fetch(config.autoroleId);
      if (role) {
        await member.roles.add(role);
        console.log(`✅ มอบยศ ${role.name} ให้กับคุณ ${member.user.tag} สำเร็จ`);
      }
    } catch (err) {
      console.error('Autorole error:', err);
    }
  }

  if (!config.welcomeEnabled || !config.channelId) return;

  try {
    const channel = await member.guild.channels.fetch(config.channelId);
    if (!channel) return;

    const embedConfig = config.embed || {
      title: '',
      description: '**𑣲⋆ 𝙉𝙀𝙒 𝙈𝙚𝙢𝙗𝙚𝙧!** ✨\n🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}** ครับ!',
      color: '#66FFFF',
      image: '',
      footerText: '',
      footerIcon: '',
      timestamp: 'no'
    };

    const finalTitle = embedConfig.title ? embedConfig.title.replace('{user}', member.user.username).replace('{server}', member.guild.name) : null;
    const finalDesc = embedConfig.description.replace('{user}', `${member}`).replace('{server}', member.guild.name);

    let embedColor = '#66FFFF';
    try { embedColor = embedConfig.color; } catch (e) {}

    const embed = new EmbedBuilder().setDescription(finalDesc).setColor(embedColor);
    if (finalTitle) embed.setTitle(finalTitle);
    if (embedConfig.image && embedConfig.image.trim() !== '') embed.setImage(embedConfig.image.trim());

    if (embedConfig.footerText && embedConfig.footerText.trim() !== '') {
      const memberCount = member.guild.memberCount.toString();
      const finalFooterText = embedConfig.footerText.replace('{server_membercount}', memberCount);
      if (embedConfig.footerIcon && embedConfig.footerIcon.trim() !== '') {
        embed.setFooter({ text: finalFooterText, iconURL: embedConfig.footerIcon.trim() });
      } else {
        embed.setFooter({ text: finalFooterText });
      }
    }

    if (embedConfig.timestamp && embedConfig.timestamp.toLowerCase() === 'yes') {
      embed.setTimestamp();
    }

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Send welcome error:', err);
  }
});

client.on('interactionCreate', async interaction => {
  const guildId = interaction.guildId;
  if (!guildId) return;

  if (!serverConfigs[guildId]) {
    serverConfigs[guildId] = {
      welcomeEnabled: false, channelId: null, autoroleEnabled: false, autoroleId: null,
      security: {
        enabled: false, antiLink: true, antiSpam: true, antiMrBeast: true,
        spamCount: 3, spamSeconds: 6, timeoutSeconds: 3000,
        actions: { invite: { timeout: true, kick: true, ban: false }, spam: { timeout: true, kick: true, ban: false }, mrbeast: { timeout: true, kick: true, ban: false } },
        ignoredChannels: []
      },
      levels: {},
      levelConfig: {
        enabled: true, minXp: 15, maxXp: 25, cmdXp: 20, xpMultiplier: 100, channelId: null,
        levelUpMessage: 'ยินดีด้วยคุณ {user}! เลเวลอัปขึ้นเป็น **Level {level}** แล้ว!',
        roleRewardMessage: '👑 ยินดีด้วยคุณ {user} ได้รับยศพิเศษ {role} เนื่องในโอกาสอัปถึง Level {level}!',
        cardTitle: '📊 𝙕𝙀𝙉 𝘽𝙊𝙏 • STATS CARD', cardDescription: 'การ์ดข้อมูลเลเวลของ **{user}**',
        embedColor: '#66FFFF', statsCardImageUrl: '',
        voiceXpEnabled: false, voiceXpAmount: 10, roleRewards: {}
      },
      embed: { title: '', description: '**𑣲⋆ 𝙉𝙀𝙒 𝙈𝙚𝙢𝙗𝙚𝙧!** ✨\n🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}** ครับ!', color: '#66FFFF', image: '', footerText: '', footerIcon: '', timestamp: 'no' },
      autoClear: { enabled: false, time: '06:00', channelId: null }
    };
  }
  const config = serverConfigs[guildId];
  if (!config.security) {
    config.security = { enabled: false, antiLink: true, antiSpam: true, antiMrBeast: true, spamCount: 3, spamSeconds: 6, timeoutSeconds: 3000, actions: { invite: { timeout: true, kick: true, ban: false }, spam: { timeout: true, kick: true, ban: false }, mrbeast: { timeout: true, kick: true, ban: false } }, ignoredChannels: [] };
  }
  if (!config.levels) config.levels = {};
  if (!config.levelConfig) {
    config.levelConfig = { enabled: true, minXp: 15, maxXp: 25, cmdXp: 20, xpMultiplier: 100, channelId: null, levelUpMessage: 'ยินดีด้วยคุณ {user}! เลเวลอัปขึ้นเป็น **Level {level}** แล้ว!', roleRewardMessage: '👑 ยินดีด้วยคุณ {user} ได้รับยศพิเศษ {role} เนื่องในโอกาสอัปถึง Level {level}!', cardTitle: '📊 𝙕𝙀𝙉 𝘽𝙊𝙏 • STATS CARD', cardDescription: 'การ์ดข้อมูลเลเวลของ **{user}**', embedColor: '#66FFFF', statsCardImageUrl: '', voiceXpEnabled: false, voiceXpAmount: 10, roleRewards: {} };
  }
  if (!config.levelConfig.roleRewardMessage) {
    config.levelConfig.roleRewardMessage = '👑 ยินดีด้วยคุณ {user} ได้รับยศพิเศษ {role} เนื่องในโอกาสอัปถึง Level {level}!';
  }
  if (!config.levelConfig.roleRewards) config.levelConfig.roleRewards = {};

  if (interaction.isChatInputCommand()) {
    handleCommandLeveling(interaction, serverConfigs, saveConfigs);
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'ping') {
    return await interaction.reply({ content: 'Pong! 🏓 บอททำงานระบบ Slash Command ปกติบน Render ครับ 🚀', ephemeral: true });
  }
  if (interaction.isChatInputCommand() && interaction.commandName === 'level') {
    return await handleLevelCommand(interaction, serverConfigs);
  }
  if (interaction.isChatInputCommand() && interaction.commandName === 'leaderboard') {
    return await handleLeaderboardCommand(interaction, serverConfigs);
  }
  if (interaction.isChatInputCommand() && interaction.commandName === 'reset-levels') {
    return await handleResetLevelsCommand(interaction, serverConfigs, saveConfigs);
  }
  if (interaction.isChatInputCommand() && interaction.commandName === 'set-level') {
    return await handleSetLevelCommand(interaction, serverConfigs);
  }
  if (interaction.isChatInputCommand() && interaction.commandName === 'set-security') {
    if (!interaction.member.permissions.has('Administrator')) return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
    return await interaction.reply({ ...getSecurityDashboardContent(config), ephemeral: true });
  }
  if (interaction.isChatInputCommand() && interaction.commandName === 'clear') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) return await interaction.reply({ content: '❌ คุณไม่มีสิทธิ์จัดการข้อความ', ephemeral: true });
    const amount = interaction.options.getInteger('amount');
    if (amount < 1 || amount > 100) return await interaction.reply({ content: '⚠️ กรุณาระบุจำนวน 1-100', ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    try {
      const messages = await interaction.channel.messages.fetch({ limit: amount });
      await interaction.channel.bulkDelete(messages, true);
      await interaction.editReply({ content: `🧹 ลบข้อความจำนวน **${amount}** เรียบร้อย!` });
    } catch (err) {
      await interaction.editReply({ content: '❌ เกิดข้อผิดพลาด ไม่สามารถลบข้อความเก่าเกิน 14 วันได้' });
    }
    return;
  }
  if (interaction.isChatInputCommand() && interaction.commandName === 'set-autoclear') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return await interaction.reply({ content: '❌ ต้องเป็น Administrator', ephemeral: true });
    const timeInput = interaction.options.getString('time');
    const channelInput = interaction.options.getChannel('channel');
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeInput)) return await interaction.reply({ content: '❌ รูปแบบเวลาไม่ถูกต้อง (HH:MM)', ephemeral: true });
    if (!config.autoClear) config.autoClear = {};
    config.autoClear.enabled = true;
    config.autoClear.time = timeInput;
    config.autoClear.channelId = channelInput.id;
    await saveConfigs(serverConfigs);
    setupCronJob(guildId, timeInput, channelInput.id);
    return await interaction.reply({ content: `✅ ตั้งค่า Auto-Clear สำเร็จ (${timeInput})`, ephemeral: true });
  }
  if (interaction.isChatInputCommand() && interaction.commandName === 'set-welcom') {
    if (!interaction.member.permissions.has('Administrator')) return await interaction.reply({ content: '❌ เฉพาะ Administrator', ephemeral: true });
    return await sendDashboard(interaction);
  }
  if (interaction.isChatInputCommand() && interaction.commandName === 'set-autorole') {
    if (!interaction.member.permissions.has('Administrator')) return await interaction.reply({ content: '❌ เฉพาะ Administrator', ephemeral: true });
    return await sendAutoroleDashboard(interaction);
  }

  if (interaction.isButton()) {
    const id = interaction.customId;
    
    const modalButtons = [
      'edit_voice_amount', 'edit_level_rate', 'edit_level_card', 
      'edit_level_messages', 'set_role_reward', 'delete_role_reward', 
      'sec_config_time', 'edit_embed', 'edit_footer', 'test_welcome'
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
      const colorInput = new TextInputBuilder().setCustomId('embedColor').setLabel('Hex Color').setStyle(TextInputStyle.Short).setValue(config.levelConfig.embedColor || '#66FFFF').setRequired(true);
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
    if (id === 'edit_embed') {
      const modal = new ModalBuilder().setCustomId('editEmbedModal').setTitle('Editing: welcome embed');
      const titleInput = new TextInputBuilder().setCustomId('embedTitle').setLabel('Title').setStyle(TextInputStyle.Short).setValue(config.embed.title || '').setRequired(false);
      const descInput = new TextInputBuilder().setCustomId('embedDesc').setLabel('Description').setStyle(TextInputStyle.Paragraph).setValue(config.embed.description || '').setRequired(true);
      const colorInput = new TextInputBuilder().setCustomId('embedColor').setLabel('Hex Color').setStyle(TextInputStyle.Short).setValue(config.embed.color || '#66FFFF').setRequired(true);
      const imageInput = new TextInputBuilder().setCustomId('embedImage').setLabel('Image URL').setStyle(TextInputStyle.Short).setValue(config.embed.image || '').setRequired(false);
      modal.addComponents(new ActionRowBuilder().addComponents(titleInput), new ActionRowBuilder().addComponents(descInput), new ActionRowBuilder().addComponents(colorInput), new ActionRowBuilder().addComponents(imageInput));
      return await interaction.showModal(modal);
    }
    if (id === 'edit_footer') {
      const modal = new ModalBuilder().setCustomId('editFooterModal').setTitle('Editing: welcome footer');
      const footerTextInput = new TextInputBuilder().setCustomId('embedFooterText').setLabel('Footer Text').setStyle(TextInputStyle.Short).setValue(config.embed.footerText || '').setRequired(false);
      const footerIconInput = new TextInputBuilder().setCustomId('embedFooterIcon').setLabel('Footer Image').setStyle(TextInputStyle.Short).setValue(config.embed.footerIcon || '').setRequired(false);
      const timestampInput = new TextInputBuilder().setCustomId('embedTimestamp').setLabel('Timestamp? (yes/no)').setStyle(TextInputStyle.Short).setValue(config.embed.timestamp || 'no').setRequired(false);
      modal.addComponents(new ActionRowBuilder().addComponents(footerTextInput), new ActionRowBuilder().addComponents(footerIconInput), new ActionRowBuilder().addComponents(timestampInput));
      return await interaction.showModal(modal);
    }
    if (id === 'test_welcome') {
      if (!config.channelId) {
        return await interaction.reply({ content: '❌ กรุณาเลือกช่องสำหรับส่งข้อความต้อนรับก่อนกดทดสอบครับ!', ephemeral: true });
      }
      await interaction.reply({ content: `🔄 กำลังส่งข้อความทดสอบ...`, ephemeral: true });
      try {
        const channel = await interaction.guild.channels.fetch(config.channelId);
        if (channel) {
          const embedConfig = config.embed;
          const finalTitle = embedConfig.title ? embedConfig.title.replace('{user}', interaction.user.username).replace('{server}', interaction.guild.name) : null;
          const finalDesc = embedConfig.description.replace('{user}', `${interaction.user}`).replace('{server}', interaction.guild.name);
          const embed = new EmbedBuilder().setDescription(finalDesc).setColor(embedConfig.color || '#66FFFF');
          if (finalTitle) embed.setTitle(finalTitle);
          if (embedConfig.image?.trim()) embed.setImage(embedConfig.image.trim());
          if (embedConfig.footerText?.trim()) {
            const memberCount = interaction.guild.memberCount.toString();
            const finalFooterText = embedConfig.footerText.replace('{server_membercount}', memberCount);
            if (embedConfig.footerIcon?.trim()) embed.setFooter({ text: finalFooterText, iconURL: embedConfig.footerIcon.trim() });
            else embed.setFooter({ text: finalFooterText });
          }
          if (embedConfig.timestamp?.toLowerCase() === 'yes') embed.setTimestamp();
          await channel.send({ embeds: [embed] });
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
      const timeoutInput = new TextInputBuilder().setCustomId('timeoutSec').setLabel('ระงับกี่วินาที').setStyle(TextInputStyle.Short).setValue(config.security.timeoutSeconds.toString()).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(countInput), new ActionRowBuilder().addComponents(secInput), new ActionRowBuilder().addComponents(timeoutInput));
      return await interaction.showModal(modal);
    } else if (id === 'sec_reset') {
      config.security = {
        enabled: false, antiLink: true, antiSpam: true, antiMrBeast: true, spamCount: 3, spamSeconds: 6, timeoutSeconds: 3000,
        actions: { invite: { timeout: true, kick: true, ban: false }, spam: { timeout: true, kick: true, ban: false }, mrbeast: { timeout: true, kick: true, ban: false } },
        ignoredChannels: []
      };
    }

    await saveConfigs(serverConfigs);
    if (id.startsWith('sec_')) return await interaction.editReply(getSecurityDashboardContent(config));
  }

  if (interaction.isStringSelectMenu()) {
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
    await interaction.deferUpdate().catch(() => {});
    if (interaction.customId === 'select_autorole') {
      config.autoroleId = interaction.values[0];
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
    if (interaction.customId === 'editEmbedModal') {
      config.embed.title = interaction.fields.getTextInputValue('embedTitle');
      config.embed.description = interaction.fields.getTextInputValue('embedDesc');
      let colorVal = interaction.fields.getTextInputValue('embedColor').trim();
      if (!colorVal.startsWith('#')) colorVal = '#' + colorVal;
      config.embed.color = colorVal;
      config.embed.image = interaction.fields.getTextInputValue('embedImage');
      await saveConfigs(serverConfigs);
      return await interaction.reply({ content: '✅ บันทึกรูปแบบ Embed เรียบร้อยแล้ว!', ephemeral: true });
    }
    if (interaction.customId === 'editFooterModal') {
      config.embed.footerText = interaction.fields.getTextInputValue('embedFooterText');
      config.embed.footerIcon = interaction.fields.getTextInputValue('embedFooterIcon');
      config.embed.timestamp = interaction.fields.getTextInputValue('embedTimestamp');
      await saveConfigs(serverConfigs);
      return await interaction.reply({ content: '✅ บันทึกรูปแบบ Footer เรียบร้อยแล้ว!', ephemeral: true });
    }
    if (interaction.customId === 'secTimeModal') {
      config.security.spamCount = parseInt(interaction.fields.getTextInputValue('spamCount')) || 3;
      config.security.spamSeconds = parseInt(interaction.fields.getTextInputValue('spamSec')) || 6;
      config.security.timeoutSeconds = parseInt(interaction.fields.getTextInputValue('timeoutSec')) || 3000;
      await saveConfigs(serverConfigs);
      return await interaction.reply({ content: '✅ บันทึกค่าเวลาความปลอดภัยเรียบร้อยแล้ว!', ephemeral: true });
    }
    if (interaction.customId === 'voiceAmountModal') {
      config.levelConfig.voiceXpAmount = parseInt(interaction.fields.getTextInputValue('voiceXp')) || 10;
      await saveConfigs(serverConfigs);
      return await interaction.reply({ content: '✅ บันทึกจำนวน XP ห้องเสียงเรียบร้อยแล้ว!', ephemeral: true });
    }
    if (interaction.customId === 'levelRateModal') {
      config.levelConfig.minXp = parseInt(interaction.fields.getTextInputValue('minXp')) || 15;
      config.levelConfig.maxXp = parseInt(interaction.fields.getTextInputValue('maxXp')) || 25;
      config.levelConfig.cmdXp = parseInt(interaction.fields.getTextInputValue('cmdXp')) || 20;
      config.levelConfig.xpMultiplier = parseInt(interaction.fields.getTextInputValue('multiplier')) || 100;
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
      const targetLevel = interaction.fields.getTextInputValue('targetLevel');
      const rewardImage = interaction.fields.getTextInputValue('rewardImage') || '';
      if (isNaN(targetLevel)) return await interaction.reply({ content: '❌ กรุณากรอกเป็นตัวเลขเลเวลที่ถูกต้อง!', ephemeral: true });
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
  const embed = new EmbedBuilder().setTitle('⚙️ ตั้งค่าระบบ Welcome').setDescription('เลือกช่อง เปิด/ปิดระบบ').setColor('#5865F2')
    .addFields({ name: '📥 Status', value: statusText, inline: true }, { name: '📢 ห้องต้อนรับ', value: channelName, inline: true });
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('toggle_welcome').setLabel(config.welcomeEnabled ? 'ปิด' : 'เปิด').setStyle(config.welcomeEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('edit_embed').setLabel('ตั้งค่า Embed').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('edit_footer').setLabel('ตั้งค่า Footer').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('test_welcome').setLabel('ทดสอบ').setStyle(ButtonStyle.Secondary)
  );
  const channelRow = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('select_channel').setPlaceholder('📂 เลือกห้องต้อนรับ').addChannelTypes(ChannelType.GuildText));
  return { embeds: [embed], components: [row1, channelRow] };
}

function getAutoroleDashboardContent(config) {
  const roleName = config.autoroleId ? `<@&${config.autoroleId}>` : 'ยังไม่ได้เลือกยศ';
  const statusText = config.autoroleEnabled ? '✅ เปิดอยู่' : '❌ ปิดอยู่';
  const embed = new EmbedBuilder().setTitle('🛡️ ตั้งค่าระบบ Autorole').setDescription('เลือกยศแจกสมาชิกใหม่').setColor('#5865F2')
    .addFields({ name: '📥 Status', value: statusText, inline: true }, { name: '👑 ยศที่จะได้รับ', value: roleName, inline: true });
  const row1 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('toggle_autorole').setLabel(config.autoroleEnabled ? 'ปิด' : 'เปิด').setStyle(config.autoroleEnabled ? ButtonStyle.Danger : ButtonStyle.Success));
  const roleRow = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('select_autorole').setPlaceholder('👑 เลือกยศแจกใหม่'));
  return { embeds: [embed], components: [row1, roleRow] };
}

async function sendDashboard(interaction) {
  await interaction.reply({ ...getDashboardContent(serverConfigs[interaction.guildId]), ephemeral: true });
}
async function updateDashboard(interaction) {
  await interaction.update({ ...getDashboardContent(serverConfigs[interaction.guildId]) });
}
async function updateDashboardAfterDefer(interaction) {
  await interaction.editReply({ ...getDashboardContent(serverConfigs[interaction.guildId]) });
}
async function sendAutoroleDashboard(interaction) {
  await interaction.reply({ ...getAutoroleDashboardContent(serverConfigs[interaction.guildId]), ephemeral: true });
}
async function updateAutoroleDashboard(interaction) {
  await interaction.update({ ...getAutoroleDashboardContent(serverConfigs[interaction.guildId]) });
}
async function updateAutoroleDashboardAfterDefer(interaction) {
  await interaction.editReply({ ...getAutoroleDashboardContent(serverConfigs[interaction.guildId]) });
}

client.login(process.env.DISCORD_TOKEN);
