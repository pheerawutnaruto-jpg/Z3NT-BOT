const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');

const setupOrderTicketCommand = new SlashCommandBuilder()
  .setName('setup-order-ticket')
  .setDescription('💎 [PREMIUM] ส่งแผงร้านค้าดีไซน์ใหม่ล่าสุด (สำหรับ Admin)');

async function handleSetupOrderTicketCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
    return true;
  }

  // ปรับดีไซน์ Embed ให้กระชับ ทันสมัย คุมโทนแบบรูปที่ 1
  const embed = new EmbedBuilder()
    .setTitle('📢 ของดีต้อง Zen เท่านั้น')
    .setDescription(
      '🏷️ จำหน่ายสินค้า bot premium เช่น BOT และร้านค้า SHOP\n\n' +
      'ชำระเงินผ่านห้องออร์เดอร์ส่วนตัว'
    )
    .setColor('#2b2d31') // โทนสีมืดสไตล์ Discord Dark Mode
    .setImage('https://cdn.discordapp.com/attachments/1559878908348997774/1560429202589876295/1792105154505.jpg');

  // ปรับสไตล์ Select Menu ให้ดูสะอาดตาและโมเดิร์นขึ้น
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('select_product_order')
    .setPlaceholder('เลือกสินค้าที่ต้องการสั่งซื้อ')
    .addOptions([
      {
        label: 'BOT PREMIUM (รายเดือน)',
        description: '฿399.00 / 1 เดือน',
        value: 'product_bot_premium',
        emoji: '💎'
      },
      {
        label: 'ยศ Artist ถาวร',
        description: '฿69.00 / ถาวร',
        value: 'product_artist_role',
        emoji: '🎨'
      },
      {
        label: 'ยศพิเศษ สายชิลล์ ถาวร',
        description: '฿19.00 / ถาวร',
        value: 'product_chilling_role',
        emoji: '☕'
      },
      {
        label: 'ยศพิเศษ คนนอนดึก ถาวร',
        description: '฿9.00 / ถาวร',
        value: 'product_nightowl_role',
        emoji: '🌙'
      }
    ]);

  const row = new ActionRowBuilder().addComponents(selectMenu);

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ ส่งแผงร้านค้าดีไซน์ใหม่ไปยังห้องนี้สำเร็จแล้ว!', ephemeral: true });
  return true;
}

// (ฟังก์ชันการทำงานส่วนอื่นๆ ของ Order Ticket คงเดิมตามระบบที่คุณเลือกใช้)
async function handleOrderTicketSelect(interaction, serverConfigs) {
  if (interaction.customId !== 'select_product_order') return false;
  const selectedValue = interaction.values[0];

  const guild = interaction.guild;
  const user = interaction.user;
  const member = interaction.member;
  const loadingGif = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560407479412588686/IMG_7559.gif';

  let productName = '';
  let productPrice = '';

  if (selectedValue === 'product_bot_premium') { productName = 'BOT PREMIUM (รายเดือน)'; productPrice = '฿399.00'; }
  else if (selectedValue === 'product_artist_role') { productName = 'ยศ Artist ถาวร'; productPrice = '฿69.00'; }
  else if (selectedValue === 'product_chilling_role') { productName = 'ยศพิเศษ สายชิลล์ ถาวร'; productPrice = '฿19.00'; }
  else if (selectedValue === 'product_nightowl_role') { productName = 'ยศพิเศษ คนนอนดึก ถาวร'; productPrice = '฿9.00'; }

  const artistPermRoleId = '1560224726868295740';
  if (selectedValue === 'product_artist_role' && member.roles.cache.has(artistPermRoleId)) {
    await interaction.reply({ content: '❌ คุณมียศ **Artist ถาวร** อยู่แล้วครับ! ไม่สามารถซื้อซ้ำได้', ephemeral: true });
    return true;
  }

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
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
      ],
    });

    const ticketEmbed = new EmbedBuilder()
      .setTitle(`🎟️ รายละเอียดออร์เดอร์: ${productName}`)
      .setDescription(`• **ผู้สั่งซื้อ:** <@${user.id}>\n• **สินค้า:** ${productName}\n• **ยอดที่ต้องชำระ:** \`${productPrice}\`\n\n──────────────────────\n📌 **ช่องทางการชำระเงิน:**\nคลิกปุ่มด้านล่างเพื่อดู QR Code สำหรับโอนเงิน จากนั้นส่งสลิปหลักฐานในห้องนี้เพื่อให้แอดมินตรวจสอบครับ`)
      .setColor('#FFD700');

    const payRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pay_promptpay_${selectedValue}`)
        .setLabel('PromptPay QR')
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

async function handleOrderPaymentButton(interaction) {
  if (!interaction.customId.startsWith('pay_promptpay_')) return false;
  const selectedValue = interaction.customId.replace('pay_promptpay_', '');
  
  let productName = '';
  let productPrice = '';
  if (selectedValue === 'product_bot_premium') { productName = 'BOT PREMIUM (รายเดือน)'; productPrice = '฿399.00'; }
  else if (selectedValue === 'product_artist_role') { productName = 'ยศ Artist ถาวร'; productPrice = '฿69.00'; }
  else if (selectedValue === 'product_chilling_role') { productName = 'ยศพิเศษ สายชิลล์ ถาวร'; productPrice = '฿19.00'; }
  else if (selectedValue === 'product_nightowl_role') { productName = 'ยศพิเศษ คนนอนดึก ถาวร'; productPrice = '฿9.00'; }

  const promptPayQr = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560193260293595176/ReceiveMoney_QR_2026-10-15_14.13.55.png';

  const embed = new EmbedBuilder()
    .setTitle('💳 ช่องทางชำระเงิน PromptPay QR')
    .setDescription(`• **สินค้า:** ${productName}\n• **ยอดชำระ:** \`${productPrice}\`\n\n📌 **สแกน QR Code ด้านล่างเพื่อโอนเงิน และส่งสลิปในห้องนี้ได้เลยครับ!**`)
    .setImage(promptPayQr)
    .setColor('#00FF00');

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('close_order_ticket').setLabel('🔒 ปิดออร์เดอร์').setStyle(ButtonStyle.Danger)
  );

  await interaction.update({ embeds: [embed], components: [closeRow] });
  return true;
}

async function handleCloseTicketButton(interaction) {
  if (interaction.customId !== 'close_order_ticket') return false;
  await interaction.reply({ content: '🔒 กำลังปิดห้องออร์เดอร์ใน 5 วินาที...' });
  setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
  return true;
}

module.exports = {
  setupOrderTicketCommand,
  handleSetupOrderTicketCommand,
  handleOrderTicketSelect,
  handleOrderPaymentButton,
  handleCloseTicketButton
};
