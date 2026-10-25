const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const { Redis } = require('@upstash/redis');
const { COLORS } = require('./constants');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// 📦 ฐานข้อมูลสัตว์เลี้ยง 6 ระดับดาว
const PET_DATABASE = [
  { name: 'Tiny Slime', stars: 1, type: 'Common', baseOrb: 50, image: 'https://cdn.discordapp.com/attachments/1559878908348997774/1563060183259811921/image0.jpg' },
  { name: 'Lazy Cat', stars: 2, type: 'Uncommon', baseOrb: 100, image: 'https://cdn.discordapp.com/attachments/1559878908348997774/1563060183763259392/image0.jpg' },
  { name: 'Shadow Fox', stars: 3, type: 'Rare', baseOrb: 250, image: 'https://cdn.discordapp.com/attachments/1559878908348997774/1563060184123703317/image0.jpg' },
  { name: 'Fire Lion', stars: 4, type: 'Epic', baseOrb: 500, image: 'https://cdn.discordapp.com/attachments/1559878908348997774/1563060184518103051/image0.jpg' },
  { name: 'Golden Dragon', stars: 5, type: 'Legendary', baseOrb: 1000, image: 'https://cdn.discordapp.com/attachments/1559878908348997774/1563060184962572338/image0.jpg' },
  { name: 'Rainbow Phoenix', stars: 6, type: 'Cosmic', baseOrb: 2500, image: 'https://cdn.discordapp.com/attachments/1559878908348997774/1563060186032377906/image0.jpg' }
];

function rollRandomPet() {
  const rand = Math.random() * 100;
  if (rand < 1) return PET_DATABASE[5];
  if (rand < 4) return PET_DATABASE[4];
  if (rand < 10) return PET_DATABASE[3];
  if (rand < 20) return PET_DATABASE[2];
  if (rand < 40) return PET_DATABASE[1];
  return PET_DATABASE[0];
}

function findPetTargetChannel(guild, config) {
  if (!guild) return null;
  if (config.petChannelId) {
    const ch = guild.channels.cache.get(config.petChannelId);
    if (ch && ch.isTextBased()) return ch;
  }
  return guild.channels.cache.find(c =>
    c.type === ChannelType.GuildText &&
    !c.name.toLowerCase().includes('staff') &&
    !c.name.toLowerCase().includes('admin') &&
    !c.name.toLowerCase().includes('log') &&
    c.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages)
  ) || null;
}

