const { Client, GatewayIntentBits, REST, Routes, Collection, EmbedBuilder } = require('discord.js');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

// นำเข้าโมดูลและคำสั่งจากไฟล์ต่างๆ ในโปรเจกต์
const { 
  setupOrderTicketCommand, 
  handleSetupOrderTicketCommand, 
  handleOrderTicketSelect, 
  handleOrderPaymentButton, 
  handleCloseTicketButton 
} = require('./order_ticket');

const { 
  setupShopCommand, 
  handleSetupShopCommand, 
  boostStatusCommand, 
  handleBoostStatusCommand, 
  coinsCommand, 
  addCoinsCommand, 
  handleCoinsCommand, 
  handleAddCoinsCommand, 
  handleShopButton 
} = require('./shop');

const { 
  cinemaCommand, 
  setupCinemaCommand, 
  handleCinemaInteraction 
} = require('./cinema');

const { 
  dailyCommand, 
  handleDailyCommand 
} = require('./quest');

const { 
  artistCardCommand, 
  handleArtistCardCommand 
} = require('./artist_card');

// สร้าง Client พร้อม Intent ที่จำเป็น
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// ไฟล์ฐานข้อมูลจำลองสำหรับเก็บข้อมูลเลเวล เหรียญ และสถานะยศ
const CONFIG_FILE = path.join(__dirname, 'server_configs.json');

function loadConfigs() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading config file:', err);
  }
  return {};
}

async function saveConfigs(configs) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving config file:', err);
  }
}

let serverConfigs = loadConfigs();

