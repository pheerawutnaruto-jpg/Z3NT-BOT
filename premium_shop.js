const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');

const setupPremiumShopCommand = new SlashCommandBuilder()
  .setName('setup-shop')
  .setDescription('💎 ส่งแผงร้านค้าพรีเมียมแบบเลือกสินค้าและสร้างห้องออร์เดอร์ (สำหรับ Admin)');

const premiumShopCommand = new SlashCommandBuilder()
  .setName('shop')
  .setDescription('💎 เปิดร้านค้าพรีเมียม เลือกซื้อ Bot Premium และยศถาวร');

async function handleSetupPremiumShopCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle('<a:emoji_93:1560403772025344101> 𝙕𝙀𝙉 𝘽𝙊𝙏 • PREMIUM STORE')
    .setDescription('✨ **บริการเช่า Bot Premium รายเดือน และซื้อยศถาวรสุดพิเศษ**\n\n📌 เลือกรายการสินค้าที่คุณต้องการจากเมนูด้านล่างได้เลยครับ')
    .setImage('https://cdn.discordapp.com/attachments/1559878908348997774/1560429202589876295/1792105154505.jpg')
    .setColor('#00FF00');

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('select_product_order')
    .setPlaceholder('🛒 เลือกสินค้าที่ต้องการสั่งซื้อ')
    .addOptions([
      {
        label: 'BOT PREMIUM (รายเดือน)',
        description: 'สต็อกไม่จำกัด • ฿299.00 / 1 เดือน • ยศ: Bot Premium',
        value: 'product_bot_premium',
        emoji: '💎'
      },
      {
        label: '👑 ยศ Artist ถาวร',
        description: 'สต็อกไม่จำกัด • ฿60.00 / ถาวร • สิทธิ์แต่งการ์ดส่วนตัว',
        value: 'perm_artist',
        emoji: '🎨'
      },
      {
        label: '☕ ยศพิเศษ สายชิลล์ ถาวร',
        description: 'สต็อกไม่จำกัด • ฿20.00 / ถาวร • ยศโปรไฟล์สุดชิลล์',
        value: 'perm_chilling',
        emoji: '☕'
      },
      {
        label: '🌙 ยศพิเศษ คนนอนดึก ถาวร',
        description: 'สต็อกไม่จำกัด • ฿20.00 / ถาวร • ยศโปรไฟล์สายโต้รุ่ง',
        value: 'perm_nightowl',
        emoji: '🌙'
      },
      {
        label: 'ล้างตัวเลือก',
        description: 'เคลียร์ค่าตัวเลือกให้กลับมาเป็นค่าเริ่มต้น',
        value: 'clear_selection',
        emoji: '❌'
      }
    ]);

  const row = new ActionRowBuilder().addComponents(selectMenu);

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ ส่งแผงร้านค้าพรีเมียมไปยังห้องนี้สำเร็จแล้ว!', ephemeral: true });
}

