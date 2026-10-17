const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

const userCooldowns = new Map();

const IN_GAME_ITEMS = [
  { 
    id: 'gacha_box', 
    name: '🎁 กล่องสุ่มกาชาปอง (Gacha Box)', 
    price: 5, 
    type: 'gacha',
    description: 'เสี่ยงโชคสุ่มรับ Zen Coins ก้อนโตหรือเกลือ! (ลุ้นรับสูงสุด 50 Coins)' 
  },
  { 
    id: 'xp_boost', 
    name: '⚡ น้ำยาคูณ XP (1 ชั่วโมง + ยศ Booster)', 
    price: 10, 
    type: 'buff',
    roleId: '1559992075095773184', 
    description: 'คูณ XP 2 เท่า พร้อมรับยศพิเศษ Xp Booster นาน 1 ชั่วโมง!' 
  },
  { 
    id: 'role_artist_temp', 
    name: '🎨 บัตรปลดล็อกยศ Artist (เช่า 3 วัน)', 
    price: 30, 
    type: 'role_temp',
    roleId: '1560136361015513108',
    description: 'รับยศ Artist และสิทธิ์เปลี่ยนรูปการ์ด /level ส่วนตัว นาน 3 วัน!' 
  },
  {
    id: 'cinema_perm',
    name: '🎫 ตั๋วภาพยนตร์ถาวร (20 วัน)',
    price: 15,
    type: 'cinema_role',
    roleId: '1560731553766707241',
    duration: 20 * 24 * 60 * 60 * 1000,
    description: 'รับยศโรงหนังถาวร นาน 20 วัน (ใช้ 15 Zen Coins)'
  },
  {
    id: 'cinema_temp',
    name: '🎟️ ตั๋วภาพยนตร์รายวัน (1 วัน)',
    price: 1,
    type: 'cinema_role',
    roleId: '1551006184272560148',
    duration: 1 * 24 * 60 * 60 * 1000,
    description: 'รับยศโรงหนังพิเศษ นาน 1 วัน (ใช้ 1 Zen Coins)'
  }
];

const setupShopCommand = new SlashCommandBuilder()
  .setName('setup-in-game-shop')
  .setDescription('💎 [PREMIUM] ส่งแผงร้านค้าในเกม (ระบบเมนูดรอปดาวน์) ไปยังห้องนี้ (สำหรับ Admin)');

const boostStatusCommand = new SlashCommandBuilder()
  .setName('boost-status')
  .setDescription('💎 [PREMIUM] เช็กสถานะและเวลาคงเหลือของน้ำยาคูณ XP');

async function handleSetupShopCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle('🛒 𝙕𝙀𝙉 𝘽𝙊𝙏 • IN-GAME SHOP')
    .setDescription('ใช้ Zen Coins ซื้อไอเทม บัฟ บัตรเช่า และตั๋วชมภาพยนตร์ได้จากเมนูดรอปดาวน์ด้านล่างนี้เลย:\n──────────────────────')
    .setColor('#FFD700');

  IN_GAME_ITEMS.forEach(item => {
    embed.addFields({
      name: `${item.name} (ราคา: ${item.price} Coins)`,
      value: `${item.description}\n──────────────────────`,
      inline: false
    });
  });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('shop_item_select')
    .setPlaceholder('📂 กรุณาเลือกสินค้าที่ต้องการซื้อ...');

  IN_GAME_ITEMS.forEach(item => {
    selectMenu.addOptions({
      label: item.name.replace(/[^\w\s\u0E00-\u0E7F]/gi, '').trim(),
      description: `ราคา ${item.price} Coins`,
      value: item.id
    });
  });

  const row = new ActionRowBuilder().addComponents(selectMenu);

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ ส่งแผงร้านค้าในเกมไปยังห้องนี้สำเร็จแล้ว!', ephemeral: true });
}