// เมื่อบอทพร้อมทำงาน
client.once('ready', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}! Zen Bot is ready.`);

  // ลงทะเบียน Slash Commands แบบ Global หรือ Guild
  const commands = [
    setupOrderTicketCommand.toJSON(),
    setupShopCommand.toJSON(),
    boostStatusCommand.toJSON(),
    coinsCommand.toJSON(),
    addCoinsCommand.toJSON(),
    cinemaCommand.toJSON(),
    setupCinemaCommand.toJSON(),
    dailyCommand.toJSON(),
    artistCardCommand.toJSON(),
    {
      name: 'bot-info',
      description: '💎 ดูข้อมูลและพรีเซนต์แนะนำตัวของ Zen Bot'
    }
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log('Started refreshing application (/) commands.');
    await rest.put(
      Routes.applicationCommands(client.user.id),
      body = commands
    );
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }

  // ⏰ ระบบ Cronjob ตรวจสอบยศหมดอายุทุกๆ 1 นาที
  cron.schedule('* * * * *', async () => {
    const now = Date.now();
    let updated = false;

    for (const guildId of Object.keys(serverConfigs)) {
      const guildData = serverConfigs[guildId];
      if (!guildData.levels) continue;

      const guild = client.guilds.cache.get(guildId);
      if (!guild) continue;

      for (const userId of Object.keys(guildData.levels)) {
        const userStat = guildData.levels[userId];

        try {
          const member = await guild.members.fetch(userId).catch(() => null);
          if (!member) continue;

          // 1. ตรวจสอบและถอดยศ Artist ชั่วคราว (Artist | 3d)
          const artist3dRoleId = '1560136361015513108';
          if (userStat.artistUntil && userStat.artistUntil <= now) {
            if (member.roles.cache.has(artist3dRoleId)) {
              await member.roles.remove(artist3dRoleId).catch(() => {});
              console.log(`[CRON] Removed expired Artist | 3d role from ${member.user.tag}`);
            }
            userStat.artistUntil = 0;
            updated = true;
          }

          // 2. ตรวจสอบและถอดยศ XP Booster
          const xpBoosterRoleId = '1559992075095773184';
          if (userStat.boostUntil && userStat.boostUntil <= now) {
            if (member.roles.cache.has(xpBoosterRoleId)) {
              await member.roles.remove(xpBoosterRoleId).catch(() => {});
              console.log(`[CRON] Removed expired XP Booster role from ${member.user.tag}`);
            }
            userStat.boostUntil = 0;
            updated = true;
          }

        } catch (err) {
          // ข้ามกรณีสมาชิกออกจากเซิร์ฟเวอร์หรือบอทไม่มีสิทธิ์
        }
      }
    }

    if (updated) {
      await saveConfigs(serverConfigs);
    }
  });
});

// จัดการเหตุการณ์เมื่อมีผู้ใช้งานพิมพ์คำสั่งหรือกดปุ่ม (Interactions)
client.on('interactionCreate', async interaction => {
  try {
    // 1. จัดการ Slash Commands
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;

      if (commandName === 'setup-order-ticket') {
        return await handleSetupOrderTicketCommand(interaction);
      }
      if (commandName === 'setup-in-game-shop') {
        return await handleSetupShopCommand(interaction);
      }
      if (commandName === 'boost-status') {
        return await handleBoostStatusCommand(interaction, serverConfigs);
      }
      if (commandName === 'coins') {
        return await handleCoinsCommand(interaction, serverConfigs);
      }
      if (commandName === 'add-coins') {
        return await handleAddCoinsCommand(interaction, serverConfigs, saveConfigs);
      }
      if (commandName === 'cinema' || commandName === 'setup-cinema') {
        return await handleCinemaInteraction(interaction, serverConfigs, saveConfigs);
      }
      if (commandName === 'daily') {
        return await handleDailyCommand(interaction, serverConfigs, saveConfigs);
      }
      if (commandName === 'artist-card') {
        return await handleArtistCardCommand(interaction, serverConfigs, saveConfigs);
      }
      if (commandName === 'bot-info') {
        const embed = new EmbedBuilder()
          .setTitle('<a:emoji_93:1560403772025344101> 𝙕𝙀𝙉 𝘽𝙊𝙏 • SYSTEM OVERVIEW')
          .setDescription('บอควบคุมระบบเซิร์ฟเวอร์ ร้านค้าอัตโนมัติ ระบบตั๋วภาพยนตร์ และเควสต์ประจำวันแบบครบวงจร พัฒนาด้วยมาตรฐานระดับพรีเมียม')
          .setColor('#00FF00')
          .addFields(
            { name: '🛡️ สถานะระบบ', value: '🟢 ออนไลน์และพร้อมใช้งาน 100%', inline: true },
            { name: '💎 แพ็กเกจ', value: 'Server Premium Active', inline: true }
          )
          .setTimestamp();
        return await interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }

    // 2. จัดการ Select Menu (ร้านค้าออร์เดอร์เงินจริง)
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'select_product_order') {
        return await handleOrderTicketSelect(interaction, serverConfigs, saveConfigs);
      }
    }

    // 3. จัดการ Buttons (ปุ่มซื้อของในเกม, ปุ่มจ่ายเงิน, ปิดตั๋ว, ตั๋วหนัง)
    if (interaction.isButton()) {
      // ตรวจสอบร้านค้าในเกม / กาชาปอง / บัฟ
      const handledShop = await handleShopButton(interaction, serverConfigs, saveConfigs);
      if (handledShop) return;

      // ตรวจสอบปุ่มชำระเงิน PromptPay
      const handledPayment = await handleOrderPaymentButton(interaction);
      if (handledPayment) return;

      // ตรวจสอบปุ่มปิดออร์เดอร์
      const handledClose = await handleCloseTicketButton(interaction);
      if (handledClose) return;

      // ตรวจสอบปุ่มระบบภาพยนตร์ (Cinema)
      const handledCinema = await handleCinemaInteraction(interaction, serverConfigs, saveConfigs);
      if (handledCinema) return;
    }

  } catch (error) {
    console.error('Interaction Error:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: '❌ เกิดข้อผิดพลาดในการประมวลผลคำสั่งครับ', ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ content: '❌ เกิดข้อผิดพลาดในการประมวลผลคำสั่งครับ', ephemeral: true }).catch(() => {});
    }
  }
});

// เข้าสู่ระบบด้วย Token ของบอท
client.login(process.env.DISCORD_TOKEN);
