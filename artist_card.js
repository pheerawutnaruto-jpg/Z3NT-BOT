const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');

const setupArtistCommand = new SlashCommandBuilder()
  .setName('setup-artist-card')
  .setDescription('💎 [PREMIUM] ส่งแผงปุ่มตั้งค่ารูปการ์ดส่วนตัวสำหรับคนมียศ Artist (สำหรับ Admin)');

async function handleSetupArtistCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle('🎨 𝙕𝙀𝙉 𝘽𝙊𝙏 • ARTIST CARD CUSTOMIZER')
    .setDescription('สำหรับสมาชิกที่มียศ **Artist** หรือ **Aritist | 3d** กดปุ่มด้านล่างเพื่อกรอกลิงก์รูปภาพสำหรับเปลี่ยนพื้นหลังการ์ด `/level` ส่วนตัวของคุณได้ทันที!\n──────────────────────')
    .setColor('#FF69B4');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('open_artist_card_modal')
      .setLabel('🎨 เปลี่ยนรูปการ์ดส่วนตัว')
      .setStyle(ButtonStyle.Primary)
  );

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ ส่งแผงปุ่มตั้งค่าการ์ด Artist ไปยังห้องนี้สำเร็จแล้ว!', ephemeral: true });
}

async function handleArtistButton(interaction, serverConfigs) {
  if (interaction.customId !== 'open_artist_card_modal') return false;

  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  
  // 📌 ID ของยศถาวร (ใส่เลขยศถาวรที่คุณให้มา)
  const artistRoleId = '1560224726868295740';     
  const artist3dRoleId = 'YOUR_ARTIST_3D_ROLE_ID';  // 👈 (ถ้ามีอีกยศ ให้ใส่ ID ของยศ 3 วัน หรือลบออกได้ถ้าไม่มี)

  const member = interaction.member;
  const config = serverConfigs[guildId] || {};
  const userStat = config.levels?.[userId] || {};
  const now = Date.now();

  // 🔍 1. เช็กจากยศถาวรจริงๆ บน Discord
  const hasArtistRole = member.roles.cache.has(artistRoleId);
  const hasArtist3dRole = artist3dRoleId !== 'YOUR_ARTIST_3D_ROLE_ID' && member.roles.cache.has(artist3dRoleId);

  // ⏳ 2. เช็กจากระบบบัตรเช่า 3 วันใน Database (ถ้ามีคนซื้อแบบเช่า)
  const hasTempAccess = userStat.artistUntil && userStat.artistUntil > now;

  // ถ้าไม่มีทั้งยศถาวรและไม่มีบัตรเช่า ถึงจะบล็อก
  if (!hasArtistRole && !hasArtist3dRole && !hasTempAccess) {
    return await interaction.reply({ 
      content: '❌ คุณไม่มีสิทธิ์ใช้งาน! เฉพาะผู้ที่มี **ยศ Artist**, **Aritist | 3d** หรือมีบัตรเช่า 3 วันเท่านั้นที่จะเปลี่ยนพื้นหลังการ์ดได้', 
      ephemeral: true 
    });
  }

  const modal = new ModalBuilder()
    .setCustomId('artistCardModal')
    .setTitle('🎨 ปรับแต่งรูปการ์ด /level ส่วนตัว');

  const imageUrlInput = new TextInputBuilder()
    .setCustomId('cardImageUrl')
    .setLabel('ลิงก์รูปภาพพื้นหลังการ์ด (Image URL)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://example.com/my-image.png')
    .setValue(userStat.customTheme || '')
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(imageUrlInput));
  await interaction.showModal(modal);
  return true;
}

async function handleArtistModalSubmit(interaction, serverConfigs, saveConfigs) {
  if (interaction.customId !== 'artistCardModal') return false;

  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const imageUrl = interaction.fields.getTextInputValue('cardImageUrl').trim();

  if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
    return await interaction.reply({ content: '❌ ลิงก์ไม่ถูกต้อง! กรุณาระบุลิงก์รูปภาพที่ขึ้นต้นด้วย http:// หรือ https://', ephemeral: true });
  }

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].levels) serverConfigs[guildId].levels = {};
  if (!serverConfigs[guildId].levels[userId]) {
    serverConfigs[guildId].levels[userId] = { xp: 0, level: 1, orbs: 0, lastDaily: 0, boostUntil: 0, artistUntil: 0, customTheme: '' };
  }

  serverConfigs[guildId].levels[userId].customTheme = imageUrl;
  await saveConfigs(serverConfigs);

  await interaction.reply({ content: `✅ บันทึกรูปภาพพื้นหลังการ์ดส่วนตัวสำเร็จ! ลองพิมพ์ \`/level\` ดูการเปลี่ยนแปลงได้เลย`, ephemeral: true });
  return true;
}

module.exports = {
  setupArtistCommand,
  handleSetupArtistCommand,
  handleArtistButton,
  handleArtistModalSubmit
};
