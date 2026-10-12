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

// ตัวเก็บค่าการตั้งค่าต้อนรับแบบ Embed (ค่าเริ่มต้น)
let welcomeConfig = {
  title: '**✨· NEW Member!·✨**',
  description: '🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}** ครับ! ขอให้สนุกนะคร้าบ 🚀',
  color: '#2f636'
};

// 2. ลงทะเบียนคำสั่ง Slash Commands
client.once('ready', async () => {
  console.log(`Bot Online แล้วจ้า: ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName('ping')
      .setDescription('เช็กความเร็วและสถานะของบอท'),
    new SlashCommandBuilder()
      .setName('setwelcome')
      .setDescription('เปิดฟอร์มตั้งค่าข้อความต้อนรับแบบ Embed'),
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

// 3. ระบบต้อนรับสมาชิกใหม่ (ส่งเป็นกล่อง Embed สวยๆ)
client.on('guildMemberAdd', member => {
  const channel = member.guild.systemsChannel || member.guild.channels.cache.find(ch => ch.type === 0 && ch.permissionsFor(member.guild.members.me).has('SendMessages'));
  if (!channel) return;

  // แทนที่ค่า {user} และ {server}
  const finalTitle = welcomeConfig.title
    .replace('{user}', member.user.username)
    .replace('{server}', member.guild.name);
    
  const finalDesc = welcomeConfig.description
    .replace('{user}', `${member}`)
    .replace('{server}', member.guild.name);

  // สร้างกล่อง Embed ตามที่ตั้งค่าไว้
  const embed = new EmbedBuilder()
    .setTitle(finalTitle)
    .setDescription(finalDesc)
    .setColor(welcomeConfig.color || '#2f636')
    .setTimestamp();

  channel.send({ embeds: [embed] });
});

// 4. จัดการคำสั่งและ Modal Form
client.on('interactionCreate', async interaction => {
  // เมื่อกดใช้คำสั่ง /setwelcome ให้เด้ง Modal ขึ้นมา
  if (interaction.isChatInputCommand() && interaction.commandName === 'setwelcome') {
    if (!interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้งานคำสั่งนี้ (ต้องเป็น Administrator เท่านั้น)', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId('welcomeModal')
      .setTitle('Editing: welcome');

    const titleInput = new TextInputBuilder()
      .setCustomId('welcomeTitle')
      .setLabel('Title')
      .setStyle(TextInputStyle.Short)
      .setValue(welcomeConfig.title)
      .setRequired(true);

    const descInput = new TextInputBuilder()
      .setCustomId('welcomeDesc')
      .setLabel('Description')
      .setStyle(TextInputStyle.Paragraph)
      .setValue(welcomeConfig.description)
      .setRequired(true);

    const colorInput = new TextInputBuilder()
      .setCustomId('welcomeColor')
      .setLabel('Hex Color (เช่น #2f636)')
      .setStyle(TextInputStyle.Short)
      .setValue(welcomeConfig.color)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(descInput),
      new ActionRowBuilder().addComponents(colorInput),
    );

    await interaction.showModal(modal);
  }

  // เมื่อผู้ใช้กด Submit ข้อมูลจาก Modal
  if (interaction.isModalSubmit() && interaction.customId === 'welcomeModal') {
    const newTitle = interaction.fields.getTextInputValue('welcomeTitle');
    const newDesc = interaction.fields.getTextInputValue('welcomeDesc');
    const newColor = interaction.fields.getTextInputValue('welcomeColor');

    // บันทึกค่าใหม่
    welcomeConfig.title = newTitle;
    welcomeConfig.description = newDesc;
    welcomeConfig.color = newColor;

    await interaction.reply({ content: '✅ บันทึกการตั้งค่าข้อความต้อนรับแบบ Embed เรียบร้อยแล้วจ้า! ✨', ephemeral: true });
  }

  // คำสั่ง /ping ปกติ
  if (interaction.isChatInputCommand() && interaction.commandName === 'ping') {
    await interaction.reply('Pong! 🏓 บอททำงานระบบ Slash Command ปกติบน Render ครับ 🚀');
  }
});

client.login(process.env.DISCORD_TOKEN);
