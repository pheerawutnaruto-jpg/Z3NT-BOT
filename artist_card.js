const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');

const setupArtistCommand = new SlashCommandBuilder()
  .setName('setup-artist-card')
  .setDescription('💎 [PREMIUM] ส่งแผงปุ่มตั้งค่ารูปการ์ดส่วนตัวสำหรับคนมียศ Artist (สำหรับ Admin)');

async function handleSetupArtistCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
    return true;
  }

  const embed = new EmbedBuilder()
    .setTitle('🎨 𝙕𝙀𝙉 𝘽𝙊𝙏 • ARTIST CARD CUSTOMIZER')
    .setDescription('สำหรับสมาชิกที่มียศ **Artist** หรือ **Aritist | 3d** กดปุ่มด้านล่างเพื่อเลือกเปลี่ยนพื้นหลังการ์ด `/level` หรือกระเป๋าเงิน Wallet ส่วนตัวของคุณได้ทันที!\n──────────────────────')
    .setColor('#FF69B4')
    .setImage('https://cdn.discordapp.com/attachments/1550576199829430382/1559721936588636220/IMG_7335.jpg?ex=6ad8ad7f&is=6ad75bff&hm=7abc72dc7a21ce57c299d6c88eeca6073cf0e33aac005569262c706a3e8a0e88&');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('open_artist_level_card_modal')
      .setLabel('🎨 เปลี่ยนรูปการ์ด Level')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('open_artist_wallet_card_modal')
      .setLabel('💰 เปลี่ยนรูปการ์ด Wallet')
      .setStyle(ButtonStyle.Success)
  );

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ ส่งแผงปุ่มตั้งค่าการ์ด Artist ไปยังห้องนี้สำเร็จแล้ว!', ephemeral: true });
  return true;
}

async function handleArtistButton(interaction, serverConfigs) {
  if (interaction.customId !== 'open_artist_level_card_modal' && interaction.customId !== 'open_artist_wallet_card_modal') return false;

  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const artistRoleId = '1560224726868295740';
  const artist3dRoleId = '1560136361015513108';

  const member = interaction.member;
  const config = serverConfigs[guildId] || {};
  const userStat = config.levels?.[userId] || {};
  const now = Date.now();

  const hasArtistRole = member.roles.cache.has(artistRoleId);
  const hasArtist3dRole = member.roles.cache.has(artist3dRoleId);
  const hasTempAccess = userStat.artistUntil && userStat.artistUntil > now;

  if (!hasArtistRole && !hasArtist3dRole && !hasTempAccess) {
    await interaction.reply({ 
      content: '❌ คุณไม่มีสิทธิ์ใช้งาน! เฉพาะผู้ที่มี **ยศ Artist** หรือ **Aritist | 3d** เท่านั้นที่จะเปลี่ยนพื้นหลังการ์ดได้', 
      ephemeral: true 
    });
    return true;
  }

  const isWallet = interaction.customId === 'open_artist_wallet_card_modal';
  const modal = new ModalBuilder()
    .setCustomId(isWallet ? 'artistWalletCardModal' : 'artistLevelCardModal')
    .setTitle(isWallet ? '💰 ปรับแต่งรูปการ์ด Wallet ส่วนตัว' : '🎨 ปรับแต่งรูปการ์ด Level ส่วนตัว');

  const imageUrlInput = new TextInputBuilder()
    .setCustomId('cardImageUrl')
    .setLabel('ลิงก์รูปภาพพื้นหลัง (Image URL)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://example.com/my-image.png')
    .setValue(isWallet ? (userStat.customWalletTheme || '') : (userStat.customTheme || ''))
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(imageUrlInput));
  await interaction.showModal(modal);
  return true;
}

async function handleArtistModalSubmit(interaction, serverConfigs, saveConfigs) {
  if (interaction.customId !== 'artistLevelCardModal' && interaction.customId !== 'artistWalletCardModal') return false;

  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const imageUrl = interaction.fields.getTextInputValue('cardImageUrl').trim();

  if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
    await interaction.reply({ content: '❌ ลิงก์ไม่ถูกต้อง! กรุณาระบุลิงก์รูปภาพที่ขึ้นต้นด้วย http:// หรือ https://', ephemeral: true });
    return true;
  }

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].levels) serverConfigs[guildId].levels = {};
  if (!serverConfigs[guildId].levels[userId]) {
    serverConfigs[guildId].levels[userId] = { xp: 0, level: 1, orbs: 0, lastDaily: 0, boostUntil: 0, artistUntil: 0, customTheme: '', customWalletTheme: '' };
  }

  const isWallet = interaction.customId === 'artistWalletCardModal';
  if (isWallet) {
    serverConfigs[guildId].levels[userId].customWalletTheme = imageUrl;
  } else {
    serverConfigs[guildId].levels[userId].customTheme = imageUrl;
  }
  await saveConfigs(serverConfigs);

  await interaction.reply({ content: `✅ บันทึกรูปภาพพื้นหลังการ์ดสำเร็จ! ลองพิมพ์ \`${isWallet ? '/coins' : '/level'}\` ดูการเปลี่ยนแปลงได้เลย`, ephemeral: true });
  return true;
}

module.exports = {
  setupArtistCommand,
  handleSetupArtistCommand,
  handleArtistButton,
  handleArtistModalSubmit
};
