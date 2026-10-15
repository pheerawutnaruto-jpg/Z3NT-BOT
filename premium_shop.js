const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

const PREMIUM_ITEMS = [
  { 
    id: 'buy_coins_10', 
    name: '🪙 เติม 10 Zen Coins', 
    price: 10, 
    coins: 10, 
    type: 'topup',
    description: '• ร้านค้าเติมเงินระบบอัตโนมัติ\n• ราคา: **฿10.00 / 10 Coins**\n• รูปแบบ: **เครดิตสะสมในเกม**\n• สต็อก: **ไม่จำกัด**' 
  },
  { 
    id: 'perm_artist', 
    name: '👑 ยศ Artist ถาวร', 
    price: 60, 
    type: 'role',
    roleId: '1560136361015513108',
    description: '• ร้านค้าขายยศถาวรตลอดชีพ\n• ราคา: **฿60.00 / ถาวร**\n• รูปแบบ: **ยศถาวร + แต่งการ์ด /level**\n• สต็อก: **ไม่จำกัด**' 
  },
  { 
    id: 'perm_chilling', 
    name: '☕ ยศพิเศษ สายชิลล์ ถาวร', 
    price: 20, 
    type: 'role',
    roleId: '1560002494204084395',
    description: '• ยศตกแต่งโปรไฟล์สุดชิลล์\n• ราคา: **฿20.00 / ถาวร**\n• รูปแบบ: **ยศพิเศษถาวร**\n• สต็อก: **ไม่จำกัด**' 
  },
  { 
    id: 'perm_nightowl', 
    name: '🌙 ยศพิเศษ คนนอนดึก ถาวร', 
    price: 20, 
    type: 'role',
    roleId: '1560002616266854420',
    description: '• ยศตกแต่งโปรไฟล์สายโต้รุ่ง\n• ราคา: **฿20.00 / ถาวร**\n• รูปแบบ: **ยศพิเศษถาวร**\n• สต็อก: **ไม่จำกัด**' 
  }
];

const premiumShopCommand = new SlashCommandBuilder()
  .setName('shop')
  .setDescription('💎 [PREMIUM] เปิดร้านค้าพรีเมียม เติมเหรียญ และซื้อยศถาวรด้วยเงินจริง');

const setupPremiumShopCommand = new SlashCommandBuilder()
  .setName('setup-premium-shop')
  .setDescription('💎 [PREMIUM] ส่งแผงป้ายร้านค้าพรีเมียมถาวรไปยังห้องนี้ (สำหรับ Admin)');

const coinsCommand = new SlashCommandBuilder()
  .setName('coins')
  .setDescription('💎 [PREMIUM] เช็กยอด Zen Coins และเหรียญคงเหลือในกระเป๋าของคุณ');

const addCoinsCommand = new SlashCommandBuilder()
  .setName('add-coins')
  .setDescription('💎 [PREMIUM] เติม Zen Coins ให้กับสมาชิก (สำหรับ Admin)')
  .addUserOption(option => option.setName('user').setDescription('เลือกสมาชิกที่ต้องการเติมเหรียญ').setRequired(true))
  .addIntegerOption(option => option.setName('amount').setDescription('จำนวน Zen Coins ที่ต้องการเติม').setRequired(true));

async function handleSetupPremiumShopCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle('# 📢 ของดีต้อง Zen Bot เท่านั้น')
    .setDescription('ร้านค้าพรีเมียมสำหรับเติมเหรียญและซื้อยศถาวรตลอดชีพ!\nกดปุ่มคำสั่ง `/shop` หรือกดปุ่มด้านล่างเพื่อเลือกสินค้า:')
    .setColor('#00FF00');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('open_premium_shop_panel')
      .setLabel('🛒 เปิดร้านค้าพรีเมียม')
      .setStyle(ButtonStyle.Success)
  );

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ ส่งป้ายร้านค้าพรีเมียมไปยังห้องนี้สำเร็จแล้ว!', ephemeral: true });
}

async function handleCoinsCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const config = serverConfigs[guildId] || {};
  const userStat = config.levels?.[userId];
  const userCoins = userStat ? (userStat.orbs || 0) : 0;

  const embed = new EmbedBuilder()
    .setTitle('💰 WALLET • ยอดเหรียญของคุณ')
    .setDescription(`ยอด Zen Coins คงเหลือในกระเป๋าของ <@${userId}>:\n🪙 **${userCoins} Zen Coins**`)
    .setColor('#FFD700')
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
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

