const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { Redis } = require('@upstash/redis');
const { generateWalletCard } = require('./canvas_card');
const { isServerPremium } = require('./license');
const { ROLES, IMAGES, COLORS } = require('./constants');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});
const userCooldowns = new Map();
const purchaseLocks = new Set();

const IN_GAME_ITEMS = [
  { id: 'gacha_box', name: 'กาชาปอง', emoji: '<a:emoji_142:1564170617240948767>', price: 15, type: 'gacha', description: 'สูงสุด 150 coins' },
  { id: 'xp_boost', name: 'XP Boost ( 1 hr. )', emoji: { name: 'xp', id: '1564107013456269433' }, price: 30, type: 'buff', roleId: ROLES.XP_BOOSTER, description: 'x2' },
  { id: 'role_artist_temp', name: 'Artist ( 3 days)', emoji: '<:emoji_143:1564202161309483048>', price: 75, type: 'role_temp', roleId: ROLES.ARTIST_TEMP, description: 'รับยศ Artist' }
];

const setupShopCommand = new SlashCommandBuilder()
  .setName('setup-in-game-shop')
  .setDescription('💎 [PREMIUM] ส่งแผงป้ายหน้าร้านค้าถาวรไปยังห้องนี้ (สำหรับ Admin)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
const boostStatusCommand = new SlashCommandBuilder().setName('boost-status').setDescription('💎 [PREMIUM] เช็กสถานะ XP x2');
const coinsCommand = new SlashCommandBuilder().setName('coins').setDescription('💎 [PREMIUM] เช็กยอด coins');
const addCoinsCommand = new SlashCommandBuilder()
  .setName('add-coins').setDescription('💎 [PREMIUM] เติม coins ให้กับสมาชิก (สำหรับ Admin)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption(option => option.setName('user').setDescription('เลือกสมาชิกที่ต้องการเติมเหรียญ').setRequired(true))
  .addIntegerOption(option => option.setName('amount').setDescription('จำนวน coins ที่ต้องการเติม').setRequired(true));

function ensureUserStat(serverConfigs, guildId, userId) {
  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].levels) serverConfigs[guildId].levels = {};
  if (!serverConfigs[guildId].levels[userId]) {
    serverConfigs[guildId].levels[userId] = {
      xp: 0, level: 1, orbs: 0, lastDaily: 0,
      boostUntil: 0, artistUntil: 0, cinemaPermUntil: 0, cinemaTempUntil: 0,
      customTheme: '', customWalletTheme: ''
    };
  }
  return serverConfigs[guildId].levels[userId];
}

// Critical shop/admin coin writes must wait for Redis and propagate failures.
async function persistConfigsNow(configs) {
  const serialized = JSON.stringify(configs);
  await redis.set('server_configs', serialized);
}

async function handleCoinsCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const config = serverConfigs[guildId] || {};
  const userStat = config.levels?.[userId] || { xp: 0, level: 1, orbs: 0, customWalletTheme: '' };
  if (await isServerPremium(guildId, serverConfigs)) {
    await interaction.deferReply({ ephemeral: true });
    const attachment = await generateWalletCard(interaction.user, userStat);
    return interaction.editReply({ files: [attachment] });
  }
  const embed = new EmbedBuilder()
    .setTitle('💰 WALLET • ยอดเหรียญของคุณ')
    .setDescription(`ยอด coins คงเหลือในกระเป๋าของ <@${userId}>:\n**${(userStat.orbs || 0).toLocaleString()} coins**`)
    .setColor(COLORS.GOLD).setTimestamp();
  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleAddCoinsCommand(interaction, serverConfigs, saveConfigs) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น!', ephemeral: true });
    return true;
  }
  const targetUser = interaction.options.getUser('user');
  const amount = interaction.options.getInteger('amount');
  const userStat = ensureUserStat(serverConfigs, interaction.guildId, targetUser.id);
  const previousBalance = userStat.orbs || 0;
  userStat.orbs = Math.max(0, previousBalance + amount);
  try {
    await persistConfigsNow(serverConfigs);
  } catch (error) {
    userStat.orbs = previousBalance;
    throw error;
  }
  const actionText = amount >= 0 ? `เติม coins จำนวน **+${amount.toLocaleString()} coins**` : `หัก coins จำนวน **${amount.toLocaleString()} coins**`;
  await interaction.reply({ content: `✅ ${actionText} ให้กับคุณ <@${targetUser.id}> สำเร็จแล้ว! ( ยอดคงเหลือ: ${userStat.orbs.toLocaleString()} coins )`, ephemeral: true });
  return true;
}

