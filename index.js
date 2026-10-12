const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');

// สร้างเว็บเซิร์ฟเวอร์จำลองเพื่อให้ Render มองเห็น Port
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running!\n');
});
server.listen(process.env.PORT || 3000);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(`Bot Online แล้วจ้า: ${client.user.tag}`);
});

client.on('messageCreate', message => {
  if (message.author.bot) return;
  
  if (message.content === '!ping') {
    message.reply('Pong! บอททำงานปกติบน Render ครับ 🚀');
  }
});

client.login(process.env.DISCORD_TOKEN);
