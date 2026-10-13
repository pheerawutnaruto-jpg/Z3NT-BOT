const { Client, GatewayIntentBits, REST, Routes, Collection, EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const http = require('http');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running!\n');
});
httpServer.listen(process.env.PORT || 3000);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

const commandsArray = [];
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    commandsArray.push(command.data.toJSON());
  }
}

const CONFIG_FILE = './config.json';

function loadConfigs() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      if (data.trim() !== '') return JSON.parse(data);
    }
  } catch (e) { console.error(e); }
  return {};
}

function saveConfigs(configs) {
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2)); } catch (e) { console.error(e); }
}

let serverConfigs = loadConfigs();
let activeCronJobs = {};

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

client.once('ready', async () => {
  console.log(`Bot Online แล้วจ้า: ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commandsArray });
    console.log('ลงทะเบียนคำสั่งสำเร็จเรียบร้อย!');
  } catch (error) { console.error(error); }

  for (const guildId in serverConfigs) {
    const config = serverConfigs[guildId];
    if (config && config.autoClear && config.autoClear.enabled && config.autoClear.time && config.autoClear.channelId) {
      setupCronJob(guildId, config.autoClear.time, config.autoClear.channelId);
    }
  }
});

client.on('guildMemberAdd', async member => {
  const guildId = member.guild.id;
  const config = serverConfigs[guildId];
  if (!config || !config.welcomeEnabled || !config.channelId) return;

  try {
    const channel = await member.guild.channels.fetch(config.channelId);
    if (!channel) return;

    const embedConfig = config.embed || {};
    const finalDesc = embedConfig.description.replace('{user}', `${member}`).replace('{server}', member.guild.name);
    const embed = new EmbedBuilder().setDescription(finalDesc).setColor(embedConfig.color || '#66FFFF');

    if (embedConfig.title) embed.setTitle(embedConfig.title.replace('{user}', member.user.username).replace('{server}', member.guild.name));
    if (embedConfig.image) embed.setImage(embedConfig.image.trim());

    await channel.send({ embeds: [embed] });
  } catch (err) { console.error(err); }
});

client.on('interactionCreate', async interaction => {
  const guildId = interaction.guildId;
  if (!guildId) return;

  if (!serverConfigs[guildId]) {
    serverConfigs[guildId] = {
      welcomeEnabled: false, channelId: null,
      embed: { title: '', description: '**𑣲⋆ 𝙉𝙀𝙒 𝙈𝙚𝙢𝙗𝙚𝙧!** ✨\n🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}** ครับ!', color: '#66FFFF', image: '' },
      autoClear: { enabled: false, time: '06:00', channelId: null }
    };
  }
  const config = serverConfigs[guildId];

  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      if (interaction.commandName === 'set-autoclear') {
        await command.execute(interaction, client, serverConfigs, saveConfigs, setupCronJob);
      } else if (interaction.commandName === 'set-welcom') {
        await command.execute(interaction, client, serverConfigs);
      } else {
        await command.execute(interaction);
      }
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'เกิดข้อผิดพลาดในการรันคำสั่งนี้!', ephemeral: true });
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'toggle_welcome') {
      config.welcomeEnabled = !config.welcomeEnabled;
      saveConfigs(serverConfigs);
      return updateDashboard(interaction, config);
    }
    if (interaction.customId === 'test_welcome') {
      if (!config.channelId) return interaction.reply({ content: '❌ กรุณาเลือกช่องสำหรับส่งข้อความต้อนรับก่อน!', ephemeral: true });
      await interaction.reply({ content: `🔄 กำลังส่งข้อความทดสอบ...`, ephemeral: true });
      try {
        const channel = await interaction.guild.channels.fetch(config.channelId);
        const embedConfig = config.embed;
        const embed = new EmbedBuilder()
          .setDescription(embedConfig.description.replace('{user}', `${interaction.user}`).replace('{server}', interaction.guild.name))
          .setColor(embedConfig.color);
        if (embedConfig.title) embed.setTitle(embedConfig.title.replace('{user}', interaction.user.username).replace('{server}', interaction.guild.name));
        if (embedConfig.image) embed.setImage(embedConfig.image.trim());
        await channel.send({ embeds: [embed] });
      } catch (err) { console.error(err); }
      return;
    }
    if (interaction.customId === 'edit_embed') {
      const modal = new ModalBuilder().setCustomId('editEmbedModal').setTitle('Editing: welcome embed');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embedTitle').setLabel('Title (เว้นว่างได้)').setStyle(TextInputStyle.Short).setValue(config.embed.title || '').setRequired(false)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embedDesc').setLabel('Description').setStyle(TextInputStyle.Paragraph).setValue(config.embed.description || '').setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embedColor').setLabel('Hex Color').setStyle(TextInputStyle.Short).setValue(config.embed.color || '#66FFFF').setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embedImage').setLabel('Image URL').setStyle(TextInputStyle.Short).setValue(config.embed.image || '').setRequired(false))
      );
      return await interaction.showModal(modal);
    }
  }

  if (interaction.isChannelSelectMenu() && interaction.customId === 'select_channel') {
    await interaction.deferUpdate();
    config.channelId = interaction.values[0];
    saveConfigs(serverConfigs);
    return updateDashboardAfterDefer(interaction, config);
  }

  if (interaction.isModalSubmit() && interaction.customId === 'editEmbedModal') {
    config.embed.title = interaction.fields.getTextInputValue('embedTitle');
    config.embed.description = interaction.fields.getTextInputValue('embedDesc');
    let colorVal = interaction.fields.getTextInputValue('embedColor').trim();
    if (!colorVal.startsWith('#')) colorVal = '#' + colorVal;
    config.embed.color = colorVal;
    config.embed.image = interaction.fields.getTextInputValue('embedImage');
    saveConfigs(serverConfigs);
    return await interaction.reply({ content: '✅ บันทึกรูปแบบ Embed เรียบร้อยแล้ว!', ephemeral: true });
  }
});

function getDashboardContent(config) {
  const channelName = config.channelId ? `<#${config.channelId}>` : 'ยังไม่ได้เลือกช่อง';
  const statusText = config.welcomeEnabled ? '✅ เปิดอยู่' : '❌ ปิดอยู่';
  const embed = new EmbedBuilder().setTitle('⚙️ ตั้งค่าระบบ Welcome').setDescription('เลือกช่อง เปิด/ปิดระบบ และตั้งค่ารูป Embed').setColor('#5865F2')
    .addFields({ name: '📥 Status', value: statusText, inline: true }, { name: '📢 ห้องต้อนรับ', value: channelName, inline: true });
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('toggle_welcome').setLabel(config.welcomeEnabled ? 'ปิด Welcome' : 'เปิด Welcome').setStyle(config.welcomeEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('edit_embed').setLabel('ตั้งค่ารูป Embed').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('test_welcome').setLabel('ทดสอบ Welcome').setStyle(ButtonStyle.Secondary)
  );
  const { ChannelSelectMenuBuilder, ChannelType } = require('discord.js');
  const channelRow = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('select_channel').setPlaceholder('📂 เลือกช่องต้อนรับ').addChannelTypes(ChannelType.GuildText));
  return { embeds: [embed], components: [row1, channelRow] };
}

async function updateDashboard(interaction, config) {
  await interaction.update(getDashboardContent(config));
}

async function updateDashboardAfterDefer(interaction, config) {
  await interaction.editReply(getDashboardContent(config));
}

client.login(process.env.DISCORD_TOKEN);
