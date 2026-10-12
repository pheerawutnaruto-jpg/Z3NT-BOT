const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const http = require('http');

// 1. สร้างเว็บเซิร์ฟเวอร์จำลองเพื่อให้ Render มองเห็น Port
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running!\n');
});
server.listen(process.env.PORT || 3000);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// เก็บข้อมูล Embed ที่สร้าง/แก้ไขล่าสุด และเก็บบันทึกสถานะว่าเปิดใช้งานต้อนรับหรือยัง
let customEmbedConfig = {
  title: '**✨· NEW Member!·✨**',
  description: '🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}** ครับ! ขอให้สนุกนะคร้าบ 🚀',
  color: '#2f636'
};

let welcomeSettings = {
  enabled: true, // เปิดใช้งานระบบต้อนรับอัตโนมัติ
  channelId: null // ถ้าไม่ระบุ จะส่งไปที่ System Channel หรือห้องแรกที่ส่งได้
};

// 2. ลงทะเบียนคำสั่ง Slash Commands
client.once('ready', async () => {
  console.log(`Bot Online แล้วจ้า: ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName('ping')
      .setDescription('เช็กความเร็วและสถานะของบอท'),
    new SlashCommandBuilder()
      .setName('embed')
      .setDescription('เปิดฟอร์มแก้ไขหน้าตา Embed สำหรับต้อนรับ'),
    new SlashCommandBuilder()
      .setName('setwelcome')
      .setDescription('ตั้งค่าเปิดใช้งานระบบต้อนรับด้วย Embed ล่าสุดที่แก้ไขไว้')
      .addChannelOption(option =>
        option.setName('channel')
          .setDescription('เลือกห้องสำหรับส่งข้อความต้อนรับ')
          .setRequired(false)
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
});

// 3. ระบบต้อนรับสมาชิกใหม่
client.on('guildMemberAdd', member => {
  if (!welcomeSettings.enabled) return;

  // เลือกห้องเป้าหมาย
  const channel = welcomeSettings.channelId 
    ? member.guild.channels.cache.get(welcomeSettings.channelId)
    : (member.guild.systemsChannel || member.guild.channels.cache.find(ch => ch.type === 0 && ch.permissionsFor(member.guild.members.me).has('SendMessages')));
  
  if (!channel) return;

  // แทนที่ค่าตัวแปร
  const finalTitle = customEmbedConfig.title
    .replace('{user}', member.user.username)
    .replace('{server}', member.guild.name);
    
  const finalDesc = customEmbedConfig.description
    .replace('{user}', `${member}`)
    .replace('{server}`, member.guild.name);

  const embed = new EmbedBuilder()
    .setTitle(finalTitle)
    .setDescription(finalDesc)
    .setColor(customEmbedConfig.color || '#2f636')
    .setTimestamp();

  channel.send({ embeds: [embed] });
});

// 4. จัดการคำสั่งและ Modal Form
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() && !interaction.isModalSubmit()) return;

  // คำสั่ง /embed (เปิดฟอร์มแก้ไขหน้าตา)
  if (interaction.isChatInputCommand() && interaction.commandName === 'embed') {
    if (!interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้งานคำสั่งนี้ (ต้องเป็น Administrator เท่านั้น)', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId('editEmbedModal')
      .setTitle('Editing: welcome embed');

    const titleInput = new TextInputBuilder()
      .setCustomId('embedTitle')
      .setLabel('Title')
      .setStyle(TextInputStyle.Short)
      .setValue(customEmbedConfig.title)
      .setRequired(true);

    const descInput = new TextInputBuilder()
      .setCustomId('embedDesc')
      .setLabel('Description')
      .setStyle(TextInputStyle.Paragraph)
      .setValue(customEmbedConfig.description)
      .setRequired(true);

    const colorInput = new TextInputBuilder()
      .setCustomId('embedColor')
      .setLabel('Hex Color (เช่น #2f636)')
      .setStyle(TextInputStyle.Short)
      .setValue(customEmbedConfig.color)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(descInput),
      new ActionRowBuilder().addComponents(colorInput),
    );

    await interaction.showModal(modal);
  }

  // กด Submit จากฟอร์มแก้ไข Embed
  if (interaction.isModalSubmit() && interaction.customId === 'editEmbedModal') {
    customEmbedConfig.title = interaction.fields.getTextInputValue('embedTitle');
    customEmbedConfig.description = interaction.fields.getTextInputValue('embedDesc');
    customEmbedConfig.color = interaction.fields.getTextInputValue('embedColor');

    // แสดงตัวอย่าง Embed ที่เพิ่งแก้ให้ดูทันทีแบบส่วนตัว (Ephemeral)
    const previewEmbed = new EmbedBuilder()
      .setTitle(customEmbedConfig.title)
      .setDescription(customEmbedConfig.description.replace('{user}', '@User').replace('{server}', interaction.guild.name))
      .setColor(customEmbedConfig.color);

    await interaction.reply({ 
      content: '✨ **บันทึกการแก้ไข Embed สำเร็จ!** นี่คือตัวอย่างหน้าตาที่จะใช้ต้อนรับ:', 
      embeds: [previewEmbed], 
      ephemeral: true 
    });
  }

  // คำสั่ง /setwelcome (เปิดใช้งานและผูกห้องต้อนรับ)
  if (interaction.isChatInputCommand() && interaction.commandName === 'setwelcome') {
    if (!interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้งานคำสั่งนี้ (ต้องเป็น Administrator เท่านั้น)', ephemeral: true });
    }

    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    welcomeSettings.enabled = true;
    welcomeSettings.channelId = targetChannel.id;

    await interaction.reply(`✅ **ตั้งค่าระบบต้อนรับสำเร็จ!**\n📌 บอทจะส่ง Embed ที่คุณตั้งค่าไว้ไปที่ห้อง ${targetChannel} ทุกครั้งที่มีสมาชิกใหม่เข้าเซิร์ฟเวอร์ครับ! 🚀`);
  }

  // คำสั่ง /ping
  if (interaction.isChatInputCommand() && interaction.commandName === 'ping') {
    await interaction.reply('Pong! 🏓 บอททำงานระบบ Slash Command ปกติบน Render ครับ 🚀');
  }
});

client.login(process.env.DISCORD_TOKEN);
