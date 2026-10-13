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
    .setDescription('ตั้งเวลาลบข้อความอัตโนมัติ')
    .addStringOption(option =>
      option.setName('time')
        .setDescription('เวลา เช่น 06:00')
        .setRequired(true)
    )
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('เลือกห้อง')
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
    
    serverConfigs[guildId].autoClear.enabled = true;
    serverConfigs[guildId].autoClear.time = timeInput;
    serverConfigs[guildId].autoClear.channelId = channelInput.id;
    saveConfigs(serverConfigs);
    
    if (client.setupCronJob) {
      client.setupCronJob(guildId, timeInput, channelInput.id);
    }

    return await interaction.reply({ content: `✅ ตั้งค่า Auto-Clear เวลา ${timeInput} น. เรียบร้อย`, ephemeral: true });
  },
};
