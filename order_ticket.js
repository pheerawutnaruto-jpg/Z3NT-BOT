const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');

const setupOrderTicketCommand = new SlashCommandBuilder()
  .setName('setup-order-ticket')
  .setDescription('💎 [PREMIUM] ส่งแผงร้านค้าแบบมีเมนูกดเลือกสินค้าและสร้างห้องออร์เดอร์ (สำหรับ Admin)');

const ORDER_PRODUCTS = {
  product_bot_premium: { name: 'BOT PREMIUM (รายเดือน)', price: '฿399.00', roleId: null },
  product_artist_role: { name: 'ยศ Artist ถาวร', price: '฿69.00', roleId: '1560224726868295740' },
  product_chilling_role: { name: 'ยศพิเศษ สายชิลล์ ถาวร', price: '฿19.00', roleId: '1560002494204084395' },
  product_nightowl_role: { name: 'ยศพิเศษ คนนอนดึก ถาวร', price: '฿9.00', roleId: '1560002616266854420' }
};

async function handleSetupOrderTicketCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
    return true;
  }

  const embed = new EmbedBuilder()
    .setTitle('<a:emoji_103:1560417845903491112> 𝙕𝙀𝙉 𝘽𝙊𝙏 • SELECT STORE')
    .setDescription('ศูนย์รวมการสั่งซื้อยศถาวรและแพ็กเกจพิเศษ สะดวก และเป็นส่วนตัว')
    .setColor('#00FF00')
    .setImage('https://cdn.discordapp.com/attachments/1559878908348997774/1560429202589876295/1792105154505.jpg');

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('select_product_order')
    .setPlaceholder('เลือกสินค้าที่ต้องการสั่งซื้อ')
    .addOptions([
      { label: 'BOT PREMIUM (รายเดือน)', description: 'สต็อกไม่จำกัด • ฿399.00 / 1 เดือน • ยศ: Bot Premium', value: 'product_bot_premium', emoji: '💎' },
      { label: 'ยศ Artist ถาวร', description: 'สต็อกไม่จำกัด • ฿69.00 / ถาวร • สิทธิ์แต่งการ์ดส่วนตัว', value: 'product_artist_role', emoji: '🎨' },
      { label: 'ยศพิเศษ สายชิลล์ ถาวร', description: 'สต็อกไม่จำกัด • ฿19.00 / ถาวร • ยศโปรไฟล์สุดชิลล์', value: 'product_chilling_role', emoji: '☕' },
      { label: 'ยศพิเศษ คนนอนดึก ถาวร', description: 'สต็อกไม่จำกัด • ฿9.00 / ถาวร • ยศโปรไฟล์สายโต้รุ่ง', value: 'product_nightowl_role', emoji: '🌙' },
      { label: 'ล้างตัวเลือก', description: 'เคลียร์ค่าตัวเลือกให้กลับมาเป็นค่าเริ่มต้น', value: 'clear_selection', emoji: '❌' }
    ]);

  const row = new ActionRowBuilder().addComponents(selectMenu);

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ ส่งแผงร้านค้าแบบเลือกสินค้าไปยังห้องนี้สำเร็จแล้ว!', ephemeral: true });
  return true;
}

async function sendOrderReceipt(channel, customerUser, adminUser, product, paymentMethod = 'PromptPay QR (Verified)') {
  const statusText = product.roleId 
    ? `✅ จัดส่งสำเร็จ (มอบยศ <@&${product.roleId}> แล้ว)` 
    : `✅ ชำระเงินสำเร็จ (ดำเนินการโดยแอดมิน)`;

  const receiptEmbed = new EmbedBuilder()
    .setTitle('🧾 ZEN BOT • OFFICIAL ORDER RECEIPT')
    .setDescription('ใบเสร็จรับเงินยืนยันการทำรายการสำเร็จ ขอบคุณที่ใช้บริการครับ!')
    .setColor('#00FF00')
    .addFields(
      { name: '👤 ผู้สั่งซื้อ', value: `<@${customerUser.id}>`, inline: true },
      { name: '🛒 สินค้า', value: product.name, inline: true },
      { name: '💰 ยอดชำระ', value: `\`${product.price}\``, inline: true },
      { name: '💳 ช่องทางชำระ', value: paymentMethod, inline: true },
      { name: '🛡️ ผู้อนุมัติรายการ', value: `<@${adminUser.id}>`, inline: true },
      { name: '👑 สถานะรายการ', value: statusText, inline: false },
      { name: '📅 วันที่ทำรายการ', value: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }), inline: false }
    )
    .setTimestamp()
    .setFooter({ text: 'Zen Bot Secure Transaction', iconURL: customerUser.displayAvatarURL() });

  await channel.send({ embeds: [receiptEmbed] }).catch(() => {});

  try {
    await customerUser.send({ content: `🎉 **รายการสั่งซื้อของคุณได้รับการอนุมัติเรียบร้อยแล้ว!** นี่คือใบเสร็จรับเงินของคุณครับ:`, embeds: [receiptEmbed] });
  } catch (e) {}
}

