const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

// 🛒 รายการสินค้าทั้งหมดใน Zen Shop
const SHOP_ITEMS = [
  { 
    id: 'gacha_box', 
    name: '🎁 กล่องสุ่มกาชาปอง (Gacha Box)', 
    price: 30, 
    type: 'gacha',
    description: 'เสี่ยงโชคสุ่มรับ Zen Coins ก้อนโตหรือเกลือ! (ลุ้นรับสูงสุด 150 Coins)' 
  },
  { 
    id: 'xp_boost', 
    name: '⚡ น้ำยาคูณ XP (1 ชั่วโมง + ยศ Boost)', 
    price: 100, 
    type: 'buff',
    boostRoleId: 'ใส่_ID_ยศ_XP_Boost_ในเซิร์ฟเวอร์_ตรงนี้', // <-- เอา ID ยศมาใส่ตรงนี้
    description: 'เพิ่มเรต XP คูณ 2 พร้อมรับยศสถานะพิเศษโชว์หล่อ 1 ชั่วโมงเต็ม!' 
  },
  { 
    id: 'role_cafe', 
    name: '☕ ยศพิเศษ Cafe Chill', 
    price: 200, 
    type: 'role',
    roleId: 'ใส่_ID_ยศ_Cafe_Chill_ตรงนี้',
    description: 'ยศตกแต่งโปรไฟล์สุดชิล แยกจากสายแรงค์เลเวลปกติ' 
  },
  { 
    id: 'card_galaxy', 
    name: '🌌 ธีมการ์ดกาแล็กซีพรีเมียม', 
    price: 150, 
    type: 'theme',
    imageUrl: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=800&auto=format&fit=crop&q=60',
    description: 'ปลดล็อกพื้นหลังการ์ด /level เป็นธีมจักรวาลกาแล็กซีสุดอลังการ' 
  }
];

// 🛍️ คำสั่งเปิดร้านค้า
const shopCommand = new SlashCommandBuilder()
  .setName('shop')
  .setDescription('เปิดร้านค้าเซิร์ฟเวอร์ ใช้ Zen Coins ซื้อไอเทม กาชา บัฟ และธีมการ์ด');

// ⏱️ คำสั่งเช็กสถานะบัฟ XP
const boostStatusCommand = new SlashCommandBuilder()
  .setName('boost-status')
  .setDescription('เช็กเวลาคงเหลือของสถานะคูณ XP และยศ Boost ของคุณ');

