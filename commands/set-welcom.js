const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
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

function getDashboardConfig(config) {
  const channelName = config.channelId ? `<#${config.channelId}>` : 'ยังไม่ได้เลือกช่อง';
  const statusText = config.welcomeEnabled ? '✅ เปิดใช้งานอยู่' : '❌ ปิดใช้งานอยู่';
  
  const embed = new EmbedBuilder()
    .setTitle('⚙️ แผงควบคุมระบบต้อนรับสมาชิกใหม่ (Welcome System)')
    .setDescription('จัดการและปรับแต่งข้อความต้อนรับสมาชิกที่เข้ามาใหม่ในเซิร์ฟเวอร์ของคุณได้อย่างอิสระ')
    .addFields(
      { name: '📥 สถานะระบบ', value: statusText, inline: true },
      { name: '📢 ช่องต้อนรับ', value: channelName, inline: true },
      { name: '🎨 รูปแบบข้อความ (Embed)', value: `**Title:** ${config.embed?.title || 'ไม่มี'}\n**Color:** ${config.embed?.color || '#66FFFF'}` }
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
      .setPlaceholder('📂 คลิกเพื่อเลือกห้องส่งข้อความต้อนรับ')
      .addChannelTypes(ChannelType.GuildText)
  );

  return { embeds: [embed], components: [row1, channelRow] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-welcom')
    .setDescription('เปิดแผงควบคุมระบบต้อนรับสมาชิกใหม่ของบอทแบบละเอียด'),
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({ content: '❌ สำหรับผู้ดูแลระบบ (Administrator) เท่านั้นครับ', ephemeral: true });
    }

    const guildId = interaction.guildId;
    let serverConfigs = loadConfigs();
    if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
    if (!serverConfigs[guildId].embed) {
      serverConfigs[guildId].embed = {
        title: '✨ ยินดีต้อนรับสู่เซิร์ฟเวอร์ ✨',
        description: 'ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}** ขอให้สนุกสนานและพูดคุยกันอย่างเป็นกันเองนะครับ!',
        color: '#66FFFF',
        image: ''
      };
      saveConfigs(serverConfigs);
    }

    const content = getDashboardConfig(serverConfigs[guildId]);
    await interaction.reply({ ...content, ephemeral: true });
  },
  getDashboardConfig
};