async function handlePremiumShopCommand(interaction, serverConfigs) {
  const embed = new EmbedBuilder()
    .setTitle('# 📢 ของดีต้อง Zen Bot เท่านั้น')
    .setDescription('เลือกสินค้าที่คุณต้องการสั่งซื้อจากปุ่มด้านล่าง:')
    .setColor('#00FF00');

  const row = new ActionRowBuilder();
  PREMIUM_ITEMS.forEach(item => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`view_item_${item.id}`)
        .setLabel(item.name)
        .setStyle(ButtonStyle.Primary)
    );
  });

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handlePremiumShopButton(interaction, serverConfigs) {
  if (interaction.customId === 'open_premium_shop_panel') {
    return await handlePremiumShopCommand(interaction, serverConfigs);
  }

  // 1. เมื่อกดเลือกสินค้าจากปุ่มหลัก จะแสดงรายละเอียดสินค้า พร้อมปุ่มเลือกช่องทางชำระเงิน (PromptPay / TrueMoney)
  if (interaction.customId.startsWith('view_item_')) {
    const itemId = interaction.customId.replace('view_item_', '');
    const item = PREMIUM_ITEMS.find(i => i.id === itemId);
    if (!item) return true;

    const embed = new EmbedBuilder()
      .setTitle(`# 📢 ของดีต้อง Zen Bot เท่านั้น`)
      .setDescription(`**${item.name}**\n\n**คำสั่งที่ได้รับ**\n${item.description}\n\nกดปุ่มด้านล่างเพื่อเลือกช่องทางชำระเงิน:`)
      .setColor('#00FF00');

    const payRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pay_promptpay_${item.id}`)
        .setLabel('💳 พร้อมเพย์ / โอนเงิน')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`pay_truemoney_${item.id}`)
        .setLabel('📱 TrueMoney')
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.update({ embeds: [embed], components: [payRow] });
    return true;
  }

  // 2. เมื่อลูกคือกดเลือกช่องทางชำระเงิน (PromptPay หรือ TrueMoney) จะแสดง QR Code หรือลิงก์ตามที่เลือก
  if (interaction.customId.startsWith('pay_promptpay_') || interaction.customId.startsWith('pay_truemoney_')) {
    const isTrueMoney = interaction.customId.startsWith('pay_truemoney_');
    const itemId = interaction.customId.replace(isTrueMoney ? 'pay_truemoney_' : 'pay_promptpay_', '');
    const item = PREMIUM_ITEMS.find(i => i.id === itemId);
    if (!item) return true;

    const promptPayQr = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560193260293595176/ReceiveMoney_QR_2026-10-15_14.13.55.png';
    const trueMoneyQr = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560193259953717279/ReceiveMoney_QR_2026-10-15_14.14.01.png';
    const truemoneyLink = 'https://tmn.app.link/57MAEZTBf7b';

    const selectedQr = isTrueMoney ? trueMoneyQr : promptPayQr;

    const embed = new EmbedBuilder()
      .setTitle('💳 ชำระเงินพรีเมียม / เติมเงิน')
      .setDescription(`คุณกำลังสั่งซื้อ: **${item.name}**\n💰 ยอดที่ต้องชำระ: **${item.price} บาท**\n\n──────────────────────\n📌 **${isTrueMoney ? 'สแกน QR Code ทรูมันนี่ หรือเติมผ่านลิงก์ซองของขวัญ:' : 'สแกน QR Code พร้อมเพย์ด้านล่างเพื่อโอนเงิน:'}**\n${isTrueMoney ? `🔗 [กดที่นี่เพื่อเปิดแอป TrueMoney Wallet](${truemoneyLink})` : ''}\n\nเมื่อโอนเงินแล้ว ส่งสลิปให้แอดมินเพื่อตรวจสอบและรับสินค้าได้เลยครับ!`)
      .setImage(selectedQr)
      .setColor('#00FF00');

    await interaction.update({ embeds: [embed], components: [] });
    return true;
  }

  return false;
}

module.exports = {
  premiumShopCommand,
  setupPremiumShopCommand,
  coinsCommand,
  addCoinsCommand,
  handleSetupPremiumShopCommand,
  handleCoinsCommand,
  handleAddCoinsCommand,
  handlePremiumShopCommand,
  handlePremiumShopButton
};
