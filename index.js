const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder, ChannelType } = require('discord.js');
const http = require('http');
const fs = require('fs');

// 1. สร้างเว็บเซิร์ฟเวอร์จำลองสำหรับ Render
const httpSever = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running!\n');
});
httpSever.listen(process.env.PORT || 3000);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ไฟล์สำหรับบันทึกข้อมูลการตั้งค่า (ป้องกันข้อมูลหายเวลาบอทรีเซ็ต)
const CONFIG_FILE = './config.json';

function loadConfigs() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
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

// 2. ลงทะเบียนคำสั่ง Slash Command
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

// 3. ระบบต้อนรับสมาชิกใหม่
client.on('guildMemberAdd', member => {
  const guildId = member.guild.id;
  const config = serverConfigs[guildId];

  if (!config || !config.welcomeEnabled || !config.channelId) return;

  const channel = member.guild.channels.cache.get(config.channelId);
  if (!channel) return;

  const embedConfig = config.embed || {
    title: '**✨· NEW Member!·✨**',
    description: '🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}** ครับ!',
    color: '#2f636'
  };

  const finalTitle = embedConfig.title
    .replace('{user}', member.user.username)
    .replace('{server}', member.guild.name);
    
  const finalDesc = embedConfig.description
    .replace('{user}', `${member}`)
    .replace('{server}', member.guild.name);

  const embed = new EmbedBuilder()
    .setTitle(finalTitle)
    .setDescription(finalDesc)
    .setColor(embedConfig.color || '#2f636')
    .setTimestamp();

  channel.send({ embeds: [embed] });
});

// 4. จัดการคำสั่งและปุ่มกดต่างๆ
client.on('interactionCreate', async interaction => {
  const guildId = interaction.guildId;
  if (!guildId) return;

  if (!serverConfigs[guildId]) {
    serverConfigs[guildId] = {
      welcomeEnabled: false,
      channelId: null,
      embed: {
        title: '**✨· NEW Member!·✨**',
        description: '🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}** ครับ!',
        color: '#2f636'
      }
    };
  }
  const config = serverConfigs[guildId];

  // คำสั่ง /ping
  if (interaction.isChatInputCommand() && interaction.commandName === 'ping') {
    return await interaction.reply({ content: 'Pong! 🏓 บอททำงานระบบ Slash Command ปกติบน Render ครับ 🚀', ephemeral: true });
  }

  // คำสั่ง /set-welcom
  if (interaction.isChatInputCommand() && interaction.commandName === 'set-welcom') {
    if (!interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: '❌ คุณต้องเป็น Administrator ถึงจะใช้งานได้ครับ', ephemeral: true });
    }
    return await sendDashboard(interaction);
  }

  // กดปุ่มต่างๆ
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
      const channel = interaction.guild.channels.cache.get(config.channelId);
      if (channel) {
        const embedConfig = config.embed;
        const embed = new EmbedBuilder()
          .setTitle(embedConfig.title.replace('{user}', interaction.user.username).replace('{server}', interaction.guild.name))
          .setDescription(embedConfig.description.replace('{user}', `${interaction.user}`).replace('{server}', interaction.guild.name))
          .setColor(embedConfig.color)
          .setTimestamp();
        
        await channel.send({ embeds: [embed] });
        return await interaction.reply({ content: `✅ ส่งข้อความทดสอบไปที่ห้อง <#${config.channelId}> เรียบร้อยแล้วครับ!`, ephemeral: true });
      } else {
        return await interaction.reply({ content: '❌ ไม่พบช่องแชทที่ตั้งค่าไว้ กรุณาเลือกใหม่อีกครั้ง', ephemeral: true });
      }
    }

    if (interaction.customId === 'edit_embed') {
      const modal = new ModalBuilder()
        .setCustomId('editEmbedModal')
        .setTitle('Editing: welcome embed');

      const titleInput = new TextInputBuilder()
        .setCustomId('embedTitle')
        .setLabel('Title')
        .setStyle(TextInputStyle.Short)
        .setValue(config.embed.title)
        .setRequired(true);

      const descInput = new TextInputBuilder()
        .setCustomId('embedDesc')
        .setLabel('Description')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(config.embed.description)
        .setRequired(true);

      const colorInput = new TextInputBuilder()
        .setCustomId('embedColor')
        .setLabel('Hex Color (เช่น #2f636)')
        .setStyle(TextInputStyle.Short)
        .setValue(config.embed.color)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descInput),
        new ActionRowBuilder().addComponents(colorInput),
      );

      return await interaction.showModal(modal);
    }
  }

  // เลือกห้องแชทจากเมนู
  if (interaction.isChannelSelectMenu() && interaction.customId === 'select_channel') {
    await interaction.deferUpdate(); // ป้องกันขึ้นแถบแดง Time out
    config.channelId = interaction.values[0];
    saveConfigs(serverConfigs);
    return await updateDashboardAfterDefer(interaction);
  }

  // บันทึก Modal
  if (interaction.isModalSubmit() && interaction.customId === 'editEmbedModal') {
    config.embed.title = interaction.fields.getTextInputValue('embedTitle');
    config.embed.description = interaction.fields.getTextInputValue('embedDesc');
    config.embed.color = interaction.fields.getTextInputValue('embedColor');
    saveConfigs(serverConfigs);

    return await interaction.reply({ content: '✅ บันทึกรูปแบบ Embed เรียบร้อยแล้ว!', ephemeral: true });
  }
});

// ฟังก์ชันสร้างหน้าตาแผงควบคุม
function getDashboardContent(config) {
  const channelName = config.channelId ? `<#${config.channelId}>` : 'ยังไม่ได้เลือกช่อง';
  const statusText = config.welcomeEnabled ? '✅ เปิดอยู่' : '❌ ปิดอยู่';

  const embed = new EmbedBuilder()
    .setTitle('⚙️ ตั้งค่าระบบ Welcome')
    .setDescription('เลือกช่อง เปิด/ปิดระบบ และตั้งค่ารูป Embed ได้จากปุ่มด้านล่าง')
    .setColor('#5865F2')
    .addFields(
      { name: '📥 Welcome Status', value: statusText, inline: true },
      { name: '📢 ห้องต้อนรับ', value: channelName, inline: true }
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('toggle_welcome')
      .setLabel(config.welcomeEnabled ? 'ปิด Welcome' : 'เปิด Welcome')
      .setStyle(config.welcomeEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('edit_embed')
      .setLabel('ตั้งค่ารูป Embed')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('test_welcome')
      .setLabel('ทดสอบ Welcome')
      .setStyle(ButtonStyle.Secondary)
  );

  const channelRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('select_channel')
      .setPlaceholder('📂 เลือกช่องสำหรับส่งข้อความต้อนรับ')
      .addChannelTypes(ChannelType.GuildText)
  );

  return { embeds: [embed], components: [row1, channelRow] };
}

async function sendDashboard(interaction) {
  const config = serverConfigs[interaction.guildId];
  const content = getDashboardContent(config);
  await interaction.reply({ ...content, ephemeral: true });
}

async function updateDashboard(interaction) {
  const config = serverConfigs[interaction.guildId];
  const content = getDashboardContent(config);
  await interaction.update({ ...content });
}

async function updateDashboardAfterDefer(interaction) {
  const config = serverConfigs[interaction.guildId];
  const content = getDashboardContent(config);
  await interaction.editReply({ ...content });
}

client.login(process.env.DISCORD_TOKEN);
