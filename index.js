const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const fs = require('fs');
const { petCommand, handlePetCommand, handlePetButton } = require('./pet_hatch');
const { handleLeveling } = require('./level');

// 🗄️ โหลดและบันทึกข้อมูล Config ลงไฟล์ JSON
const CONFIG_FILE = './serverConfigs.json';
let serverConfigs = {};

if (fs.existsSync(CONFIG_FILE)) {
  try {
    serverConfigs = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (e) {
    console.error('Error reading config file:', e);
  }
}

function saveConfigs(configs) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2));
  } catch (e) {
    console.error('Error saving config file:', e);
  }
}

// 🛡️ ป้องกันบอท Crash จาก Error ที่ไม่ได้ดักจับ
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

client.on('error', error => {
  console.error('Discord client error:', error);
});

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  // ลงทะเบียน Slash Command /pet
  const commands = [petCommand.toJSON()];
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands },
    );
    console.log('Successfully registered application commands.');
  } catch (error) {
    console.error('Failed to register commands:', error);
  }
});

// ตรวจสอบข้อความแชทเพื่อรันระบบเลเวลและฟักไข่
client.on('messageCreate', message => {
  handleLeveling(message, serverConfigs, saveConfigs);
});

// รองรับการใช้งานคำสั่ง Slash และปุ่มกด
client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'pet') {
        await handlePetCommand(interaction, serverConfigs);
      }
    }

    if (interaction.isButton()) {
      const handled = await handlePetButton(interaction, serverConfigs, saveConfigs);
      if (handled) return;
    }
  } catch (err) {
    console.error('Interaction error:', err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'เกิดข้อผิดพลาดในการทำรายการ', ephemeral: true }).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
