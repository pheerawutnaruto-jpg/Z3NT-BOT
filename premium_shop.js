const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { isServerPremium } = require('./license');

const PREMIUM_ITEMS = [
  { 
    id: 'buy_coins_10', 
    name: '🪙 เติม 10 Zen Coins', 
    price: 10, 
    coins: 10, 
    type: 'topup',
    buttonLabel: 'เติม 10 บาท (ได้ 10 Coins)',
    description: 'เติมเงินสด 10 บาท รับทันที 10 Zen Coins เข้ากระเป๋าสำหรับซื้อไอเทมในเกม!' 
  },
  { 
    id: 'perm_artist', 
    name: '👑 ยศ Artist ถาวร', 
    price: 60, 
    type: 'role',
    roleId: '1560136361015513108',
    buttonLabel: 'ซื้อยศ Artist ถาวร (60 บาท)',
    description: 'ปลดล็อกยศ Artist ถาวรตลอดชีพ ไม่ต้องต่ออายุ เปลี่ยนรูปการ์ด /level ได้ตลอดไป!' 
  },
  { 
    id: 'perm_chilling', 
    name: '☕ ยศพิเศษ สายชิลล์ ถาวร', 
    price: 20, 
    type: 'role',
    roleId: '1560002494204084395',
    buttonLabel: 'ซื้อยศ สายชิลล์ ถาวร (20 บาท)',
    description: 'ยศตกแต่งโปรไฟล์สุดชิลล์ ถาวรตลอดชีพ แยกจากสายแรงค์เลเวล' 
  },
  { 
    id: 'perm_nightowl', 
    name: '🌙 ยศพิเศษ คนนอนดึก ถาวร', 
    price: 20, 
    type: 'role',
    roleId: '1560002616266854420',
    buttonLabel: 'ซื้อยศ คนนอนดึก ถาวร (20 บาท)',
    description: 'ยศตกแต่งโปรไฟล์สำหรับสายโต้รุ่ง ถาวรตลอดชีพ' 
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
    .setTitle('💳 𝙕𝙀𝙉 𝘽𝙊𝙏 • PREMIUM STORE & TOPUP')
    .setDescription('ร้านค้าพรีเมียมสำหรับเติมเงิน (1 Coin = 1 บาท) และซื้อยศถาวรตลอดชีพ!\nกดปุ่มคำสั่ง `/shop` หรือกดปุ่มด้านล่างเพื่อเปิดร้านค้าพรีเมียมได้เลย:')
    .setColor('#FFD700');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('open_premium_shop_panel')
      .setLabel('💳 เปิดร้านค้าพรีเมียม / เติมเงิน')
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
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const config = serverConfigs[guildId] || {};
  const userStat = config.levels?.[userId];
  const userCoins = userStat ? (userStat.orbs || 0) : 0;

  const embed = new EmbedBuilder()
    .setTitle('💳 𝙕𝙀𝙉 𝘽𝙊𝙏 • PREMIUM STORE & TOPUP')
    .setDescription(`ร้านค้าพรีเมียมและเติมเงิน (1 Coin = 1 บาท)\n💰 เหรียญของคุณตอนนี้: **${userCoins} Coins**\n\nกดปุ่มสินค้าด้านล่างเพื่อดู QR Code ชำระเงิน:`)
    .setColor('#FFD700');

  PREMIUM_ITEMS.forEach(item => {
    embed.addFields({
      name: `${item.name} (ราคา: ${item.price} บาท)`,
      value: `${item.description}\n──────────────────────`,
      inline: false
    });
  });

  const row = new ActionRowBuilder();
  PREMIUM_ITEMS.forEach(item => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`buy_perm_${item.id}`)
        .setLabel(item.buttonLabel)
        .setStyle(item.type === 'topup' ? ButtonStyle.Success : ButtonStyle.Primary)
    );
  });

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handlePremiumShopButton(interaction, serverConfigs) {
  if (interaction.customId === 'open_premium_shop_panel') {
    return await handlePremiumShopCommand(interaction, serverConfigs);
  }

  if (!interaction.customId.startsWith('buy_perm_')) return false;

  const itemId = interaction.customId.replace('buy_perm_', '');
  const item = PREMIUM_ITEMS.find(i => i.id === itemId);
  if (!item) return true;

  // 📌 เลือกระหว่าง QR Code PromptPay (สำหรับซื้อยศ) กับ TrueMoney Wallet (สำหรับเติมเงิน)
  const promptPayQr = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560193259953717279/ReceiveMoney_QR_2026-10-15_14.14.01.png';
  const trueMoneyQr = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560193260293595176/ReceiveMoney_QR_2026-10-15_14.13.55.png';
  const selectedQr = item.type === 'topup' ? trueMoneyQr : promptPayQr;
  const truemoneyLink = 'https://tmn.app.link/57MAEZTBf7b';

  const embed = new EmbedBuilder()
    .setTitle(`💳 ชำระเงินพรีเมียม / เติมเงิน`)
    .setDescription(`คุณกำลังสั่งซื้อ: **${item.name}**\n💰 ยอดที่ต้องชำระ: **${item.price} บาท**\n\n──────────────────────\n📌 **สแกน QR Code ด้านล่างเพื่อโอนเงิน:**\n🔗 หรือคลิกลิงก์จ่ายผ่านทรูมันนี่: [กดที่นี่เพื่อเปิดแอป TrueMoney](${truemoneyLink})`)
    .setImage(selectedQr)
    .setColor('#00FF00')
    .setFooter({ text: 'เมื่อโอนเงินแล้ว ส่งสลิปให้แอดมินเพื่อเติมเหรียญ / กดรับยศถาวรได้เลยครับ!' });

  await interaction.reply({ embeds: [embed], ephemeral: true });
  return true;
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
