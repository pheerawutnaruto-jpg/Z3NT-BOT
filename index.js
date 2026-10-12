const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
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

// 2. ระบบต้อนรับสมาชิกใหม่แบบกล่อง Embed สุดสวย
client.on('guildMemberAdd', member => {
  // ค้นหาห้องชื่อ "welcome" หรือห้องทั่วไป
  const channel = member.guild.channels.cache.find(ch => ch.name.includes('welcome') || ch.name.includes('ทั่วไป')) || member.guild.systemsChannel;
  
  if (!channel) return;

  // สร้างกล่องข้อความ Embed
  const welcomeEmbed = new EmbedBuilder()
    .setColor(0x5865F2) // สีแถบด้านข้าง (สีฟ้า/ม่วงสไตล์ดิสคอร์ด)
    .setTitle('💖 NEW Member! ✨')
    .setDescription(`「 🎉 ยินดีต้อนรับคุณ ${member} !\nรบกวนทำตามขั้นตอนด้านล่างนี้ก่อนไปสนุกกันนะรับ 」\n\nปล. ⚠️ | เมื่อกดรับยศเสร็จแล้วห้องพูดคุยจะปลดล็อกขึ้นมาให้ทันทีครับ !\n\n📜 | อ่านกฎที่นี่ # 📋 │ rules`)
    .setImage('https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExM2Q3djZmdTh5M25pd2V0NGZ1NnI0NGt2M29oZmN1bW9wMGp2ZjRhMiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKSjRrfIPjeiOkM/giphy.gif') // รูปภาพประกอบ (เปลี่ยนลิงก์รูปได้ตามชอบ)
    .setTimestamp()
    .setFooter({ text: `สมาชิกคนที่ ${member.guild.memberCount}` });

  // ส่งข้อความแบบ Embed เข้าห้อง
  channel.send({ embeds: [welcomeEmbed] });
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ping') {
    await interaction.reply('Pong! 🏓 บอททำงานระบบ Slash Command ปกติบน Render ครับ 🚀');
  }
});

client.login(process.env.DISCORD_TOKEN);
