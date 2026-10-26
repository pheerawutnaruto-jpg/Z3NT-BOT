const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { generateWalletCard } = require('./canvas_card');
const { isServerPremium } = require('./license');
const { ROLES, IMAGES, COLORS } = require('./constants');

const userCooldowns = new Map();

// โครงสร้างข้อมูลรายการไอเทม
const IN_GAME_ITEMS = [
  {
    id: 'gacha_box',
    name: 'กาชาปอง',
    emoji: '<a:emoji_142:1564170617240948767>',
    price: 15,
    type: 'gacha',
    description: 'สูงสุด 150 coins'
  },
  {
    id: 'xp_boost',
    name: 'XP Boost ( 1 hr. )',
    emoji: { name: 'xp', id: '1564107013456269433' },
    price: 30,
    type: 'buff',
    roleId: ROLES.XP_BOOSTER,
    description: 'x2'
  },
  {
    id: 'role_artist_temp',
    name: 'Artist ( 3 days)',
    emoji: '<:emoji_143:1564202161309483048>',
    price: 75,
    type: 'role_temp',
    roleId: ROLES.ARTIST_TEMP,
    description: 'รับยศ Artist'
  }
];

const setupShopCommand = new SlashCommandBuilder()
  .setName('setup-in-game-shop')
  .setDescription('💎 [PREMIUM] ส่งแผงป้ายหน้าร้านค้าถาวรไปยังห้องนี้ (สำหรับ Admin)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const boostStatusCommand = new SlashCommandBuilder()
  .setName('boost-status')
  .setDescription('💎 [PREMIUM] เช็กสถานะ XP x2');

const coinsCommand = new SlashCommandBuilder()
  .setName('coins')
  .setDescription('💎 [PREMIUM] เช็กยอด coins');

const addCoinsCommand = new SlashCommandBuilder()
  .setName('add-coins')
  .setDescription('💎 [PREMIUM] เติม coins ให้กับสมาชิก (สำหรับ Admin)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption(option => option.setName('user').setDescription('เลือกสมาชิกที่ต้องการเติมเหรียญ').setRequired(true))
  .addIntegerOption(option => option.setName('amount').setDescription('จำนวน coins ที่ต้องการเติม').setRequired(true));

async function handleCoinsCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const config = serverConfigs[guildId] || {};
  const userStat = config.levels?.[userId] || { xp: 0, level: 1, orbs: 0, customWalletTheme: '' };
  const hasPremium = await isServerPremium(guildId, serverConfigs);

  if (hasPremium) {
    await interaction.deferReply({ ephemeral: true });
    const attachment = await generateWalletCard(interaction.user, userStat);
    return await interaction.editReply({ files: [attachment] });
  }

  const userCoins = userStat.orbs || 0;
  const embed = new EmbedBuilder()
    .setTitle('💰 WALLET • ยอดเหรียญของคุณ')
    .setDescription(`ยอด coins คงเหลือในกระเป๋าของ <@${userId}>:\n**${userCoins.toLocaleString()} coins**`)
    .setColor(COLORS.GOLD)
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleAddCoinsCommand(interaction, serverConfigs, saveConfigs) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น!', ephemeral: true });
    return true;
  }

  const targetUser = interaction.options.getUser('user');
  const amount = interaction.options.getInteger('amount');
  const guildId = interaction.guildId;
  const userId = targetUser.id;

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].levels) serverConfigs[guildId].levels = {};
  if (!serverConfigs[guildId].levels[userId]) {
    serverConfigs[guildId].levels[userId] = {
      xp: 0, level: 1, orbs: 0, lastDaily: 0,
      boostUntil: 0, artistUntil: 0, cinemaPermUntil: 0, cinemaTempUntil: 0,
      customTheme: '', customWalletTheme: ''
    };
  }

  const userStat = serverConfigs[guildId].levels[userId];
  userStat.orbs = Math.max(0, (userStat.orbs || 0) + amount);
  await saveConfigs(serverConfigs);

  const actionText = amount >= 0 ? `เติม coins จำนวน **+${amount.toLocaleString()} coins**` : `หัก coins จำนวน **${amount.toLocaleString()} coins**`;
  await interaction.reply({ content: `✅ ${actionText} ให้กับคุณ <@${userId}> สำเร็จแล้ว! ( ยอดคงเหลือ: ${userStat.orbs.toLocaleString()} coins )`, ephemeral: true });
  return true;
}