async function handleBoostStatusCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const config = serverConfigs[guildId] || {};
  const userStat = config.levels?.[userId];
  const now = Date.now();

  if (!userStat || !userStat.boostUntil || userStat.boostUntil <= now) {
    return await interaction.reply({ content: '❌ คุณยังไม่ได้เปิดใช้งานน้ำยาคูณ XP หรือบัฟหมดอายุไปแล้วครับ!', ephemeral: true });
  }

  const remainingMs = userStat.boostUntil - now;
  const remainingMins = Math.ceil(remainingMs / (1000 * 60));

  const embed = new EmbedBuilder()
    .setTitle('⚡ XP BOOSTER STATUS')
    .setDescription(`สถานะบัฟคูณ XP 2 เท่าของคุณ:\n⏳ คงเหลือเวลาอีกประมาณ **${remainingMins} นาที**`)
    .setColor('#00FF00');

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleShopButton(interaction, serverConfigs, saveConfigs, client) {
  if (!interaction.isStringSelectMenu() || interaction.customId !== 'shop_item_select') return false;

  const userId = interaction.user.id;
  const now = Date.now();

  if (userCooldowns.has(userId)) {
    const expirationTime = userCooldowns.get(userId) + 2000;
    if (now < expirationTime) {
      return await interaction.reply({ content: '⏳ ใจเย็นๆ ครับ! กรุณารอสักครู่ก่อนกดทำรายการถัดไป...', ephemeral: true });
    }
  }
  userCooldowns.set(userId, now);

  const guildId = interaction.guildId;
  const itemId = interaction.values[0];

  const item = IN_GAME_ITEMS.find(i => i.id === itemId);
  if (!item) return true;

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].levels) serverConfigs[guildId].levels = {};
  if (!serverConfigs[guildId].levels[userId]) {
    serverConfigs[guildId].levels[userId] = { xp: 0, level: 1, orbs: 0, lastDaily: 0, boostUntil: 0, artistUntil: 0, customTheme: '' };
  }

  const userStat = serverConfigs[guildId].levels[userId];
  const userCoins = userStat.orbs || 0;

  if (item.type === 'role_temp' && userStat.artistUntil && userStat.artistUntil > now) {
    const remainingDays = Math.ceil((userStat.artistUntil - now) / (1000 * 60 * 60 * 24));
    return await interaction.reply({ content: `⚠️ คุณยังมีสิทธิ์ Artist ใช้งานอยู่ (เหลือเวลาอีกประมาณ ${remainingDays} วัน) ไม่สามารถซื้อซ้ำซ้อนได้ครับ!`, ephemeral: true });
  }

  try {
    const member = await interaction.guild.members.fetch(userId);
    if (item.type === 'cinema_role' && member.roles.cache.has(item.roleId)) {
      return await interaction.reply({ content: `❤️ คุณมีตั๋วอยู่แล้ว ขอให้สนุกกับการรับชมนะครับ!`, ephemeral: true });
    }
  } catch (e) {}

  if (userCoins < item.price) {
    return await interaction.reply({ content: `❌ Zen Coins ของคุณไม่พอ! (คุณมี ${userCoins} Coins แต่สินค้าราคา ${item.price} Coins)`, ephemeral: true });
  }

  userStat.orbs -= item.price;

  if (item.type === 'gacha') {
    const outcomes = [
      { reward: 0, text: 'เกลือ! รอบนี้ไม่ได้อะไรเลย เสียใจด้วยนะ 😢' },
      { reward: 5, text: 'ได้ทุนคืน! รับไป 5 Zen Coins 🪙' },
      { reward: 15, text: 'โชคดี! ได้กำไรรับไป 15 Zen Coins 🎉' }
    ];
    const roll = outcomes[Math.floor(Math.random() * outcomes.length)];
    userStat.orbs += roll.reward;
    await saveConfigs(serverConfigs);

    return await interaction.reply({ content: `🎁 **ผลการสุ่มกาชาปอง:**\n${roll.text}\n(ยอด Zen Coins ปัจจุบันของคุณ: ${userStat.orbs} Coins)`, ephemeral: true });
  } 
  
  else if (item.type === 'buff') {
    const oneHour = 60 * 60 * 1000;
    userStat.boostUntil = (userStat.boostUntil && userStat.boostUntil > now ? userStat.boostUntil : now) + oneHour;
    await saveConfigs(serverConfigs);

    try {
      const member = await interaction.guild.members.fetch(userId);
      const role = await interaction.guild.roles.fetch(item.roleId);
      if (role) await member.roles.add(role);
    } catch (err) {}

    return await interaction.reply({ content: `⚡ เปิดใช้งานน้ำยาคูณ XP สำเร็จ! คุณได้รับสิทธิ์คูณ XP 2 เท่า นาน 1 ชั่วโมงเต็ม`, ephemeral: true });
  } 
  
  else if (item.type === 'role_temp') {
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    userStat.artistUntil = (userStat.artistUntil && userStat.artistUntil > now ? userStat.artistUntil : now) + threeDays;
    await saveConfigs(serverConfigs);

    try {
      const member = await interaction.guild.members.fetch(userId);
      const role = await interaction.guild.roles.fetch(item.roleId);
      if (role) await member.roles.add(role);
    } catch (err) {}

    return await interaction.reply({ content: `🎉 เช่าสำเร็จ! คุณได้รับยศ Artist และสิทธิ์แต่งการ์ดส่วนตัวเป็นเวลา 3 วันเต็ม!`, ephemeral: true });
  }

  else if (item.type === 'cinema_role') {
    await saveConfigs(serverConfigs);

    try {
      const member = await interaction.guild.members.fetch(userId);
      await member.roles.add(item.roleId);

      setTimeout(async () => {
        try {
          const guild = await client.guilds.fetch(member.guild.id).catch(() => null);
          if (guild) {
            const fetchedMember = await guild.members.fetch(member.id).catch(() => null);
            if (fetchedMember && fetchedMember.roles.cache.has(item.roleId)) {
              await fetchedMember.roles.remove(item.roleId);
            }
          }
        } catch (e) {
          console.error('Error removing cinema role from shop:', e);
        }
      }, item.duration);
    } catch (err) {
      console.error('Error assigning cinema role from shop:', err);
    }

    return await interaction.reply({ content: `🎉 **ซื้อตั๋วสำเร็จ!** ระบบได้หัก ${item.price} C และมอบยศ <@&${item.roleId}> ให้คุณเรียบร้อยแล้วครับ!`, ephemeral: true });
  }

  return true;
}

module.exports = {
  setupShopCommand,
  handleSetupShopCommand,
  boostStatusCommand,
  handleBoostStatusCommand,
  handleShopButton,
  SHOP_ITEMS: IN_GAME_ITEMS
};
