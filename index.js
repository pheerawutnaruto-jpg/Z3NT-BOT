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
      .setDescription('เปิดแผงควบคุมระบบต้อนรับ'),
    new SlashCommandBuilder()
      .setName('antispam-panel')
      .setDescription('เปิดแผงควบคุมระบบป้องกันความปลอดภัย'),
    new SlashCommandBuilder()
      .setName('clear')
      .setDescription('ลบข้อความในแชท 1-100 ข้อความ')
      .addIntegerOption(option =>
        option.setName('amount')
          .setDescription('จำนวนข้อความ')
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName('set-autoclear')
      .setDescription('ตั้งเวลาลบข้อความอัตโนมัติ')
      .addStringOption(option =>
        option.setName('time')
          .setDescription('เวลา เช่น 06:00')
          .setRequired(true)
      )
      .addChannelOption(option =>
        option.setName('channel')
          .setDescription('เลือกห้อง')
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

  const parts = timeStr.split(':');
  if (parts.length !== 2) return;
  const cronExpression = `${parts[1]}${parts[0]} * * *`;

  activeCronJobs[guildId] = cron.schedule(cronExpression, async () => {
    try {
      const guild = await client.guilds.fetch(guildId);
      if (!guild) return;
      const channel = await guild.channels.fetch(channelId);
      if (channel && channel.isTextBased()) {
        const fetched = await channel.messages.fetch({ limit: 100 });
        await channel.bulkDelete(fetched, true);
      }
    } catch (err) {
      console.error('Cron error:', err);
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
      description: 'ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ {server}',
      color: '#66FFFF',
      image: ''
    };

    const finalTitle = embedConfig.title ? embedConfig.title
      .replace('{user}', member.user.username)
      .replace('{server}', member.guild.name) : null;
      
    const finalDesc = embedConfig.description
      .replace('{user}', `${member}`)
      .replace('{server}`, member.guild.name);

    const embed = new EmbedBuilder()
      .setDescription(finalDesc)
      .setColor(embedConfig.color || '#66FFFF');

    if (finalTitle) embed.setTitle(finalTitle);
    if (embedConfig.image && embedConfig.image.trim() !== '') embed.setImage(embedConfig.image.trim());

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Welcome error:', err);
  }
});

// ระบบตรวจสอบข้อความและการป้องกัน (Anti-Spam & Protection)
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
      timeoutSeconds: 3000,
      cooldown: 1,
      inviteAction: 'Timeout 3000s + Kick',
      spamAction: 'Timeout 3000s + Kick',
      mrBeastAction: 'Timeout 3000s + Kick',
      selectedChannels: []
    };
  }
  const security = serverConfigs[guildId].security;
  if (!security.enabled) return;

  // ถ้ามีการตั้งค่าห้องเฉพาะ ให้เช็กว่าห้องนี้เปิดใช้งานไหม
  if (security.selectedChannels.length > 0 && !security.selectedChannels.includes(message.channel.id)) {
    return;
  }

  const content = message.content;

  // 1. ตรวจจับลิงก์เชิญ / ลิงก์
  if (security.inviteLink && (content.includes('discord.gg/') || content.includes('https://') || content.includes('http://'))) {
    try {
      await message.delete();
      const warning = await message.channel.send(`⚠️ <@${message.author.id}> ห้ามส่งลิงก์ในห้องนี้!`);
      setTimeout(() => warning.nodeDelete ? warning.nodeDelete() : warning.delete().catch(() => {}), 4000);
      
      if (security.inviteAction.includes('Timeout') && message.member.moderatable) {
        await message.member.timeout(security.timeoutSeconds * 1000, 'Anti-Invite Violation');
      }
      if (security.inviteAction.includes('Kick') && message.member.kickable) {
        await message.member.kick('Anti-Invite Violation');
      }
      return;
    } catch (err) {
      console.error(err);
    }
  }

  // 2. ตรวจจับสแปม MrBeast / Scam
  if (security.mrBeastSpam && (content.toLowerCase().includes('mrbeast') || content.toLowerCase().includes('free nitro'))) {
    try {
      await message.delete();
      const warning = await message.channel.send(`⚠️ <@${message.author.id}> ตรวจพบข้อความสแปมต้องสงสัย (MrBeast)!`);
      setTimeout(() => warning.delete().catch(() => {}), 4000);

      if (security.mrBeastAction.includes('Timeout') && message.member.moderatable) {
        await message.member.timeout(security.timeoutSeconds * 1000, 'MrBeast Scam Violation');
      }
      if (security.mrBeastAction.includes('Kick') && message.member.kickable) {
        await message.member.kick('MrBeast Scam Violation');
      }
      return;
    } catch (err) {
      console.error(err);
    }
  }

  // 3. ตรวจจับสแปมข้อความทั่วไป
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

        if (security.spamAction.includes('Timeout') && message.member.moderatable) {
          await message.member.timeout(security.timeoutSeconds * 1000, 'Message Spam Violation');
        }
        if (security.spamAction.includes('Kick') && message.member.kickable) {
          await message.member.kick('Message Spam Violation');
        }
      } catch (err) {
        console.error(err);
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
        description: 'ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ {server}',
        color: '#66FFFF',
        image: ''
      },
      autoClear: { enabled: false, time: '06:00', channelId: null },
      security: {
        enabled: true,
        inviteLink: true,
        messageSpam: true,
        mrBeastSpam: true,
        spamLimit: 3,
        spamSeconds: 6,
        timeoutSeconds: 3000,
        cooldown: 1,
        inviteAction: 'Timeout 3000s + Kick',
        spamAction: 'Timeout 3000s + Kick',
        mrBeastAction: 'Timeout 3000s + Kick',
        selectedChannels: []
      }
    };
  }
  const config = serverConfigs[guildId];

  if (interaction.isChatInputCommand() && interaction.commandName === 'ping') {
    return await interaction.reply({ content: 'Pong! 🏓 บอททำงานปกติบน Render ครับ', ephemeral: true });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'antispam-panel') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({ content: '❌ สำหรับ Administrator เท่านั้น', ephemeral: true });
    }
    return await sendAntiSpamDashboard(interaction);
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'clear') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return await interaction.reply({ content: '❌ ไม่มีสิทธิ์จัดการข้อความ', ephemeral: true });
    }
    const amount = interaction.options.getInteger
