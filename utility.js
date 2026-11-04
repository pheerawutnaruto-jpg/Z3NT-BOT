const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const cron = require('node-cron');
const { IMAGES, COLORS } = require('./constants');

const utilityCommands = [
  new SlashCommandBuilder().setName('ping').setDescription('เช็กความเร็วและสถานะของบอท'),
  new SlashCommandBuilder().setName('bot-info').setDescription('✨ แสดงข้อมูลและหน้าพรีเซนต์แนะนำตัวของ Zen Bot'),
  new SlashCommandBuilder()
    .setName('set-dev-log')
    .setDescription('🛠️ ตั้งค่าห้องสำหรับรับแจ้งเตือน Live GitHub Dev Stream')
    .addChannelOption(option => option.setName('channel').setDescription('เลือกห้อง').setRequired(true)),
  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('ลบข้อความในแชทจำนวน 1-100 ข้อความ')
    .addIntegerOption(option => option.setName('amount').setDescription('จำนวนข้อความ').setRequired(true).setMinValue(1).setMaxValue(100)),
  new SlashCommandBuilder()
    .setName('set-autoclear')
    .setDescription('💎 [PREMIUM] ตั้งเวลาระบบลบข้อความอัตโนมัติ')
    .addStringOption(option => option.setName('time').setDescription('เวลาในรูปแบบ HH:MM').setRequired(true))
    .addChannelOption(option => option.setName('channel').setDescription('เลือกห้องที่ต้องการลบข้อความ').setRequired(true))
];

let activeCronJobs = {};

function setupCronJob(guildId, timeStr, channelId, client) {
  if (activeCronJobs[guildId]) {
    activeCronJobs[guildId].stop();
    delete activeCronJobs[guildId];
  }
  const [hour, minute] = (timeStr || '').split(':');
  if (!hour || !minute) return;

  const cronExpression = `${minute} ${hour} * * *`;
  activeCronJobs[guildId] = cron.schedule(cronExpression, async () => {
    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return;
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (channel && channel.isTextBased()) {
        const fetched = await channel.messages.fetch({ limit: 100 });
        await channel.bulkDelete(fetched, true);
      }
    } catch (err) {
      console.error(`Auto-clear error for guild ${guildId}`, err);
    }
  }, { timezone: 'Asia/Bangkok' });
}

function loadAllAutoClearCrons(client, serverConfigs) {
  for (const guildId in serverConfigs) {
    const config = serverConfigs[guildId];
    if (config?.autoClear?.enabled && config.autoClear.time && config.autoClear.channelId) {
      setupCronJob(guildId, config.autoClear.time, config.autoClear.channelId, client);
    }
  }
}

async function handleUtilityCommands(interaction, serverConfigs, saveConfigs, client) {
  const cmd = interaction.commandName;
  const guildId = interaction.guildId;
  const config = serverConfigs[guildId] || {};

  if (cmd === 'ping') {
    return await interaction.reply({ content: 'Pong! 🏓 บอททำงานระบบ Slash Command ปกติครับ 🚀', ephemeral: true });
  }

  if (cmd === 'bot-info') {
    const embed = new EmbedBuilder()
      .setTitle('🤖 𝙕𝙀𝙉 𝘽𝙊𝙏 • OFFICIAL PRESENTATION')
      .setDescription('**ระบบจัดการและปกป้องเซิร์ฟเวอร์แบบครบวงจร** ✨\n\n' +
        '🚀 **ฟีเจอร์เด่นภายในบอท:**\n' +
        '> 🛡️ **Advanced Security:** ระบบป้องกันลิงก์สแปม และบอทหลอกลวงพร้อมบทลงโทษอัตโนมัติ\n' +
        '> 📊 **Leveling & Voice XP:** ระบบเก็บเลเวลทั้งแชทและห้องเสียงพร้อมการ์ดโปรไฟล์\n' +
        '> 🐾 **Zen Pet System:** ระบบเลี้ยงสัตว์และลานประลอง\n' +
        '> 🎁 **Daily Quest:** เควสต์สุ่มแจก Zen Coins ฟรี\n' +
        '> 🛒 **Automated Store:** ระบบร้านค้าสกินและยศ\n' +
        '> 🛠️ **Dev Stream:** ระบบสตรีมโค้ดและรายงาน Commit สดจาก GitHub')
      .setColor(COLORS.PRIMARY)
      .setImage(IMAGES.BOT_PRESENTATION)
      .setTimestamp()
      .setFooter({ text: 'Powered by Zen Bot Technology' });

    return await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (cmd === 'set-dev-log') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
    }
    const channel = interaction.options.getChannel('channel');
    config.devLogChannelId = channel.id;
    await saveConfigs(serverConfigs);
    return await interaction.reply({ content: `✅ ตั้งค่าห้องรับแจ้งเตือน GitHub Dev Stream เรียบร้อยที่: ${channel}`, ephemeral: true });
  }

  if (cmd === 'clear') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return await interaction.reply({ content: '❌ คุณไม่มีสิทธิ์จัดการข้อความ', ephemeral: true });
    }
    const amount = interaction.options.getInteger('amount');
    await interaction.deferReply({ ephemeral: true });
    try {
      const messages = await interaction.channel.messages.fetch({ limit: amount });
      await interaction.channel.bulkDelete(messages, true);
      await interaction.editReply({ content: `🧹 ลบข้อความจำนวน **${amount}** เรียบร้อย!` });
    } catch (err) {
      await interaction.editReply({ content: '❌ เกิดข้อผิดพลาด ไม่สามารถลบข้อความเก่าเกิน 14 วันได้' });
    }
    return true;
  }

  if (cmd === 'set-autoclear') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({ content: '❌ ต้องเป็น Administrator', ephemeral: true });
    }
    const timeInput = interaction.options.getString('time');
    const channelInput = interaction.options.getChannel('channel');
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeInput)) {
      return await interaction.reply({ content: '❌ รูปแบบเวลาไม่ถูกต้อง (HH:MM)', ephemeral: true });
    }
    config.autoClear = { enabled: true, time: timeInput, channelId: channelInput.id };
    await saveConfigs(serverConfigs);
    setupCronJob(guildId, timeInput, channelInput.id, client);
    return await interaction.reply({ content: `✅ ตั้งค่า Auto-Clear สำเร็จ (${timeInput})`, ephemeral: true });
  }

  return false;
}

module.exports = {
  utilityCommands,
  loadAllAutoClearCrons,
  handleUtilityCommands
};
