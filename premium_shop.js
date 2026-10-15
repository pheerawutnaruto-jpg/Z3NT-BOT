const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');

const PREMIUM_ITEMS = [
  { 
    id: 'buy_coins_10', 
    name: '🪙 เติม 10 Zen Coins', 
    price: 10, 
    coins: 10, 
    type: 'topup',
    description: 'เติมแพ็กเกจ 10 บาท รับทันที 10 Zen Coins เข้ากระเป๋าสำหรับซื้อไอเทมและปลดล็อกฟีเจอร์พิเศษในเซิร์ฟเวอร์!' 
  },
  { 
    id: 'perm_artist', 
    name: '👑 ยศ Artist ถาวร', 
    price: 60, 
    type: 'role',
    roleId: '1560136361015513108',
    description: 'ปลดล็อกยศ Artist ถาวรตลอดชีพ ไม่ต้องต่ออายุ เปลี่ยนรูปการ์ด /level ได้ตลอดไป!' 
  },
  { 
    id: 'perm_chilling', 
    name: '☕ ยศพิเศษ สายชิลล์ ถาวร', 
    price: 20, 
    type: 'role',
    roleId: '1560002494204084395',
    description: 'ยศตกแต่งโปรไฟล์สุดชิลล์ ถาวรตลอดชีพ แยกจากสายแรงค์เลเวล' 
  },
  { 
    id: 'perm_nightowl', 
    name: '🌙 ยศพิเศษ คนนอนดึก ถาวร', 
    price: 20, 
    type: 'role',
    roleId: '1560002616266854420',
    description: 'ยศตกแต่งโปรไฟล์สำหรับสายโต้รุ่ง ถาวรตลอดชีพ' 
  }
];

const premiumShopCommand = new SlashCommandBuilder()
  .setName('shop')
  .setDescription('💎 [PREMIUM] เปิดร้านค้าพรีเมียม เติมเหรียญ และซื้อยศถาวร');

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
    .setDescription('ร้านค้าพรีเมียมสำหรับเติม Zen Coins และซื้อยศถาวรตลอดชีพ!\nกดปุ่มคำสั่ง `/shop` หรือกดปุ่มด้านล่างเพื่อเปิดร้านค้าพรีเมียมได้เลย:')
    .setColor('#FFD700');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('open_premium_shop_panel')
      .setLabel('💳 เปิดร้านค้าพรีเมียม / เติมเหรียญ')
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
    .setDescription(`ร้านค้าพรีเมียมและระบบเติมเหรียญสะสม\n💰 เหรียญของคุณตอนนี้: **${userCoins} Coins**\n\nกดปุ่มสินค้าด้านล่างเพื่อเลือกซื้อและสร้างห้องออร์เดอร์ส่วนตัว:`)
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
        .setCustomId(`create_order_${item.id}`)
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

  const loadingGif = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560407479412588686/IMG_7559.gif';

  if (interaction.customId.startsWith('create_order_')) {
    const itemId = interaction.customId.replace('create_order_', '');
    const item = PREMIUM_ITEMS.find(i => i.id === itemId);
    if (!item) return true;

    const guild = interaction.guild;
    const user = interaction.user;

    const loadingEmbed = new EmbedBuilder()
      .setTitle('⏳ กำลังประมวลผลออร์เดอร์ของคุณ...')
      .setDescription('กรุณารอสักครู่ ระบบกำลังสร้างห้องออร์เดอร์ส่วนตัวให้คุณครับ')
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

      const embed = new EmbedBuilder()
        .setTitle(`🎫 ออร์เดอร์สินค้า: ${item.name}`)
        .setDescription(`สวัสดีคุณ <@${user.id}>!\nคุณได้เลือกสั่งซื้อสินค้า: **${item.name}**\n💰 **ยอดชำระ:** \`${item.price} บาท\`\n\n${item.description}\n\n👇 **กรุณากดปุ่มด้านล่างเพื่อเลือกช่องทางชำระเงิน:**`)
        .setColor('#FFD700')
        .setTimestamp();

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

    // แสดงหน้าจอ loading ชั่วคราวก่อนแสดง QR Code เพื่อความสมูท
    const loadingEmbed = new EmbedBuilder()
      .setTitle('⏳ กำลังโหลดช่องทางชำระเงิน...')
      .setDescription('กรุณารอสักครู่ ระบบกำลังเตรียม QR Code ให้คุณครับ')
      .setImage(loadingGif)
      .setColor('#00FFFF');

    await interaction.update({ embeds: [loadingEmbed], components: [] });

    // หน่วงเวลาเล็กน้อย 1 วินาทีเพื่อให้เห็นภาพ GIF โหลดดิ้งสวยๆ แล้วค่อยสลับเป็น QR Code
    setTimeout(async () => {
      const promptPayQr = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560193260293595176/ReceiveMoney_QR_2026-10-15_14.13.55.png';
      const trueMoneyQr = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560193259953717279/ReceiveMoney_QR_2026-10-15_14.14.01.png';
      const truemoneyLink = 'https://tmn.app.link/57MAEZTBf7b';

      const selectedQr = isTrueMoney ? trueMoneyQr : promptPayQr;

      const embed = new EmbedBuilder()
        .setTitle('💳 ชำระเงินพรีเมียม / เติมเหรียญ')
        .setDescription(`คุณกำลังสั่งซื้อ: **${item.name}**\n💰 ยอดที่ต้องชำระ: **${item.price} บาท**\n\n──────────────────────\n📌 **${isTrueMoney ? 'สแกน QR Code ทรูมันนี่ หรือเติมผ่านลิงก์ซองของขวัญ:' : 'สแกน QR Code PromptPay ด้านล่างเพื่อโอนเงิน:'}**\n${isTrueMoney ? `🔗 [กดที่นี่เพื่อเปิดแอป TrueMoney Wallet](${truemoneyLink})` : ''}\n\nเมื่อโอนเงินแล้ว ส่งสลิปหลักฐานในห้องนี้เพื่อให้แอดมินตรวจสอบและเติมเหรียญ / มอบยศให้ได้เลยครับ!`)
        .setImage(selectedQr)
        .setColor('#00FF00');

      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('close_order_ticket')
          .setLabel('🔒 ปิดออร์เดอร์ / ลบห้อง')
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.editReply({ embeds: [embed], components: [closeRow] }).catch(() => {});
    }, 1000);

    return true;
  }

  if (interaction.customId. === 'close_order_ticket' || interaction.customId === 'close_order_ticket') {
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