async function progressPetXp(guildId, userId, xpAmount, client, serverConfigs, saveConfigs, shouldSave = true) {
  const config = serverConfigs[guildId];
  if (!config || !config.levels || !config.levels[userId]) return;

  const userStat = config.levels[userId];
  if (!userStat.petEgg || !userStat.petEgg.isHatched || !userStat.petEgg.hatchedPet) return;

  if (userStat.petEgg.petLevel === undefined) userStat.petEgg.petLevel = 1;
  if (userStat.petEgg.petXp === undefined) userStat.petEgg.petXp = 0;

  userStat.petEgg.petXp += xpAmount;
  let requiredPetXp = userStat.petEgg.petLevel * 100;
  let leveledUp = false;
  let newLevel = userStat.petEgg.petLevel;

  while (userStat.petEgg.petXp >= requiredPetXp) {
    userStat.petEgg.petXp -= requiredPetXp;
    userStat.petEgg.petLevel += 1;
    newLevel = userStat.petEgg.petLevel;
    leveledUp = true;
    requiredPetXp = userStat.petEgg.petLevel * 100;
  }

  if (shouldSave) {
    await saveConfigs(serverConfigs);
  }

  if (leveledUp && client && client.guilds) {
    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      const targetChannel = findPetTargetChannel(guild, config);

      if (targetChannel) {
        const pet = userStat.petEgg.hatchedPet;
        await targetChannel.send({
          content: `✨ [ZEN PET] ยินดีด้วยคุณ <@${userId}>! **${pet.name}** ของคุณอัปเลเวลเป็น **Level ${newLevel}** แล้ว!`
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Error sending pet level up notification:', err);
    }
  }
}

// 🛒 คำสั่งเปิดร้านค้า
const petShopCommand = new SlashCommandBuilder()
  .setName('pet-shop')
  .setDescription('🛒 เปิดร้านค้าไข่วิญญาณ (เฉพาะแอดมิน)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function handlePetShopCommand(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('🥚 ร้านค้าไข่วิญญาณ (Zen Pet Shop)')
    .setDescription('ซื้อไข่วิญญาณลึกลับเพื่อฟักเป็นสัตว์เลี้ยงคู่กาย!\n\n**ราคา:** `100 Coins`\n**ระยะเวลาฟัก:** `60 วินาที`')
    .setImage('https://cdn.discordapp.com/attachments/1559878908348997774/1563060185633652816/image0.jpg')
    .setColor(0xFFD700);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('buy_pet_egg')
      .setLabel('🟢 ซื้อไข่วิญญาณ (100 Coins)')
      .setStyle(ButtonStyle.Success)
  );

  await interaction.reply({ content: '🛒 เปิดหน้าร้านค้าเรียบร้อย!', ephemeral: true });
  await interaction.channel.send({ embeds: [embed], components: [row] });
}

// 🐾 คำสั่งดูโปรไฟล์สัตว์เลี้ยง
const companionCommand = new SlashCommandBuilder()
  .setName('companion')
  .setDescription('🐾 ตรวจสอบการ์ดโปรไฟล์และสเตตัสคู่หูวิญญาณของคุณ');

async function handleCompanionCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  const userData = serverConfigs[guildId]?.levels?.[userId];
  const petEgg = userData?.petEgg;

  if (!petEgg || !petEgg.hasEgg) {
    return await interaction.reply({ content: '❌ คุณยังไม่มีไข่หรือสัตว์เลี้ยง! ไปซื้อไข่จากหน้าร้านก่อน', ephemeral: true });
  }

  if (!petEgg.isHatched) {
    const remainingTime = petEgg.remainingSeconds || 60;
    return await interaction.reply({
      content: `🥚 ไข่วิญญาณของคุณกำลังฟัก... เหลือเวลาอีกประมาณ **${remainingTime} วินาที**`,
      ephemeral: true
    });
  }

  const pet = petEgg.hatchedPet || PET_DATABASE[0];
  const totalPower = pet.baseOrb + ((petEgg.petLevel || 1) * 20);

  const embed = new EmbedBuilder()
    .setTitle(`🛡️ โปรไฟล์คู่หู: ${pet.name}`)
    .setDescription(
      `⭐ **ระดับดาว:** ${'⭐'.repeat(pet.stars)} (${pet.type})\n` +
      `📈 **เลเวล:** Level ${petEgg.petLevel || 1}\n` +
      `✨ **ค่าประสบการณ์ (XP):** ${petEgg.petXp || 0}/${(petEgg.petLevel || 1) * 100}\n` +
      `⚔️ **พลังต่อสู้ (Power):** \`${totalPower}\`\n` +
      `🔮 **Base Orb:** ${pet.baseOrb} Orbs`
    )
    .setColor(0x00FF99)
    .setImage(pet.image)
    .setFooter({ text: `Owner: ${interaction.user.tag} • ZEN PET PROFILE` });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// 💰 เช็กเงิน
const coinsCommand = new SlashCommandBuilder()
  .setName('coins')
  .setDescription('💰 ตรวจสอบยอดเงินของคุณ');

async function handleCoinsCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  const userData = serverConfigs[guildId]?.levels?.[userId];
  const userCoins = userData?.coins !== undefined ? userData.coins : (userData?.orbs || 0);
  await interaction.reply({ content: `🔮 ยอดเงินของคุณคือ: **${userCoins.toLocaleString()} Coins**`, ephemeral: true });
}

const setPetChannelCommand = new SlashCommandBuilder()
  .setName('set-pet-channel')
  .setDescription('📢 ตั้งค่าห้องสำหรับส่งแจ้งเตือนฟักไข่สัตว์เลี้ยง (เฉพาะแอดมิน)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('เลือกห้องที่ต้องการให้บอทรายงาน')
      .setRequired(true)
  );

