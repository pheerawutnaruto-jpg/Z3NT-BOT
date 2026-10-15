const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

const IN_GAME_ITEMS = [
  { 
    id: 'gacha_box', 
    name: '🎁 กล่องสุ่มกาชาปอง (Gacha Box)', 
    price: 5, 
    type: 'gacha',
    buttonLabel: 'ซื้อ กล่องสุ่ม (5c)',
    description: 'เสี่ยงโชคสุ่มรับ Zen Coins ก้อนโตหรือเกลือ! (ลุ้นรับสูงสุด 150 Coins)' 
  },
  { 
    id: 'xp_boost', 
    name: '⚡ น้ำยาคูณ XP (1 ชั่วโมง + ยศ Booster)', 
    price: 10, 
    type: 'buff',
    roleId: '1559992075095773184', 
    buttonLabel: 'ซื้อ น้ำยาคูณ (10c)',
    description: 'คูณ XP 2 เท่า พร้อมรับยศพิเศษ Xp Booster นาน 1 ชั่วโมง!' 
  },
  { 
    id: 'role_artist_temp', 
    name: '🎨 บัตรปลดล็อกยศ Artist (เช่า 3 วัน)', 
    price: 30, 
    type: 'role_temp',
    roleId: '1560136361015513108',
    buttonLabel: 'ซื้อ บัตร Artist 3 วัน (30c)',
    description: 'รับยศ Artist และสิทธิ์เปลี่ยนรูปการ์ด /level ส่วนตัว นาน 3 วัน!' 
  }
];

const setupShopCommand = new SlashCommandBuilder()
  .setName('setup-in-game-shop')
  .setDescription('ส่งแผงร้านค้าในเกม (ใช้ Zen Coins ซื้อ) ไปยังห้องนี้ (สำหรับ Admin)');

const boostStatusCommand = new SlashCommandBuilder()
  .setName('boost-status')
  .setDescription('เช็กสถานะและเวลาคงเหลือของน้ำยาคูณ XP (XP Booster)');

async function handleSetupShopCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle('🛒 𝙕𝙀𝙉 𝘽𝙊𝙏 • IN-GAME SHOP')
    .setDescription('ใช้ Zen Coins ซื้อไอเทม บัฟ และบัตรเช่าใช้งานได้จากปุ่มด้านล่างนี้เลย:\n──────────────────────')
    .setColor('#FFD700');

  IN_GAME_ITEMS.forEach(item => {
    embed.addFields({
      name: `${item.name} (ราคา: ${item.price} Coins)`,
      value: `${item.description}\n──────────────────────`,
      inline: false
    });
  });

  const row = new ActionRowBuilder();
  IN_GAME_ITEMS.forEach(item => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`buy_ ingame_${item.id}`)
        .setLabel(item.buttonLabel)
        .setStyle(ButtonStyle.Primary)
    );
  });

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

async function handleShopButton(interaction, serverConfigs, saveConfigs) {
  if (!interaction.customId.startsWith('buy_ ingame_')) return false;

  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const itemId = interaction.customId.replace('buy_ ingame_', '');

  const item = IN_GAME_ITEMS.find(i => i.id === itemId);
  if (!item) return true;

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].levels) serverConfigs[guildId].levels = {};
  if (!serverConfigs[guildId].levels[userId]) {
    serverConfigs[guildId].levels[userId] = { xp: 0, level: 1, orbs: 0, lastDaily: 0, boostUntil: 0, artistUntil: 0, customTheme: '' };
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
      { reward: 5, text: 'ได้ทุนคืน! รับไป 5 Zen Coins 🪙' },
      { reward: 20, text: 'โชคดี! ได้กำไรรับไป 20 Zen Coins 🎉' },
      { reward: 50, text: 'แจ็คพอตแตก! สุดยอดดด รับไปเลย 50 Zen Coins 🏆' }
    ];
    const roll = outcomes[Math.floor(Math.random() * outcomes.length)];
    userStat.orbs += roll.reward;
    await saveConfigs(serverConfigs);

    return await interaction.reply({ content: `🎁 **ผลการสุ่มกาชาปอง:**\n${roll.text}\n(ยอด Zen Coins ปัจจุบันของคุณ: ${userStat.orbs} Coins)`, ephemeral: true });
  } 
  
  else if (item.type === 'buff') {
    const now = Date.now();
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
    const now = Date.now();
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

  return true;
}

module.exports = {
  setupShopCommand,
  handleSetupShopCommand,
  boostStatusCommand,
  handleBoostStatusCommand,
  handleShopButton
};
