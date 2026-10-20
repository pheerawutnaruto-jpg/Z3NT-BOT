const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { generateWalletCard } = require('./canvas_card');
const { isServerPremium } = require('./license');

const userCooldowns = new Map();

// ปรับขึ้นราคาสินค้าใน In-Game Shop และเปลี่ยนชื่อเป็น "กาชาปอง"
const IN_GAME_ITEMS = [
  { 
    id: 'gacha_box', 
    name: '🎁 กาชาปอง', 
    price: 15, 
    type: 'gacha',
    description: '• ลุ้นรับ Zen Coins สูงสุด 150 Coins!' 
  },
  { 
    id: 'xp_boost', 
    name: '⚡ น้ำยาคูณ XP (1 ชม.)', 
    price: 30, 
    type: 'buff',
    roleId: '1559992075095773184', 
    description: '• คูณ XP 2 เท่า พร้อมรับยศ Xp Booster' 
  },
  { 
    id: 'role_artist_temp', 
    name: '🎨 บัตรเช่า Artist (3 วัน)', 
    price: 75, 
    type: 'role_temp',
    roleId: '1560136361015513108',
    description: '• รับยศ Artist และสิทธิ์เปลี่ยนการ์ด /level & /coins' 
  }
];

const setupShopCommand = new SlashCommandBuilder()
  .setName('setup-in-game-shop')
  .setDescription('💎 [PREMIUM] ส่งแผงป้ายหน้าร้านค้าในเกมถาวร (Storefront) ไปยังห้องนี้ (for Admin)');

const boostStatusCommand = new SlashCommandBuilder()
  .setName('boost-status')
  .setDescription('💎 [PREMIUM] เช็กสถานะและเวลาคงเหลือของน้ำยาคูณ XP');

const coinsCommand = new SlashCommandBuilder()
  .setName('coins')
  .setDescription('💎 [PREMIUM] เช็กยอด Zen Coins และกระเป๋าเงินของคุณ');

const addCoinsCommand = new SlashCommandBuilder()
  .setName('add-coins')
  .setDescription('💎 [PREMIUM] เติม Zen Coins ให้กับสมาชิก (for Admin)')
  .addUserOption(option => option.setName('user').setDescription('เลือกสมาชิกที่ต้องการเติมเหรียญ').setRequired(true))
  .addIntegerOption(option => option.setName('amount').setDescription('จำนวน Zen Coins ที่ต้องการเติม').setRequired(true));

async function handleCoinsCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const config = serverConfigs[guildId] || {};
  const userStat = config.levels?.[userId] || { xp: 0, level: 1, orbs: 0 };
  const hasPremium = await isServerPremium(guildId, serverConfigs);

  if (hasPremium) {
    await interaction.deferReply({ ephemeral: true });
    const attachment = await generateWalletCard(interaction.user, userStat);
    return await interaction.editReply({ files: [attachment] });
  }

  const userCoins = userStat.orbs || 0;
  const embed = new EmbedBuilder()
    .setTitle('💰 WALLET • ยอดเหรียญของคุณ')
    .setDescription(`ยอด Zen Coins คงเหลือในกระเป๋าของ <@${userId}>:\n**${userCoins} Zen Coins**`)
    .setColor('#FFD700')
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleAddCoinsCommand(interaction, serverConfigs, saveConfigs) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
    return true;
  }

  const targetUser = interaction.options.getUser('user');
  const amount = interaction.options.getInteger('amount');
  const guildId = interaction.guildId;
  const userId = targetUser.id;

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].levels) serverConfigs[guildId].levels = {};
  if (!serverConfigs[guildId].levels[userId]) {
    serverConfigs[guildId].levels[userId] = { xp: 0, level: 1, orbs: 0, lastDaily: 0, boostUntil: 0, artistUntil: 0, customTheme: '', customWalletTheme: '' };
  }

  const userStat = serverConfigs[guildId].levels[userId];
  userStat.orbs = (userStat.orbs || 0) + amount;
  await saveConfigs(serverConfigs);

  await interaction.reply({ content: `✅ เติม Zen Coins จำนวน **+${amount} Coins** ให้กับคุณ <@${userId}> สำเร็จแล้ว! (ยอดรวม: ${userStat.orbs} Coins)`, ephemeral: true });
  return true;
}

async function handleSetupShopCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
    return true;
  }

  const storefrontImageUrl = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560429209522806814/1792105478227.jpg';

  const embed = new EmbedBuilder()
    .setTitle('<a:emoji_103:1560417845903491112> 𝙕𝙀𝙉 𝘽𝙊𝙏 • IN-GAME STOREFRONT')
    .setDescription(
      'ยินดีต้อนรับสู่ศูนย์รวมไอเทม บัฟ และบัตรเช่ายศพิเศษประจำเซิร์ฟเวอร์!\n\n' +
      '📌 **วิธีใช้งาน:** คลิกปุ่มด้านล่างเพื่อเปิดหน้าต่างร้านค้าและใช้ Zen Coins เลือกซื้อสินค้าได้ทันทีครับ'
    )
    .setImage(storefrontImageUrl)
    .setColor('#FFD700');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('open_in_game_shop_panel')
      .setLabel('🛒 เปิดแผงร้านค้าในเกม')
      .setEmoji('1560417845903491112')
      .setStyle(ButtonStyle.Success)
  );

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ ส่งแผงป้ายหน้าร้านค้าในเกมไปยังห้องนี้สำเร็จแล้ว!', ephemeral: true });
  return true;
}

