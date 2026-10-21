const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const axios = require('axios');

// ⚠️ สำคัญมาก: เปลี่ยนเบอร์โทรศัพท์ตรงนี้เป็นเบอร์ TrueMoney Wallet ของคุณ (หรือตั้งในไฟล์ .env)
const TRUEMONEY_WALLET_NUMBER = process.env.TRUEMONEY_PHONE || '0812345678';

// Role IDs
const ROLES = {
  ARTIST_PERM: '1560224726868295740',
  ARTIST_TEMP: '1560136361015513108',
  CHILLING: '1560002494204084395',
  NIGHTOWL: '1560002616266854420'
};

const setupOrderTicketCommand = new SlashCommandBuilder()
  .setName('setup-order-ticket')
  .setDescription('💎 [PREMIUM] ส่งแผงร้านค้าแบบมีเมนูกดเลือกสินค้าและสร้างห้องออร์เดอร์ (for Admin)');

function buildStoreSelectRow() {
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

  return new ActionRowBuilder().addComponents(selectMenu);
}

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

  await interaction.channel.send({ embeds: [embed], components: [buildStoreSelectRow()] });
  await interaction.reply({ content: '✅ ส่งแผงร้านค้าแบบเลือกสินค้าไปยังห้องนี้สำเร็จแล้ว!', ephemeral: true });
  return true;
}

// 🧾 ฟังก์ชันส่งใบเสร็จรับเงิน (Order Receipt)
async function sendOrderReceipt(channel, user, productName, productPriceFormatted, roleStatusText, paymentMethod = 'TrueMoney Wallet (Auto)') {
  const receiptEmbed = new EmbedBuilder()
    .setTitle('🧾 ZEN BOT • OFFICIAL ORDER RECEIPT')
    .setDescription('ใบเสร็จรับเงินยืนยันการทำรายการสำเร็จ ขอบคุณที่ใช้บริการครับ!')
    .setColor('#00FF00')
    .addFields(
      { name: '👤 ผู้สั่งซื้อ', value: `<@${user.id}>`, inline: true },
      { name: '🛒 สินค้า', value: productName, inline: true },
      { name: '💰 ยอดชำระ', value: `\`${productPriceFormatted}\``, inline: true },
      { name: '💳 ช่องทางชำระ', value: paymentMethod, inline: true },
      { name: '👑 สถานะการมอบสินค้า', value: roleStatusText, inline: true },
      { name: '📅 วันที่ทำรายการ', value: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }), inline: false }
    )
    .setTimestamp()
    .setFooter({ text: 'Zen Bot Secure Transaction', iconURL: user.displayAvatarURL() });

  await channel.send({ embeds: [receiptEmbed] });
}

