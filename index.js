const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const http = require('http');

// 1. สร้างเว็บเซิร์ฟเวอร์จำลองเพื่อให้ Render มองเห็น Port (ห้ามลบส่วนนี้)
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running!\n');
});
server.listen(process.env.PORT || 3000);

// 2. สร้าง Client ของบอท
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// 3. ลงทะเบียนคำสั่ง Slash Command (/ping) อัตโนมัติเมื่อบอทออนไลน์
client.once('ready', async () => {
  console.log(`Bot Online แล้วจ้า: ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName('ping')
      .setDescription('เช็กความเร็วและสถานะของบอท'),
  ].map(command => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log('กำลังลงทะเบียนคำสั่ง Slash Commands...');
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands },
    );
    console.log('ลงทะเบียนคำสั่งสำเร็จเรียบร้อย!');
  } catch (error) {
    console.error(error);
  }
});

// 4. รอรับการใช้งานคำสั่ง /ping จากผู้ใช้
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ping') {
    await interaction.reply('Pong! 🏓 บอททำงานระบบ Slash Command ปกติบน Render ครับ 🚀');
  }
});

// 5. ล็อกอินเข้าสู่ระบบ Discord
client.login(process.env.DISCORD_TOKEN);
