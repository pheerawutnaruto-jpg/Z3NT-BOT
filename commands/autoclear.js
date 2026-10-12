const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '../config.json');

function loadConfigs() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      if (data.trim() !== '') return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error loading config:', e);
  }
  return {};
}

function saveConfigs(configs) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2));
  } catch (e) {
    console.error('Error saving config:', e);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-autoclear')
    .setDescription('ตั้งเวลาลบข้อความอัตโนมัติประจำวัน')
    .addStringOption(option =>
      option.setName('time')
        .setDescription('เวลา เช่น 06:00')
        .setRequired(true)
    )
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('เลือกห้องแชทที่ต้องการลบ')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),
  async execute(interaction, client) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({ content: '❌ สำหรับ Administrator เท่านั้น', ephemeral: true });
    }

    const timeInput = interaction.options.getString('time');
    const channelInput = interaction.options.getChannel('channel');
    const guildId = interaction.guildId;

    let serverConfigs = loadConfigs();
    if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
    if (!serverConfigs[guildId].autoClear) serverConfigs[guildId].autoClear = {};

    serverConfigs[guildId].autoClear = {
      enabled: true,
      time: timeInput,
      channelId: channelInput.id
    };

    saveConfigs(serverConfigs);

    // เรียกฟังก์ชันตั้งเวลา (ถ้ามีระบบ Cron ใน index.js)
    if (client.setupCronJob) {
      client.setupCronJob(guildId, timeInput, channelInput.id);
    }

    return await interaction.reply({ content: `✅ ตั้งค่า Auto-Clear เวลา ${timeInput} น. ที่ห้อง <#${channelInput.id}> เรียบร้อย`, ephemeral: true });
  },
};
