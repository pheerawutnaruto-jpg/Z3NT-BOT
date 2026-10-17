const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');

const PREMIUM_ITEMS = [
  { 
    id: 'buy_coins_10', 
    name: '<a:emoji_103:1560417845903491112> เติม 10 Zen Coins', 
    price: 10, 
    coins: 10, 
    type: 'topup',
    description: '• สำหรับ: ใช้ซื้อไอเทม / ปลดล็อกฟีเจอร์ต่างๆ' 
  },
  { 
    id: 'buy_coins_50', 
    name: '<a:emoji_103:1560417845903491112> เติม 50 Zen Coins', 
    price: 45, 
    coins: 50, 
    type: 'topup',
    description: '• สำหรับ: แพ็กเกจสุดคุ้ม ประหยัดกว่าเดิม' 
  },
  { 
    id: 'buy_coins_100', 
    name: '<a:emoji_103:1560417845903491112> เติม 100 Zen Coins', 
    price: 89, 
    coins: 100, 
    type: 'topup',
    description: '• สำหรับ: ยอดนิยม สำหรับสายสะสมไอเทม' 
  },
  { 
    id: 'buy_coins_500', 
    name: '<a:emoji_103:1560417845903491112> เติม 500 Zen Coins', 
    price: 399, 
    coins: 500, 
    type: 'topup',
    description: '• สำหรับ: สาย VIP จัดเต็มความคุ้มค่าสูงสุด' 
  }
];

const premiumShopCommand = new SlashCommandBuilder()
  .setName('shop')
  .setDescription('💎 [PREMIUM] เปิดร้านค้าเติมเงิน Topup Shop');

const setupPremiumShopCommand = new SlashCommandBuilder()
  .setName('setup-premium-shop')
  .setDescription('💎 [PREMIUM] ส่งแผงป้ายร้านค้าเติมเงินถาวรไปยังห้องนี้ (สำหรับ Admin)');

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
    .setTitle('<a:emoji_93:1560417845903491112> 𝙕𝙀𝙉 𝘽𝙊𝙏 • OFFICIAL TOPUP SHOP')
    .setDescription('ศูนย์บริการเติม Zen Coins อัตโนมัติ รวดเร็ว ปลอดภัย\n\n📌 **วิธีใช้งาน:** คลิกปุ่มด้านล่างเพื่อเปิดหน้าต่างแพ็กเกจเติมเงินได้ทันทีครับ')
    .setImage('https://cdn.discordapp.com/attachments/1559878908348997774/1560424207702040647/1792104497426.jpg')
    .setColor('#FFD700');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('open_premium_shop_panel')
      .setLabel('💳 เปิดแผงร้านค้าพรีเมียม')
      .setStyle(ButtonStyle.Success)
  );

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ ส่งแผงป้าย Topup Shop ไปยังห้องนี้สำเร็จแล้ว!', ephemeral: true });
}