async function handleBoostStatusCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const config = serverConfigs[guildId] || {};
  const userStat = config.levels?.[userId];
  const now = Date.now();

  if (!userStat || !userStat.boostUntil || userStat.boostUntil <= now) {
    await interaction.reply({ content: '❌ คุณยังไม่ได้เปิดใช้งานน้ำยาคูณ XP หรือบัฟหมดอายุไปแล้วครับ!', ephemeral: true });
    return true;
  }

  const remainingMs = userStat.boostUntil - now;
  const remainingMins = Math.ceil(remainingMs / (1000 * 60));

  const embed = new EmbedBuilder()
    .setTitle('⚡ XP BOOSTER STATUS')
    .setDescription(`สถานะบัฟคูณ XP 2 เท่าของคุณ:\n⏳ คงเหลือเวลาอีกประมาณ **${remainingMins} นาที**`)
    .setColor('#00FF00');

  await interaction.reply({ embeds: [embed], ephemeral: true });
  return true;
}

async function handleInGameShopPanel(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const config = serverConfigs[guildId] || {};
  const userStat = config.levels?.[userId];
  const userCoins = userStat ? (userStat.orbs || 0) : 0;

  const embed = new EmbedBuilder()
    .setTitle('🛒 𝙕𝙀𝙉 𝘽𝙊𝙏 • IN-GAME SHOP')
    .setDescription(
      `<a:emoji_100:1560416789211516938> **ยอดเหรียญของคุณ:** \`${userCoins} Zen Coins\`\n\n` +
      'เลือกซื้อไอเทมหรือบัฟที่คุณต้องการได้จากรายการด้านล่างนี้เลยครับ:\n──────────────────────'
    )
    .setColor('#FFD700');

  IN_GAME_ITEMS.forEach(item => {
    embed.addFields({
      name: `${item.name} ➔ \`${item.price} Coins\``,
      value: `${item.description}\n──────────────────────`,
      inline: false
    });
  });

  const row = new ActionRowBuilder();
  IN_GAME_ITEMS.forEach(item => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`buy_item_${item.id}`)
        .setLabel(item.name.split(' (')[0])
        .setEmoji('1560417845903491112')
        .setStyle(ButtonStyle.Primary)
    );
  });

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  return true;
}

async function handleShopButton(interaction, serverConfigs, saveConfigs) {
  if (interaction.customId === 'open_in_game_shop_panel') {
    return await handleInGameShopPanel(interaction, serverConfigs);
  }

  if (!interaction.customId.startsWith('buy_item_')) return false;

  const userId = interaction.user.id;
  const now = Date.now();

  if (userCooldowns.has(userId)) {
    const expirationTime = userCooldowns.get(userId) + 2000;
    if (now < expirationTime) {
      await interaction.reply({ content: '⏳ ใจเย็นๆ ครับ! กรุณารอสักครู่ก่อนกดทำรายการถัดไป...', ephemeral: true });
      return true;
    }
  }
  userCooldowns.set(userId, now);

  const guildId = interaction.guildId;
  const itemId = interaction.customId.replace('buy_item_', '');
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
    await interaction.reply({ content: `⚠️ คุณยังมีสิทธิ์ Artist ใช้งานอยู่ (เหลือเวลาอีกประมาณ ${Math.ceil((userStat.artistUntil - now) / (1000 * 60 * 60 * 24))} วัน) ไม่สามารถซื้อซ้ำซ้อนได้ครับ!`, ephemeral: true });
    return true;
  }

  if (userCoins < item.price) {
    await interaction.reply({ content: `❌ Zen Coins ของคุณไม่พอ! (คุณมี ${userCoins} Coins แต่สินค้าราคา ${item.price} Coins)`, ephemeral: true });
    return true;
  }

  userStat.orbs -= item.price;

  if (item.type === 'gacha') {
    const outcomes = [
      { reward: 0, text: 'เกลือ! รอบนี้ไม่ได้อะไรเลย เสียใจด้วยนะ 😢' },
      { reward: 10, text: 'ได้ทุนคืน! รับไป 10 Zen Coins' },
      { reward: 40, text: 'โชคดี! ได้กำไรรับไป 40 Zen Coins 🎉' },
      { reward: 150, text: 'แจ็กพอตแตก! รับไปเต็มๆ 150 Zen Coins 🏆✨' }
    ];
    const roll = outcomes[Math.floor(Math.random() * outcomes.length)];
    userStat.orbs += roll.reward;
    await saveConfigs(serverConfigs);

    await interaction.reply({ content: `🎁 **ผลการสุ่มกาชาปอง:**\n${roll.text}\n(ยอด Zen Coins ปัจจุบันของคุณ: ${userStat.orbs} Coins)`, ephemeral: true });
    return true;
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

    await interaction.reply({ content: `⚡ เปิดใช้งานน้ำยาคูณ XP สำเร็จ! คุณได้รับสิทธิ์คูณ XP 2 เท่า นาน 1 ชั่วโมงเต็ม (คงเหลือ ${userStat.orbs} Coins)`, ephemeral: true });
    return true;
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

    await interaction.reply({ content: `🎉 เช่าสำเร็จ! คุณได้รับยศ Artist และสิทธิ์แต่งการ์ดส่วนตัวเป็นเวลา 3 วันเต็ม! (คงเหลือ ${userStat.orbs} Coins)`, ephemeral: true });
    return true;
  }

  return true;
}

module.exports = {
  setupShopCommand,
  handleSetupShopCommand,
  boostStatusCommand,
  handleBoostStatusCommand,
  coinsCommand,
  addCoinsCommand,
  handleCoinsCommand,
  handleAddCoinsCommand,
  handleShopButton,
  SHOP_ITEMS: IN_GAME_ITEMS
};
