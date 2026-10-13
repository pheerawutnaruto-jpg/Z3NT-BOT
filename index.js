const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder } = require('discord.js');
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
    new SlashCommandBuilder().setName('ping').setDescription('เช็กความเร็วและสถานะของบอท'),
    new SlashCommandBuilder().setName('set-welcom').setDescription('เปิดแผงควบคุมระบบต้อนรับ (Welcome Dashboard)'),
    new SlashCommandBuilder().setName('set-autorole').setDescription('ตั้งค่าระบบแจกยศอัตโนมัติสำหรับสมาชิกใหม่'),
    new SlashCommandBuilder().setName('set-security').setDescription('เปิดแผงควบคุมระบบป้องกันความปลอดภัยขั้นสูง (Anti-Spam / Anti-Link)'),
    new SlashCommandBuilder()
      .setName('clear')
      .setDescription('ลบข้อความในแชทจำนวน 1-100 ข้อความ')
      .addIntegerOption(option => option.setName('amount').setDescription('จำนวนข้อความที่ต้องการลบ (1-100)').setRequired(true)),
    new SlashCommandBuilder()
      .setName('set-autoclear')
      .setDescription('ตั้งเวลาระบบลบข้อความอัตโนมัติ')
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
  }, {
    timezone: "Asia/Bangkok"
  });
}

// ระบบตรวจจับข้อความและป้องกันภัยคุกคามตามค่า Config
client.on('messageCreate', async message => {
  if (!message.guild || message.author.bot) return;

  const guildId = message.guild.id;
  const config = serverConfigs[guildId];
  if (!config || !config.security || !config.security.enabled) return;

  // ตรวจสอบห้องที่ได้รับการยกเว้น หรือกำหนดให้บอทดูแลเฉพาะห้องที่เลือก
  if (config.security.selectedChannels && config.security.selectedChannels.length > 0) {
    if (!config.security.selectedChannels.includes(message.channel.id)) return;
  }

  if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return;

  const sec = config.security;

  // 1. Anti-Link (ลบลิงก์เชิญ / ลิงก์ทั่วไป)
  if (sec.antiLink) {
    const linkRegex = /(https?:\/\/[^\s]+)/gi;
    if (linkRegex.test(message.content)) {
      try {
        await message.delete();
        await applyPunishment(message.member, sec.inviteAction || 'timeout');
        const warning = await message.channel.send(`⚠️ <@${message.author.id}> ตรวจพบลิงก์ห้ามส่งในห้องนี้!`);
        setTimeout(() => warning.delete().catch(() => {}), 4000);
        return;
      } catch (err) {
        console.error('Anti-link error:', err);
      }
    }
  }

  // 2. Anti-MrBeast Spam / Scam Keywords
  if (sec.antiMrBeast) {
    const scamKeywords = ['mrbeast', 'free nitro', 'claim free', 'nitro generator', 'steam gift'];
    const contentLower = message.content.toLowerCase();
    if (scamKeywords.some(keyword => contentLower.includes(keyword))) {
      try {
        await message.delete();
        await applyPunishment(message.member, sec.mrBeastAction || 'timeout');
        const warning = await message.channel.send(`⚠️ <@${message.author.id}> ตรวจพบข้อความสแปมอันตราย (MrBeast/Scam)!`);
        setTimeout(() => warning.delete().catch(() => {}), 4000);
        return;
      } catch (err) {
        console.error('Anti-MrBeast error:', err);
      }
    }
  }

  // 3. Anti-Spam (เช็คจำนวนข้อความในเวลาที่กำหนด เช่น 3 ข้อความ / 6 วินาที)
  if (sec.antiSpam) {
    const userId = message.author.id;
    const now = Date.now();
    const limitSec = sec.spamSeconds || 6;
    const maxMsg = sec.spamCount || 3;

    const userSpam = spamTracker.get(userId) || { count: 0, startTime: now };

    if (now - userSpam.startTime < limitSec * 1000) {
      userSpam.count++;
      if (userSpam.count > maxMsg) {
        try {
          await message.delete();
          await applyPunishment(message.member, sec.spamAction || 'timeout');
          const warning = await message.channel.send(`⚠️ <@${userId}> ส่งข้อความเร็วเกินกำหนด (Anti-Spam)`);
          setTimeout(() => warning.delete().catch(() => {}), 4000);
          spamTracker.set(userId, { count: 0, startTime: now });
          return;
        } catch (err) {
          console.error('Anti-spam error:', err);
        }
      }
    } else {
      userSpam.count = 1;
      userSpam.startTime = now;
    }
    spamTracker.set(userId, userSpam);
  }
});

