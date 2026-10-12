const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const http = require('http');

// 1. สร้างเว็บเซิร์ฟเวอร์จำลองเพื่อให้ Render มองเห็น Port
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running!\n');
});
server.listen(process.env.PORT || 3000);

// 2. เพิ่ม Intent สำหรับตรวจจับสมาชิกใหม่เข้าเซิร์ฟเวอร์ (GuildMembers)
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// 3. ลงทะเบียนคำสั่ง Slash Command
client.once('ready', async () => {
  console.log(`Bot Online แล้วจ้า: ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName('ping')
      .setDescription('เช็กความเร็วและสถานะของบอท'),
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

// 4. ระบบต้อนรับสมาชิกใหม่เข้าเซิร์ฟเวอร์
client.on('guildMemberAdd', member => {
  // ค้นหาห้องชื่อ "ทั่วไป" หรือห้องแรกที่บอทพิมพ์ได้ในเซิร์ฟเวอร์
  const channel = member.guild.systemsChannel || member.guild.channels.cache.find(ch => ch.type === 0 && ch.permissionsFor(member.guild.members.me).has('SendMessages'));
  
  if (!channel) return;

  // ส่งข้อความต้อนรับพร้อมแท็กสมาชิกใหม่
  channel.send(`🎉 ยินดีต้อนรับคุณ ${member} สู่เซิร์ฟเวอร์ **${member.guild.name}** ครับ! ขอให้สนุกนะคร้าบ 🚀`);
});

// 5. ระบบรับคำสั่ง /ping
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ping') {
    await interaction.reply('Pong! 🏓 บอททำงานระบบ Slash Command ปกติบน Render ครับ 🚀');
  }
});

client.login(process.env.DISCORD_TOKEN);
