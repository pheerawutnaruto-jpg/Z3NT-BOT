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
    .setTitle('🛒 𝙕𝙀𝙉 𝘽𝙊𝙏 • PREMIUM STORE')
    .setDescription('🎉 **ของดีต้อง Zen Bot เท่านั้น!**\n💎 จำหน่ายสินค้า Bot Premium, ยศถาวร และแพ็กเกจเสริมสุดคุ้ม\n\n👇 **คลิกเลือกสินค้าที่ต้องการสั่งซื้อจากเมนูด้านล่างได้เลยครับ**')
    .setColor('#00FF00')
    .setImage('https://placehold.co/600x300/101010/FFFFFF/png?text=ZEN+BOT+PREMIUM+STORE');

  // สร้างเมนูกดเลือกสินค้า (Select Menu) แบบในรูปตัวอย่าง
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

  let productName = '';
  let productPrice = '';
  if (selectedValue === 'product_bot_premium') {
    productName = 'BOT PREMIUM (รายเดือน)';
    productPrice = '฿299.00';
  } else if (selectedValue === 'product_artist_role') {
    productName = 'ยศ Artist ถาวร';
    productPrice = '฿60.00';
  }

  await interaction.deferReply({ ephemeral: true });

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
          id: clientUserOrAdminRoleId = interaction.client.user.id, // ให้บอทจัดการได้
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
        }
      ],
    });

    const ticketEmbed = new EmbedBuilder()
      .setTitle(`🎫 ออร์เดอร์สินค้า: ${productName}`)
      .setDescription(`สวัสดีคุณ <@${user.id}>!\nคุณได้เลือกสั่งซื้อสินค้า: **${productName}**\n💰 **ยอดชำระ:** \`${productPrice}\`\n\n📱 **ช่องทางชำระเงิน:**\nโอนเงินผ่านพร้อมเพย์เบอร์: \`08x-xxx-xxxx\` หรือทรูมันนี่วอลเล็ต\n\n*กรุณาส่งสลิปหลักฐานการโอนเงินในห้องนี้ เพื่อให้แอดมินตรวจสอบและกดยืนยันคำสั่งซื้อครับ*`)
      .setColor('#FFD700')
      .setTimestamp();

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('close_order_ticket')
        .setLabel('🔒 ปิดออร์เดอร์ / ลบห้อง')
        .setStyle(ButtonStyle.Danger)
    );

    await ticketChannel.send({ content: `🔔 ออร์เดอร์ใหม่จาก <@${user.id}>`, embeds: [ticketEmbed], components: [closeRow] });

    await interaction.editReply({ content: `✅ สร้างห้องออร์เดอร์ส่วนตัวให้คุณแล้วครับ: <#${ticketChannel.id}>` });
  } catch (err) {
    console.error('Error creating order ticket channel:', err);
    await interaction.editReply({ content: '❌ เกิดข้อผิดพลาดในการสร้างห้องออร์เดอร์ กรุณาติดต่อแอดมินครับ' });
  }

  return true;
}

// 🔒 ฟังก์ชันปิดห้องออร์เดอร์
async function handleCloseTicketButton(interaction) {
  if (interaction.customId !== 'close_order_ticket') return false;

  await interaction.reply({ content: '🔒 กำลังปิดห้องออร์เดอร์ใน 5วินาที...' });
  setTimeout(() => {
    interaction.channel.delete().catch(() => {});
  }, 5000);

  return true;
}

module.exports = {
  setupOrderTicketCommand,
  handleSetupOrderTicketCommand,
  handleOrderTicketSelect,
  handleCloseTicketButton
};