async function handleSetupShopCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
    return true;
  }
  const embed = new EmbedBuilder().setTitle('<a:emoji_103:1560417845903491112> 𝙕𝙀𝙉 𝙎𝙃𝙊𝙋')
    .setDescription('ร้านค้าไอเทม `xp boost` และ `ยศพิเศษประจำเซิร์ฟเวอร์`')
    .setImage(IMAGES.SHOP_STOREFRONT).setColor(COLORS.GOLD);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('open_in_game_shop_panel').setLabel('เปิดแผงร้านค้า').setEmoji('1560417845903491112').setStyle(ButtonStyle.Success)
  );
  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ ส่งแผงป้ายหน้าร้านค้าในเกมไปยังห้องนี้สำเร็จแล้ว!', ephemeral: true });
  return true;
}

async function handleBoostStatusCommand(interaction, serverConfigs) {
  const userStat = serverConfigs[interaction.guildId]?.levels?.[interaction.user.id];
  const now = Date.now();
  if (!userStat?.boostUntil || userStat.boostUntil <= now) {
    await interaction.reply({ content: '❌ คุณยังไม่ได้เปิดใช้งาน XP x2 หรือบัฟหมดอายุไปแล้วครับ!', ephemeral: true });
    return true;
  }
  const remainingMins = Math.ceil((userStat.boostUntil - now) / 60000);
  const embed = new EmbedBuilder().setTitle('<:xp_active:1564107060021432370> XP BOOSTER STATUS')
    .setDescription(`สถานะ XP x2:\n⏳ คงเหลือเวลาอีกประมาณ **${remainingMins} นาที**`).setColor(COLORS.GREEN);
  await interaction.reply({ embeds: [embed], ephemeral: true });
  return true;
}

async function handleInGameShopPanel(interaction, serverConfigs) {
  await interaction.deferReply({ ephemeral: true });
  const userCoins = serverConfigs[interaction.guildId]?.levels?.[interaction.user.id]?.orbs || 0;
  const itemsText = IN_GAME_ITEMS.map(item => {
    const emoji = typeof item.emoji === 'object' ? `<:${item.emoji.name}:${item.emoji.id}>` : item.emoji;
    return `${emoji} **${item.name}** • \`${item.price} coins\`\n└ ${item.description}`;
  }).join('\n\n');
  const embed = new EmbedBuilder().setTitle('<a:emoji_103:1560417845903491112> 𝙕𝙀𝙉 𝙎𝙃𝙊𝙋')
    .setDescription(`${itemsText}\n\n<a:emoji_100:1560416789211516938> **Wallet:** \`${userCoins.toLocaleString()} coins\``).setColor('#66FFFF');
  const row = new ActionRowBuilder();
  for (const item of IN_GAME_ITEMS) {
    const button = new ButtonBuilder().setCustomId(`buy_item_${item.id}`).setLabel(item.name.split(' (')[0]).setStyle(ButtonStyle.Primary);
    if (item.emoji) button.setEmoji(item.emoji);
    row.addComponents(button);
  }
  await interaction.editReply({ embeds: [embed], components: [row] });
  return true;
}