async function handleOrderTicketSelect(interaction, serverConfigs, saveConfigs) {
  if (interaction.customId !== 'select_product_order') return false;

  const selectedValue = interaction.values[0];

  if (selectedValue === 'clear_selection') {
    await interaction.update({ components: [buildStoreSelectRow()] });
    return true;
  }

  const guild = interaction.guild;
  const user = interaction.user;
  const member = interaction.member;

  // 🔒 1. ป้องกันการเปิดห้องออร์เดอร์ซ้ำซ้อน (Spam Ticket Protection)
  const expectedChannelName = `🛒-order-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  const existingChannel = guild.channels.cache.find(c => c.name === expectedChannelName || c.topic === `order_owner:${user.id}`);
  if (existingChannel) {
    await interaction.reply({ 
      content: `⚠️ คุณมีห้องออร์เดอร์ที่ยังเปิดค้างอยู่แล้วครับ: <#${existingChannel.id}> กรุณาทำรายการหรือกดปิดห้องเดิมก่อนนะครับ`, 
      ephemeral: true 
    });
    return true;
  }

  let productName = '';
  let productPriceNum = 0;
  let targetRoleId = null;

  if (selectedValue === 'product_bot_premium') { 
    productName = 'BOT PREMIUM (รายเดือน)'; 
    productPriceNum = 399.00; 
  } else if (selectedValue === 'product_artist_role') { 
    productName = 'ยศ Artist ถาวร'; 
    productPriceNum = 69.00; 
    targetRoleId = ROLES.ARTIST_PERM;
  } else if (selectedValue === 'product_chilling_role') { 
    productName = 'ยศพิเศษ สายชิลล์ ถาวร'; 
    productPriceNum = 19.00; 
    targetRoleId = ROLES.CHILLING;
  } else if (selectedValue === 'product_nightowl_role') { 
    productName = 'ยศพิเศษ คนนอนดึก ถาวร'; 
    productPriceNum = 9.00; 
    targetRoleId = ROLES.NIGHTOWL;
  }

  // 🔒 2. ป้องกันผู้ที่มียศถาวรนั้นๆ อยู่แล้วกดซื้อซ้ำ
  if (targetRoleId && member.roles.cache.has(targetRoleId)) {
    await interaction.reply({ content: `❌ คุณมียศ **${productName}** อยู่แล้วครับ! ไม่สามารถซื้อซ้ำได้`, ephemeral: true });
    return true;
  }

  const loadingGif = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560407479412588686/IMG_7559.gif';
  const loadingEmbed = new EmbedBuilder()
    .setTitle('⏳ กำลังเตรียมช่องทางส่วนตัวของคุณ...')
    .setDescription('ระบบกำลังสร้างห้องออร์เดอร์เฉพาะกิจ กรุณารอสักครู่ครับ')
    .setImage(loadingGif)
    .setColor('#00FFFF');

  await interaction.reply({ embeds: [loadingEmbed], ephemeral: true });

  try {
    const ticketChannel = await guild.channels.create({
      name: expectedChannelName,
      type: ChannelType.GuildText,
      topic: `order_owner:${user.id}`,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
      ],
    });

    const newOrderGif = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560415906281300059/image0.gif';

    const ticketEmbed = new EmbedBuilder()
      .setTitle(`🎟️ รายละเอียดออร์เดอร์: ${productName}`)
      .setDescription(`• **ผู้สั่งซื้อ:** <@${user.id}>\n• **สินค้า:** ${productName}\n• **ยอดที่ต้องชำระ:** \`฿${productPriceNum.toFixed(2)}\`\n\n──────────────────────\n📌 **วิธีชำระเงินอัตโนมัติ:**\nส่งลิงก์ซองอั่งเปา TrueMoney Wallet ในห้องนี้ได้เลย ระบบจะตรวจสอบและมอบสินค้าให้อัตโนมัติทันที!`)
      .setImage(newOrderGif)
      .setColor('#FFD700')
      .setFooter({ text: 'ระบบออร์เดอร์อัตโนมัติ' });

    const payRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pay_promptpay_${selectedValue}`)
        .setLabel('PromptPay QR')
        .setEmoji('1560403647882334208')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('close_order_ticket')
        .setLabel('🔒 ปิดออร์เดอร์')
        .setStyle(ButtonStyle.Danger)
    );

    await ticketChannel.send({ content: `🔔 ออร์เดอร์ใหม่จาก <@${user.id}>`, embeds: [ticketEmbed], components: [payRow] });
    
    const filter = m => m.author.id === user.id && m.content.includes('gift.truemoney.com');
    const collector = ticketChannel.createMessageCollector({ filter, time: 30 * 60 * 1000 });

    collector.on('collect', async m => {
      const giftUrl = m.content.trim();
      const match = giftUrl.match(/v=([a-zA-Z0-9]+)/);
      if (!match) return;

      const processingMsg = await ticketChannel.send(`⏳ กำลังตรวจสอบซองอั่งเปา TrueMoney Wallet กรุณารอสักครู่...`);

      try {
        const voucherHash = match[1];
        const apiEndpoint = `https://gift.truemoney.com/campaign/vouchers/${voucherHash}/redeem`;

        const response = await axios.post(apiEndpoint, {
          mobile: TRUEMONEY_WALLET_NUMBER,
          voucher_hash: voucherHash
        });

        const data = response.data;

        if (data.status.code === 'SUCCESS') {
          const redeemedAmount = parseFloat(data.data.my_ticket.amount);

          if (redeemedAmount < productPriceNum) {
            await processingMsg.edit(`❌ ยอดเงินในซองไม่ครบตามราคาสินค้า! ต้องการ \`฿${productPriceNum.toFixed(2)}\` แต่รับได้ \`฿${redeemedAmount.toFixed(2)}\` กรุณาติดต่อแอดมิน`);
            return;
          }

          let roleStatusText = '✅ จัดส่งสินค้าสำเร็จ';

          // 🔒 3. แยก Try-Catch เฉพาะส่วนการมอบยศ เพื่อไม่ให้ Error ตีกลับไปปนกับระบบจ่ายเงิน
          try {
            const fetchedMember = await guild.members.fetch(user.id);
            if (fetchedMember && targetRoleId) {
              const role = guild.roles.cache.get(targetRoleId);
              if (role) {
                await fetchedMember.roles.add(role);
                roleStatusText = `✅ มอบยศ ${role.name} เรียบร้อยแล้ว`;
              }

              // ถ้าซื้อ Artist ถาวร ให้ถอดยศ Artist | 3d (ชั่วคราว) ออกอัตโนมัติเพื่อไม่ให้ยศซ้อนกัน
              if (targetRoleId === ROLES.ARTIST_PERM && fetchedMember.roles.cache.has(ROLES.ARTIST_TEMP)) {
                await fetchedMember.roles.remove(ROLES.ARTIST_TEMP).catch(() => {});
                if (serverConfigs?.[guild.id]?.levels?.[user.id]) {
                  serverConfigs[guild.id].levels[user.id].artistUntil = 0;
                  if (typeof saveConfigs === 'function') await saveConfigs(serverConfigs);
                }
              }
            }
          } catch (roleErr) {
            console.error('Role Assignment Error:', roleErr);
            roleStatusText = '⚠️ ชำระเงินแล้ว (กรุณาแจ้งแอดมินเพื่อรับยศเนื่องจากสิทธิ์บอทไม่พอ)';
          }

          await processingMsg.edit(`🎉 **ชำระเงินสำเร็จ!** ตรวจสอบยอดเงิน \`฿${redeemedAmount.toFixed(2)}\` เรียบร้อยแล้ว`);
          
          // 🧾 ส่งใบเสร็จรับเงิน
          await sendOrderReceipt(ticketChannel, user, productName, `฿${redeemedAmount.toFixed(2)}`, roleStatusText, 'TrueMoney Wallet (Auto)');

          collector.stop();

          setTimeout(() => {
            ticketChannel.delete().catch(() => {});
          }, 12000);

        } else {
          await processingMsg.edit(`❌ ไม่สามารถรับซองได้: ${data.status.message} (ซองอาจจะเต็ม หรือถูกใช้ไปแล้ว)`);
        }
      } catch (err) {
        console.error('TrueMoney Auto-Redeem Error:', err.response?.data || err.message);
        await processingMsg.edit(`❌ ไม่สามารถรับซองอั่งเปาได้ (ลิงก์อาจไม่ถูกต้อง หมดอายุ หรือถูกรับไปแล้ว)`);
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
