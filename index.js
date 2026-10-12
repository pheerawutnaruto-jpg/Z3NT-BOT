const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder, ChannelType } = require('discord.js');
const http = require('http');
const fs = require('fs');

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

client.once('ready', async () => {
  console.log(`Bot Online แล้วจ้า: ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName('ping')
      .setDescription('เช็กความเร็วและสถานะของบอท'),
    new SlashCommandBuilder()
      .setName('set-welcom')
      .setDescription('เปิดแผงควบคุมระบบต้อนรับ (Welcome Dashboard)'),
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
      color: '#66FFFF'
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
      .setColor(embedColor)
      .setTimestamp();

    if (finalTitle) {
      embed.setTitle(finalTitle);
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
      embed: {
        title: '',
        description: '**𑣲⋆ 𝙉𝙀𝙒 𝙈𝙚𝙢𝙗𝙚𝙧!** ✨\n🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}** ครับ!',
        color: '#66FFFF'
      }
    };
  }
  const config = serverConfigs[guildId];

  if (interaction.isChatInputCommand() && interaction.commandName === 'ping') {
    return await interaction.reply({ content: 'Pong! 🏓 บอททำงานระบบ Slash Command ปกติบน Render ครับ 🚀', ephemeral: true });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'set-welcom') {
    if (!interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: '❌ คุณต้องเป็น Administrator ถึงจะใช้งานได้ครับ', ephemeral: true });
    }
    return await sendDashboard(interaction);
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'toggle_welcome') {
      config.welcomeEnabled = !config.welcomeEnabled;
      saveConfigs(serverConfigs);
      return await updateDashboard(interaction);
    }
    
    if (interaction.customId === 'test_welcome') {
      if (!config.channelId) {
        return await interaction.reply({ content: '❌ กรุณาเลือกช่อง (Channel) สำหรับส่งข้อความต้อนรับก่อนกดทดสอบครับ!', ephemeral: true });
      }

      await interaction.reply({ content: `🔄 กำลังส่งข้อความทดสอบไปที่ห้อง <#${config.channelId}>...`, ephemeral: true });

      try {
        const channel = await interaction.guild.channels.fetch(config.channelId);
        if (channel) {
          const embedConfig = config.embed;
          const finalTitle = embedConfig.title ? embedConfig.title
            .replace('{user}', interaction.user.username)
            .replace('{server}', interaction.guild.name) : null;
          const finalDesc = embedConfig.description
            .replace('{user}', `${interaction.user}`)
            .replace('{server}', interaction.guild.name);

          let embedColor = '#66FFFF';
          try {
            embedColor = embedConfig.color;
          } catch (e) {
            embedColor = '#66FFFF';
          }

          const embed = new EmbedBuilder()
            .setDescription(finalDesc)
            .setColor(embedColor)
            .setTimestamp();

          if (finalTitle) {
            embed.setTitle(finalTitle);
          }
          
          await channel.send({ embeds: [embed] });
        }
      } catch (err) {
        console.error('Test welcome send error:', err);
      }
      return;
    }

    if (interaction.customId === 'edit_embed') {
      const modal = new ModalBuilder()
        .setCustomId('editEmbedModal')
        .setTitle('Editing: welcome embed');

      const titleInput = new TextInputBuilder()
        .setCustomId('embedTitle')
        .setLabel('Title (เว้นว่างได้)')
        .setStyle(TextInputStyle.Short)
        .setValue(config.embed.title || '')
        .setRequired(false);

      const descInput = new TextInputBuilder()
        .setCustomId('embedDesc')
        .setLabel('Description')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(config.embed.description)
        .setRequired(true);

      const colorInput = new TextInputBuilder()
        .setCustomId('embedColor')
        .setLabel('Hex Color (เช่น 66FFFF)')
        .setStyle(TextInputStyle.Short)
        .setValue(config.embed.color || '#66FFFF')
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descInput),
        new ActionRowBuilder().addComponents(colorInput),
      );

      return await interaction.showModal(modal);
    }
  }

  if (interaction.isChannelSelectMenu() && interaction.customId === 'select_channel') {
    await interaction.deferUpdate();
    config.channelId = interaction.values[0];
    saveConfigs(serverConfigs);
    return await updateDashboardAfterDefer(interaction);
  }

  if (interaction.isModalSubmit() && interaction.customId === 'editEmbedModal') {
    config.embed.title = interaction.fields.getTextInputValue('embedTitle');
    config.embed.description = interaction.fields.getTextInputValue('embedDesc');
    let colorVal = interaction.fields.getTextInputValue('embedColor').trim();
    if (!colorVal.startsWith('#')) colorVal = '#' + colorVal;
    
    if (colorVal.length === 4) {
      colorVal = '#' + colorVal[1] + colorVal[1] + colorVal[2] + colorVal[2] + colorVal[3] + colorVal[3];
    }
    
    config.embed.color = colorVal;
    saveConfigs(serverConfigs);

    return await interaction.reply({ content: '✅ บันทึกรูปแบบ Embed เรียบร้อยแล้ว!', ephemeral
                                    
