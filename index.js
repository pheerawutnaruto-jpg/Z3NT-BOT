const { Client, GatewayIntentBits } = require('discord.js');

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

// ใช้ Token จาก Environment Variable บน Render
client.login(process.env.DISCORD_TOKEN);