// 🛒 ระบบซื้อไข่แบบตรงไปตรงมา หักเงินจริง เซฟลง Redis ทันที
async function handleCompanionButton(interaction) {
  if (!interaction.isButton() || interaction.customId !== 'buy_pet_egg') return false;

  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  // โหลดข้อมูลสดจาก Redis
  let rawData = await redis.get('server_configs');
  let serverConfigs = rawData ? (typeof rawData === 'string' ? JSON.parse(rawData) : rawData) : {};

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].levels) serverConfigs[guildId].levels = {};
  if (!serverConfigs[guildId].levels[userId]) {
    serverConfigs[guildId].levels[userId] = { xp: 0, level: 1, coins: 1000, orbs: 1000 };
  }

  const userData = serverConfigs[guildId].levels[userId];
  let currentMoney = userData.coins !== undefined ? userData.coins : (userData.orbs !== undefined ? userData.orbs : 0);
  const eggCost = 100;

  if (currentMoney < eggCost) {
    await interaction.reply({ content: `❌ เงินของคุณไม่พอ! (ต้องการ ${eggCost} Coins แต่คุณมี ${currentMoney.toLocaleString()} Coins)`, ephemeral: true });
    return true;
  }

  // หักเงิน
  if (userData.coins !== undefined) userData.coins -= eggCost;
  else if (userData.orbs !== undefined) userData.orbs -= eggCost;

  // เซ็ตไข่ใหม่ทันที
  userData.petEgg = {
    hasEgg: true,
    totalSecondsNeeded: 60,
    remainingSeconds: 60,
    isHatched: false,
    hatchedPet: null,
    createdAt: Date.now()
  };

  // บันทึกลง Redis ทันทีแบบเรียลไทม์
  await redis.set('server_configs', JSON.stringify(serverConfigs));

  let remainingBalance = userData.coins !== undefined ? userData.coins : userData.orbs;

  await interaction.reply({
    content: `🎉 ซื้อไข่วิญญาณสำเร็จ! หักเงินไป **${eggCost} Coins** (ยอดคงเหลือ: ${remainingBalance.toLocaleString()} Coins)\n⏳ รอฟัก 60 วินาที เช็กโปรไฟล์สัตว์เลี้ยงด้วย \`/companion\``,
    ephemeral: true
  });

  return true;
}

// ⚔️ ลานประลอง
const petBattleCommand = new SlashCommandBuilder()
  .setName('pet-battle')
  .setDescription('⚔️ ท้าประลองสัตว์เลี้ยงกับผู้เล่นคนอื่นเพื่อชิงเงิน')
  .addUserOption(option => 
    option.setName('target')
      .setDescription('เลือกผู้เล่นที่ต้องการท้าประลอง')
      .setRequired(true)
  )
  .addIntegerOption(option => 
    option.setName('bet')
      .setDescription('จำนวนเงินที่ต้องการวางเดิมพัน')
      .setRequired(true)
      .setMinValue(10)
  );