async function handleCoinsCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const config = serverConfigs[guildId] || {};
  const userStat = config.levels?.[userId];
  const userCoins = userStat ? (userStat.orbs || 0) : 0;
  const customWalletTheme = userStat && userStat.customWalletTheme ? userStat.customWalletTheme : null;

  const embed = new EmbedBuilder()
    .setTitle('💰 WALLET • ยอดเหรียญของคุณ')
    .setDescription(`ยอด Zen Coins คงเหลือในกระเป๋าของ <@${userId}>:\n**${userCoins} Zen Coins**`)
    .setColor('#FFD700')
    .setTimestamp();

  if (customWalletTheme) {
    embed.setImage(customWalletTheme);
  }

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
    serverConfigs[guildId].levels[userId] = { xp: 0, level: 1, orbs: 0, lastDaily: 0, boostUntil: 0, artistUntil: 0, customTheme: '', customWalletTheme: '' };
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
    .setTitle('<a:emoji_93:1560403772025344101> 𝙕𝙀𝙉 𝘽𝙊𝙏 • TOPUP SHOP')
    .setDescription(
      `<a:emoji_100:1560416789211516938> **ยอดเหรียญของคุณ:** \`${userCoins} Zen Coins\`\n\n` +
      'เลือกแพ็กเกจเติมเงินที่คุณต้องการจากรายการด้านล่างนี้ได้เลยครับ:\n──────────────────────'
    )
    .setColor('#FFD700');

  PREMIUM_ITEMS.forEach(item => {
    embed.addFields({
      name: `${item.name} ➔ \`฿${item.price}.00\``,
      value: `${item.description}\n──────────────────────`,
      inline: false
    });
  });

  const row = new ActionRowBuilder();
  PREMIUM_ITEMS.forEach(item => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`create_order_${item.id}`)
        .setLabel(item.name.replace(/<a:[^>]+>\s*/, ''))
        .setEmoji('1560417845903491112')
        .setStyle(ButtonStyle.Primary)
    );
  });

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handlePremiumShopButton(interaction, serverConfigs) {
  if (interaction.customId === 'open_premium_shop_panel') {
    return await handlePremiumShopCommand(interaction, serverConfigs);
  }

  if (interaction.customId.startsWith('create_order_')) {
    const itemId = interaction.customId.replace('create_order_', '');
    const item = PREMIUM_ITEMS.find(i => i.id === itemId);
    if (!item) return true;

    const guild = interaction.guild;
    const user = interaction.user;
    const loadingGif = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560407479412588686/IMG_7559.gif';

    const loadingEmbed = new EmbedBuilder()
      .setTitle('⏳ กำลังเตรียมช่องทางส่วนตัวของคุณ...')
      .setDescription('ระบบกำลังสร้างห้องออร์เดอร์เฉพาะกิจ กรุณารอสักครู่ครับ')
      .setImage(loadingGif)
      .setColor('#00FFFF');

    await interaction.reply({ embeds: [loadingEmbed], ephemeral: true });

    try {
      const ticketChannel = await guild.channels.create({
        name: `🛒-order-${user.username}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
          },
          {
            id: interaction.client.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
          }
        ],
      });

      const newOrderGif = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560415906281300059/image0.gif';

      const cleanItemName = item.name.replace(/<a:[^>]+>\s*/, '');
      const embed = new EmbedBuilder()
        .setTitle(`<a:emoji_103:1560417845903491112> รายละเอียดออร์เดอร์: ${cleanItemName}`)
        .setDescription(`• **ผู้สั่งซื้อ:** <@${user.id}>\n• **สินค้า:** ${cleanItemName}\n• **ยอดที่ต้องชำระ:** \`${item.price} บาท\`\n\n──────────────────────\nเลือกช่องทางการชำระเงินจากปุ่มด้านล่างได้เลยครับ:`)
        .setImage(newOrderGif)
        .setColor('#FFD700')
        .setFooter({ text: 'ช่องทางชำระ' });

      const payRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`pay_truemoney_${item.id}`)
          .setLabel('TrueMoney')
          .setEmoji('1560403718153965618')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`pay_promptpay_${item.id}`)
          .setLabel('PromptPay')
          .setEmoji('1560403647882334208')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('close_order_ticket')
          .setLabel('🔒 ปิดออร์เดอร์')
          .setStyle(ButtonStyle.Danger)
      );

      await ticketChannel.send({ content: `🔔 ออร์เดอร์ใหม่จาก <@${user.id}>`, embeds: [embed], components: [payRow] });
      await interaction.editReply({ content: `✅ สร้างห้องออร์เดอร์ส่วนตัวให้คุณสำเร็จแล้ว: <#${ticketChannel.id}>`, embeds: [] });
    } catch (err) {
      console.error('Error creating order ticket channel:', err);
      await interaction.editReply({ content: '❌ เกิดข้อผิดพลาดในการสร้างห้องออร์เดอร์ กรุณาติดต่อแอดมินครับ', embeds: [] });
    }

    return true;
  }

  if (interaction.customId.startsWith('pay_promptpay_') || interaction.customId.startsWith('pay_truemoney_')) {
    const isTrueMoney = interaction.customId.startsWith('pay_truemoney_');
    const itemId = interaction.customId.replace(isTrueMoney ? 'pay_truemoney_' : 'pay_promptpay_', '');
    const item = PREMIUM_ITEMS.find(i => i.id === itemId);
    if (!item) return true;

    const promptPayQr = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560193260293595176/ReceiveMoney_QR_2026-10-15_14.13.55.png';
    const trueMoneyQr = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560193259953717279/ReceiveMoney_QR_2026-10-15_14.14.01.png';
    const truemoneyLink = 'https://tmn.app.link/57MAEZTBf7b';

    const selectedQr = isTrueMoney ? trueMoneyQr : promptPayQr;
    const cleanItemName = item.name.replace(/<a:[^>]+>\s*/, '');

    const embed = new EmbedBuilder()
      .setTitle('💳 ยืนยันช่องทางชำระเงิน')
      .setDescription(`• **สินค้า:** ${cleanItemName}\n• **ยอดชำระ:** \`${item.price} บาท\`\n\n──────────────────────\n📌 **${isTrueMoney ? 'สแกน QR Code ทรูมันนี่ หรือกดลิงก์ซองของขวัญ:' : 'สแกน QR Code PromptPay ด้านล่างเพื่อโอนเงิน:'}**\n${isTrueMoney ? `🔗 [เปิดแอป TrueMoney Wallet](${truemoneyLink})` : ''}\n\n*เมื่อทำรายการเรียบร้อยแล้ว ส่งสลิปหลักฐานในห้องนี้เพื่อให้แอดมินตรวจสอบและมอบสินค้าให้ได้เลยครับ!*`)
      .setImage(selectedQr)
      .setColor('#00FF00')
      .setFooter({ text: 'ช่องทางชำระ' });

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('close_order_ticket')
        .setLabel('🔒 ปิดออร์เดอร์ / ลบห้อง')
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.update({ embeds: [embed], components: [closeRow] });
    return true;
  }

  if (interaction.customId === 'close_order_ticket') {
    await interaction.reply({ content: '🔒 กำลังปิดห้องออร์เดอร์ใน 5 วินาที...' });
    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 5000);
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
