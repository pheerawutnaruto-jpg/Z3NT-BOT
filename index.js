const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
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

// ตัวแปรสำหรับเก็บข้อความต้อนรับ (เริ่มต้นเป็นข้อความนี้)
let welcomeMessage = '🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}** ครับ! ขอให้สนุกนะคร้าบ 🚀';

// 2. ลงทะเบียนคำสั่ง Slash Commands ทั้งหมด
client.once('ready', async () => {
  console.log(`Bot Online แล้วจ้า: ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName('ping')
      .setDescription('เช็กความเร็วและสถานะของบอท'),
    new SlashCommandBuilder()
      .setName('setwelcome')
      .setDescription('ตั้งค่าข้อความต้อนรับสมาชิกใหม่')
      .addStringOption(option =>
        option.setName('message')
          .setDescription('ข้อความต้อนรับ (ใช้ {user} แทนชื่อสมาชิก, {server} แทนชื่อเซิร์ฟเวอร์)')
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
});

// 3. ระบบต้อนรับสมาชิกใหม่ (ดึงข้อความจากตัวแปรที่ตั้งไว้)
client.on('guildMemberAdd', member => {
  const channel = member.guild.systemsChannel || member.guild.channels.cache.find(ch => ch.type === 0 && ch.permissionsFor(member.guild.members.me).has('SendMessages'));
  if (!channel) return;

  // แทนที่ค่า {user} และ {server} เป็นข้อมูลจริง
  const finalMessage = welcomeMessage
    .replace('{user}', `${member}`)
    .replace('{server}', member.guild.name);

  channel.send(finalMessage);
});

// 4. จัดการคำสั่ง Slash Commands ต่างๆ
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // คำสั่ง /ping
  if (interaction.commandName === 'ping') {
    await interaction.reply('Pong! 🏓 บอททำงานระบบ Slash Command ปกติบน Render ครับ 🚀');
  }

  // คำสั่ง /setwelcome สำหรับเปลี่ยนข้อความ
  if (interaction.commandName === 'setwelcome') {
    // เช็กว่าผู้ใช้มีสิทธิ์ Administrator หรือไม่ (เพื่อความปลอดภัย)
    if (!interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้งานคำสั่งนี้ (ต้องเป็น Administrator เท่านั้น)', ephemeral: true });
    }

    const newMessage = interaction.options.getString('message');
    welcomeMessage = newMessage; // อัปเดตข้อความใหม่ทันที

    await interaction.reply(`✅ เปลี่ยนข้อความต้อนรับเรียบร้อยแล้ว!\n📝 **ข้อความใหม่:** ${newMessage}`);
  }
});

client.login(process.env.DISCORD_TOKEN);