async function handlePetBattleCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const attackerId = interaction.user.id;
  const defenderUser = interaction.options.getUser('target');
  const betAmount = interaction.options.getInteger('bet');

  if (defenderUser.id === attackerId || defenderUser.bot) {
    return await interaction.reply({ content: '❌ เป้าหมายท้าประลองไม่ถูกต้อง!', ephemeral: true });
  }

  const levels = serverConfigs[guildId]?.levels || {};
  const atkData = levels[attackerId];
  const defData = levels[defenderUser.id];

  if (!atkData?.petEgg?.isHatched) {
    return await interaction.reply({ content: '❌ คุณยังไม่มีสัตว์เลี้ยงที่ฟักเป็นตัว!', ephemeral: true });
  }
  if (!defData?.petEgg?.isHatched) {
    return await interaction.reply({ content: `❌ <@${defenderUser.id}> ยังไม่มีสัตว์เลี้ยงที่พร้อมประลอง!`, ephemeral: true });
  }

  const atkCoins = atkData.coins !== undefined ? atkData.coins : (atkData.orbs || 0);
  const defCoins = defData.coins !== undefined ? defData.coins : (defData.orbs || 0);

  if (atkCoins < betAmount) {
    return await interaction.reply({ content: `❌ คุณมีเงินไม่พอสำหรับการเดิมพัน!`, ephemeral: true });
  }
  if (defCoins < betAmount) {
    return await interaction.reply({ content: `❌ <@${defenderUser.id}> มีเงินไม่พอสำหรับการเดิมพันนี้!`, ephemeral: true });
  }

  const atkPet = atkData.petEgg.hatchedPet || PET_DATABASE[0];
  const defPet = defData.petEgg.hatchedPet || PET_DATABASE[0];

  const atkPower = atkPet.baseOrb + ((atkData.petEgg.petLevel || 1) * 20);
  const defPower = defPet.baseOrb + ((defData.petEgg.petLevel || 1) * 20);

  const embed = new EmbedBuilder()
    .setTitle('⚔️ คำท้าประลองลานสู้สัตว์เลี้ยง!')
    .setDescription(
      `<@${attackerId}> ได้ส่งคำท้าประลองถึง <@${defenderUser.id}>!\n\n` +
      `💰 **เดิมพัน:** \`${betAmount.toLocaleString()} Coins\`\n\n` +
      `🔴 **ผู้ท้า:** <@${attackerId}> (${atkPet.name} [Power: ${atkPower}])\n` +
      `🔵 **ผู้รับ:** <@${defenderUser.id}> (${defPet.name} [Power: ${defPower}])\n\n` +
      `*กดปุ่มด้านล่างเพื่อเริ่มประลอง!*`
    )
    .setColor(0xFF4500);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`accept_battle_${attackerId}_${defenderUser.id}_${betAmount}`)
      .setLabel('⚔️ ยอมรับการประลอง')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`decline_battle_${attackerId}_${defenderUser.id}`)
      .setLabel('❌ ปฏิเสธ')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.reply({ content: `<@${defenderUser.id}> คุณถูกท้าประลอง!`, embeds: [embed], components: [row] });
}

async function handleBattleButtons(interaction, loadConfigs, saveConfigs) {
  if (!interaction.isButton() || !interaction.customId) return false;
  
  const customId = interaction.customId;
  if (!customId.startsWith('accept_battle_') && !customId.startsWith('decline_battle_')) return false;

  const parts = customId.split('_');
  const action = parts[0];
  const attackerId = parts[2];
  const defenderId = parts[3];

  if (interaction.user.id !== defenderId) {
    await interaction.reply({ content: '❌ คุณไม่ใช่คนที่ถูกท้าประลอง!', ephemeral: true });
    return true;
  }

  if (action === 'decline') {
    const cancelEmbed = new EmbedBuilder()
      .setTitle('❌ การประลองถูกยกเลิก')
      .setDescription(`<@${defenderId}> ได้ปฏิเสธคำท้าประลอง`)
      .setColor(0x808080);

    await interaction.update({ embeds: [cancelEmbed], components: [] });
    return true;
  }

  const betAmount = parseInt(parts[4]);
  const guildId = interaction.guildId;

  let serverConfigs = await loadConfigs();
  const levels = serverConfigs[guildId]?.levels || {};

  const atkData = levels[attackerId];
  const defData = levels[defenderId];

  const atkCoins = atkData?.coins !== undefined ? atkData.coins : (atkData?.orbs || 0);
  const defCoins = defData?.coins !== undefined ? defData.coins : (defData?.orbs || 0);

  if (atkCoins < betAmount || defCoins < betAmount) {
    await interaction.reply({ content: '❌ ยอดเงินไม่พอสำหรับการเดิมพันแล้ว การประลองถูกยกเลิก', ephemeral: true });
    return true;
  }

  const atkPet = atkData.petEgg.hatchedPet || PET_DATABASE[0];
  const defPet = defData.petEgg.hatchedPet || PET_DATABASE[0];

  const atkPower = atkPet.baseOrb + ((atkData.petEgg.petLevel || 1) * 20);
  const defPower = defPet.baseOrb + ((defData.petEgg.petLevel || 1) * 20);

  const totalPower = atkPower + defPower;
  const isAttackerWin = Math.random() < (atkPower / totalPower);

  const winnerId = isAttackerWin ? attackerId : defenderId;
  const loserId = isAttackerWin ? defenderId : attackerId;
  const winnerPet = isAttackerWin ? atkPet.name : defPet.name;
  const winnerPetObj = isAttackerWin ? atkPet : defPet;

  // โอนเงินเดิมพัน
  if (levels[winnerId].coins !== undefined) levels[winnerId].coins += betAmount;
  else if (levels[winnerId].orbs !== undefined) levels[winnerId].orbs += betAmount;

  if (levels[loserId].coins !== undefined) levels[loserId].coins -= betAmount;
  else if (levels[loserId].orbs !== undefined) levels[loserId].orbs -= betAmount;

  // บวก EXP ให้สัตว์เลี้ยงตัวชนะ
  const winnerPetEgg = levels[winnerId].petEgg;
  winnerPetEgg.petXp = (winnerPetEgg.petXp || 0) + 25;
  if (winnerPetEgg.petXp >= (winnerPetEgg.petLevel || 1) * 100) {
    winnerPetEgg.petLevel = (winnerPetEgg.petLevel || 1) + 1;
    winnerPetEgg.petXp -= (winnerPetEgg.petLevel - 1) * 100;
  }

  await saveConfigs(serverConfigs);

  const resultEmbed = new EmbedBuilder()
    .setTitle('🏆 ผลการประลอง!')
    .setDescription(
      `🎉 **ผู้ชนะ:** <@${winnerId}> (${winnerPet})!\n` +
      `💰 เงินรางวัล: \`+${betAmount.toLocaleString()} Coins\` | รับ EXP: \`+25 XP\``
    )
    .setImage(winnerPetObj.image)
    .setColor(0x00FF00);

  await interaction.update({ embeds: [resultEmbed], components: [] });
  return true;
}

