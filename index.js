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
  const cronExpression = `${parts[1]} ${parts[0]} * * *`;

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
      .replace('{server}', member.guild.name);

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

  if (security.selectedChannels.length > 0 && !security.selectedChannels.includes(message.channel.id)) {
    return;
  }

  const content = message.content;

  if (security.inviteLink && (content.includes('discord.gg/') || content.includes('https://') || content.includes('http://'))) {
    try {
      await message.delete();
      const warning = await message.channel.send(`⚠️ <@${message.author.id}> ห้ามส่งลิงก์ในห้องนี้!`);
      setTimeout(() => warning.delete().catch(() => {}), 4000);
      return;
    } catch (err) {
      console.error(err);
    }
  }

  if (security.mrBeastSpam && (content.toLowerCase().includes('mrbeast') || content.toLowerCase().includes('free nitro'))) {
    try {
      await message.delete();
      const warning = await message.channel.send(`⚠️ <@${message.author.id}> ตรวจพบข้อความสแปมต้องสงสัย (MrBeast)!`);
      setTimeout(() => warning.delete().catch(() => {}), 4000);
      return;
    } catch (err) {
      console.error(err);
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
    const amount = interaction.options.getInteger('amount');
    await interaction.deferReply({ ephemeral: true });
    try {
      const messages = await interaction.channel.messages.fetch({ limit: amount });
      await interaction.channel.bulkDelete(messages, true);
      await interaction.editReply({ content: `🧹 ลบข้อความจำนวน ${amount} ข้อความเรียบร้อย` });
    } catch (err) {
      await interaction.editReply({ content: '❌ ลบข้อความไม่สำเร็จ' });
    }
    return;
  }

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

    return await interaction.reply({ content: `✅ ตั้งค่า Auto-Clear เวลา ${timeInput} น. เรียบร้อย`, ephemeral: true });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'set-welcom') {
    if (!interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: '❌ สำหรับ Administrator เท่านั้น', ephemeral: true });
    }
    return await sendDashboard(interaction);
  }

  if (interaction.isButton() && interaction.customId.startsWith('sec_')) {
    if (!config.security) {
      config.security = {
        enabled: true, inviteLink: true, messageSpam: true, mrBeastSpam: true,
        spamLimit: 3, spamSeconds: 6, timeoutSeconds: 3000, cooldown: 1,
        inviteAction: 'Timeout 3000s + Kick', spamAction: 'Timeout 3000s + Kick', mrBeastAction: 'Timeout 3000s + Kick',
        selectedChannels: []
      };
    }
    const sec = config.security;

    if (interaction.customId === 'sec_toggle') sec.enabled = !sec.enabled;
    else if (interaction.customId === 'sec_invite') sec.inviteLink = !sec.inviteLink;
    else if (interaction.customId === 'sec_spam') sec.messageSpam = !sec.messageSpam;
    else if (interaction.customId === 'sec_mrbeast') sec.mrBeastSpam = !sec.mrBeastSpam;
    else if (interaction.customId === 'sec_action_timeout') {
      sec.inviteAction = sec.spamAction = sec.mrBeastAction = 'Timeout 3000s';
    }
    else if (interaction.customId === 'sec_action_kick') {
      sec.inviteAction = sec.spamAction = sec.mrBeastAction = 'Kick';
    }
    else if (interaction.customId === 'sec_reset') {
      config.security = {
        enabled: true, inviteLink: true, messageSpam: true, mrBeastSpam: true,
        spamLimit: 3, spamSeconds: 6, timeoutSeconds: 3000, cooldown: 1,
        inviteAction: 'Timeout 3000s + Kick', spamAction: 'Timeout 3000s + Kick', mrBeastAction: 'Timeout 3000s + Kick',
        selectedChannels: []
      };
    }

    saveConfigs(serverConfigs);
    return await updateAntiSpamDashboard(interaction);
  }

  if (interaction.isButton() && interaction.customId === 'toggle_welcome') {
    config.welcomeEnabled = !config.welcomeEnabled;
    saveConfigs(serverConfigs);
    return await updateDashboard(interaction);
  }
  if (interaction.isButton() && interaction.customId === 'test_welcome') {
    if (!config.channelId) return await interaction.reply({ content: '❌ กรุณาเลือกช่องต้อนรับก่อน', ephemeral: true });
    await interaction.reply({ content: '🔄 กำลังส่งข้อความทดสอบ...', ephemeral: true });
    try {
      const channel = await interaction.guild.channels.fetch(config.channelId);
      if (channel) {
        const embedConfig = config.embed || {};
        const embed = new EmbedBuilder()
          .setDescription((embedConfig.description || '').replace('{user}', `${interaction.user}`).replace('{server}', interaction.guild.name))
          .setColor(embedConfig.color || '#66FFFF');
        if (embedConfig.title) embed.setTitle(embedConfig.title);
        if (embedConfig.image) embed.setImage(embedConfig.image);
        await channel.send({ embeds: [embed] });
      }
    } catch (err) { console.error(err); }
    return;
  }
  if (interaction.isButton() && interaction.customId === 'edit_embed') {
    const modal = new ModalBuilder().setCustomId('editEmbedModal').setTitle('Editing: welcome embed');
    const titleInput = new TextInputBuilder().setCustomId('embedTitle').setLabel('Title').setStyle(TextInputStyle.Short).setValue(config.embed?.title || '').setRequired(false);
    const descInput = new TextInputBuilder().setCustomId('embedDesc').setLabel('Description').setStyle(TextInputStyle.Paragraph).setValue(config.embed?.description || '').setRequired(true);
    const colorInput = new TextInputBuilder().setCustomId('embedColor').setLabel('Hex Color').setStyle(TextInputStyle.Short).setValue(config.embed?.color || '#66FFFF').setRequired(true);
    const imageInput = new TextInputBuilder().setCustomId('embedImage').setLabel('Image URL').setStyle(TextInputStyle.Short).setValue(config.embed?.image || '').setRequired(false);
    modal.addComponents(new ActionRowBuilder().addComponents(titleInput), new ActionRowBuilder().addComponents(descInput), new ActionRowBuilder().addComponents(colorInput), new ActionRowBuilder().addComponents(imageInput));
    return await interaction.showModal(modal);
  }
  if (interaction.isChannelSelectMenu() && interaction.customId === 'select_channel') {
    await interaction.deferUpdate();
    config.channelId = interaction.values[0];
    saveConfigs(serverConfigs);
    return await updateDashboardAfterDefer(interaction);
  }
  if (interaction.isModalSubmit() && interaction.customId === 'editEmbedModal') {
    if (!config.embed) config.embed = {};
    config.embed.title = interaction.fields.getTextInputValue('embedTitle');
    config.embed.description = interaction.fields.getTextInputValue('embedDesc');
    config.embed.color = interaction.fields.getTextInputValue('embedColor');
    config.embed.image = interaction.fields.getTextInputValue('embedImage');
    saveConfigs(serverConfigs);
    return await interaction.reply({ content: '✅ บันทึกเรียบร้อย', ephemeral: true });
  }
});

