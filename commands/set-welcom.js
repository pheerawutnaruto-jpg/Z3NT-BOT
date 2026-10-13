const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

function getDashboardConfig(config) {
  const channelName = config.channelId ? `<#${config.channelId}>` : 'ยังไม่ได้เลือกช่อง';
  const statusText = config.welcomeEnabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน';
  
  const embed = new EmbedBuilder()
    .setTitle('ตั้งค่าระบบต้อนรับสมาชิกใหม่')
    .setDescription('จัดการและปรับแต่งข้อความต้อนรับสมาชิกที่เข้ามาใหม่ในเซิร์ฟเวอร์ของคุณ')
    .addFields(
      { name: 'สถานะระบบ', value: statusText, inline: true },
      { name: 'ช่องต้อนรับ', value: channelName, inline: true },
      { name: 'รูปแบบ Embed', value: `**Description:**\n${config.embed?.description || 'ยังไม่ได้ตั้งค่า'}\n**Hex Color:** \`${config.embed?.color || '#66FFFF'}\``, inline: false }
    )
    .setColor(config.embed?.color || '#66FFFF')
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('toggle_welcome')
      .setLabel(config.welcomeEnabled ? 'ปิดระบบ' : 'เปิดระบบ')
      .setStyle(config.welcomeEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('edit_embed')
      .setLabel('ตั้งค่าข้อความ/Embed')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('test_welcome')
      .setLabel('ทดสอบส่งข้อความ')
      .setStyle(ButtonStyle.Secondary)
  );

  const channelRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('select_channel')
      .setPlaceholder('เลือกช่องสำหรับส่งข้อความต้อนรับ')
      .addChannelTypes(ChannelType.GuildText)
  );

  return { embeds: [embed], components: [row1, channelRow] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-welcom')
    .setDescription('เปิดแผงควบคุมระบบต้อนรับสมาชิกใหม่'),
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({ content: 'สำหรับผู้ดูแลระบบ (Administrator) เท่านั้น', ephemeral: true });
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
        description: '**𑣲⋆ 𝙉𝙀𝙒 𝙈𝙚𝙢\x62𝙚𝙧!** ✨\n🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}** ครับ! เอาไปเลยยย',
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
