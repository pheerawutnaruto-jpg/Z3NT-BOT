const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');

const setupArtistCommand = new SlashCommandBuilder()
  .setName('setup-artist-card')
  .setDescription('💎 [PREMIUM] ส่งแผงปุ่มตั้งค่ารูปการ์ดส่วนตัว (Level & Wallet) สำหรับคนมียศ Artist (สำหรับ Admin)');

async function handleSetupArtistCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle('🎨 𝙕𝙀𝙉 𝘽𝙊𝙏 • ARTIST CARD CUSTOMIZER')
    .setDescription('สำหรับสมาชิกที่มียศ **Artist** หรือ **Aritist | 3d** กดปุ่มด้านล่างเพื่อกรอกลิงก์รูปภาพสำหรับเปลี่ยนพื้นหลังการ์ด `/level` และการ์ดกระเป๋าเงิน `/coins` ส่วนตัวของคุณได้ทันที!\n──────────────────────')
    .setColor('#FF69B4');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('open_artist_card_modal')
      .setLabel('🎨 เปลี่ยนรูปการ์ดเลเวล')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('open_artist_wallet_modal')
      .setLabel('💰 เปลี่ยนรูปการ์ดกระเป๋า')
      .setStyle(ButtonStyle.Success)
  );

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ ส่งแผงปุ่มตั้งค่าการ์ด Artist ไปยังห้องนี้สำเร็จแล้ว!', ephemeral: true });
}

async function handleArtistButton(interaction, serverConfigs) {
  const customId = interaction.customId;
  if (customId !== 'open_artist_card_modal' && customId !== 'open_artist_wallet_modal') return false;

  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  
  // 📌 ID ของยศ Artist และยศเช่า 3 วัน
  const artistRoleId = '1560224726868295740';     // ยศ Artist ถาวร
  const artist3dRoleId = '1560136361015513108';  // ยศ Aritist | 3d (เช่า 3 วัน)

  const member = interaction.member;
  const config = serverConfigs[guildId] || {};
  const userStat = config.levels?.[userId] || {};
  const now = Date.now();

  // 🔍 1. เช็กจากยศจริงๆ บน Discord ทั้งแบบถาวรและแบบ 3 วัน
  const hasArtistRole = member.roles.cache.has(artistRoleId);
  const hasArtist3dRole = member.roles.cache.has(artist3dRoleId);

  // ⏳ 2. เช็กจากระบบฐานข้อมูลบัตรเช่า (กรณีระบบบันทึกสถานะเวลา)
  const hasTempAccess = userStat.artistUntil && userStat.artistUntil > now;

  // ถ้าไม่มีทั้งยศถาวร ยศ 3 วัน และไม่มีสิทธิ์ในระบบ ถึงจะบล็อก
  if (!hasArtistRole && !hasArtist3dRole && !hasTempAccess) {
    return await interaction.reply({ 
      content: '❌ คุณไม่มีสิทธิ์ใช้งาน! เฉพาะผู้ที่มี **ยศ Artist**, **Aritist | 3d** หรือมีบัตรเช่า 3 วันเท่านั้นที่จะเปลี่ยนพื้นหลังการ์ดได้', 
      ephemeral: true 
    });
  }

  if (customId === 'open_artist_card_modal') {
    const modal = new ModalBuilder()
      .setCustomId('artistCardModal')
      .setTitle('🎨 ปรับแต่งรูปการ์ด /level ส่วนตัว');

    const imageUrlInput = new TextInputBuilder()
      .setCustomId('cardImageUrl')
      .setLabel('ลิงก์รูปภาพพื้นหลังการ์ด Level (Image URL)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://example.com/my-level-image.png')
      .setValue(userStat.customTheme || '')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(imageUrlInput));
    await interaction.showModal(modal);
    return true;
  }

  if (customId === 'open_artist_wallet_modal') {
    const modal = new ModalBuilder()
      .setCustomId('artistWalletModal')
      .setTitle('💰 ปรับแต่งรูปการ์ด /coins ส่วนตัว');

    const walletImageUrlInput = new TextInputBuilder()
      .setCustomId('walletImageUrl')
      .setLabel('ลิงก์รูปภาพพื้นหลังการ์ด Wallet (Image URL)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://example.com/my-wallet-image.png')
      .setValue(userStat.customWalletTheme || '')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(walletImageUrlInput));
    await interaction.showModal(modal);
    return true;
  }

  return false;
}

async function handleArtistModalSubmit(interaction, serverConfigs, saveConfigs) {
  const customId = interaction.customId;
  if (customId !== 'artistCardModal' && customId !== 'artistWalletModal') return false;

  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const imageUrl = interaction.fields.getTextInputValue(customId === 'artistCardModal' ? 'cardImageUrl' : 'walletImageUrl').trim();

  if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
    return await interaction.reply({ content: '❌ ลิงก์ไม่ถูกต้อง! กรุณาระบุลิงก์รูปภาพที่ขึ้นต้นด้วย http:// หรือ https://', ephemeral: true });
  }

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].levels) serverConfigs[guildId].levels = {};
  if (!serverConfigs[guildId].levels[userId]) {
    serverConfigs[guildId].levels[userId] = { xp: 0, level: 1, orbs: 0, lastDaily: 0, boostUntil: 0, artistUntil: 0, customTheme: '', customWalletTheme: '' };
  }

  if (customId === 'artistCardModal') {
    serverConfigs[guildId].levels[userId].customTheme = imageUrl;
    await saveConfigs(serverConfigs);
    await interaction.reply({ content: `✅ บันทึกรูปภาพพื้นหลังการ์ด Level สำเร็จ! ลองพิมพ์ \`/level\` ดูการเปลี่ยนแปลงได้เลย`, ephemeral: true });
  } else {
    serverConfigs[guildId].levels[userId].customWalletTheme = imageUrl;
    await saveConfigs(serverConfigs);
    await interaction.reply({ content: `✅ บันทึกรูปภาพพื้นหลังการ์ด Wallet สำเร็จ! ลองพิมพ์คำสั่งเช็กเหรียญดูการเปลี่ยนแปลงได้เลย`, ephemeral: true });
  }

  return true;
}

module.exports = {
  setupArtistCommand,
  handleSetupArtistCommand,
  handleArtistButton,
  handleArtistModalSubmit
};
