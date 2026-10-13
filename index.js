const { Client, GatewayIntentBits, REST, Routes, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const http = require('http');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

// สร้าง HTTP Server สำหรับให้ Render รันรอด (Keep Alive)
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is online and running smoothly!\n');
});

server.listen(process.env.PORT || 3000, () => {
  console.log('HTTP Server is listening...');
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();
const CONFIG_FILE = path.join(__dirname, 'config.json');
let activeCronJobs = {};
const spamTracker = new Map();

function loadConfigs() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      if (data.trim() !== '') return JSON.parse(data);
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

// โหลดคำสั่งจากโฟลเดอร์ commands อัตโนมัติ
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      console.log(`Loaded command: ${command.data.name}`);
    }
  }
}

// ฟังก์ชันตั้งเวลา Auto-Clear
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
client.setupCronJob = setupCronJob;

client.once('ready', async () => {
  console.log(`Bot Online แล้วจ้า: ${client.user.tag}`);

  const commandsData = client.commands.map(cmd => cmd.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commandsData },
    );
    console.log('ลงทะเบียน Slash Commands สำเร็จเรียบร้อย!');
  } catch (error) {
    console.error(error);
  }

  // เปิดใช้งาน Cron Job ที่ตั้งค่าไว้เดิม
  for (const guildId in serverConfigs) {
    const config = serverConfigs[guildId];
    if (config && config.autoClear && config.autoClear.enabled && config.autoClear.time && config.autoClear.channelId) {
      setupCronJob(guildId, config.autoClear.time, config.autoClear.channelId);
    }
  }
});

// ระบบต้อนรับสมาชิกใหม่ (Welcome Event)
client.on('guildMemberAdd', async member => {
  const guildId = member.guild.id;
  serverConfigs = loadConfigs();
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

// ระบบป้องกัน Anti-Spam & Links
client.on('messageCreate', async message => {
  if (!message.guild || message.author.bot) return;
  if (message.member.permissions.has('ManageMessages')) return;

  const guildId = message.guild.id;
  serverConfigs = loadConfigs();
  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].security) return;

  const security = serverConfigs[guildId].security;
  if (!security.enabled) return;

  if (security.selectedChannels && security.selectedChannels.length > 0 && !security.selectedChannels.includes(message.channel.id)) {
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

// จัดการ Interaction (Slash Commands, Buttons, Select Menus, Modals)
client.on('interactionCreate', async interaction => {
  const guildId = interaction.guildId;
  serverConfigs = loadConfigs();
  if (guildId && !serverConfigs[guildId]) serverConfigs[guildId] = {};
  const config = serverConfigs[guildId];

  // 1. จัดการคำสั่ง Slash Commands
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, client);
    } catch (error) {
      console.error(error);
      const replyPayload = { content: 'เกิดข้อผิดพลาดในการรันคำสั่งนี้!', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(replyPayload);
      } else {
        await interaction.reply(replyPayload);
      }
    }
    return;
  }

  // 2. จัดการปุ่ม Anti-Spam Panel (`sec_`)
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
    const antispamCmd = client.commands.get('antispam-panel');
    if (antispamCmd) {
      const updatedContent = antispamCmd.getAntiSpamDashboardContent(config.security);
      return await interaction.update(updatedContent);
    }
  }

  // 3. จัดการปุ่ม Welcome Dashboard
  if (interaction.isButton() && interaction.customId === 'toggle_welcome') {
    config.welcomeEnabled = !config.welcomeEnabled;
    saveConfigs(serverConfigs);
    const welcomeCmd = client.commands.get('set-welcom');
    if (welcomeCmd) return await interaction.update(welcomeCmd.getDashboardConfig(config));
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

  // 4. จัดการเมนูเลือกช่อง Welcome
  if (interaction.isChannelSelectMenu() && interaction.customId === 'select_channel') {
    await interaction.deferUpdate();
    config.channelId = interaction.values[0];
    saveConfigs(serverConfigs);
    const welcomeCmd = client.commands.get('set-welcom');
    if (welcomeCmd) return await interaction.editReply(welcomeCmd.getDashboardConfig(config));
  }

  // 5. จัดการบันทึก Modal แต่ง Embed
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

client.login(process.env.DISCORD_TOKEN);
