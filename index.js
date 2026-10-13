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

client.on('messageCreate', async message => {
  if (!message.guild || message.author.bot) return;

  const guildId = message.guild.id;
  const config = serverConfigs[guildId];
  if (!config || !config.security || !config.security.enabled) return;

  if (config.security.ignoredChannels && config.security.ignoredChannels.includes(message.channel.id)) {
    return;
  }

  if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return;
  const sec = config.security;

  if (sec.antiLink) {
    const linkRegex = /(https?:\/\/[^\s]+)/gi;
    if (linkRegex.test(message.content)) {
      try {
        await message.delete();
        await executeActions(message.member, sec.actions?.invite, sec.timeoutSeconds || 3000);
        const warning = await message.channel.send(`⚠️ <@${message.author.id}> ตรวจพบลิงก์ห้ามส่งในห้องนี้!`);
        setTimeout(() => warning.delete().catch(() => {}), 4000);
        return;
      } catch (err) { console.error(err); }
    }
  }

  if (sec.antiMrBeast) {
    const scamKeywords = ['mrbeast', 'free nitro', 'claim free', 'nitro generator'];
    const contentLower = message.content.toLowerCase();
    if (scamKeywords.some(kw => contentLower.includes(kw))) {
      try {
        await message.delete();
        await executeActions(message.member, sec.actions?.mrbeast, sec.timeoutSeconds || 3000);
        const warning = await message.channel.send(`⚠️ <@${message.author.id}> ตรวจพบสแปมอันตราย (MrBeast/Scam)!`);
        setTimeout(() => warning.delete().catch(() => {}), 4000);
        return;
      } catch (err) { console.error(err); }
    }
  }

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
          await executeActions(message.member, sec.actions?.spam, sec.timeoutSeconds || 3000);
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

async function executeActions(member, actionConfig, timeoutSec) {
  if (!member || !actionConfig) return;
  try {
    if (actionConfig.timeout) {
      await member.timeout(timeoutSec * 1000, 'Security Violation').catch(() => {});
    }
    if (actionConfig.kick) {
      if (member.kickable) await member.kick('Security Violation').catch(() => {});
    }
    if (actionConfig.ban) {
      if (member.bannable) await member.ban({ reason: 'Security Violation' }).catch(() => {});
    }
  } catch (e) { console.error('Execution error:', e); }
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
        actions: {
          invite: { timeout: true, kick: true, ban: false },
          spam: { timeout: true, kick: true, ban: false },
          mrbeast: { timeout: true, kick: true, ban: false }
        },
        ignoredChannels: []
      },
      embed: { title: '', description: '', color: '#66FFFF', image: '', footerText: '', footerIcon: '', timestamp: 'no' },
      autoClear: { enabled: false, time: '06:00', channelId: null }
    };
  }
  const config = serverConfigs[guildId];
  if (!config.security.actions) {
    config.security.actions = {
      invite: { timeout: true, kick: true, ban: false },
      spam: { timeout: true, kick: true, ban: false },
      mrbeast: { timeout: true, kick: true, ban: false }
    };
  }

  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'ping') return await interaction.reply({ content: 'Pong! 🏓 บอททำงานปกติ', ephemeral: true });
    if (interaction.commandName === 'set-security') {
      if (!interaction.member.permissions.has('Administrator')) return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
      return await sendSecurityDashboard(interaction);
    }
  }

  if (interaction.isButton()) {
    const id = interaction.customId;
    if (id === 'sec_toggle_main') config.security.enabled = !config.security.enabled;
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
        actions: {
          invite: { timeout: true, kick: true, ban: false },
          spam: { timeout: true, kick: true, ban: false },
          mrbeast: { timeout: true, kick: true, ban: false }
        },
        ignoredChannels: []
      };
    }

    saveConfigs(serverConfigs);
    return await updateSecurityDashboard(interaction);
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'act_invite_select') {
      const vals = interaction.values;
      config.security.actions.invite.timeout = vals.includes('timeout');
      config.security.actions.invite.kick = vals.includes('kick');
      config.security.actions.invite.ban = vals.includes('ban');
      saveConfigs(serverConfigs);
      return await updateSecurityDashboard(interaction);
    }
    if (interaction.customId === 'act_spam_select') {
      const vals = interaction.values;
      config.security.actions.spam.timeout = vals.includes('timeout');
      config.security.actions.spam.kick = vals.includes('kick');
      config.security.actions.spam.ban = vals.includes('ban');
      saveConfigs(serverConfigs);
      return await updateSecurityDashboard(interaction);
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

function getSecurityDashboardContent(config) {
  const sec = config.security;
  let ignoredTags = 'ไม่มีห้องยกเว้น (ดูแลทุกห้อง)';
  if (sec.ignoredChannels && sec.ignoredChannels.length > 0) {
    ignoredTags = sec.ignoredChannels.map(id => `<#${id}>`).join(', ');
  }

  const act = sec.actions;
  const formatAct = (a) => `[${a.timeout ? '✓' : '✗'} Timeout] [${a.kick ? '✓' : '✗'} Kick] [${a.ban ? '✓' : '✗'} Ban]`;

  const embed = new EmbedBuilder()
    .setTitle('⚙️ ตั้งค่าระบบกันสแปมและความปลอดภัย')
    .setDescription('จัดการระบบป้องกันภัยคุกคาม กำหนดบทลงโทษผ่านดรอปดาวน์ และเลือกห้องยกเว้นได้จากด้านล่าง')
    .setColor('#66FFFF')
    .addFields(
      { name: 'สถานะ', value: sec.enabled ? 'เปิด' : 'ปิด', inline: true },
      { name: 'ลบลิงก์เชิญ', value: sec.antiLink ? 'เปิด' : 'ปิด', inline: true },
      { name: 'ลบข้อความสแปม', value: sec.antiSpam ? 'เปิด' : 'ปิด', inline: true },
      { name: 'ลบสแปม MrBeast', value: sec.antiMrBeast ? 'เปิด' : 'ปิด', inline: true },
      { name: 'สแปม', value: `${sec.spamCount} ข้อความ / ${sec.spamSeconds} วินาที`, inline: true },
      { name: 'ระงับผู้ใช้', value: `${sec.timeoutSeconds} วินาที`, inline: true },
      { name: 'Invite Actions', value: formatAct(act.invite), inline: false },
      { name: 'Spam Actions', value: formatAct(act.spam), inline: false },
      { name: 'ห้องยกเว้น (ไม่ต้องดูแล)', value: ignoredTags, inline: false }
    );

  // แถวที่ 1: เปิด/ปิดระบบหลัก + ลิงก์ + สแปม
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sec_toggle_main').setLabel(sec.enabled ? 'เปิดระบบ' : 'ปิดระบบ').setStyle(sec.enabled ? ButtonStyle.Success : ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('sec_toggle_link').setLabel(`ลิงก์: ${sec.antiLink ? 'เปิด' : 'ปิด'}`).setStyle(sec.antiLink ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sec_toggle_spam').setLabel(`สแปม: ${sec.antiSpam ? 'เปิด' : 'ปิด'}`).setStyle(sec.antiSpam ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );

  // แถวที่ 2: MrBeast + ปุ่มตั้งเวลา (สั้นกระชับ) + รีเซ็ตทั้งหมด
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sec_toggle_mrbeast').setLabel(`MrBeast: ${sec.antiMrBeast ? 'เปิด' : 'ปิด'}`).setStyle(sec.antiMrBeast ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sec_config_time').setLabel('ตั้งเวลา').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('sec_reset').setLabel('รีเซ็ตทั้งหมด').setStyle(ButtonStyle.Danger)
  );

  // แถวที่ 3: ดรอปดาวน์เลือก Action สำหรับ Invite Link
  const rowInviteSelect = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('act_invite_select')
      .setPlaceholder('⚙️ เลือก Action สำหรับ Invite Link (เลือกหลายอันได้)')
      .setMinValues(0)
      .setMaxValues(3)
      .addOptions([
        { label: 'Timeout (ระงับการพิมพ์)', value: 'timeout' },
        { label: 'Kick (เตะออกจากเซิร์ฟเวอร์)', value: 'kick' },
        { label: 'Ban (แบนถาวร)', value: 'ban' }
      ])
  );

  // แถวที่ 4: ดรอปดาวน์เลือก Action สำหรับ Spam
  const rowSpamSelect = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('act_spam_select')
      .setPlaceholder('⚙️ เลือก Action สำหรับ Spam (เลือกหลายอันได้)')
      .setMinValues(0)
      .setMaxValues(3)
      .addOptions([
        { label: 'Timeout (ระงับการพิมพ์)', value: 'timeout' },
        { label: 'Kick (เตะออกจากเซิร์ฟเวอร์)', value: 'kick' },
        { label: 'Ban (แบนถาวร)', value: 'ban' }
      ])
  );

  // แถวที่ 5: เลือกห้องยกเว้นที่ไม่ต้องดูแล
  const rowChannel = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('sec_select_ignored')
      .setPlaceholder('📂 เลือกห้องที่ไม่ต้องดูแล (ห้องยกเว้น)')
      .setMinValues(0)
      .setMaxValues(5)
      .addChannelTypes(ChannelType.GuildText)
  );

  return { embeds: [embed], components: [row1, row2, rowInviteSelect, rowSpamSelect, rowChannel] };
}

async function sendSecurityDashboard(interaction) {
  const codeConfig = serverConfigs[interaction.guildId];
  await interaction.reply({ ...getSecurityDashboardContent(codeConfig), ephemeral: true });
}

async function updateSecurityDashboard(interaction) {
  const codeConfig = serverConfigs[interaction.guildId];
  await interaction.update(getSecurityDashboardContent(codeConfig));
}

client.login(process.env.DISCORD_TOKEN);