async function handleOrderTicketSelect(interaction, serverConfigs) {
  if (interaction.customId !== 'select_product_order') return false;

  const selectedValue = interaction.values[0];

  if (selectedValue === 'clear_selection') {
    await interaction.deferUpdate().catch(() => {});
    const embed = new EmbedBuilder()
      .setTitle('<a:emoji_93:1560403772025344101> 𝙕𝙀𝙉 𝘽𝙊𝙏 • SELECT STORE')
      .setDescription('ศูนย์รวมการสั่งซื้อยศถาวรและแพ็กเกจพิเศษ สะดวก และเป็นส่วนตัว\n\n📌 **วิธีใช้งาน:** เลือกรายการสินค้าที่ต้องการจากกล่องตัวเลือกด้านล่างได้ทันที')
      .setColor('#00FF00')
      .setImage('https://cdn.discordapp.com/attachments/1559878908348997774/1560429202589876295/1792105154505.jpg');

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_product_order')
      .setPlaceholder('🛒 เลือกสินค้าที่ต้องการสั่งซื้อ')
      .addOptions([
        { label: 'BOT PREMIUM (รายเดือน)', description: 'สต็อกไม่จำกัด • ฿399.00 / 1 เดือน', value: 'product_bot_premium', emoji: '💎' },
        { label: 'ยศ Artist ถาวร', description: 'สต็อกไม่จำกัด • ฿69.00 / ถาวร', value: 'product_artist_role', emoji: '🎨' },
        { label: 'ยศพิเศษ สายชิลล์ ถาวร', description: 'สต็อกไม่จำกัด • ฿19.00 / ถาวร', value: 'product_chilling_role', emoji: '☕' },
        { label: 'ยศพิเศษ คนนอนดึก ถาวร', description: 'สต็อกไม่จำกัด • ฿9.00 / ถาวร', value: 'product_nightowl_role', emoji: '🌙' },
        { label: 'ล้างตัวเลือก', description: 'เคลียร์ค่าตัวเลือก', value: 'clear_selection', emoji: '❌' }
      ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);
    await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => {});
    return true;
  }

  const product = ORDER_PRODUCTS[selectedValue];
  if (!product) return false;

  const guild = interaction.guild;
  const user = interaction.user;
  const member = interaction.member;
  const loadingGif = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560407479412588686/IMG_7559.gif';

  if (product.roleId && member.roles.cache.has(product.roleId)) {
    await interaction.reply({ content: `❌ คุณมียศ **${product.name}** อยู่แล้วครับ! ไม่สามารถสั่งซื้อซ้ำได้`, ephemeral: true });
    return true;
  }

  await interaction.deferReply({ ephemeral: true }).catch(() => {});

  const loadingEmbed = new EmbedBuilder()
    .setTitle('⏳ กำลังเตรียมช่องทางส่วนตัวของคุณ...')
    .setDescription('ระบบกำลังสร้างห้องออร์เดอร์เฉพาะกิจ กรุณารอสักครู่ครับ')
    .setImage(loadingGif)
    .setColor('#00FFFF');

  await interaction.editReply({ embeds: [loadingEmbed] });

  try {
    const cleanName = user.username.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '').slice(0, 20) || user.id.slice(-4);

    const ticketChannel = await guild.channels.create({
      name: `🛒-order-${cleanName}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { 
          id: user.id, 
          allow: [
            PermissionFlagsBits.ViewChannel, 
            PermissionFlagsBits.SendMessages, 
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ] 
        },
        { 
          id: interaction.client.user.id, 
          allow: [
            PermissionFlagsBits.ViewChannel, 
            PermissionFlagsBits.SendMessages, 
            PermissionFlagsBits.ManageChannels
          ] 
        }
      ],
    });

    const newOrderGif = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560415906281300059/image0.gif';

    const ticketEmbed = new EmbedBuilder()
      .setTitle(`🎟️ รายละเอียดออร์เดอร์: ${product.name}`)
      .setDescription(
        `• **ผู้สั่งซื้อ:** <@${user.id}>\n` +
        `• **สินค้า:** ${product.name}\n` +
        `• **ยอดที่ต้องชำระ:** \`${product.price}\`\n\n` +
        `──────────────────────\n` +
        `📌 **ขั้นตอนการชำระเงิน:**\n` +
        `1. กดปุ่ม **PromptPay QR** ด้านล่างเพื่อสแกนโอนเงิน\n` +
        `2. ส่งรูปสลิปโอนเงินลงในห้องนี้\n` +
        `3. รอแอดมินกดปุ่มอนุมัติเพื่อรับยศและใบเสร็จอัตโนมัติครับ!`
      )
      .setImage(newOrderGif)
      .setColor('#FFD700')
      .setFooter({ text: 'ช่องทางชำระเงินปลอดภัย' });

    const payRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pay_promptpay_${selectedValue}_${user.id}`)
        .setLabel('PromptPay QR')
        .setEmoji('1560403647882334208')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`approve_order_${selectedValue}_${user.id}`)
        .setLabel('✅ แอดมินยืนยันสลิป & มอบยศ')
        .setStyle(ButtonStyle.Primary),
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
  const customId = interaction.customId;

  if (customId.startsWith('pay_promptpay_')) {
    await interaction.deferUpdate().catch(() => {});

    const parts = customId.replace('pay_promptpay_', '').split('_');
    const customerId = parts.pop();
    const selectedValue = parts.join('_');
    const product = ORDER_PRODUCTS[selectedValue];
    if (!product) return false;

    const promptPayQr = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560193260293595176/ReceiveMoney_QR_2026-10-15_14.13.55.png';

    const embed = new EmbedBuilder()
      .setTitle('💳 ช่องทางชำระเงิน PromptPay QR')
      .setDescription(
        `• **ผู้สั่งซื้อ:** <@${customerId}>\n` +
        `• **สินค้า:** ${product.name}\n` +
        `• **ยอดชำระ:** \`${product.price}\`\n\n` +
        `──────────────────────\n` +
        `📌 **สแกน QR Code ด้านล่างเพื่อโอนเงิน:**\n` +
        `*เมื่อโอนเงินเรียบร้อยแล้ว ส่งรูปสลิปหลักฐานในห้องนี้เพื่อให้แอดมินกดปุ่มอนุมัติและรับยศอัตโนมัติได้เลยครับ!*`
      )
      .setImage(promptPayQr)
      .setColor('#00FF00')
      .setFooter({ text: 'กรุณาส่งสลิปหลังโอนเงินเสร็จสิ้น' });

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`approve_order_${selectedValue}_${customerId}`)
        .setLabel('✅ แอดมินยืนยันสลิป & มอบยศ')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('close_order_ticket')
        .setLabel('🔒 ปิดออร์เดอร์ / ลบห้อง')
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.editReply({ embeds: [embed], components: [actionRow] });
    return true;
  }

  if (customId.startsWith('approve_order_')) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ ปุ่มนี้สำหรับ **Administrator** กดยืนยันสลิปเท่านั้นครับ! ลูกค้ากรุณาส่งรูปสลิปในแชทแล้วรอแอดมินสักครู่นะครับ', ephemeral: true });
      return true;
    }

    await interaction.deferUpdate().catch(() => {});

    const parts = customId.replace('approve_order_', '').split('_');
    const customerId = parts.pop();
    const selectedValue = parts.join('_');
    const product = ORDER_PRODUCTS[selectedValue];
    if (!product) return false;

    const guild = interaction.guild;
    const customerMember = await guild.members.fetch(customerId).catch(() => null);

    if (!customerMember) {
      await interaction.followUp({ content: '❌ ไม่พบข้อมูลสมาชิกผู้สั่งซื้อในเซิร์ฟเวอร์ (อาจออกจากเซิร์ฟเวอร์ไปแล้ว)', ephemeral: true });
      return true;
    }

    if (product.roleId) {
      try {
        await customerMember.roles.add(product.roleId);
        const artist3dRoleId = '1560136361015513108';
        if (product.roleId === '1560224726868295740' && customerMember.roles.cache.has(artist3dRoleId)) {
          await customerMember.roles.remove(artist3dRoleId).catch(() => {});
        }
      } catch (err) {
        console.error('Error granting role on order approval:', err);
        await interaction.followUp({ content: '❌ เกิดข้อผิดพลาดในการมอบยศ! กรุณาตรวจสอบว่ายศของบอทอยู่สูงกว่ายศสินค้าหรือไม่', ephemeral: true });
        return true;
      }
    }

    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('approved_done')
        .setLabel('✅ อนุมัติและส่งมอบสินค้าเรียบร้อยแล้ว')
        .setStyle(ButtonStyle.Success)
        .setDisabled(true)
    );
    await interaction.editReply({ components: [disabledRow] });

    await sendOrderReceipt(interaction.channel, customerMember.user, interaction.user, product);

    await interaction.channel.send({ content: `🎉 ขอบคุณที่ใช้บริการครับคุณ <@${customerId}>! ห้องออร์เดอร์นี้จะถูกปิดอัตโนมัติใน **10 วินาที**...` }).catch(() => {});

    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 10000);

    return true;
  }

  return false;
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
  setupOrderTicketCommand,
  handleSetupOrderTicketCommand,
  handleOrderTicketSelect,
  handleOrderPaymentButton,
  handleCloseTicketButton,
  sendOrderReceipt
};