async function handleSetupShopCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
    return true;
  }

  const embed = new EmbedBuilder()
    .setTitle('<a:emoji_103:1560417845903491112> 𝙕𝙀𝙉 𝙎𝙃𝙊𝙋')
    .setDescription(
      'ร้านค้าไอเทม `xp boost` และ `ยศพิเศษประจำเซิร์ฟเวอร์`'
    )
    .setImage(IMAGES.SHOP_STOREFRONT)
    .setColor(COLORS.GOLD);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('open_in_game_shop_panel')
      .setLabel('เปิดแผงร้านค้า')
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
    await interaction.reply({ content: '❌ คุณยังไม่ได้เปิดใช้งาน XP x2 หรือบัฟหมดอายุไปแล้วครับ!', ephemeral: true });
    return true;
  }

  const remainingMs = userStat.boostUntil - now;
  const remainingMins = Math.ceil(remainingMs / (1000 * 60));

  const embed = new EmbedBuilder()
    .setTitle('<:xp_active:1564107060021432370> XP BOOSTER STATUS')
    .setDescription(`สถานะ XP x2:\n⏳ คงเหลือเวลาอีกประมาณ **${remainingMins} นาที**`)
    .setColor(COLORS.GREEN);

  await interaction.reply({ embeds: [embed], ephemeral: true });
  return true;
}

async function handleInGameShopPanel(interaction, serverConfigs) {
  await interaction.deferReply({ ephemeral: true }).catch(() => {});

  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const config = serverConfigs[guildId] || {};
  const userStat = config.levels?.[userId];
  const userCoins = userStat ? (userStat.orbs || 0) : 0;

  const itemsText = IN_GAME_ITEMS.map(item => {
    const emojiDisplay = typeof item.emoji === 'object' ? `<:${item.emoji.name}:${item.emoji.id}>` : item.emoji;
    return `${emojiDisplay} **${item.name}** • \`${item.price} coins\`\n└ ${item.description}`;
  }).join('\n\n');

  const embed = new EmbedBuilder()
    .setTitle('<a:emoji_103:1560417845903491112> 𝙕𝙀𝙉 𝙎𝙃𝙊𝙋')
    .setDescription(
      `${itemsText}\n\n` +
      `<a:emoji_100:1560416789211516938> **Wallet:** \`${userCoins.toLocaleString()} coins\``
    )
    .setColor('#66FFFF');

  const row = new ActionRowBuilder();
  IN_GAME_ITEMS.forEach(item => {
    const button = new ButtonBuilder()
      .setCustomId(`buy_item_${item.id}`)
      .setLabel(item.name.split(' (')[0])
      .setStyle(ButtonStyle.Primary);

    if (item.emoji) {
      button.setEmoji(item.emoji);
    }

    row.addComponents(button);
  });

  await interaction.editReply({ embeds: [embed], components: [row] });
  return true;
}

