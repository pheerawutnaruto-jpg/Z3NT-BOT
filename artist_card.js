const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');

// 🛠️ คำสั่งสำหรับแอดมินส่งปุ่มตั้งค่าการ์ดไปไว้ในห้องเฉพาะของ Artist
const setupArtistCommand = new SlashCommandBuilder()
  .setName('setup-artist-card')
  .setDescription('ส่งแผงปุ่มตั้งค่ารูปการ์ดส่วนตัวสำหรับคนมียศ Artist (สำหรับ Admin)');

async function handleSetupArtistCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle('🎨 ARTIST CARD CUSTOMIZER')
    .setDescription('สำหรับสมาชิกที่มี **ยศ Artist** เท่านั้น!\nกดปุ่มด้านล่างเพื่อใส่ลิงก์รูปภาพ (Image URL) สำหรับเปลี่ยนพื้นหลังการ์ด `/level` ส่วนตัวของคุณตามใจชอบได้เลยครับ')
    .setColor('#FF007F');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('open_artist_card_modal')
      .setLabel('🖼️ ตั้งค่ารูปการ์ดส่วนตัวของคุณ')
      .setStyle(ButtonStyle.Success)
  );

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ ส่งแผงปุ่มตั้งค่าการ์ดไปยังห้องนี้สำเร็จแล้ว!', ephemeral: true });
}

// 🖼️ ดักจับการกดปุ่มเพื่อเปิด Modal
async function handleArtistButton(interaction, serverConfigs) {
  if (interaction.customId !== 'open_artist_card_modal') return false;

  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const artistRoleId = '1560136361015513108'; // รหัสยศ Artist ของคุณ

  // เช็กว่าผู้ใช้มียศ Artist จริงไหม
  try {
    const member = await interaction.guild.members.fetch(userId);
    if (!member.roles.cache.has(artistRoleId)) {
      return await interaction.reply({ content: '❌ เฉพาะผู้ที่มี **ยศ Artist** เท่านั้นถึงจะใช้งานปุ่มนี้ได้! (สามารถซื้อบัตรได้ที่ `/shop`)', ephemeral: true });
    }
  } catch (err) {
    console.error('Error fetching member role for artist card:', err);
  }

  // สร้าง Modal ให้กรอกลิงก์รูป
  const modal = new ModalBuilder()
    .setCustomId('artistCardModal')
    .setTitle('🎨 ตั้งค่ารูปการ์ดส่วนตัว');

  const imageUrlInput = new TextInputBuilder()
    .setCustomId('cardImageUrl')
    .setLabel('วางลิงก์รูปภาพ (Image URL) ของคุณที่นี่')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://example.com/my-image.png')
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(imageUrlInput));
  await interaction.showModal(modal);
  return true;
}

// 📥 บันทึกข้อมูลลิงก์รูปจาก Modal ลงฐานข้อมูลของผู้ใช้
async function handleArtistModalSubmit(interaction, serverConfigs, saveConfigs) {
  if (interaction.customId !== 'artistCardModal') return false;

  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const imageUrl = interaction.fields.getTextInputValue('cardImageUrl').trim();

  // ตรวจสอบเบื้องต้นว่าเป็นลิงก์รูปภาพไหม
  if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
    return await interaction.reply({ content: '❌ ลิงก์ไม่ถูกต้อง! กรุณาระบุลิงก์รูปภาพที่ขึ้นต้นด้วย http:// หรือ https://', ephemeral: true });
  }

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].levels) serverConfigs[guildId].levels = {};
  if (!serverConfigs[guildId].levels[userId]) {
    serverConfigs[guildId].levels[userId] = { xp: 0, level: 1, orbs: 0, lastDaily: 0, boostUntil: 0, customTheme: '' };
  }

  // บันทึกลิงก์ลง customTheme ของผู้ใช้
  serverConfigs[guildId].levels[userId].customTheme = imageUrl;
  await saveConfigs(serverConfigs);

  await interaction.reply({ 
    content: `🎨 บันทึกรูปการ์ดส่วนตัวสำเร็จ! ตอนนี้ลองพิมพ์คำสั่ง \`/level\` เพื่อดูความเท่ของการ์ดคุณได้เลยครับ`, 
    ephemeral: true 
  });

  return true;
}

module.exports = {
  setupArtistCommand,
  handleSetupArtistCommand,
  handleArtistButton,
  handleArtistModalSubmit
};
