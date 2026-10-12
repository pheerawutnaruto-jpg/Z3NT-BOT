const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const http = require('http');
const fs = require('fs');
const cron = require('node-cron');

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
    GatewayIntentBits.MessageContent
  ]
});

const CONFIG_FILE = './config.json';

function loadConfigs() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      if (data.trim() !== '') {
        return JSON.parse(data);
      }
    }
  } catch (e) {
    console.error('Error loading config:', e);
  }
  return {};
}

function saveConfigs(configs) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2));
  } catch (e) {
    console.error('Error saving config:', e);
  }
}

let serverConfigs = loadConfigs();
let activeCronJobs = {};
const spamTracker = new Map();

client.once('ready', async () => {
  console.log(`Bot Online แล้วจ้า: ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName('ping')
      .setDescription('เช็กความเร็วและสถานะของบอท'),
    new SlashCommandBuilder()
      .setName('set-welcom')
      .setDescription('เปิดแผงควบคุมระบบต้อนรับ (Welcome Dashboard)'),
    new SlashCommandBuilder()
      .setName('antispam-panel')
      .setDescription('เปิดแผงควบคุมระบบป้องกันและกันสแปมเซิร์ฟเวอร์'),
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
}

// ระบบต้อนรับสมาชิกใหม่
client.on('guildMemberAdd', async member => {
  const guildId = member.guild.id;
  const config = serverConfigs[guildId];

  if (!config || !config.welcomeEnabled || !config.channelId) return;

  try {
    const channel = await member.guild.channels.fetch(config.channelId);
    if (!channel) return;

    const embedConfig = config.embed || {
      title: '',
      description: '**𑣲⋆ 𝙉𝙀𝙒 𝙈𝙚𝙢𝙗𝙚𝙧!** ✨\n🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}** ครับ!',
      color: '#66FFFF',
      image: ''
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

    if (finalTitle) embed.setTitle(finalTitle);
    if (embedConfig.image && embedConfig.image.trim() !== '') embed.setImage(embedConfig.image.trim());

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Send welcome error:', err);
  }
});

// ระบบป้องกันเซิร์ฟเวอร์ (Anti-Spam, Anti-Invite, Anti-MrBeast)
client.on('messageCreate', async message => {
  if (!message.guild || message.author.bot) return;
  if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return;

  const guildId = message.guild.id;
  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].security) {
    serverConfigs[guildId].security = {
      enabled: true,
      inviteLink: true,
      messageSpam: true,
      mrBeastSpam: true,
      spamLimit: 3,
      spamSeconds: 6,
      timeoutDuration: 3000,
      action: 'timeout'
    };
  }
  const security = serverConfigs[guildId].security;

  if (!security.enabled) return;

  const content = message.content;

  if (security.inviteLink && (content.includes('discord.gg/') || content.includes('https://') || content.includes('http://'))) {
    try {
      await message.delete();
      const warning = await message.channel.send(`⚠️ <@${message.author.id}> ห้ามส่งลิงก์หรือคำเชิญในห้องนี้!`);
      setTimeout(() => warning.delete().catch(() => {}), 4000);

      if (security.action === 'timeout' && message.member.moderatable) {
        await message.member.timeout(security.timeoutDuration * 1000, 'Anti-Invite Violation');
      } else if (security.action === 'kick' && message.member.kickable) {
        await message.member.kick('Anti-Invite Violation');
      }
      return;
    } catch (err) {
      console.error('Security invite action error:', err);
    }
  }

  if (security.mrBeastSpam && (content.toLowerCase().includes('mrbeast') || content.toLowerCase().includes('free nitro'))) {
    try {
      await message.delete();
      const warning = await message.channel.send(`⚠️ <@${message.author.id}> ตรวจพบข้อความสแปมต้องสงสัย!`);
      setTimeout(() => warning.delete().catch(() => {}), 4000);

      if (message.member.moderatable) {
        await message.member.timeout(security.timeoutDuration * 1000, 'MrBeast Scam Spam');
      }
      return;
    } catch (err) {
      console.error('MrBeast spam error:', err);
    }
  }

  if (security.messageSpam) {
    const userId = message.author.id;
    const currentTime = Date.now();
    
    if (!spamTracker.has(userId)) spamTracker.set(userId, []);
    const timestamps = spamTracker.get(userId);
    timestamps.push(currentTime);

    const timeWindow = security.spamSeconds * 1000;
    const recentTimestamps = timestamps.filter(time => currentTime - time < timeWindow);
    spamTracker.set(userId, recentTimestamps);

    if (recentTimestamps.length >= security.spamLimit) {
      try {
        await message.delete();
        const warning = await message.channel.send(`⚠️ <@${message.author.id}> กรุณาอย่าพิมพ์ข้อความสแปมหรือรัวแชท!`);
        setTimeout(() => warning.delete().catch(() => {}), 4000);
        spamTracker.set(userId, []);

        if (message.member.moderatable) {
          await message.member.timeout(security.timeoutDuration * 1000, 'Message Spam Violation');
        }
      } catch (err) {
        console.error('Anti-spam action error:', err);
      }
    }
  }
});

client.on('interactionCreate', async interaction => {
  const guildId = interaction.guildId;
  if (!guildId) return;

  if (!serverConfigs[guildId]) {
    serverConfigs[guildId] = {
      welcomeEnabled: false,
      channelId: null,
      embed: {
        title: '',
        description: '**𑣲⋆ 𝙉𝙀𝙒 𝙈𝙚𝙢𝙗𝙚𝙧!** ✨\n🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}** ครับ!',
        color: '#66FFFF',
        image: ''
      },
      autoClear: {
        enabled: false,
        time: '06:00',
        channelId: null
      },
      security: {
        enabled: true,
        inviteLink: true,
        messageSpam: true,
        mrBeastSpam: true,
        spamLimit: 3,
        spamSeconds: 6,
        timeoutDuration: 3000,
        action: 'timeout'
      }
    };
  }
  const config = serverConfigs[guildId];

  // คำสั่ง /ping
  if (interaction.isChatInputCommand() && interaction.commandName === 'ping') {
    return await interaction.reply({ content: 'Pong! 🏓 บอททำงานระบบ Slash Command ปกติบน Render ครับ 🚀', ephemeral: true });
  }

  // คำสั่ง /antispam-panel
  if (interaction.isChatInputCommand() && interaction.commandName === 'antispam-panel') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({ content: '❌ คุณต้องเป็น Administrator ถึงจะเปิดแผงควบคุมนี้ได้ครับ', ephemeral: true });
    }
    return await sendAntiSpamDashboard(interaction);
  }

  // คำสั่ง /clear
  if (interaction.isChatInputCommand() && interaction.commandName === 'clear') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return await interaction.reply({ content: '❌ คุณไม่มีสิทธิ์จัดการข้อความครับ', ephemeral: true });
    }
    const amount = interaction.options.getInteger('amount');
    await interaction.deferReply({ ephemeral: true });
    try {
      const messages = await interaction.channel.messages.fetch({ limit: amount });
      await interaction.channel.bulkDelete(messages, true);
      await interaction.editReply({ content: `🧹 ลบข้อความจำนวน **${amount}** เรียบร้อยแล้ว!` });
    } catch (err) {
      await interaction.editReply({ content: '❌ เกิดข้อผิดพลาด ไม่สามารถลบข้อความที่เก่าเกิน 14 วันได้ครับ' });
    }
    return;
  }

  // คำสั่ง /set-autoclear
  if (interaction.isChatInputCommand() && interaction.commandName === 'set-autoclear') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({ content: '❌ สำหรับ Administrator เท่านั้น', ephemeral: true });
    }
    const timeInput = interaction.options.getString('time');
    const channelInput = interaction.options.getChannel('channel');

    if (!config.autoClear) config.autoClear = {};
    config.autoClear.enabled = true;
    config.autoClear.time = timeInput;
    config.autoClear.channelId = channelInput.id;
    saveConfigs(serverConfigs);
    setupCronJob(guildId, timeInput, channelInput.id);

    return await interaction.reply({ content: `✅ ตั้งค่า Auto-Clear เวลา **${timeInput} น.** ในห้อง <#${channelInput.id}> สำเร็จ!`, ephemeral: true });
  }

  // คำสั่ง /set-welcom
  if (interaction.isChatInputCommand() && interaction.commandName === 'set-welcom') {
    if (!interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: '❌ สำหรับ Administrator เท่านั้น', ephemeral: true });
    }
    return await sendDashboard(interaction);
  }

  // ปุ่มกดระบบป้องกัน (Anti-spam panel buttons)
  if (interaction.isButton() && interaction.customId.startsWith('sec_')) {
    if (!config.security) {
      config.security = { enabled: true, inviteLink: true, messageSpam: true, mrBeastSpam: true, spamLimit: 3, spamSeconds: 6, timeoutDuration: 3000, action: 'timeout' };
    }
    const sec = config.security;

    if (interaction.customId === 'sec_toggle') sec.enabled = !sec.enabled;
    else if (interaction.customId === 'sec_invite') sec.inviteLink = !sec.inviteLink;
    else if (interaction.customId === 'sec_spam') sec.messageSpam = !sec.messageSpam;
    else if (interaction.customId === 'sec_mrbeast') sec.mrBeastSpam = !sec.mrBeastSpam;
    else if (interaction.customId === 'sec_action_timeout') sec.action = 'timeout';
    else if (interaction.customId === 'sec_action_kick') sec.action = 'kick';
    else if (interaction.customId === 'sec_reset') {
      config.security = { enabled: true, inviteLink: true, messageSpam: true, mrBeastSpam: true, spamLimit: 3, spamSeconds: 6, timeoutDuration: 3000, action: 'timeout' };
    }

    saveConfigs(serverConfigs);
    return await updateAntiSpamDashboard(interaction);
  }

  // ปุ่มกด Welcome เดิม
  if (interaction.isButton() && interaction.customId === 'toggle_welcome') {
    config.welcomeEnabled = !config.welcomeEnabled;
    saveConfigs(serverConfigs);
    return await updateDashboard(interaction);
  }
  if (interaction.isButton() && interaction.customId === 'test_welcome') {
    if (!config.channelId) return await interaction.reply({ content: '❌ กรุณาเลือกช่องต้อนรับก่อน!', ephemeral: true });
    await interaction.
      
