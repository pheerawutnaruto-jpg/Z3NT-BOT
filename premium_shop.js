const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

const setupPremiumShopCommand = new SlashCommandBuilder()
  .setName('setup-premium-shop')
  .setDescription('💎 [PREMIUM] ส่งแผงป้ายร้านค้าพรีเมียมถาวรไปยังห้องนี้ (สำหรับ Admin)');

const addCoinsCommand = new SlashCommandBuilder()
  .setName('add-coins')
  .setDescription('💎 [PREMIUM] เติม Zen Coins ให้กับสมาชิก (สำหรับ Admin)')
  .addUserOption(option => option.setName('user').setDescription('เลือกสมาชิกที่ต้องการเติมเหรียญ').setRequired(true))
  .addIntegerOption(option => option.setName('amount').setDescription('จำนวน Zen Coins ที่ต้องการเติม').setRequired(true));

const coinsCommand = new SlashCommandBuilder()
  .setName('coins')
  .setDescription('💎 [PREMIUM] เช็กยอด Zen Coins ในกระเป๋าของคุณ');

async function handleSetupPremiumShopCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle('💎 𝙕𝙀𝙉 𝘽𝙊𝙏 • PREMIUM SHOP (PERMANENT)')
    .setDescription('สั่งซื้อยศถาวรและไอเทมพิเศษด้วยเงินจริง (โอนผ่าน QR Code พร้อมเพย์ หรือซองของขวัญทรูมันนี่):\n──────────────────────\n🎨 **ยศ Artist ถาวร** (ราคา: 60 บาท)\n👉 *สิทธิ์ Artist ถาวร + แต่งการ์ด /level ส่วนตัวตลอดชีพ!*\n──────────────────────\n📱 **ช่องทางชำระเงิน:** สแกน QR Code ด้านล่าง หรือคลิกปุ่มเพื่อดูรายละเอียด')
    .setColor('#00FF00')
    .setImage('https://cdn.discordapp.com/attachments/1559878908348997774/1560193259953717279/ReceiveMoney_QR_2026-10-15_14.14.01.png'); // QR Code ของคุณ

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('open_premium_shop_panel')
      .setLabel('💳 ช่องทางชำระเงิน / แจ้งสลิป')
      .setStyle(ButtonStyle.Success)
  );

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ ส่งแผงร้านค้าพรีเมียมไปยังห้องนี้สำเร็จแล้ว!', ephemeral: true });
}

async function handleCoinsCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const config = serverConfigs[guildId] || {};
  const userStat = config.levels?.[userId];
  const coins = userStat ? (userStat.orbs || 0) : 0;

  await interaction.reply({ content: `🪙 ยอด Zen Coins ปัจจุบันของคุณ: **${coins} Coins**`, ephemeral: true });
}

async function handleAddCoinsCommand(interaction, serverConfigs, saveConfigs) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
  }

  const targetUser = interaction.options.getUser('user');
  const amount = interaction.options.getInteger('amount');
  const guildId = interaction.guildId;
  const userId = targetUser.id;

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].levels) serverConfigs[guildId].levels = {};
  if (!serverConfigs[guildId].levels[userId]) {
    serverConfigs[guildId].levels[userId] = { xp: 0, level: 1, orbs: 0, lastDaily: 0, boostUntil: 0, artistUntil: 0, customTheme: '' };
  }

  const userStat = serverConfigs[guildId].levels[userId];
  userStat.orbs = (userStat.orbs || 0) + amount;
  await saveConfigs(serverConfigs);

  await interaction.reply({ content: `✅ เติม Zen Coins จำนวน **+${amount} Coins** ให้กับคุณ <@${userId}> สำเร็จแล้ว! (ยอดรวม: ${userStat.orbs} Coins)`, ephemeral: true });
}

async function handleOpenPremiumShop(interaction) {
  if (interaction.customId !== 'open_premium_shop_panel') return false;

  const embed = new EmbedBuilder()
    .setTitle('💳 ข้อมูลการชำระเงินพรีเมียม')
    .setDescription('โอนเงินผ่านพร้อมเพย์ หรือเติมผ่านซองของขวัญทรูมันนี่ได้ที่ลิงก์ด้านล่าง:\n\n🔗 **ลิงก์ซองของขวัญ TrueMoney Wallet:**\nhttps://tmn.app.link/57MAEZTBf7b\n\n*ส่งสลิปหลักฐานหรือยืนยันการเติมเงินให้แอดมินเพื่อตรวจสอบและรับยศถาวร*')
    .setColor('#FFD700');

  await interaction.reply({ embeds: [embed], ephemeral: true });
  return true;
}

async function handlePremiumShopButton(interaction, serverConfigs) {
  const handled = await handleOpenPremiumShop(interaction);
  if (handled) return true;
  return false;
}

module.exports = {
  setupPremiumShopCommand,
  coinsCommand,
  addCoinsCommand,
  handleSetupPremiumShopCommand,
  handleCoinsCommand,
  handleAddCoinsCommand,
  handleOpenPremiumShop,
  handlePremiumShopButton
};