async function applyPunishment(member, action) {
  if (!member) return;
  try {
    if (action.includes('timeout') || action === 'timeout') {
      await member.timeout(3000 * 1000, 'Security Violation (Anti-Spam/Link)');
    }
    if (action.includes('kick') || action === 'kick') {
      if (member.kickable) await member.kick('Security Violation');
    }
    if (action.includes('ban') || action === 'ban') {
      if (member.bannable) await member.ban({ reason: 'Security Violation' });
    }
  } catch (e) {
    console.error('Punishment error:', e);
  }
}

client.on('guildMemberAdd', async member => {
  const guildId = member.guild.id;
  const config = serverConfigs[guildId];
  if (!config) return;

  if (config.autoroleEnabled && config.autoroleId) {
    try {
      const role = await member.guild.roles.fetch(config.autoroleId);
      if (role) await member.roles.add(role);
    } catch (err) { console.error('Autorole error:', err); }
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

    const embed = new EmbedBuilder().setDescription(finalDesc).setColor(embedConfig.color || '#66FFFF');
    if (finalTitle) embed.setTitle(finalTitle);
    if (embedConfig.image) embed.setImage(embedConfig.image);
    if (embedConfig.footerText) {
      embed.setFooter({ text: embedConfig.footerText.replace('{server_membercount}', member.guild.memberCount.toString()) });
    }
    if (embedConfig.timestamp === 'yes') embed.setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (err) { console.error('Welcome send error:', err); }
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
        inviteAction: 'timeout',
        spamAction: 'timeout',
        mrBeastAction: 'timeout',
        selectedChannels: []
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
      autoClear: { enabled: false, time: '06:00', channelId: null }
    };
  }
  const config = serverConfigs[guildId];
  if (!config.security) {
    config.security = { enabled: false, antiLink: true, antiSpam: true, antiMrBeast: true, spamCount: 3, spamSeconds: 6, timeoutSeconds: 3000, inviteAction: 'timeout', spamAction: 'timeout', mrBeastAction: 'timeout', selectedChannels: [] };
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'ping') {
    return await interaction.reply({ content: 'Pong! 🏓 บอททำงานระบบ Slash Command ปกติบน Render ครับ 🚀', ephemeral: true });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'clear') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return await interaction.reply({ content: '❌ คุณไม่มีสิทธิ์จัดการข้อความครับ', ephemeral: true });
    }
    const amount = interaction.options.getInteger('amount');
    await interaction.deferReply({ ephemeral: true });
    try {
      const messages = await interaction.channel.messages.fetch({ limit: amount });
      await interaction.channel.bulkDelete(messages, true);
      await interaction.editReply({ content: `🧹 ลบข้อความจำนวน **${amount}** ข้อความเรียบร้อยแล้ว!` });
    } catch (err) {
      await interaction.editReply({ content: '❌ เกิดข้อผิดพลาด ไม่สามารถลบข้อความเก่าเกิน 14 วันได้ครับ' });
    }
    return;
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'set-security') {
    if (!interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: '❌ คุณต้องเป็น Administrator ถึงจะใช้งานได้ครับ', ephemeral: true });
    }
    return await sendSecurityDashboard(interaction);
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'sec_toggle_main') {
      config.security.enabled = !config.security.enabled;
      saveConfigs(serverConfigs);
      return await updateSecurityDashboard(interaction);
    }
    if (interaction.customId === 'sec_toggle_link') {
      config.security.antiLink = !config.security.antiLink;
      saveConfigs(serverConfigs);
      return await updateSecurityDashboard(interaction);
    }
    if (interaction.customId === 'sec_toggle_spam') {
      config.security.antiSpam = !config.security.antiSpam;
      saveConfigs(serverConfigs);
      return await updateSecurityDashboard(interaction);
    }
    if (interaction.customId === 'sec_toggle_mrbeast') {
      config.security.antiMrBeast = !config.security.antiMrBeast;
      saveConfigs(serverConfigs);
      return await updateSecurityDashboard(interaction);
    }
    if (interaction.customId === 'sec_reset') {
      config.security = { enabled: false, antiLink: true, antiSpam: true, antiMrBeast: true, spamCount: 3, spamSeconds: 6, timeoutSeconds: 3000, inviteAction: 'timeout', spamAction: 'timeout', mrBeastAction: 'timeout', selectedChannels: [] };
      saveConfigs(serverConfigs);
      return await updateSecurityDashboard(interaction);
    }
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'sec_action_select') {
      const val = interaction.values[0];
      // อัปเดต action ทั้งหมดตามที่เลือกจากเมนู
      config.security.inviteAction = val;
      config.security.spamAction = val;
      config.security.mrBeastAction = val;
      saveConfigs(serverConfigs);
      return await interaction.update(getSecurityDashboardContent(config));
    }
  }
});