async function handleShopButton(interaction, serverConfigs, saveConfigs) {
  const customId = interaction.customId;
  if (customId !== 'open_in_game_shop_panel' && !customId.startsWith('buy_item_')) return false;

  const guildId = interaction.guildId;
  if (!(await isServerPremium(guildId, serverConfigs))) {
    await interaction.reply({ content: '❌ ระบบร้านค้านี้ใช้งานได้เฉพาะเซิร์ฟเวอร์พรีเมียมเท่านั้น!', ephemeral: true });
    return true;
  }

  if (customId === 'open_in_game_shop_panel') {
    return await handleInGameShopPanel(interaction, serverConfigs);
  }

  await interaction.deferReply({ ephemeral: true }).catch(() => {});

  const userId = interaction.user.id;
  const now = Date.now();

  if (userCooldowns.has(userId)) {
    const expirationTime = userCooldowns.get(userId) + 2000;
    if (now < expirationTime) {
      await interaction.editReply({ content: '⏳ ใจเย็นๆ ครับ! กรุณารอสักครู่ก่อนกดทำรายการถัดไป...' });
      return true;
    }
  }
  userCooldowns.set(userId, now);

  const itemId = customId.replace('buy_item_', '');
  const item = IN_GAME_ITEMS.find(i => i.id === itemId);
  if (!item) return true;

  if (item.id === 'role_artist_temp') {
    try {
      const member = await interaction.guild.members.fetch(userId);
      if (member.roles.cache.has(ROLES.ARTIST_PERM)) {
        await interaction.editReply({ content: '❌ คุณมียศ **Artist ถาวร** อยู่แล้วครับ!' });
        return true;
      }
    } catch (e) {}
  }

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].levels) serverConfigs[guildId].levels = {};
  if (!serverConfigs[guildId].levels[userId]) {
    serverConfigs[guildId].levels[userId] = {
      xp: 0, level: 1, orbs: 0, lastDaily: 0,
      boostUntil: 0, artistUntil: 0, cinemaPermUntil: 0, cinemaTempUntil: 0,
      customTheme: '', customWalletTheme: ''
    };
  }

  const userStat = serverConfigs[guildId].levels[userId];
  const userCoins = userStat.orbs || 0;

  if (item.type === 'role_temp' && userStat.artistUntil && userStat.artistUntil > now) {
    const remainingDays = Math.ceil((userStat.artistUntil - now) / (1000 * 60 * 60 * 24));
    await interaction.editReply({ content: `⚠️ คุณยังมีสิทธิ์ Artist | 3d ใช้งานอยู่\n (เหลือเวลาอีกประมาณ ${remainingDays} วัน) ไม่สามารถซื้อซ้ำได้ครับ!` });
    return true;
  }

  if (userCoins < item.price) {
    await interaction.editReply({ content: `❌ coins ของคุณมีไม่พอ!\n ( คุณมี ${userCoins} coins สินค้าราคา ${item.price} coins )` });
    return true;
  }

  // ป้องกันเคสที่ userStat.orbs เป็น undefined แล้วกลายเป็น NaN
  userStat.orbs = (userStat.orbs || 0) - item.price;

  if (item.type === 'gacha') {
    const outcomes = [
      { reward: 0, text: '<a:cuteghost:1563345975597080686> เกลือ!' },
      { reward: 0, text: '0 coins ลองใหม่อีกครั้งนะ! <a:kitty:1563350578375950496>' },
      { reward: 5, text: 'เศษเหรียญปลอบใจ! รับไป 5 coins <a:emoji_145:1564216100915515432>' },
      { reward: 20, text: 'พอมีโชค! รับไป 20 coins <a:emoji_144:1564216078530514995>' },
      { reward: 150, text: 'แจ็กพอตแตกกระจาย! รับไปเต็มๆ 150 coins <a:emoji_101:1560416845322920067>' }
    ];
    const roll = outcomes[Math.floor(Math.random() * outcomes.length)];
    userStat.orbs += roll.reward;
    await saveConfigs(serverConfigs);

    await interaction.editReply({ 
      content: `<a:emoji_142:1564170617240948767> **กาชาปอง**\n${roll.text}\n\`Wallet : ${userStat.orbs.toLocaleString()} coins\`` 
    });
    return true;
  }

    if (item.type === 'buff') {
    const oneHour = 60 * 60 * 1000;
    userStat.boostUntil = (userStat.boostUntil && userStat.boostUntil > now ? userStat.boostUntil : now) + oneHour;
    await saveConfigs(serverConfigs);

    try {
      const member = await interaction.guild.members.fetch(userId);
      const role = await interaction.guild.roles.fetch(item.roleId);
      if (role) await member.roles.add(role);
    } catch (err) {}

    const remainingMs = userStat.boostUntil - now;
    const remainingMins = Math.ceil(remainingMs / (1000 * 60));

    await interaction.editReply({ 
      content: `<:xp_active:1564107060021432370> เปิดใช้งาน XP x2 สำเร็จ! ( ⏱️ **${remainingMins}** นาที )\n\`Wallet : ${userStat.orbs.toLocaleString()} coins\`` 
    });
    return true;
  }

  if (item.type === 'role_temp') {
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    userStat.artistUntil = (userStat.artistUntil && userStat.artistUntil > now ? userStat.artistUntil : now) + threeDays;
    await saveConfigs(serverConfigs);

    try {
      const member = await interaction.guild.members.fetch(userId);
      const role = await interaction.guild.roles.fetch(item.roleId);
      if (role) await member.roles.add(role);
    } catch (err) {}

    await interaction.editReply({ 
      content: `🎉 เช่าสำเร็จ! คุณได้รับยศ Artist และสิทธิ์แต่งการ์ดส่วนตัวเป็นเวลา 3 วันเต็ม!\n\`Wallet : ${userStat.orbs.toLocaleString()} coins\`` 
    });
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
