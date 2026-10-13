const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-welcom')
    .setDescription('เปิดแผงควบคุมระบบต้อนรับ (Welcome Dashboard)'),
  async execute(interaction, client, serverConfigs) {
    if (!interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: 'คุณต้องเป็น Administrator ถึงจะใช้งานได้ครับ', ephemeral: true });
    }

    const guildId = interaction.guildId;
    if (!serverConfigs[guildId]) {
      serverConfigs[guildId] = {
        welcomeEnabled: false,
        channelId: null,
        embed: {
          title: '',
          description: '**𑣲⋆ 𝙉𝙀𝙒 𝙈𝙚𝙢𝙗𝙚𝙧!** ✨\n🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}** ครับ!',
          color: '#66FFFF',
          image: ''
        },
        autoClear: { enabled: false, time: '06:00', channelId: null }
      };
    }

    const config = serverConfigs[guildId];
    const payload = getDashboardPayload(config);

    await interaction.reply({ ...payload, ephemeral: true });
  },
};

function getDashboardPayload(config) {
  const channelName = config.channelId ? `<#${config.channelId}>` : '` ยังไม่ได้เลือกช่อง `';
  const statusText = config.welcomeEnabled ? '`เปิดใช้งานอยู่`' : '`ปิดใช้งานอยู่`';
  const embedColor = config.embed.color || '#66FFFF';
  const hasImage = config.embed.image ? '`ตั้งค่าแล้ว`' : '`ยังไม่ได้ตั้งค่า`';

  const embed = new EmbedBuilder()
    .setTitle('แผงควบคุมระบบต้อนรับ (Welcome Dashboard)')
    .setDescription('จัดการตั้งค่าข้อความต้อนรับสมาชิกใหม่ รูปแบบ Embed และช่องทางแสดงผลได้ผ่านปุ่มด้านล่างนี้ครับ')
    .setColor('#5865F2')
    .addFields(
      { name: 'สถานะระบบ', value: statusText, inline: true },
      { name: 'ช่องต้อนรับ', value: channelName, inline: true },
      { name: 'สี Embed', value: `\`${embedColor}\``, inline: true },
      { name: 'รูปภาพประกอบ', value: hasImage, inline: true }
    )
    .setFooter({ text: 'Zen Bot Management System' })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('toggle_welcome')
      .setLabel(config.welcomeEnabled ? 'ปิดระบบ Welcome' : 'เปิดระบบ Welcome')
      .setStyle(config.welcomeEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('edit_embed')
      .setLabel('ตั้งค่า Embed / รูปภาพ')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('test_welcome')
      .setLabel('ทดสอบระบบ')
      .setStyle(ButtonStyle.Secondary)
  );

  const channelRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('select_channel')
      .setPlaceholder('คลิกเพื่อเลือกช่องส่งข้อความต้อนรับ')
      .addChannelTypes(ChannelType.GuildText)
  );

  return { embeds: [embed], components: [row1, channelRow] };
}
