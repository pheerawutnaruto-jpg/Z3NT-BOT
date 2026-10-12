const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const http = require('http');

// 1. สร้างเว็บเซิร์ฟเวอร์จำลองเพื่อให้ Render มองเห็น Port
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running!\n');
});
server.listen(process.env.PORT || 3000);

// 2. สร้าง Client และเปิด Intent สำหรับอ่านสมาชิก
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// 3. ลงทะเบียนคำสั่ง Slash Command (/ping)
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

// 4. ระบบต้อนรับสมาชิกใหม่แบบ Embed การ์ดสวยๆ
client.on('guildMemberAdd', member => {
  // ค้นหาห้องชื่อ "welcome" หรือ "ทั่วไป" ที่บอทสามารถพิมพ์ได้
  const channel = member.guild.channels.cache.find(ch => 
    (ch.name.includes('welcome') || ch.name.includes('ทั่วไป')) && ch.type === 0 && ch.permissionsFor(member.guild.members.me).has('SendMessages')
  ) || member.guild.systemsChannel;

  if (!channel) return;

  // สร้างการ์ด Embed ต้อนรับ
  const welcomeEmbed = new EmbedBuilder()
    .setColor('#ffb6c1') // สีชมพูพาสเทล (ปรับเปลี่ยนโค้ดสี Hex ได้ตามชอบ)
    .setAuthor({ 
      name: `Welcome to Z+`, 
      iconURL: member.guild.iconURL({ dynamic: true }) 
    })
    .setDescription(
      `💖 **· NEW Member! ✨**\n\n` +
      `「 🎉 ยินดีต้อนรับคุณ ${member} !\n` +
      
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 })) // รูปโปรไฟล์ของสมาชิกใหม่
    .setImage('https://i.imgur.com/AfFp7pu.png') // รูปภาพประกอบด้านล่างการ์ด (สามารถเปลี่ยนลิงก์รูปได้ตามต้องการ)
    .setFooter({ text: `สมาชิกลำดับที่ ${member.guild.memberCount}` });

  channel.send({ embeds: [welcomeEmbed] });
});

// 5. ระบบรับคำสั่ง /ping
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ping') {
    await interaction.reply('Pong! 🏓 บอททำงานระบบ Slash Command ปกติบน Render ครับ 🚀');
  }
});

client.login(process.env.DISCORD_TOKEN);
