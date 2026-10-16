const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');

// 💎 [PREMIUM] คำสั่งสำหรับแอดมินส่งแผงเลือกสินค้า
const setupOrderTicketCommand = new SlashCommandBuilder()
  .setName('setup-order-ticket')
  .setDescription('💎 [PREMIUM] ส่งแผงร้านค้าแบบมีเมนูกดเลือกสินค้าและสร้างห้องออร์เดอร์ (สำหรับ Admin)');

async function handleSetupOrderTicketCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle('<a:emoji_93:1560403772025344101> 𝙕𝙀𝙉 𝘽𝙊𝙏 • PREMIUM STORE')
    .setDescription('🎉 **ของดีต้อง Zen Bot เท่านั้น!**\n💎 จำหน่ายสินค้า Bot Premium, ยศถาวร และแพ็กเกจเสริมสุดคุ้ม\n\n👇 **คลิกเลือกสินค้าที่ต้องการสั่งซื้อจากเมนูด้านล่างได้เลยครับ**')
    .setColor('#00FF00')
    .setImage('https://placehold.co/600x300/101010/FFFFFF/png?text=ZEN+BOT+PREMIUM+STORE');

  // สร้างเมนูกดเลือกสินค้า (Select Menu) พร้อมอิโมจิ
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
        label: 'ยศ Artist ถาวร',
        description: 'สต็อกไม่จำกัด • ฿60.00 / ถาวร • สิทธิ์แต่งการ์ดส่วนตัว',
        value: 'product_artist_role',
        emoji: '🎨'
      }
    ]);

  const row = new ActionRowBuilder().addComponents(selectMenu);

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ ส่งแผงร้านค้าแบบเลือกสินค้าไปยังห้องนี้สำเร็จแล้ว!', ephemeral: true });
}

// 🎫 ฟังก์ชันสร้างห้องออร์เดอร์ส่วนตัว (Order Ticket Channel) เมื่อลูกค้าเลือกสินค้า
async function handleOrderTicketSelect(interaction, serverConfigs) {
  if (interaction.customId !== 'select_product_order') return false;

  const selectedValue = interaction.values[0];
  const guild = interaction.guild;
  const user = interaction.user;
  const loadingGif = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560407479412588686/IMG_7559.gif';

  let productName = '';
  let productPrice = '';
  if (selectedValue === 'product_bot_premium') {
    productName = 'BOT PREMIUM (รายเดือน)';
    productPrice = '฿299.00';
  } else if (selectedValue === 'product_artist_role') {
    productName = 'ยศ Artist ถาวร';
    productPrice = '฿60.00';
  }

  // ส่ง Embed โหลดดิ้งชั่วคราวพร้อมภาพ GIF เคลื่อนไหว
  const loadingEmbed = new EmbedBuilder()
    .setTitle('⏳ กำลังประมวลผลออร์เดอร์ของคุณ...')
    .setDescription('กรุณารอสักครู่ ระบบกำลังสร้างห้องออร์เดอร์ส่วนตัวให้คุณครับ')
    .setImage(loadingGif)
    .setColor('#00FFFF');

  await interaction.reply({ embeds: [loadingEmbed], ephemeral: true });

  try {
    // สร้างห้องแชทลับส่วนตัวสำหรับออร์เดอร์นี้
    const ticketChannel = await guild.channels.create({
      name: `🛒-order-${user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: guild.id, // ซ่อนไม่ให้คนอื่นเห็น
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: user.id, // ให้ลูกค้าเห็นและพิมพ์ได้
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        },
        {
          id: interaction.client.user.id, // ให้บอทจัดการได้
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
        }
      ],
    });

    const newOrderGif = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560415906281300059/image0.gif';

    const ticketEmbed = new EmbedBuilder()
      .setTitle(`<a:emoji_103:1560417845903491112> ออร์เดอร์สินค้า: ${productName}`)
      .setDescription(`สวัสดีคุณ <@${user.id}>!\nคุณได้เลือกสั่งซื้อสินค้า: **${productName}**\n💰 **ยอดชำระ:** \`${productPrice}\``)
      .setImage(newOrderGif)
      .setColor('#FFD700')
      .setFooter({ text: 'ช่องทางชำระ' });

    // ปุ่มเลือกช่องทางชำระเงิน พร้อมอิโมจินอนิเมชัน TrueMoney และ PromptPay
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

    await interaction.editReply({ content: `✅ สร้างห้องออร์เดอร์ส่วนตัวให้คุณสำเร็จแล้ว: <#${ticketChannel.id}>`, embeds: [] });
  } catch (err) {
    console.error('Error creating order ticket channel:', err);
    await interaction.editReply({ content: '❌ เกิดข้อผิดพลาดในการสร้างห้องออร์เดอร์ กรุณาติดต่อแอดมินครับ', embeds: [] });
  }

  return true;
}

// 💳 ฟังก์ชันกดเลือกช่องทางชำระเงิน (แสดง QR Code หรือลิงก์ซองของขวัญ)
async function handleOrderPaymentButton(interaction) {
  if (!interaction.customId.startsWith('pay_promptpay_') && !interaction.customId.startsWith('pay_truemoney_')) return false;

  const isTrueMoney = interaction.customId.startsWith('pay_truemoney_');
  const selectedValue = interaction.customId.replace(isTrueMoney ? 'pay_truemoney_' : 'pay_promptpay_', '');

  let productName = selectedValue === 'product_bot_premium' ? 'BOT PREMIUM (รายเดือน)' : 'ยศ Artist ถาวร';
  let productPrice = selectedValue === 'product_bot_premium' ? '฿299.00' : '฿60.00';

  const promptPayQr = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560193260293595176/ReceiveMoney_QR_2026-10-15_14.13.55.png';
  const trueMoneyQr = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560193259953717279/ReceiveMoney_QR_2026-10-15_14.14.01.png';
  const truemoneyLink = 'https://tmn.app.link/57MAEZTBf7b';

  const selectedQr = isTrueMoney ? trueMoneyQr : promptPayQr;

  const embed = new EmbedBuilder()
    .setTitle('💳 ชำระเงินออร์เดอร์สินค้า')
    .setDescription(`คุณกำลังสั่งซื้อ: **${productName}**\n💰 ยอดที่ต้องชำระ: \`${productPrice}\`\n\n──────────────────────\n📌 **${isTrueMoney ? 'สแกน QR Code ทรูมันนี่ หรือเติมผ่านลิงก์ซองของขวัญ:' : 'สแกน QR Code PromptPay ด้านล่างเพื่อโอนเงิน:'}**\n${isTrueMoney ? `🔗 [กดที่นี่เพื่อเปิดแอป TrueMoney Wallet](${truemoneyLink})` : ''}\n\nเมื่อโอนเงินแล้ว ส่งสลิปหลักฐานในห้องนี้เพื่อให้แอดมินตรวจสอบและกดยืนยันคำสั่งซื้อครับ!`)
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

// 🔒 ฟังก์ชันปิดห้องออร์เดอร์
async function handleCloseTicketButton(interaction) {
  if (interaction.customId !== 'close_order_ticket') return false;

  await interaction.reply({ content: '🔒 กำลังปิดห้องออร์เดอร์ใน 5 วินาที...' });
  setTimeout(() => {
    interaction.channel.delete().catch(() => {});
  }, 5000);

  return true;
}

module.exports = {
  setupOrderTicketCommand,
  handleSetupOrderTicketCommand,
  handleOrderTicketSelect,
  handleOrderPaymentButton,
  handleCloseTicketButton
};
