const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder } = require('discord.js');
const http = require('http');
const fs = require('fs');
const cron = require('node-cron');
const { getSecurityDashboardContent, handleSecurityMessage } = require('./security');

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
    new SlashCommandBuilder().setName('set-security').setDescription('เปิดแผงควบคุมระบบป้องกันความปลอดภัยขั้นสูง'),
    new SlashCommandBuilder().setName('clear').setDescription('ลบข้อความในแชทจำนวน 1-100 ข้อความ').addIntegerOption(o => o.setName('amount').setDescription('จำนวน 1-100').setRequired(true)),
    new SlashCommandBuilder().setName('set-autoclear').setDescription('ตั้งเวลาระบบลบข้อความอัตโนมัติ')
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

// เรียกใช้ฟังก์ชันตรวจสอบข้อความจาก security.js
client.on('messageCreate', async message => {
  const config = serverConfigs[message.guild?.id];
  handleSecurityMessage(message, config, spamTracker);
});

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
      image: '', footerText: '', footerIcon: '', timestamp: 'no'
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
  } catch (err) { console.error(err); }
});

client.on('interactionCreate', async interaction => {
  const guildId = interaction.guildId;
  if (!guildId) return;

  if (!serverConfigs[guildId]) {
    serverConfigs[guildId] = {
      welcomeEnabled: false, channelId: null,
      security: {
        enabled: false, antiLink: true, antiSpam: true, antiMrBeast: true,
        spamCount: 3, spamSeconds: 6, timeoutSeconds: 3000,
        actions: { invite: { timeout: true, kick: true, ban: false }, spam: { timeout: true, kick: true, ban: false }, mrbeast: { timeout: true, kick: true, ban: false } },
        ignoredChannels: []
      },
      embed: { title: '', description: '**𑣲⋆ 𝙉𝙀𝙒 𝙈𝙚𝙢𝙗𝙚𝙧!** ✨\n🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}** ครับ!', color: '#66FFFF', image: '', footerText: '', footerIcon: '', timestamp: 'no' },
      autoClear: { enabled: false, time: '06:00', channelId: null }
    };
  }
  const config = serverConfigs[guildId];
  if (!config.security) {
    config.security = {
      enabled: false, antiLink: true, antiSpam: true, antiMrBeast: true,
      spamCount: 3, spamSeconds: 6, timeoutSeconds: 3000,
      actions: { invite: { timeout: true, kick: true, ban: false }, spam: { timeout: true, kick: true, ban: false }, mrbeast: { timeout: true, kick: true, ban: false } },
      ignoredChannels: []
    };
  }

  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'ping') return await interaction.reply({ content: 'Pong! 🏓 บอททำงานปกติ', ephemeral: true });
    if (interaction.commandName === 'set-security') {
      if (!interaction.member.permissions.has('Administrator')) return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
      return await interaction.reply({ ...getSecurityDashboardContent(config), ephemeral: true });
    }
    if (interaction.commandName === 'set-welcom') {
      if (!interaction.member.permissions.has('Administrator')) return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
      return await interaction.reply({ ...getDashboardContent(config), ephemeral: true });
    }
    if (interaction.commandName === 'clear') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) return await interaction.reply({ content: '❌ ไม่มีสิทธิ์', ephemeral: true });
      const amount = interaction.options.getInteger('amount');
      await interaction.deferReply({ ephemeral: true });
      try {
        const messages = await interaction.channel.messages.fetch({ limit: amount });
        await interaction.channel.bulkDelete(messages, true);
        await interaction.editReply({ content: `🧹 ลบข้อความ ${amount} ข้อความแล้ว!` });
      } catch (err) { await interaction.editReply({ content: '❌ ไม่สามารถลบข้อความเก่าเกิน 14 วันได้' }); }
      return;
    }
  }

  if (interaction.isButton()) {
    const id = interaction.customId;
    if (id === 'toggle_welcome') config.welcomeEnabled = !config.welcomeEnabled;
    else if (id === 'sec_toggle_main') config.security.enabled = !config.security.enabled;
    else if (id === 'sec_toggle_link') config.security.antiLink = !config.security.antiLink;
    else if (id === 'sec_toggle_spam') config.security.antiSpam = !config.security.antiSpam;
    else if (id === 'sec_toggle_mrbeast') config.security.antiMrBeast = !config.security.antiMrBeast;
    else if (id === 'sec_config_time') {
      const modal = new ModalBuilder().setCustomId('secTimeModal').setTitle('ตั้งค่าเวลาและเกณฑ์สแปม');
      const countInput = new TextInputBuilder().setCustomId('spamCount').setLabel('จำนวนข้อความ (เช่น 3)').setStyle(TextInputStyle.Short).setValue(config.security.spamCount.toString()).setRequired(true);
      const secInput = new TextInputBuilder().setCustomId('spamSec').setLabel('ภายในกี่วินาที (เช่น 6)').setStyle(TextInputStyle.Short).setValue(config.security.spamSeconds.toString()).setRequired(true);
      const timeoutInput = new TextInputBuilder().setCustomId('timeoutSec').setLabel('ระงับผู้ใช้กี่วินาที (เช่น 3000)').setStyle(TextInputStyle.Short).setValue(config.security.timeoutSeconds.toString()).setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(countInput), new ActionRowBuilder().addComponents(secInput), new ActionRowBuilder().addComponents(timeoutInput));
      return await interaction.showModal(modal);
    } else if (id === 'sec_reset') {
      config.security = {
        enabled: false, antiLink: true, antiSpam: true, antiMrBeast: true,
        spamCount: 3, spamSeconds: 6, timeoutSeconds: 3000,
        actions: { invite: { timeout: true, kick: true, ban: false }, spam: { timeout: true, kick: true, ban: false }, mrbeast: { timeout: true, kick: true, ban: false } },
        ignoredChannels: []
      };
    }

    saveConfigs(serverConfigs);
    if (id === 'toggle_welcome') return await interaction.update(getDashboardContent(config));
    if (id.startsWith('sec_')) return await interaction.update(getSecurityDashboardContent(config));
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'act_invite_select') {
      const vals = interaction.values;
      config.security.actions.invite.timeout = vals.includes('timeout');
      config.security.actions.invite.kick = vals.includes('kick');
      config.security.actions.invite.ban = vals.includes('ban');
      saveConfigs(serverConfigs);
      return await interaction.update(getSecurityDashboardContent(config));
    }
    if (interaction.customId === 'act_spam_select') {
      const vals = interaction.values;
      config.security.actions.spam.timeout = vals.includes('timeout');
      config.security.actions.spam.kick = vals.includes('kick');
      config.security.actions.spam.ban = vals.includes('ban');
      saveConfigs(serverConfigs);
      return await interaction.update(getSecurityDashboardContent(config));
    }
  }

  if (interaction.isChannelSelectMenu() && interaction.customId === 'sec_select_ignored') {
    await interaction.deferUpdate();
    config.security.ignoredChannels = interaction.values;
    saveConfigs(serverConfigs);
    return await interaction.editReply(getSecurityDashboardContent(config));
  }

  if (interaction.isModalSubmit() && interaction.customId === 'secTimeModal') {
    const c = parseInt(interaction.fields.getTextInputValue('spamCount'));
    const s = parseInt(interaction.fields.getTextInputValue('spamSec'));
    const t = parseInt(interaction.fields.getTextInputValue('timeoutSec'));

    if (!isNaN(c)) config.security.spamCount = c;
    if (!isNaN(s)) config.security.spamSeconds = s;
    if (!isNaN(t)) config.security.timeoutSeconds = t;
    saveConfigs(serverConfigs);

    return await interaction.reply({ content: '✅ บันทึกค่าเวลาเรียบร้อยแล้ว!', ephemeral: true });
  }
});

function getDashboardContent(config) {
  const channelName = config.channelId ? `<#${config.channelId}>` : 'ยังไม่ได้เลือกช่อง';
  const statusText = config.welcomeEnabled ? '✅ เปิดอยู่' : '❌ ปิดอยู่';
  const embed = new EmbedBuilder().setTitle('⚙️ ตั้งค่าระบบ Welcome').setDescription('เลือกช่อง เปิด/ปิดระบบ').setColor('#5865F2').addFields({ name: 'Status', value: statusText, inline: true });
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('toggle_welcome').setLabel(config.welcomeEnabled ? 'ปิด Welcome' : 'เปิด Welcome').setStyle(config.welcomeEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
  );
  return { embeds: [embed], components: [row1] };
}

client.login(process.env.DISCORD_TOKEN);
