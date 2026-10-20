const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const axios = require('axios');

const setupOrderTicketCommand = new SlashCommandBuilder()
  .setName('setup-order-ticket')
  .setDescription('💎 [PREMIUM] ส่งแผงร้านค้าแบบมีเมนูกดเลือกสินค้าและสร้างห้องออร์เดอร์ (for Admin)');

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

  const guild = interaction.guild;
  const user = interaction.user;
  const member = interaction.member;

  // 🔒 เงื่อนไขข้อ 2: ตรวจสอบว่าถ้าซื้อ "ยศ Artist ถาวร" แต่ตัวผู้ใช้มียศ "Artist | 3d" อยู่แล้ว หรือถ้ามีถาวรอยู่แล้วจะเช็กเงื่อนไขซ้ำซ้อน
  const artistPermId = '1560224726868295740'; // Artist ถาวร
  const artist3dId = '1560136361015513108';   // Artist | 3d (เช่า 3 วัน)

  if (selectedValue === 'product_artist_role') {
    if (member.roles.cache.has(artistPermId)) {
      await interaction.reply({ content: '❌ คุณมียศ **Artist ถาวร** อยู่แล้วครับ! ไม่จำเป็นต้องซื้อซ้ำ', ephemeral: true });
      return true;
    }
  }

  let productName = '';
  let productPriceNum = 0;
  if (selectedValue === 'product_bot_premium') { productName = 'BOT PREMIUM (รายเดือน)'; productPriceNum = 399.00; }
  else if (selectedValue === 'product_artist_role') { productName = 'ยศ Artist ถาวร'; productPriceNum = 69.00; }
  else if (selectedValue === 'product_chilling_role') { productName = 'ยศพิเศษ สายชิลล์ ถาวร'; productPriceNum = 19.00; }
  else if (selectedValue === 'product_nightowl_role') { productName = 'ยศพิเศษ คนนอนดึก ถาวร'; productPriceNum = 9.00; }

  const loadingGif = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560407479412588686/IMG_7559.gif';
  const loadingEmbed = new EmbedBuilder()
    .setTitle('⏳ กำลังเตรียมช่องทางส่วนตัวของคุณ...')
    .setDescription('ระบบกำลังสร้างห้องออร์เดอร์เฉพาะกิจ กรุณารอสักครู่ครับ')
    .setImage(loadingGif)
    .setColor('#00FFFF');

  await interaction.reply({ embeds: [loadingEmbed], ephemeral: true });

  try {
    const ticketChannel = await guild.channels.create({
      name: `🛒-order-${user.username}`, type: ChannelType.GuildText, permissionOverwrites: [ { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }, { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] } ], });  const newOrderGif = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560415906281300059/image0.gif';  const ticketEmbed = new EmbedBuilder() .setTitle(`🎟️ รายละเอียดออร์เดอร์: ${productName}`)
      .setDescription(`• **ผู้สั่งซื้อ:** <@${user.id}>\n• **สินค้า:** ${productName}\n• **ยอดที่ต้องชำระ:** \`฿${productPriceNum}.00\`\n\n──────────────────────\n📌 **วิธีชำระเงินอัตโนมัติ:**\nส่งลิงก์ซองอั่งเปา TrueMoney Wallet ในห้องนี้ได้เลย ระบบจะตรวจสอบและมอบสินค้าให้อัตโนมัติทันที!`)
      .setImage(newOrderGif)
      .setColor('#FFD700')
      .setFooter({ text: 'ระบบออร์เดอร์อัตโนมัติ' });

    const payRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pay_promptpay_${selectedValue}`) .setLabel('PromptPay QR') .setEmoji('1560403647882334208') .setStyle(ButtonStyle.Success), new ButtonBuilder() .setCustomId('close_order_ticket') .setLabel('🔒 ปิดออร์เดอร์') .setStyle(ButtonStyle.Danger) );  await ticketChannel.send({ content: `🔔 ออร์เดอร์ใหม่จาก <@${user.id}>`, embeds: [ticketEmbed], components: [payRow] });
    
    // Collector สำหรับดึงลิงก์ซองอั่งเปา
    const filter = m => m.author.id === user.id && m.content.includes('gift.truemoney.com');
    const collector = ticketChannel.createMessageCollector({ filter, time: 30 * 60 * 1000 });

    collector.on('collect', async m => {
      const giftUrl = m.content.trim();
      const match = giftUrl.match(/v=([a-zA-Z0-9]+)/);
      if (!match) return;

      const processingMsg = await ticketChannel.send(`⏳ กำลังตรวจสอบซองอั่งเปา TrueMoney Wallet กรุณารอสักครู่...`);

      try {
        const voucherHash = match[1];
        const storeMobileNumber = '0812345678'; // เบอร์ Wallet ร้านค้าของคุณ
        const apiEndpoint = `https://gift.truemoney.com/campaign/vouchers/${voucherHash}/redeem`;

        const response = await axios.post(apiEndpoint, {
          mobile: storeMobileNumber,
          voucher_hash: voucherHash
        });

        const data = response.data;

        if (data.status.code === 'SUCCESS') {
          const redeemedAmount = parseFloat(data.data.my_ticket.amount);

          if (redeemedAmount < productPriceNum) {
            await processingMsg.edit(`❌ ยอดเงินในซองไม่ถูกต้อง! ต้องการ \`฿${productPriceNum}.00\` แต่ในซองมี \`฿${redeemedAmount}.00\``);
            return;
          }

          // ✅ มอบยศอัตโนมัติ
          let roleGrantedText = '';
          const targetMember = await guild.members.fetch(user.id).catch(() => null);

          if (targetMember) {
            let targetRoleId = null;
            if (selectedValue === 'product_artist_role') targetRoleId = artistPermId;
            else if (selectedValue === 'product_chilling_role') targetRoleId = '1560002494204084395';
            else if (selectedValue === 'product_nightowl_role') targetRoleId = '1560002616266854420';

            if (targetRoleId) {
              const role = guild.roles.cache.get(targetRoleId);
              if (role) {
                // ถ้าซื้อยศ Artist ถาวร ให้ตรวจสอบและถอดยศ Artist | 3d (เช่า 3 วัน) ออกแทนที่ทันที
                if (selectedValue === 'product_artist_role' && targetMember.roles.cache.has(artist3dId)) {
                  await targetMember.roles.remove(artist3dId).catch(() => {});
                }
                await targetMember.roles.add(role);
                roleGrantedText = `พร้อมมอบยศ <@&${targetRoleId}> ให้คุณเรียบร้อยแล้ว!`;
              }
            }
          }

          // 🧾 ระบบสลีปใบเสร็จรับเงิน (Receipt Embed)
          const receiptEmbed = new EmbedBuilder()
            .setTitle('🧾 ZEN BOT • OFFICIAL RECEIPT (ใบเสร็จรับเงิน)')
            .setDescription(
              `• 🛒 **สินค้า:** ${productName}\n` +
              `• 💵 **ยอดชำระ:** \`฿${redeemedAmount}.00 บาท\`\n` +
              `• 👤 **ผู้ซื้อ:** <@${user.id}>\n` +
              `• ⏰ **เวลา:** \`${new Date().toLocaleString('th-TH')}\`\n` +
              `• 👑 **สถานะ:** ชำระเงินสำเร็จ & ${roleGrantedText}\n\n` +
              '──────────────────────\n' +
              '*ขอบคุณที่ใช้บริการ Zen Bot ครับ! ห้องนี้จะปิดอัตโนมัติใน 10 วินาที*'
            )
            .setColor('#00FF00')
            .setTimestamp()
            .setFooter({ text: 'Verified Transaction' });

          await processingMsg.delete().catch(() => {});
          await ticketChannel.send({ embeds: [receiptEmbed] });
          
          collector.stop();

          setTimeout(() => {
            ticketChannel.delete().catch(() => {});
          }, 10000);

        } else {
          await processingMsg.edit(`❌ ไม่สามารถรับซองได้: ${data.status.message} (ซองอาจจะเต็ม หรือถูกใช้ไปแล้ว)`);
        }
      } catch (err) {
        console.error('TrueMoney Auto-Redeem Error:', err.response?.data || err.message);
        await processingMsg.edit(`❌ เกิดข้อผิดพลาดในการเชื่อมต่อตรวจสอบซองอั่งเปา กรุณาติดต่อแอดมิน`);
      }
    });

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
    .setDescription(`• **สินค้า:** ${productName}\n• **ยอดชำระ:** \`${productPrice}\`\n\n──────────────────────\n📌 **สแกน QR Code PromptPay ด้านล่างเพื่อโอนเงิน:**\n\n*หรือส่งลิงก์ซองอั่งเปา TrueMoney Wallet ในแชทร้านค้านี้เพื่อระบบตรวจสอบและมอบยศให้อัตโนมัติได้เลยครับ!*`)
    .setImage(promptPayQr)
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
  setupOrderTicketCommand,
  handleSetupOrderTicketCommand,
  handleOrderTicketSelect,
  handleOrderPaymentButton,
  handleCloseTicketButton
};
