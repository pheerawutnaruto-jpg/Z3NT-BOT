const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder } = require('discord.js');
const http = require('http');
const fs = require('fs');
const cron = require('node-cron');
const { getSecurityDashboardContent, handleSecurityMessage } = require('./security');
const { levelCommands, getLevelDashboardContent, handleLevelMessage, handleLevelCommand, levelData, saveLevels } = require('./level');

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
      .setName('set-autorole')
      .setDescription('ตั้งค่าระบบแจกยศอัตโนมัติสำหรับสมาชิกใหม่'),
    new SlashCommandBuilder()
      .setName('set-security')
      .setDescription('เปิดแผงควบคุมระบบป้องกันความปลอดภัยขั้นสูง'),
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
    ...levelCommands
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

// ตรวจสอบข้อความสำหรับระบบ Level และ Security
client.on('messageCreate', async message => {
  handleLevelMessage(message, serverConfigs, saveConfigs);

  const config = serverConfigs[message.guild?.id];
  handleSecurityMessage(message, config, spamTracker);
});

client.on('guildMemberAdd', async member => {
  const guildId = member.guild.id;
  const config = serverConfigs[guildId];

  if (!config) return;

  // 1. ระบบ Autorole
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

  // 2. ระบบ Welcome Message
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
      levelConfig: {
        enabled: true,
        minXp: 15,
        maxXp: 25,
        ignoredChannels: []
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
  if (!config.levelConfig) {
    config.levelConfig = { enabled: true, minXp: 15, maxXp: 25, ignoredChannels: [] };
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'ping') {
    return await interaction.reply({ content: 'Pong! 🏓 บอททำงานระบบ Slash Command ปกติบน Render ครับ 🚀', ephemeral: true });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'set-security') {
    if (!interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
    }
    return await interaction.reply({ ...getSecurityDashboardContent(config), ephemeral: true });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'set-level') {
    if (!interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
    }
    return await interaction.reply({ ...getLevelDashboardContent(config), ephemeral: true });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'level') {
    return await handleLevelCommand(interaction);
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'clear') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return await interaction.reply({ content: '❌ คุณไม่มีสิทธิ์จัดการข้อความ (Manage Messages) ครับ', ephemeral: true });
    }

    const amount = interaction.options.getInteger('amount');
    if (amount < 1 || amount > 100) {
      return await
