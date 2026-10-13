const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

function getDashboardConfig(config) {
  const channelName = config.channelId ? `<#${config.channelId}>` : 'ยังไม่ได้เลือกช่อง ⚠️';
  const statusText = config.welcomeEnabled ? '🟢 เปิดใช้งานแล้ว' : '🔴 ปิดใช้งานอยู่';
  
  const embed = new EmbedBuilder()
    .setTitle('✨ แผงควบคุมระบบต้อนรับสมาชิกใหม่ (Welcome Dashboard)')
    .setDescription('จัดการระบบต้อนรับสมาชิกใหม่ ตั้งค่าห้อง และปรับแต่งข้อความ Embed ได้อย่างอิสระ')
    .addFields(
      { name: '📊 สถานะระบบ', value: statusText, inline: true },
      { name: '📢 ช่องแสดงข้อความ', value: channelName, inline: true },
      { name: '🎨 ค่าสีเริ่มต้น', value: `\`${config.embed?.color || '#66FFFF'}\``, inline: true }
    )
    .setColor(config.embed?.color || '#66FFFF')
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('toggle_welcome')
      .setLabel(config.welcomeEnabled ? 'ปิดระบบ Welcome' : 'เปิดระบบ Welcome')
      .setStyle(config.welcomeEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('edit_embed')
      .setLabel('✏️ ตั้งค่าข้อความ/Embed')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('test_welcome')
      .setLabel('🚀 ทดสอบส่งข้อความ')
      .setStyle(ButtonStyle.Secondary)
  );

  const channelRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('select_channel')
      .setPlaceholder('📂 คลิกเพื่อเลือกห้องสำหรับส่งข้อความต้อนรับ')
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
      return await interaction.reply({ content: '❌ สำหรับ Administrator เท่านั้นครับ', ephemeral: true });
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
    
    // ตั้งค่า Default ข้อความและสีตามที่คุณต้องการเป๊ะๆ
    if (!config.embed) {
      config.embed = {
        title: '**𑣲⋆ 𝙉𝙀𝙒 𝙈𝙚𝙢𝙗𝙚𝙧!** ✨',
        description: '🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}** ครับ! เอาไปเลยยย',
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