function getSecurityDashboardContent(config) {
  const sec = config.security;
  
  // แปลงรายชื่อห้องที่เลือกให้แสดงผลเป็นแท็กช่อง
  let channelTags = 'ทุกห้องในเซิร์ฟเวอร์';
  if (sec.selectedChannels && sec.selectedChannels.length > 0) {
    channelTags = sec.selectedChannels.map(id => `<#${id}>`).join(', ');
  }

  const embed = new EmbedBuilder()
    .setTitle('🛡️ แผงควบคุมระบบป้องกัน (Security Dashboard)')
    .setDescription('ตั้งค่าระบบป้องกันสแปม ลิงก์เชิญ และระบบกลั่นกรองความปลอดภัยขั้นสูง')
    .setColor('#66FFFF')
    .addFields(
      { name: 'สถานะระบบหลัก', value: sec.enabled ? '🟢 เปิดอยู่' : '🔴 ปิดอยู่', inline: true },
      { name: 'ลบลิงก์เชิญ', value: sec.antiLink ? 'เปิด' : 'ปิด', inline: true },
      { name: 'ลบข้อความสแปม', value: sec.antiSpam ? 'เปิด' : 'ปิด', inline: true },
      { name: 'ลบสแปม MrBeast', value: sec.antiMrBeast ? 'เปิด' : 'ปิด', inline: true },
      { name: 'สแปมตั้งค่า', value: `${sec.spamCount} ข้อความ / ${sec.spamSeconds} วินาที`, inline: true },
      { name: 'ระงับผู้ใช้ (Timeout)', value: `${sec.timeoutSeconds} วินาที`, inline: true },
      { name: 'Action ลงโทษ', value: `Invite: **${sec.inviteAction}**\nSpam: **${sec.spamAction}**`, inline: false },
      { name: 'ห้องที่เลือกดูแล', value: channelTags, inline: false }
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sec_toggle_main').setLabel(sec.enabled ? 'ปิดระบบ' : 'เปิดระบบ').setStyle(sec.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('sec_toggle_link').setLabel(`ลิงก์เชิญ: ${sec.antiLink ? 'เปิด' : 'ปิด'}`).setStyle(sec.antiLink ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sec_toggle_spam').setLabel(`สแปม: ${sec.antiSpam ? 'เปิด' : 'ปิด'}`).setStyle(sec.antiSpam ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sec_toggle_mrbeast').setLabel(`MrBeast: ${sec.antiMrBeast ? 'เปิด' : 'ปิด'}`).setStyle(sec.antiMrBeast ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('sec_action_select')
      .setPlaceholder('⚙️ เลือก Action ลงโทษ (Timeout / Kick / Ban)')
      .addOptions([
        { label: 'Timeout 3000s', value: 'timeout', description: 'ระงับการพิมพ์ชั่วคราว' },
        { label: 'Timeout + Kick', value: 'timeout+kick', description: 'ระงับแล้วเตะออกจากเซิร์ฟเวอร์' },
        { label: 'Ban', value: 'ban', description: 'แบนถาวรทันที' }
      ])
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sec_reset').setLabel('รีเซ็ตทั้งหมด').setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [row1, row2, row3] };
}

async function sendSecurityDashboard(interaction) {
  const codeConfig = serverConfigs[interaction.guildId];
  const content = getSecurityDashboardContent(codeConfig);
  await interaction.reply({ ...content, ephemeral: true });
}

async function updateSecurityDashboard(interaction) {
  const codeConfig = serverConfigs[interaction.guildId];
  const content = getSecurityDashboardContent(codeConfig);
  await interaction.update({ ...content });
}

client.login(process.env.DISCORD_TOKEN);