function getAntiSpamDashboardContent(sec) {
  const statusText = sec.enabled ? 'เปิด' : 'ปิด';
  const inviteText = sec.inviteLink ? 'เปิด' : 'ปิด';
  const spamText = sec.messageSpam ? 'เปิด' : 'ปิด';
  const mrBeastText = sec.mrBeastSpam ? 'เปิด' : 'ปิด';
  
  const channelsList = sec.selectedChannels.length > 0 
    ? sec.selectedChannels.map(id => `<#${id}>`).join(' ') 
    : 'ทุกห้อง';

  const desc = `ตั้งค่าระบบกันสแปม\nสถานะ: **${statusText}**\nลบลิงก์เชิญ: **${inviteText}**\nลบข้อความสแปม: **${spamText}**\nลบสแปม MrBeast: **${mrBeastText}**\nสแปม: **${sec.spamLimit} ข้อความ / ${sec.spamSeconds} วินาที**\nระงับผู้ใช้: **${sec.timeoutSeconds} วินาที**\nคูลดาวน์ลงโทษซ้ำ: **${sec.cooldown} วินาที**\nInvite action: **${sec.inviteAction}**\nSpam action: **${sec.spamAction}**\nMrBeast action: **${sec.mrBeastAction}**\nห้องที่เลือก: ${channelsList}`;

  const embed = new EmbedBuilder()
    .setTitle('🛡️ แผงควบคุมระบบป้องกันความปลอดภัย')
    .setDescription(desc)
    .setColor('#00FF99');

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sec_toggle').setLabel(sec.enabled ? 'ปิดระบบ' : 'เปิดระบบ').setStyle(sec.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('sec_invite').setLabel(`ลิงก์เชิญ: ${inviteText}`).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sec_spam').setLabel(`สแปม: ${spamText}`).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sec_mrbeast').setLabel(`MrBeast: ${mrBeastText}`).setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sec_action_timeout').setLabel('Timeout').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('sec_action_kick').setLabel('Kick').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sec_reset').setLabel('รีเซ็ตทั้งหมด').setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [row1, row2] };
}

async function sendAntiSpamDashboard(interaction) {
  const sec = serverConfigs[interaction.guildId].security;
  const content = getAntiSpamDashboardContent(sec);
  await interaction.reply({ ...content, ephemeral: true });
}

async function updateAntiSpamDashboard(interaction) {
  const sec = serverConfigs[interaction.guildId].security;
  const content = getAntiSpamDashboardContent(sec);
  await interaction.update({ ...content });
}

function getDashboardConfig(config) {
  const channelName = config.channelId ? `<#${config.channelId}>` : 'ยังไม่ได้เลือกช่อง';
  const statusText = config.welcomeEnabled ? '✅ เปิดอยู่' : '❌ ปิดอยู่';
  const embed = new EmbedBuilder().setTitle('⚙️ ตั้งค่าระบบ Welcome').addFields({ name: '📥 Status', value: statusText, inline: true }, { name: '📢 ห้อง', value: channelName, inline: true });
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('toggle_welcome').setLabel(config.welcomeEnabled ? 'ปิด Welcome' : 'เปิด Welcome').setStyle(config.welcomeEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('edit_embed').setLabel('ตั้งค่า Embed').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('test_welcome').setLabel('ทดสอบ').setStyle(ButtonStyle.Secondary)
  );
  const channelRow = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('select_channel').setPlaceholder('📂 เลือกช่องต้อนรับ').addChannelTypes(ChannelType.GuildText));
  return { embeds: [embed], components: [row1, channelRow] };
}

async function sendDashboard(interaction) {
  const config = serverConfigs[interaction.guildId];
  await interaction.reply({ ...getDashboardConfig(config), ephemeral: true });
}

async function updateDashboard(interaction) {
  const config = serverConfigs[interaction.guildId];
  await interaction.update({ ...getDashboardConfig(config) });
}

async function updateDashboardAfterDefer(interaction) {
  const config = serverConfigs[interaction.guildId];
  await interaction.editReply({ ...getDashboardConfig(config) });
}

client.login(process.env.DISCORD_TOKEN);