async function handleShopButton(interaction, serverConfigs, saveConfigs) {
  const customId = interaction.customId;
  if (customId !== 'open_in_game_shop_panel' && !customId.startsWith('buy_item_')) return false;
  const guildId = interaction.guildId;
  if (!(await isServerPremium(guildId, serverConfigs))) {
    await interaction.reply({ content: '❌ ระบบร้านค้านี้ใช้งานได้เฉพาะเซิร์ฟเวอร์พรีเมียมเท่านั้นครับ!', ephemeral: true });
    return true;
  }
  if (customId === 'open_in_game_shop_panel') return handleInGameShopPanel(interaction, serverConfigs);

  await interaction.deferReply({ ephemeral: true });
  const userId = interaction.user.id;
  const purchaseKey = `${guildId}:${userId}`;
  const now = Date.now();
  if (purchaseLocks.has(purchaseKey)) {
    await interaction.editReply({ content: '⏳ กำลังประมวลผลคำสั่งซื้อของคุณอยู่ โปรดรอสักครู่...' });
    return true;
  }
  const lastPurchase = userCooldowns.get(purchaseKey) || 0;
  if (now - lastPurchase < 2000) {
    await interaction.editReply({ content: '⏳ ใจเย็นๆ ครับ! กรุณารอสักครู่ก่อนกดทำรายการถัดไป...' });
    return true;
  }

  purchaseLocks.add(purchaseKey);
  try {
    const item = IN_GAME_ITEMS.find(entry => entry.id === customId.slice('buy_item_'.length));
    if (!item) {
      await interaction.editReply({ content: '❌ ไม่พบสินค้านี้ในร้านค้า' });
      return true;
    }

    const userStat = ensureUserStat(serverConfigs, guildId, userId);
    const balanceBefore = userStat.orbs || 0;
    if (balanceBefore < item.price) {
      await interaction.editReply({ content: `❌ coins ของคุณมีไม่พอ! คุณมี ${balanceBefore} coins แต่สินค้าราคา ${item.price} coins` });
      return true;
    }

    const purchaseTime = Date.now();
    if (item.type === 'role_temp' && userStat.artistUntil > purchaseTime) {
      const remainingDays = Math.ceil((userStat.artistUntil - purchaseTime) / 86400000);
      await interaction.editReply({ content: `⚠️ สิทธิ์ Artist ยังใช้งานอยู่ (เหลือประมาณ ${remainingDays} วัน)` });
      return true;
    }

    let member = null;
    let role = null;
    let addedRole = false;
    if (item.type === 'buff' || item.type === 'role_temp') {
      member = await interaction.guild.members.fetch(userId);
      if (item.type === 'role_temp' && member.roles.cache.has(ROLES.ARTIST_PERM)) {
        await interaction.editReply({ content: '❌ คุณมียศ **Artist ถาวร** อยู่แล้วครับ!' });
        return true;
      }
      role = await interaction.guild.roles.fetch(item.roleId);
      if (!role) throw new Error(`Shop role not found: ${item.roleId}`);
      if (!member.roles.cache.has(role.id)) {
        await member.roles.add(role);
        addedRole = true;
      }
    }

    const previousState = {
      orbs: userStat.orbs,
      boostUntil: userStat.boostUntil,
      artistUntil: userStat.artistUntil
    };
    userStat.orbs = balanceBefore - item.price;
    let responseText;
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
      responseText = `<a:emoji_142:1564170617240948767> **กาชาปอง**\n${roll.text}\n\`Wallet: ${userStat.orbs.toLocaleString()} coins\``;
    } else if (item.type === 'buff') {
      userStat.boostUntil = Math.max(userStat.boostUntil || 0, purchaseTime) + 60 * 60 * 1000;
      const remainingMins = Math.ceil((userStat.boostUntil - purchaseTime) / 60000);
      responseText = `<:xp_active:1564107060021432370> เปิดใช้งาน XP x2 สำเร็จ! เหลือเวลา ${remainingMins} นาที\n\`Wallet: ${userStat.orbs.toLocaleString()} coins\``;
    } else if (item.type === 'role_temp') {
      userStat.artistUntil = Math.max(userStat.artistUntil || 0, purchaseTime) + 3 * 24 * 60 * 60 * 1000;
      responseText = `🎉 เช่าสำเร็จ! คุณได้รับยศ Artist และสิทธิ์แต่งการ์ดส่วนตัว 3 วัน\n\`Wallet: ${userStat.orbs.toLocaleString()} coins\``;
    } else {
      throw new Error(`Unsupported shop item type: ${item.type}`);
    }

    try {
      await persistConfigsNow(serverConfigs);
    } catch (error) {
      userStat.orbs = previousState.orbs;
      userStat.boostUntil = previousState.boostUntil;
      userStat.artistUntil = previousState.artistUntil;
      if (addedRole) await member.roles.remove(role).catch(() => {});
      throw error;
    }

    userCooldowns.set(purchaseKey, Date.now());
    await interaction.editReply({ content: responseText });
    return true;
  } catch (error) {
    console.error('Shop purchase failed:', error);
    await interaction.editReply({ content: '❌ การซื้อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง หักเงินจะไม่ถูกยืนยัน' }).catch(() => {});
    return true;
  } finally {
    purchaseLocks.delete(purchaseKey);
  }
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