async function handleShopCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].levels) serverConfigs[guildId].levels = {};
  if (!serverConfigs[guildId].levels[userId]) {
    serverConfigs[guildId].levels[userId] = { xp: 0, level: 1, orbs: 0, lastDaily: 0, boostUntil: 0, customTheme: '' };
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
        .setLabel(`ซื้อ ${item.name.split(' ')[1]} (${item.price}c)`)
        .setStyle(ButtonStyle.Primary)
    );
  });

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handleBoostStatusCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  const userStat = serverConfigs[guildId]?.levels?.[userId];
  const now = Date.now();

  if (!userStat || !userStat.boostUntil || userStat.boostUntil <= now) {
    return await interaction.reply({ content: '❌ ตอนนี้คุณยังไม่ได้เปิดใช้งานน้ำยาคูณ XP (สถานะบัฟหมดอายุหรือยังไม่เคยซื้อ)', ephemeral: true });
  }

  const remainingMs = userStat.boostUntil - now;
  const remainingMinutes = Math.ceil(remainingMs / (1000 * 60));

  await interaction.reply({ content: `⚡ **สถานะ XP Boost ของคุณ:**\nกำลังใช้งานอยู่ เหลือเวลาอีกประมาณ **${remainingMinutes} นาที** ครับ!`, ephemeral: true });
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
    await interaction.reply({ content: `❌ Zen Coins ของคุณไม่พอ! (คุณมี ${userCoins} Coins แต่สินค้าราคา ${item.price} Coins)`, ephemeral: true });
    return true;
  }

  userStat.orbs -= item.price;

  if (item.type === 'gacha') {
    const outcomes = [
      { reward: 0, text: 'เกลือ! รอบนี้ไม่ได้อะไรเลย เสียใจด้วยนะ 😢' },
      { reward: 20, text: 'ได้ทุนคืน! รับไป 20 Zen Coins 🪙' },
      { reward: 80, text: 'โชคดี! ได้กำไรรับไป 80 Zen Coins 🎉' },
      { reward: 150, text: 'แจ็คพอตแตก! สุดยอดดด รับไปเลย 150 Zen Coins 🏆' }
    ];
    const roll = outcomes[Math.floor(Math.random() * outcomes.length)];
    userStat.orbs += roll.reward;
    await saveConfigs(serverConfigs);

    return await interaction.reply({ 
      content: `🎁 **ผลการสุ่มกาชาปอง:**\n${roll.text}\n(ยอด Zen Coins ปัจจุบันของคุณ: ${userStat.orbs} Coins)`, 
      ephemeral: true 
    });
  } 
  
  else if (item.type === 'buff') {
    // บัฟ XP 1 ชั่วโมง + ให้ยศ Boost ทันที
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const currentBoost = userStat.boostUntil && userStat.boostUntil > now ? userStat.boostUntil : now;
    userStat.boostUntil = currentBoost + oneHour;
    
    await saveConfigs(serverConfigs);

    // มอบยศ Boost ให้ทันที
    try {
      const member = await interaction.guild.members.fetch(userId);
      const role = await interaction.guild.roles.fetch(item.boostRoleId);
      if (role && !member.roles.cache.has(item.boostRoleId)) {
        await member.roles.add(role);
      }
    } catch (err) {
      console.error('Error giving boost role:', err);
    }

    return await interaction.reply({ 
      content: `⚡ เปิดใช้งานน้ำยาคูณ XP สำเร็จ! คุณได้รับสิทธิ์คูณ XP 2 เท่า และได้รับ **ยศ Boost** เป็นเวลา 1 ชั่วโมงเต็ม! (ใช้คำสั่ง \`/boost-status\` เพื่อเช็กเวลาได้)`, 
      ephemeral: true 
    });
  } 
  
  else if (item.type === 'role') {
    await saveConfigs(serverConfigs);
    try {
      const member = await interaction.guild.members.fetch(userId);
      const role = await interaction.guild.roles.fetch(item.roleId);
      if (role) {
        await member.roles.add(role);
        return await interaction.reply({ content: `🎉 ซื้อสำเร็จ! คุณได้รับ **${item.name}** เรียบร้อยแล้ว (ยอดคงเหลือ: ${userStat.orbs} Zen Coins)`, ephemeral: true });
      } else {
        return await interaction.reply({ content: `⚠️ ซื้อสำเร็จและหักเหรียญแล้ว แต่ยังไม่ได้ตั้งค่า ID ยศนี้ในระบบ กรุณาแจ้ง Admin ครับ!`, ephemeral: true });
      }
    } catch (err) {
      return await interaction.reply({ content: `❌ เกิดข้อผิดพลาดในการมอบยศ กรุณาแจ้ง Admin ครับ`, ephemeral: true });
    }
  } 
  
  else if (item.type === 'theme') {
    userStat.customTheme = item.imageUrl;
    await saveConfigs(serverConfigs);

    return await interaction.reply({ 
      content: `🎨 ซื้อธีมการ์ดสำเร็จ! ตอนนี้การ์ด /level ของคุณเปลี่ยนเป็น **${item.name}** เรียบร้อยแล้ว ลองพิมพ์เช็กดูได้เลย!`, 
      ephemeral: true 
    });
  }

  return true;
}

module.exports = {
  shopCommand,
  boostStatusCommand,
  handleShopCommand,
  handleBoostStatusCommand,
  handleShopButton,
  SHOP_ITEMS
};
