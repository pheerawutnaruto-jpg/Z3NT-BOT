const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const http = require('http');
const cron = require('node-cron');
const { Redis } = require('@upstash/redis');
const { getSecurityDashboardContent, handleSecurityMessage } = require('./security');
const { handleLeveling, handleCommandLeveling, levelCommand, handleLevelCommand, leaderboardCommand, handleLeaderboardCommand, setLevelCommand, handleSetLevelCommand, getLevelDashboardContent, startVoiceXpCron } = require('./level');

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

// ฟังก์ชันโหลดข้อมูลจาก Redis บน Cloud
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

// ฟังก์ชันบันทึกข้อมูลลง Redis บน Cloud
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
  // โหลดข้อมูลการตั้งค่าทั้งหมดขึ้นมาจาก Cloud เมื่อบอทเริ่มทำงาน
  serverConfigs = await loadConfigs();
  console.log(`Bot Online แล้วจ้า: ${client.user.tag}`);

  // เริ่มระบบแจก XP ห้องเสียงอัตโนมัติ
  startVoiceXpCron(client, serverConfigs, saveConfigs);

  const commands = [
    new SlashCommandBuilder()
      .setName('ping')
      .setDescription('เช็กความเร็วและสถานะของบอท'),
    new SlashCommandBuilder()
      .setName('set-welcom')
      .setDescription('เปิดแผงควบคุมระบบต้อนรับ (Welcome Dashboard)'),
    new SlashCommandBuilder()
      .setName('set-autorole')
      .setDescription('ตั้งค่าระบบแจกยศอัตโนมัติสำหรับสมาชิกใหม่'),
    new SlashCommandBuilder()
      .setName('set-security')
      .setDescription('เปิดแผงควบคุมระบบป้องกันความปลอดภัยขั้นสูง'),
    levelCommand,
    leaderboardCommand,
    setLevelCommand,
    new SlashCommandBuilder()
      .setName('clear')
      .setDescription('ลบข้อความในแชทจำนวน 1-100 ข้อความ')
      .addIntegerOption(option =>
        option.setName('amount')
          .setDescription('จำนวนข้อความที่ต้องการลบ (1-100)')
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName('set-autoclear')
      .setDescription('ตั้งเวลาระบบลบข้อความอัตโนมัติ')
      .addStringOption(option =>
        option.setName('time')
          .setDescription('ระบุเวลาในรูปแบบ HH:MM เช่น 06:00')
          .setRequired(true)
      )
      .addChannelOption(option =>
        option.setName('channel')
          .setDescription('เลือกห้องที่ต้องการให้ลบข้อความอัตโนมัติ')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      ),
  ].map(command => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands },
    );
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
  }, {
    timezone: "Asia/Bangkok"
  });

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

    const finalTitle = embedConfig.title ? embedConfig.title
      .replace('{user}', member.user.username)
      .replace('{server}', member.guild.name) : null;
      
    const finalDesc = embedConfig.description
      .replace('{user}', `${member}`)
      .replace('{server}', member.guild.name);

    let embedColor = '#66FFFF';
    try {
      embedColor = embedConfig.color;
    } catch (e) {
      embedColor = '#66FFFF';
    }

    const embed = new EmbedBuilder()
      .setDescription(finalDesc)
      .setColor(embedColor);

    if (finalTitle) {
      embed.setTitle(finalTitle);
    }

    if (embedConfig.image && embedConfig.image.trim() !== '') {
      embed.setImage(embedConfig.image.trim());
    }

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
      welcomeEnabled: false,
      channelId: null,
      autoroleEnabled: false,
      autoroleId: null,
      security: {
        enabled: false,
        antiLink: true,
        antiSpam: true,
        antiMrBeast: true,
        spamCount: 3,
        spamSeconds: 6,
        timeoutSeconds: 3000,
        actions: {
          invite: { timeout: true, kick: true, ban: false },
          spam: { timeout: true, kick: true, ban: false },
          mrbeast: { timeout: true, kick: true, ban: false }
        },
        ignoredChannels: []
      },
      levels: {},
      levelConfig: {
        enabled: true,
        minXp: 15,
        maxXp: 25,
        cmdXp: 20,
        xpMultiplier: 100,
        channelId: null,
        levelUpMessage: 'ยินดีด้วยคุณ {user}! เลเวลอัปขึ้นเป็น **Level {level}** แล้ว!',
        cardTitle: '📊 𝙕𝙀𝙉 𝘽𝙊𝙏 • STATS CARD',
        cardDescription: 'การ์ดข้อมูลเลเวลของ **{user}**',
        embedColor: '#66FFFF',
        levelUpImageUrl: '',
        statsCardImageUrl: '',
        voiceXpEnabled: false,
        voiceXpAmount: 10,
        roleRewards: {}
      },
      embed: {
        title: '',
        description: '**𑣲⋆ 𝙉𝙀𝙒 𝙈𝙚𝙢𝙗𝙚𝙧!** ✨\n🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}** ครับ!',
        color: '#66FFFF',
        image: '',
        footerText: '',
        footerIcon: '',
        timestamp: 'no'
      },
      autoClear: {
        enabled: false,
        time: '06:00',
        channelId: null
      }
    };
  }
  const config = serverConfigs[guildId];
  if (!config.security) {
    config.security = {
      enabled: false,
      antiLink: true,
      antiSpam: true,
      antiMrBeast: true,
      spamCount: 3,
      spamSeconds: 6,
      timeoutSeconds: 3000,
      actions: {
        invite: { timeout: true, kick: true, ban: false },
        spam: { timeout: true, kick: true, ban: false },
        mrbeast: { timeout: true, kick: true, ban: false }
      },
      ignoredChannels: []
    };
  }
  if (!config.levels) config.levels = {};
  if (!config.levelConfig) {
    config.levelConfig = {
      enabled: true,
      minXp: 15,
      maxXp: 25,
      cmdXp: 20,
      xpMultiplier: 100,
      channelId: null,
      levelUpMessage: 'ยินดีด้วยคุณ {user}! เลเวลอัปขึ้นเป็น **Level {level}** แล้ว!',
      cardTitle: '📊 𝙕𝙀𝙉 𝘽𝙊𝙏 • STATS CARD',
      cardDescription: 'การ์ดข้อมูลเลเวลของ **{user}**',
      embedColor: '#66FFFF',
      levelUpImageUrl: '',
      statsCardImageUrl: '',
      voiceXpEnabled: false,
      voiceXpAmount: 10,
      roleRewards: {}
    };
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

  if (interaction.isChatInputCommand() && interaction.commandName === 'set-level') {
    return await handleSetLevelCommand(interaction, serverConfigs);
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'set-security') {
    if (!interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
    }
    return await interaction.reply({ ...getSecurityDashboardContent(config), ephemeral: true });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'clear') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return await interaction.reply({ content: '❌ คุณไม่มีสิทธิ์จัดการข้อความ (Manage Messages) ครับ', ephemeral: true });
    }

    const amount = interaction.options.getInteger('amount');
    if (amount < 1 || amount > 100) {
      return await interaction.reply({ content: '⚠️ กรุณาระบุจำนวนข้อความระหว่าง 1 ถึง 100 ครับ', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const messages = await interaction.channel.messages.fetch({ limit: amount });
      await interaction.channel.bulkDelete(messages, true);
      await interaction.editReply({ content: `🧹 ลบข้อความจำนวน **${amount}** ข้อความเรียบร้อยแล้ว!` });
    } catch (err) {
      console.error(err);
      await interaction.editReply({ content: '❌ เกิดข้อผิดพลาด ไม่สามารถลบข้อความที่เก่าเกิน 14 วันได้ครับ' });
    }
    return;
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'set-autoclear') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({ content: '❌ คุณต้องเป็น Administrator ถึงจะใช้งานคำสั่งนี้ได้ครับ', ephemeral: true });
    }

    const timeInput = interaction.options.getString('time');
    const channelInput = interaction.options.getChannel('channel');

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(timeInput)) {
      return await interaction.reply({ content: '❌ รูปแบบเวลาไม่ถูกต้อง กรุณาใส่ในรูปแบบ **HH:MM** (เช่น `06:00` หรือ `23:30`)', ephemeral: true });
    }

    if (!config.autoClear) {
      config.autoClear = {};
    }

    config.autoClear.enabled = true;
    config.autoClear.time = timeInput;
    config.autoClear.channelId = channelInput.id;
    await saveConfigs(serverConfigs);

    setupCronJob(guildId, timeInput, channelInput.id);

    return await interaction.reply({ content: `✅ ตั้งค่าระบบ Auto-Clear สำเร็จ!\n⏰ เวลา: **${timeInput} น.** (ทุกวัน)\n📢 ช่อง: <#${channelInput.id}>`, ephemeral: true });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'set-welcom') {
    if (!interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: '❌ คุณต้องเป็น Administrator ถึงจะใช้งานได้ครับ', ephemeral: true });
    }
    return await sendDashboard(interaction);
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'set-autorole') {
    if (!interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: '❌ คุณต้องเป็น Administrator ถึงจะใช้งานได้ครับ', ephemeral: true });
    }
    return await sendAutoroleDashboard(interaction);
  }

  if (interaction.isButton()) {
    const id = interaction.customId;
    if (id === 'toggle_welcome') {
      config.welcomeEnabled = !config.welcomeEnabled;
      await saveConfigs(serverConfigs);
      return await updateDashboard(interaction);
    }
    
    if (id === 'toggle_autorole') {
      config.autoroleEnabled = !config.autoroleEnabled;
      await saveConfigs(serverConfigs);
      return await updateAutoroleDashboard(interaction);
    }

    if (id === 'toggle_level') {
      config.levelConfig.enabled = !config.levelConfig.enabled;
      await saveConfigs(serverConfigs);
      return await interaction.update(getLevelDashboardContent(config));
    }
    if (id === 'toggle_voice_xp') {
      config.levelConfig.voiceXpEnabled = !config.levelConfig.voiceXpEnabled;
      await saveConfigs(serverConfigs);
      return await interaction.update(getLevelDashboardContent(config));
    }
    if (id === 'edit_voice_amount') {
      const modal = new ModalBuilder().setCustomId('voiceAmountModal').setTitle('ตั้งค่า XP ห้องเสียง');
      const amountInput = new TextInputBuilder().setCustomId('voiceXp').setLabel('จำนวน XP ต่อ 1 นาที').setStyle(TextInputStyle.Short).setValue(config.levelConfig.voiceXpAmount?.toString() || '10').setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
      return await interaction.showModal(modal);
    }
    if (id === 'edit_level_rate') {
      const modal = new ModalBuilder().setCustomId('levelRateModal').setTitle('ตั้งค่าเรต XP แชท/คำสั่ง');
      const minInput = new TextInputBuilder().setCustomId('minXp').setLabel('XP ต่ำสุดต่อข้อความ').setStyle(TextInputStyle.Short).setValue(config.levelConfig.minXp.toString()).setRequired(true);
      const maxInput = new TextInputBuilder().setCustomId('maxXp').setLabel('XP สูงสุดต่อข้อความ').setStyle(TextInputStyle.Short).setValue(config.levelConfig.maxXp.toString()).setRequired(true);
      const cmdInput = new TextInputBuilder().setCustomId('cmdXp').setLabel('XP จากการใช้คำสั่ง /').setStyle(TextInputStyle.Short).setValue(config.levelConfig.cmdXp?.toString() || '20').setRequired(true);
      const multInput = new TextInputBuilder().setCustomId('multiplier').setLabel('ตัวคูณเลเวลอัป').setStyle(TextInputStyle.Short).setValue(config.levelConfig.xpMultiplier.toString()).setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(minInput), new ActionRowBuilder().addComponents(maxInput), new ActionRowBuilder().addComponents(cmdInput), new ActionRowBuilder().addComponents(multInput));
      return await interaction.showModal(modal);
    }
    if (id === 'edit_level_card') {
      const modal = new ModalBuilder().setCustomId('levelCardModal').setTitle('ตกแต่งการ์ด Level (/level)');
      const titleInput = new TextInputBuilder().setCustomId('cardTitle').setLabel('Title การ์ด').setStyle(TextInputStyle.Short).setValue(config.levelConfig.cardTitle || '').setRequired(true);
      const descInput = new TextInputBuilder().setCustomId('cardDesc').setLabel('Description การ์ด').setStyle(TextInputStyle.Paragraph).setValue(config.levelConfig.cardDescription || '').setRequired(true);
      const colorInput = new TextInputBuilder().setCustomId('embedColor').setLabel('Hex Color (เช่น 66FFFF)').setStyle(TextInputStyle.Short).setValue(config.levelConfig.embedColor || '#66FFFF').setRequired(true);
      const imageInput = new TextInputBuilder().setCustomId('statsCardImg').setLabel('Image URL (รูปตอนเช็กเลเวล)').setStyle(TextInputStyle.Short).setValue(config.levelConfig.statsCardImageUrl || '').setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descInput),
        new ActionRowBuilder().addComponents(colorInput),
        new ActionRowBuilder().addComponents(imageInput)
      );
      return await interaction.showModal(modal);
    }
    if (id === 'edit_level_msg') {
      const modal = new ModalBuilder().setCustomId('levelMsgModal').setTitle('ตั้งค่าข้อความและรูปเลเวลอัป');
      const msgInput = new TextInputBuilder().setCustomId('levelMsg').setLabel('ข้อความ ({user}, {level})').setStyle(TextInputStyle.Paragraph).setValue(config.levelConfig.levelUpMessage).setRequired(true);
      const imageInput = new TextInputBuilder().setCustomId('levelUpImg').setLabel('Image URL (รูปตอนเลเวลอัป)').setStyle(TextInputStyle.Short).setValue(config.levelConfig.levelUpImageUrl || '').setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(msgInput),
        new ActionRowBuilder().addComponents(imageInput)
      );
      return await interaction.showModal(modal);
    }
    if (id === 'set_role_reward') {
      const modal = new ModalBuilder().setCustomId('roleRewardModal').setTitle('ตั้งค่ายศรางวัลตามเลเวล');
      const levelInput = new TextInputBuilder().setCustomId('targetLevel').setLabel('ระบุเลเวลที่ต้องการให้ได้รับยศ (เช่น 5)').setStyle(TextInputStyle.Short).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(levelInput));
      return await interaction.showModal(modal);
    }

    if (id === 'sec_toggle_main') {
      config.security.enabled = !config.security.enab
