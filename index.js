const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
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
      if (data.trim() !== '') return JSON.parse(data);
    }
  } catch (e) { console.error('Error loading config:', e); }
  return {};
}

function saveConfigs(configs) {
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2)); }
  catch (e) { console.error('Error saving config:', e); }
}

let serverConfigs = loadConfigs();
let activeCronJobs = {};
const spamTracker = new Map();

client.once('ready', async () => {
  console.log(`Bot Online แล้วจ้า: ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder().setName('ping').setDescription('เช็กความเร็วและสถานะของบอท'),
    new SlashCommandBuilder().setName('set-welcom').setDescription('เปิดแผงควบคุมระบบต้อนรับ'),
    new SlashCommandBuilder().setName('set-autorole').setDescription('ตั้งค่าระบบแจกยศอัตโนมัติ'),
    new SlashCommandBuilder().setName('set-security').setDescription('เปิดแผงควบคุมระบบป้องกันความปลอดภัยขั้นสูง'),
    new SlashCommandBuilder().setName('clear').setDescription('ลบข้อความ').addIntegerOption(o => o.setName('amount').setDescription('จำนวน 1-100').setRequired(true)),
    new SlashCommandBuilder().setName('set-autoclear').setDescription('ตั้งเวลาลบข้อความ')
      .addStringOption(o => o.setName('time').setDescription('HH:MM').setRequired(true))
      .addChannelOption(o => o.setName('channel').setDescription('ห้อง').addChannelTypes(ChannelType.GuildText).setRequired(true)),
  ].map(c => c.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('ลงทะเบียนคำสั่งสำเร็จ!');
  } catch (error) { console.error(error); }

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

  activeCronJobs[guildId] = cron.schedule(`${minute} ${hour} * * *`, async () => {
    try {
      const guild = await client.guilds.fetch(guildId);
      if (!guild) return;
      const channel = await guild.channels.fetch(channelId);
      if (channel && channel.isTextBased()) {
        const fetched = await channel.messages.fetch({ limit: 100 });
        await channel.bulkDelete(fetched, true);
      }
    } catch (err) { console.error(err); }
  }, { timezone: "Asia/Bangkok" });
}

// ระบบป้องกันข้อความ (Anti-Spam / Anti-Link / Anti-MrBeast)
client.on('messageCreate', async message => {
  if (!message.guild || message.author.bot) return;

  const guildId = message.guild.id;
  const config = serverConfigs[guildId];
  if (!config || !config.security || !config.security.enabled) return;

  // ตรวจสอบห้องที่บล็อก (ถ้ามีการเลือกห้องเฉพาะ)
  if (config.security.selectedChannels && config.security.selectedChannels.length > 0) {
    if (!config.security.selectedChannels.includes(message.channel.id)) return;
  }

  if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return;
  const sec = config.security;

  // 1. Anti-Link (ลิงก์เชิญ / ลิงก์ทั่วไป)
  if (sec.antiLink) {
    const linkRegex = /(https?:\/\/[^\s]+)/gi;
    if (linkRegex.test(message.content)) {
      try {
        await message.delete();
        await applyPunishment(message.member, sec.inviteAction || 'timeout', sec.timeoutSeconds || 3000);
        const warning = await message.channel.send(`⚠️ <@${message.author.id}> ตรวจพบลิงก์ห้ามส่งในห้องนี้!`);
        setTimeout(() => warning.delete().catch(() => {}), 4000);
        return;
      } catch (err) { console.error(err); }
    }
  }

  // 2. Anti-MrBeast / Scam
  if (sec.antiMrBeast) {
    const scamKeywords = ['mrbeast', 'free nitro', 'claim free', 'nitro generator'];
    const contentLower = message.content.toLowerCase();
    if (scamKeywords.some(kw => contentLower.includes(kw))) {
      try {
        await message.delete();
        await applyPunishment(message.member, sec.mrBeastAction || 'timeout', sec.timeoutSeconds || 3000);
        const warning = await message.channel.send(`⚠️ <@${message.author.id}> ตรวจพบสแปมอันตราย (MrBeast/Scam)!`);
        setTimeout(() => warning.delete().catch(() => {}), 4000);
        return;
      } catch (err) { console.error(err); }
    }
  }

  // 3. Anti-Spam (ข้อความ / วินาที)
  if (sec.antiSpam) {
    const userId = message.author.id;
    const now = Date.now();
    const limitSec = sec.spamSeconds || 6;
    const maxMsg = sec.spamCount || 3;

    let userSpam = spamTracker.get(userId) || { count: 0, startTime: now };
    if (now - userSpam.startTime < limitSec * 1000) {
      userSpam.count++;
      if (userSpam.count > maxMsg) {
        try {
          await message.delete();
          await applyPunishment(message.member, sec.spamAction || 'timeout', sec.timeoutSeconds || 3000);
          const warning = await message.channel.send(`⚠️ <@${userId}> ส่งข้อความเร็วเกินกำหนด (Anti-Spam)`);
          setTimeout(() => warning.delete().catch(() => {}), 4000);
          spamTracker.set(userId, { count: 0, startTime: now });
          return;
        } catch (err) { console.error(err); }
      }
    } else {
      userSpam.count = 1;
      userSpam.startTime = now;
    }
    spamTracker.set(userId, userSpam);
  }
});

async function applyPunishment(member, action, timeoutSec) {
  if (!member) return;
  try {
    if (action === 'timeout') {
      await member.timeout(timeoutSec * 1000, 'Security Violation');
    } else if (action === 'kick') {
      if (member.kickable) await member.kick('Security Violation');
    } else if (action === 'ban') {
      if (member.bannable) await member.ban({ reason: 'Security Violation' });
    } else if (action === 'timeout+kick') {
      await member.timeout(timeoutSec * 1000, 'Security Violation');
      setTimeout(async () => { if (member.kickable) await member.kick('Security Violation'); }, 3000);
    }
  } catch (e) { console.error('Punishment error:', e); }
}

client.on('interactionCreate', async interaction => {
  const guildId = interaction.guildId;
  if (!guildId) return;

  if (!serverConfigs[guildId]) {
    serverConfigs[guildId] = {
      welcomeEnabled: false, channelId: null, autoroleEnabled: false, autoroleId: null,
      security: {
        enabled: false, antiLink: true, antiSpam: true, antiMrBeast: true,
        spamCount: 3, spamSeconds: 6, timeoutSeconds: 3000,
        inviteAction: 'timeout', spamAction: 'timeout', mrBeastAction: 'timeout',
        selectedChannels: []
      },
      embed: { title: '', description: '', color: '#66FFFF', image: '', footerText: '', footerIcon: '', timestamp: 'no' },
      autoClear: { enabled: false, time: '06:00', channelId: null }
    };
  }
  const config = serverConfigs[guildId];
  if (!config.security) {
    config.security = { enabled: false, antiLink: true, antiSpam: true, antiMrBeast: true, spamCount: 3, spamSeconds: 6, timeoutSeconds: 3000, inviteAction: 'timeout', spamAction: 'timeout', mrBeastAction: 'timeout', selectedChannels: [] };
  }

  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'ping') return await interaction.reply({ content: 'Pong! 🏓 บอททำงานปกติบน Render', ephemeral: true });
    if (interaction.commandName === 'set-security') {
      if (!interaction.member.permissions.has('Administrator')) return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
      return await sendSecurityDashboard(interaction);
    }
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
    if (interaction.customId === 'sec_config_time') {
      // เปิด Modal ตั้งค่าเวลาสแปมและ Timeout
      const modal = new ModalBuilder().setCustomId('secTimeModal').setTitle('ตั้งค่าเวลาและเกณฑ์สแปม');
      const countInput = new TextInputBuilder().setCustomId('spamCount').setLabel('จำนวนข้อความสแปม (เช่น 3)').setStyle(TextInputStyle.Short).setValue(config.security.spamCount.toString()).setRequired(true);
      const secInput = new TextInputBuilder().setCustomId('spamSec').setLabel('ภายในกี่วินาที (เช่น 6)').setStyle(TextInputStyle.Short).setValue(config.security.spamSeconds.toString()).setRequired(true);
      const timeoutInput = new TextInputBuilder().setCustomId('timeoutSec').setLabel('ระงับผู้ใช้กี่วินาที (เช่น 3000)').setStyle(TextInputStyle.Short).setValue(config.security.timeoutSeconds.toString()).setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(countInput), new ActionRowBuilder().addComponents(secInput), new ActionRowBuilder().addComponents(timeoutInput));
      return await interaction.showModal(modal);
    }
    if (interaction.customId === 'sec_reset') {
      config.security = { enabled: false, antiLink: true, antiSpam: true, antiMrBeast: true, spamCount: 3, spamSeconds: 6, timeoutSeconds: 3000, inviteAction: 'timeout', spamAction: 'timeout', mrBeastAction: 'timeout', selectedChannels: [] };
      saveConfigs(serverConfigs);
      return await updateSecurityDashboard(interaction);
    }
  }

  // เลือกห้องที่จะให้บอทดูแล
  if (interaction.isChannelSelectMenu() && interaction.customId === 'sec_select_channels') {
    await interaction.deferUpdate();
    config.security.selectedChannels = interaction.values;
    saveConfigs(serverConfigs);
    return await interaction.editReply(getSecurityDashboardContent(config));
  }

  // เลือก Action ลงโทษ
  if (interaction.isStringSelectMenu() && interaction.customId === 'sec_action_select') {
    const val = interaction.values[0];
    config.security.inviteAction = val;
    config.security.spamAction = val;
    config.security.mrBeastAction = val;
    saveConfigs(serverConfigs);
    return await interaction.update(getSecurityDashboardContent(config));
  }

  // บันทึกค่าจาก Modal ตั้งเวลา
  if (interaction.isModalSubmit() && interaction.customId === 'secTimeModal') {
    const c = parseInt(interaction.fields.getTextInputValue('spamCount'));
    const s = parseInt(interaction.fields.getTextInputValue('spamSec'));
    const t = parseInt(interaction.fields.getTextInputValue('timeoutSec'));

    if (!isNaN(c)) config.security.spamCount = c;
    if (!isNaN(s)) config.security.spamSeconds = s;
    if (!isNaN(t)) config.security.timeoutSeconds = t;
    saveConfigs(serverConfigs);

    return await interaction.reply({ content: '✅ บันทึกค่าเวลาและเกณฑ์การลงโทษเรียบร้อยแล้ว