async function handlePremiumShopSelect(interaction, serverConfigs) {
  if (interaction.customId !== 'select_product_order') return false;

  const selectedValue = interaction.values[0];

  if (selectedValue === 'clear_selection') {
    const embed = new EmbedBuilder()
      .setTitle('<a:emoji_93:1560403772025344101> 𝙕𝙀𝙉 𝘽𝙊𝙏 • PREMIUM STORE')
      .setDescription('✨ **บริการเช่า Bot Premium รายเดือน และซื้อยศถาวรสุดพิเศษ**\n\n📌 เลือกรายการสินค้าที่คุณต้องการจากเมนูด้านล่างได้เลยครับ')
      .setImage('https://cdn.discordapp.com/attachments/1559878908348997774/1560429202589876295/1792105154505.jpg')
      .setColor('#00FF00');

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_product_order')
      .setPlaceholder('🛒 เลือกสินค้าที่ต้องการสั่งซื้อ')
      .addOptions([
        {
          label: 'BOT PREMIUM (รายเดือน)',
          description: 'สต็อกไม่จำกัด • ฿299.00 / 1 เดือน • ยศ: Bot Premium',
          value: 'product_bot_premium',
          emoji: '💎'
        },
        {
          label: '👑 ยศ Artist ถาวร',
          description: 'สต็อกไม่จำกัด • ฿60.00 / ถาวร • สิทธิ์แต่งการ์ดส่วนตัว',
          value: 'perm_artist',
          emoji: '🎨'
        },
        {
          label: '☕ ยศพิเศษ สายชิลล์ ถาวร',
          description: 'สต็อกไม่จำกัด • ฿20.00 / ถาวร • ยศโปรไฟล์สุดชิลล์',
          value: 'perm_chilling',
          emoji: '☕'
        },
        {
          label: '🌙 ยศพิเศษ คนนอนดึก ถาวร',
          description: 'สต็อกไม่จำกัด • ฿20.00 / ถาวร • ยศโปรไฟล์สายโต้รุ่ง',
          value: 'perm_nightowl',
          emoji: '🌙'
        },
        {
          label: 'ล้างตัวเลือก',
          description: 'เคลียร์ค่าตัวเลือกให้กลับมาเป็นค่าเริ่มต้น',
          value: 'clear_selection',
          emoji: '❌'
        }
      ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);
    await interaction.update({ embeds: [embed], components: [row] });
    return true;
  }

  const guild = interaction.guild;
  const user = interaction.user;
  const loadingGif = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560407479412588686/IMG_7559.gif';

  let productName = '';
  let productPrice = '';
  if (selectedValue === 'product_bot_premium') {
    productName = 'BOT PREMIUM (รายเดือน)';
    productPrice = '฿299.00';
  } else if (selectedValue === 'perm_artist') {
    productName = '👑 ยศ Artist ถาวร';
    productPrice = '฿60.00';
  } else if (selectedValue === 'perm_chilling') {
    productName = '☕ ยศพิเศษ สายชิลล์ ถาวร';
    productPrice = '฿20.00';
  } else if (selectedValue === 'perm_nightowl') {
    productName = '🌙 ยศพิเศษ คนนอนดึก ถาวร';
    productPrice = '฿20.00';
  }

  const loadingEmbed = new EmbedBuilder()
    .setTitle('⏳ กำลังเตรียมห้องออร์เดอร์ของคุณ...')
    .setDescription('ระบบกำลังสร้างห้องส่วนตัว กรุณารอสักครู่ครับ...')
    .setImage(loadingGif)
    .setColor('#00FFFF');

  await interaction.reply({ embeds: [loadingEmbed], ephemeral: true });

  try {
    const ticketChannel = await guild.channels.create({
      name: `🛒-order-${user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
      ],
    });

    const newOrderGif = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560415906281300059/image0.gif';

    const ticketEmbed = new EmbedBuilder()
      .setTitle(`<a:emoji_103:1560417845903491112> รายการสั่งซื้อ: ${productName}`)
      .setDescription(`สวัสดีคุณ <@${user.id}>!\nคุณเลือกสั่งซื้อ: **${productName}**\n💰 **ยอดชำระ:** \`${productPrice}\``)
      .setImage(newOrderGif)
      .setColor('#FFD700')
      .setFooter({ text: 'ช่องทางชำระ' });

    const payRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pay_truemoney_${selectedValue}`)
        .setLabel('TrueMoney')
        .setEmoji('1560403718153965618')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`pay_promptpay_${selectedValue}`)
        .setLabel('PromptPay')
        .setEmoji('1560403647882334208')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('close_order_ticket')
        .setLabel('🔒 ปิดออร์เดอร์')
        .setStyle(ButtonStyle.Danger)
    );

    await ticketChannel.send({ content: `🔔 ออร์เดอร์ใหม่จาก <@${user.id}>`, embeds: [ticketEmbed], components: [payRow] });
    await interaction.editReply({ content: `✅ สร้างห้องออร์เดอร์ส่วนตัวให้คุณเรียบร้อยแล้ว: <#${ticketChannel.id}>`, embeds: [] });
  } catch (err) {
    console.error('Error creating order ticket channel:', err);
    await interaction.editReply({ content: '❌ เกิดข้อผิดพลาดในการสร้างห้องออร์เดอร์ กรุณาติดต่อแอดมินครับ', embeds: [] });
  }

  return true;
}

async function handlePremiumShopCommand(interaction, serverConfigs) {
  await handleSetupPremiumShopCommand(interaction);
}

async function handleOrderPaymentButton(interaction) {
  if (!interaction.customId.startsWith('pay_promptpay_') && !interaction.customId.startsWith('pay_truemoney_')) return false;

  const isTrueMoney = interaction.customId.startsWith('pay_truemoney_');
  const selectedValue = interaction.customId.replace(isTrueMoney ? 'pay_truemoney_' : 'pay_promptpay_', '');

  let productName = '';
  let productPrice = '';
  if (selectedValue === 'product_bot_premium') { productName = 'BOT PREMIUM (รายเดือน)'; productPrice = '฿299.00'; }
  else if (selectedValue === 'perm_artist') { productName = '👑 ยศ Artist ถาวร'; productPrice = '฿60.00'; }
  else if (selectedValue === 'perm_chilling') { productName = '☕ ยศพิเศษ สายชิลล์ ถาวร'; productPrice = '฿20.00'; }
  else if (selectedValue === 'perm_nightowl') { productName = '🌙 ยศพิเศษ คนนอนดึก ถาวร'; productPrice = '฿20.00'; }

  const promptPayQr = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560193260293595176/ReceiveMoney_QR_2026-10-15_14.13.55.png';
  const trueMoneyQr = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560193259953717279/ReceiveMoney_QR_2026-10-15_14.14.01.png';
  const truemoneyLink = 'https://tmn.app.link/57MAEZTBf7b';

  const selectedQr = isTrueMoney ? trueMoneyQr : promptPayQr;

  const embed = new EmbedBuilder()
    .setTitle('💳 ช่องทางการชำระเงิน')
    .setDescription(`รายการ: **${productName}**\n💰 ยอดชำระ: \`${productPrice}\`\n\n──────────────────────\n📌 **${isTrueMoney ? 'สแกน QR Code ทรูมันนี่ หรือเติมผ่านซองของขวัญ:' : 'สแกน QR Code PromptPay ด้านล่างเพื่อโอนเงิน:'}**\n${isTrueMoney ? `🔗 [กดที่นี่เพื่อเปิดแอป TrueMoney Wallet](${truemoneyLink})` : ''}\n\n*โอนเงินแล้วส่งสลิปหลักฐานในห้องนี้เพื่อให้แอดมินตรวจสอบได้เลยครับ*`)
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

async function handleCloseTicketButton(interaction) {
  if (interaction.customId !== 'close_order_ticket') return false;

  await interaction.reply({ content: '🔒 กำลังปิดห้องออร์เดอร์ใน 5 วินาที...' });
  setTimeout(() => {
    interaction.channel.delete().catch(() => {});
  }, 5000);

  return true;
}

module.exports = {
  premiumShopCommand,
  setupPremiumShopCommand,
  handleSetupPremiumShopCommand,
  handlePremiumShopSelect,
  handleOrderPaymentButton,
  handleCloseTicketButton
};