const petLeaderboardCommand = new SlashCommandBuilder()
  .setName('pet-leaderboard')
  .setDescription('🏆 ตรวจสอบอันดับสัตว์เลี้ยงในเซิร์ฟเวอร์');

async function handlePetLeaderboardCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const levels = serverConfigs[guildId]?.levels || {};

  const entries = Object.entries(levels);
  const hatchedPets = entries
    .filter(([_, userData]) => userData?.petEgg?.hasEgg && userData?.petEgg?.isHatched && userData?.petEgg?.hatchedPet)
    .map(([userId, userData]) => {
      const petEgg = userData.petEgg;
      const pet = petEgg.hatchedPet;
      const level = petEgg.petLevel || 1;
      const power = pet.baseOrb + (level * 20);
      return { userId, pet, level, power };
    })
    .sort((a, b) => b.level - a.level || b.pet.stars - a.pet.stars || b.power - a.power);

  if (hatchedPets.length === 0) {
    return await interaction.reply({ content: '🏆 ยังไม่มีสัตว์เลี้ยงที่ฟักในเซิร์ฟเวอร์นี้!', ephemeral: true });
  }

  const topPets = hatchedPets.slice(0, 10);
  let description = '';

  topPets.forEach((item, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `\`#${index + 1}\``;
    description += `${medal} <@${item.userId}> — **${item.pet.name}** (Level ${item.level} | ⚔️ Power: \`${item.power}\`)\n`;
  });

  const embed = new EmbedBuilder()
    .setTitle('🏆 Pet Leaderboard')
    .setDescription(description)
    .setColor(0xFFD700);

  await interaction.reply({ embeds: [embed] });
}

module.exports = {
  PET_DATABASE,
  rollRandomPet,
  findPetTargetChannel,
  progressPetXp,
  petShopCommand,
  handlePetShopCommand,
  companionCommand,
  handleCompanionCommand,
  coinsCommand,
  handleCoinsCommand,
  setPetChannelCommand,
  handleCompanionButton,
  petBattleCommand,
  handlePetBattleCommand,
  handleBattleButtons,
  petLeaderboardCommand,
  handlePetLeaderboardCommand
};
