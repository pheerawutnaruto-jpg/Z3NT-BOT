const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

// 📦 รายการสินค้าในร้านค้า (คุณสามารถเปลี่ยนชื่อยศและราคา Zen Coins ได้ตามต้องการตรงนี้)
const SHOP_ITEMS = [
  { id: 'role_vip', name: '🌟 VIP Member', price: 100, roleId: 'ใส่_ID_ยศ_VIP_ตรงนี้', description: 'ยศพิเศษสีสันสวยงาม เข้าถึงห้องลับและสิทธิประโยชน์เพียบ!' },
  { id: 'role_legend', name: '🔥 Legend Role', price: 500, roleId: 'ใส่_ID_ยศ_Legend_ตรงนี้', description: 'ยศขั้นเทพ แสดงความเก๋าในเซิร์ฟเวอร์' }
];

// 🛍️ คำสั่งเปิดร้านค้า
const shopCommand = new SlashCommandBuilder()
  .setName('shop')
  .setDescription('เปิดร้านค้าเซิร์ฟเวอร์ ใช้ Zen Coins ซื้อยศและไอเทมพิเศษ');

async function handleShopCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].levels) serverConfigs[guildId].levels = {};
  if (!serverConfigs[guildId].levels[userId]) {
    serverConfigs[guildId].levels[userId] = { xp: 0, level: 1, orbs: 0, lastDaily: 0 };
  }

  const userCoins = serverConfigs[guildId].levels[userId].orbs || 0;

  const embed = new EmbedBuilder()
    .setTitle('🛒 𝙕𝙀𝙉 𝘽𝙊𝙏 • SERVER SHOP')
    .setDescription(`ยินดีต้อนรับสู่ร้านค้าเซิร์ฟเวอร์!\n💰 Zen Coins ของคุณ: **${userCoins} Coins**\n\nเลือกกดปุ่มสินค้าด้านล่างเพื่อซื้อได้เลย:`)
    .setColor('#FFD700');

  SHOP_ITEMS.forEach(item => {
    embed.addFields({
      name: `${item.name} (ราคา: ${item.price} Coins)`,
      value: `${item.description}\n──────────────────────`,
      inline: false
    });
  });

  const row = new ActionRowBuilder();
  SHOP_ITEMS.forEach(item => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`buy_item_${item.id}`)
        .setLabel(`ซื้อ ${item.name} (${item.price}c)`)
        .setStyle(ButtonStyle.Primary)
    );
  });

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

// 🛒 ระบบกดปุ่มซื้อสินค้า
async function handleShopButton(interaction, serverConfigs, saveConfigs) {
  if (!interaction.customId.startsWith('buy_item_')) return false;

  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const itemId = interaction.customId.replace('buy_item_', '');

  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) {
    await interaction.reply({ content: '❌ ไม่พบสินค้านี้ในระบบ!', ephemeral: true });
    return true;
  }

  if (!serverConfigs[guildId] || !serverConfigs[guildId].levels || !serverConfigs[guildId].levels[userId]) {
    await interaction.reply({ content: '❌ คุณยังไม่มี Zen Coins สะสมเลย!', ephemeral: true });
    return true;
  }

  const userStat = serverConfigs[guildId].levels[userId];
  const userCoins = userStat.orbs || 0;

  if (userCoins < item.price) {
    await interaction.reply({ content: `❌ Zen Coins ของคุณไม่พอ! (คุณมี ${userCoins} Coins แต่สินค้า ${item.price} Coins)`, ephemeral: true });
    return true;
  }

  // หักเงิน
  userStat.orbs -= item.price;
  await saveConfigs(serverConfigs);

  // มอบยศให้ผู้ใช้
  try {
    const member = await interaction.guild.members.fetch(userId);
    const role = await interaction.guild.roles.fetch(item.roleId);
    if (role) {
      await member.roles.add(role);
      await interaction.reply({ content: `🎉 ซื้อสำเร็จ! คุณได้รับ **${item.name}** เรียบร้อยแล้ว (ยอดคงเหลือ: ${userStat.orbs} Zen Coins)`, ephemeral: true });
    } else {
      await interaction.reply({ content: `⚠️ ซื้อสำเร็จและหักเหงียนแล้ว แต่ไม่พบยศ ID นี้ในเซิร์ฟเวอร์ กรุณาแจ้ง Admin!`, ephemeral: true });
    }
  } catch (err) {
    console.error('Error giving shop role:', err);
    await interaction.reply({ content: `❌ เกิดข้อผิดพลาดในการมอบยศ กรุณาแจ้ง Admin ครับ`, ephemeral: true });
  }

  return true;
}

module.exports = {
  shopCommand,
  handleShopCommand,
  handleShopButton
};
