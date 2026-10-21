const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');

const setupOrderTicketCommand = new SlashCommandBuilder()
  .setName('setup-order-ticket')
  .setDescription('💎 [PREMIUM] ส่งแผงร้านค้าแบบมีเมนูกดเลือกสินค้าและสร้างห้องออร์เดอร์ (สำหรับ Admin)');

// ข้อมูลสินค้าและ Role ID สำหรับมอบยศอัตโนมัติเมื่อแอดมินกดยืนยัน
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
    .setTitle('<a:emoji_93:1560403772025344101> 𝙕𝙀𝙉 𝘽𝙊𝙏 • SELECT STORE')
    .setDescription('ศูนย์รวมการสั่งซื้อยศถาวรและแพ็กเกจพิเศษผ่านเมนูดรอปดาวน์ สะดวก รวดเร็ว และเป็นส่วนตัว\n\n📌 **วิธีใช้งาน:** เลือกรายการสินค้าที่ต้องการจากกล่องตัวเลือกด้านล่างได้ทันที')
    .setColor('#00FF00')
    .setImage('https://cdn.discordapp.com/attachments/1559878908348997774/1560429202589876295/1792105154505.jpg');

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('select_product_order')
    .setPlaceholder('🛒 เลือกสินค้าที่ต้องการสั่งซื้อ')
    .addOptions([
      {
        label: 'BOT PREMIUM (รายเดือน)',
        description: 'สต็อกไม่จำกัด • ฿399.00 / 1 เดือน • ยศ: Bot Premium',
        value: 'product_bot_premium',
        emoji: '💎'
      },
      {
        label: 'ยศ Artist ถาวร',
        description: 'สต็อกไม่จำกัด • ฿69.00 / ถาวร • สิทธิ์แต่งการ์ดส่วนตัว',
        value: 'product_artist_role',
        emoji: '🎨'
      },
      {
        label: 'ยศพิเศษ สายชิลล์ ถาวร',
        description: 'สต็อกไม่จำกัด • ฿19.00 / ถาวร • ยศโปรไฟล์สุดชิลล์',
        value: 'product_chilling_role',
        emoji: '☕'
      },
      {
        label: 'ยศพิเศษ คนนอนดึก ถาวร',
        description: 'สต็อกไม่จำกัด • ฿9.00 / ถาวร • ยศโปรไฟล์สายโต้รุ่ง',
        value: 'product_nightowl_role',
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
  await interaction.reply({ content: '✅ ส่งแผงร้านค้าแบบเลือกสินค้าไปยังห้องนี้สำเร็จแล้ว!', ephemeral: true });
  return true;
}

// 🧾 ฟังก์ชันส่งใบเสร็จรับเงิน (Order Receipt)
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

  await channel.send({ embeds: [receiptEmbed] });

  // ส่งใบเสร็จเข้า DM ของลูกค้าเพื่อเก็บเป็นหลักฐานส่วนตัว
  try {
    await customerUser.send({ content: `🎉 **รายการสั่งซื้อของคุณได้รับการอนุมัติเรียบร้อยแล้ว!** นี่คือใบเสร็จรับเงินของคุณครับ:`, embeds: [receiptEmbed] });
  } catch (e) {
    // กรณีลูกค้าปิด DM ไว้ ระบบจะข้ามไปโดยไม่เกิด Error
  }
}

async function handleOrderTicketSelect(interaction, serverConfigs) {
  if (interaction.customId !== 'select_product_order') return false;

  const selectedValue = interaction.values[0];

  if (selectedValue === 'clear_selection') {
    const embed = new EmbedBuilder()
      .setTitle('<a:emoji_93:1560403772025344101> 𝙕𝙀𝙉 𝘽𝙊𝙏 • SELECT STORE')
      .setDescription('ศูนย์รวมการสั่งซื้อยศถาวรและแพ็กเกจพิเศษผ่านเมนูดรอปดาวน์ สะดวก รวดเร็ว และเป็นส่วนตัว\n\n📌 **วิธีใช้งาน:** เลือกรายการสินค้าที่ต้องการจากกล่องตัวเลือกด้านล่างได้ทันที')
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
    await interaction.update({ embeds: [embed], components: [row] });
    return true;
  }

  const product = ORDER_PRODUCTS[selectedValue];
  if (!product) return false;

  const guild = interaction.guild;
  const user = interaction.user;
  const member = interaction.member;
  const loadingGif = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560407479412588686/IMG_7559.gif';

  // 🔒 ป้องกันคนที่มียศถาวรของสินค้านั้นอยู่แล้ว มาซื้อซ้ำซ้อน
  if (product.roleId && member.roles.cache.has(product.roleId)) {
    await interaction.reply({ content: `❌ คุณมียศ **${product.name}** อยู่แล้วครับ! ไม่สามารถสั่งซื้อซ้ำได้`, ephemeral: true });
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

  // 1. ปุ่มแสดง QR Code PromptPay
  if (customId.startsWith('pay_promptpay_')) {
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

    await interaction.update({ embeds: [embed], components: [actionRow] });
    return true;
  }

  // 2. 🟢 ปุ่มแอดมินยืนยันสลิป & มอบยศอัตโนมัติ
  if (customId.startsWith('approve_order_')) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ ปุ่มนี้สำหรับ **Administrator** กดยืนยันสลิปเท่านั้นครับ! ลูกค้ากรุณาส่งรูปสลิปในแชทแล้วรอแอดมินสักครู่นะครับ', ephemeral: true });
      return true;
    }

    const parts = customId.replace('approve_order_', '').split('_');
    const customerId = parts.pop();
    const selectedValue = parts.join('_');
    const product = ORDER_PRODUCTS[selectedValue];
    if (!product) return false;

    await interaction.deferUpdate();

    const guild = interaction.guild;
    const customerMember = await guild.members.fetch(customerId).catch(() => null);

    if (!customerMember) {
      await interaction.followUp({ content: '❌ ไม่พบข้อมูลสมาชิกผู้สั่งซื้อในเซิร์ฟเวอร์ (อาจออกจากเซิร์ฟเวอร์ไปแล้ว)', ephemeral: true });
      return true;
    }

    // มอบยศให้ลูกค้าอัตโนมัติ (กรณีเป็นสินค้าประเภทยศ)
    if (product.roleId) {
      try {
        await customerMember.roles.add(product.roleId);
        // หากซื้อ Artist ถาวร แล้วมี Artist | 3d อยู่ ให้ถอดยศเช่า 3 วันออกแทนที่ด้วยยศถาวรเลย
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

    // ปิดปุ่มไม่ให้กดซ้ำ
    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('approved_done')
        .setLabel('✅ อนุมัติและส่งมอบสินค้าเรียบร้อยแล้ว')
        .setStyle(ButtonStyle.Success)
        .setDisabled(true)
    );
    await interaction.editReply({ components: [disabledRow] });

    // ออกใบเสร็จรับเงินเข้าห้องแชทและส่งเข้า DM ลูกค้า
    await sendOrderReceipt(interaction.channel, customerMember.user, interaction.user, product);

    await interaction.channel.send({ content: `🎉 ขอบคุณที่ใช้บริการครับคุณ <@${customerId}>! ห้องออร์เดอร์นี้จะถูกปิดอัตโนมัติใน **10 วินาที**...` });

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
