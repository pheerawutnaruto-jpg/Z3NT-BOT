const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');

const setupSupportCommand = new SlashCommandBuilder()
  .setName('setup-support')
  .setDescription('💎 [PREMIUM] ส่งแผงป้ายระบบแจ้งปัญหาและติดต่อแอดมินแบบแยกประเภท (สำหรับ Admin)');

async function handleSetupSupportCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
    return true;
  }

  const embed = new EmbedBuilder()
    .setTitle('🎫 ZEN BOT • ADVANCED SUPPORT CENTER')
    .setDescription('ต้องการความช่วยเหลือ ติดต่อซื้อสินค้า หรือแจ้งปัญหาการใช้งาน?\n\n📌 **กรุณาเลือกหมวดหมู่ที่ต้องการจากปุ่มด้านล่างนี้ได้เลยครับ:**')
    .setColor('#5865F2')
    .setImage('https://cdn.discordapp.com/attachments/1559878908348997774/1560429202589876295/1792105154505.jpg');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_cat_shop').setLabel('🛒 ติดต่อร้านค้า/ซื้อสินค้า').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('ticket_cat_bug').setLabel('🛠️ แจ้งปัญหา/บักบอท').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket_cat_admin').setLabel('👑 ติดต่อแอดมินส่วนตัว').setStyle(ButtonStyle.Primary)
  );

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ ส่งแผงป้ายระบบ Support Ticket เรียบร้อยแล้ว!', ephemeral: true });
  return true;
}

async function handleSupportButton(interaction) {
  if (!interaction.customId.startsWith('ticket_cat_')) return false;

  const guild = interaction.guild;
  const user = interaction.user;
  const categoryType = interaction.customId.replace('ticket_cat_', '');

  let categoryName = 'support';
  let categoryTitle = 'สนับสนุนทั่วไป';
  if (categoryType === 'shop') { categoryName = '🛒-shop'; categoryTitle = 'ติดต่อร้านค้า/ซื้อสินค้า'; }
  else if (categoryType === 'bug') { categoryName = '🛠️-bug'; categoryTitle = 'แจ้งปัญหา/บักบอท'; }
  else if (categoryType === 'admin') { categoryName = '👑-admin'; categoryTitle = 'ติดต่อแอดมินส่วนตัว'; }

  await interaction.reply({ content: '⏳ กำลังสร้างห้อง Ticket ส่วนตัวให้คุณ กรุณารอสักครู่...', ephemeral: true });

  try {
    const ticketChannel = await guild.channels.create({
      name: `${categoryName}-${user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
      ],
    });

    const ticketEmbed = new EmbedBuilder()
      .setTitle(`🎫 หมวดหมู่: ${categoryTitle}`)
      .setDescription(`• **ผู้ติดต่อ:** <@${user.id}>\n• **ประเภท:** ${categoryTitle}\n\n📌 *กรุณาพิมพ์รายละเอียดปัญหาหรือความต้องการของคุณไว้ได้เลย แอดมินจะรีบเข้ามาตรวจสอบโดยเร็วที่สุดครับ*`)
      .setColor('#00FFFF')
      .setTimestamp();

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('close_support_ticket').setLabel('🔒 ปิดห้อง Ticket').setStyle(ButtonStyle.Danger)
    );

    await ticketChannel.send({ content: `🔔 มีคำขอความช่วยเหลือใหม่จาก <@${user.id}>`, embeds: [ticketEmbed], components: [closeRow] });
    await interaction.editReply({ content: `✅ สร้างห้อง Ticket สำเร็จแล้ว: <#${ticketChannel.id}>` });
  } catch (err) {
    console.error('Error creating support ticket:', err);
    await interaction.editReply({ content: '❌ เกิดข้อผิดพลาดในการสร้างห้อง Ticket' });
  }

  return true;
}

async function handleCloseSupportButton(interaction) {
  if (interaction.customId !== 'close_support_ticket') return false;

  await interaction.reply({ content: '🔒 กำลังปิดห้อง Ticket ใน 5 วินาที...' });
  setTimeout(() => {
    interaction.channel.delete().catch(() => {});
  }, 5000);

  return true;
}

module.exports = {
  setupSupportCommand,
  handleSetupSupportCommand,
  handleSupportButton,
  handleCloseSupportButton
};
