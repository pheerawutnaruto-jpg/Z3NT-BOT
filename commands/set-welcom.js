const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

function getDashboardConfig(config) {
  const channelName = config.channelId ? `<#${config.channelId}>` : 'ยังไม่ได้เลือกช่อง';
  const statusText = config.welcomeEnabled ? '✅ เปิดอยู่' : '❌ ปิดอยู่';
  const embed = new EmbedBuilder().setTitle('⚙️ ตั้งค่าระบบ Welcome').addFields({ name: '📥 Status', value: statusText, inline: true }, { name: '📢 ห้อง', value: channelName, inline: true });
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('toggle_welcome').setLabel(config.welcomeEnabled ? 'ปิด Welcome' : 'เปิด Welcome').setStyle(config.welcomeEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('edit_embed').setLabel('ตั้งค่า Embed').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('test_welcome').setLabel('ทดสอบ').setStyle(ButtonStyle.Secondary)
  );
  const channelRow = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('select_channel').setPlaceholder('📂 เลือกช่องต้อนรับ').addChannelTypes(ChannelType.GuildText));
  return { embeds: [embed], components: [row1, channelRow] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-welcom')
    .setDescription('เปิดแผงควบคุมระบบต้อนรับ'),
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({ content: '❌ สำหรับ Administrator เท่านั้น', ephemeral: true });
    }
    const fs = require('fs');
    const path = require('path');
    const CONFIG_FILE = path.join(__dirname, '../config.json');
    let serverConfigs = {};
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        serverConfigs = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      }
    } catch(e) {}

    const guildId = interaction.guildId;
    if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
    const config = serverConfigs[guildId];
    if (!config.embed) {
      config.embed = {
        title: '',
        description: 'ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ {server}',
        color: '#66FFFF',
        image: ''
      };
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(serverConfigs, null, 2));
    }
    await interaction.reply({ ...getDashboardConfig(config), ephemeral: true });
  },
  async updateDashboard(interaction, config) {
    await interaction.update({ ...getDashboardConfig(config) });
  },
  async updateDashboardAfterDefer(interaction, config) {
    await interaction.editReply({ ...getDashboardConfig(config) });
  }
};
