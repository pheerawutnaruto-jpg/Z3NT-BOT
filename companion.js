const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const { Redis } = require('@upstash/redis');
const { COLORS } = require('./constants');

// เชื่อมต่อ Redis โดยตรงเพื่อบันทึกข้อมูลทันทีแบบเรียลไทม์ (แก้ปัญหากดรัวแล้วเงินไม่ลด)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// 📦 ฐานข้อมูลสัตว์เลี้ยง 6 ระดับดาว (1 ดาว - 6 ดาว Cosmic)
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

// 🛠️ Helper: ค้นหาห้องส่งแจ้งเตือนสัตว์เลี้ยงที่ปลอดภัยที่สุด
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

// 🐾 ระบบเก็บเลเวลสัตว์เลี้ยงอัตโนมัติ
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

// 🛒 1. /pet-shop
const petShopCommand = new SlashCommandBuilder()
  .setName('pet-shop')
  .setDescription('🛒 เปิดร้านค้าไข่วิญญาณ (เฉพาะแอดมิน)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function handlePetShopCommand(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('🥚 ร้านค้าไข่วิญญาณ (Zen Pet Shop)')
    .setDescription('ซื้อไข่วิญญาณลึกลับเพื่อฟักเป็นสัตว์เลี้ยงคู่กาย!\n\n**ราคา:** `100 Coins/Orbs`\n**ระยะเวลาฟัก:** `60 วินาที`')
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

// 🐾 2. /companion
const companionCommand = new SlashCommandBuilder()
  .setName('companion')
  .setDescription('🐾 ตรวจสอบการ์ดโปรไฟล์และสเตตัสคู่หูวิญญาณของคุณ');

async function handleCompanionCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  const userData = serverConfigs[guildId]?.levels?.[userId];
  const petEgg = userData?.petEgg;

  if (!petEgg || !petEgg.hasEgg) {
    return await interaction.reply({ content: '❌ คุณยังไม่มีคู่หูหรือไข่วิญญาณ! ไปซื้อไข่จากหน้าร้านก่อน', ephemeral: true });
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

// 💰 3. /coins
const coinsCommand = new SlashCommandBuilder()
  .setName('coins')
  .setDescription('💰 ตรวจสอบยอดเงิน Orbs ของคุณ');

async function handleCoinsCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  const userData = serverConfigs[guildId]?.levels?.[userId];
  const userCoins = userData?.coins !== undefined ? userData.coins : (userData?.orbs || 0);
  await interaction.reply({ content: `🔮 ยอดเงินของคุณคือ: **${userCoins.toLocaleString()} Coins**`, ephemeral: true });
}

// 📢 4. /set-pet-channel
const setPetChannelCommand = new SlashCommandBuilder()
  .setName('set-pet-channel')
  .setDescription('📢 ตั้งค่าห้องสำหรับส่งแจ้งเตือนฟักไข่สัตว์เลี้ยง (เฉพาะแอดมิน)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('เลือกห้องที่ต้องการให้บอทรายงาน')
      .setRequired(true)
  );

// 🛒 [แก้ไขให้เสถียร] จัดการปุ่มซื้อไข่ (บันทึกข้อมูลทันที ป้องกันกดรัวและเงินไม่ลด)
async function handleCompanionButton(interaction) {
  if (!interaction.isButton() || interaction.customId !== 'buy_pet_egg') return false;

  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  // โหลดข้อมูลสดๆ จาก Redis ทันที
  let rawData = await redis.get('server_configs');
  let serverConfigs = rawData ? (typeof rawData === 'string' ? JSON.parse(rawData) : rawData) : {};

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].levels) serverConfigs[guildId].levels = {};
  if (!serverConfigs[guildId].levels[userId]) {
    serverConfigs[guildId].levels[userId] = { xp: 0, level: 1, coins: 200, orbs: 200 };
  }

  const userData = serverConfigs[guildId].levels[userId];

  // 1. เช็กว่ามีไข่หรือสัตว์เลี้ยงอยู่แล้วหรือไม่ (ป้องกันการซื้อซ้ำเด็ดขาด)
  if (userData.petEgg && userData.petEgg.hasEgg) {
    await interaction.reply({ 
      content: userData.petEgg.isHatched 
        ? '❌ คุณมีสัตว์เลี้ยงอยู่แล้ว ไม่สามารถซื้อไข่เพิ่มได้!' 
        : `❌ คุณมีไข่วิญญาณที่กำลังฟักอยู่! (เหลือเวลาอีกประมาณ ${userData.petEgg.remainingSeconds || 0} วินาที)`, 
      ephemeral: true 
    });
    return true;
  }

  // 2. ตรวจสอบยอดเงิน (รองรับทั้ง coins และ orbs)
  let currentMoney = userData.coins !== undefined ? userData.coins : (userData.orbs !== undefined ? userData.orbs : 0);
  const eggCost = 100;

  if (currentMoney < eggCost) {
    await interaction.reply({ content: `❌ เงินของคุณไม่พอ! (ต้องการ ${eggCost} Coins แต่คุณมี ${currentMoney.toLocaleString()} Coins)`, ephemeral: true });
    return true;
  }

  // 3. หักเงินทันที
  if (userData.coins !== undefined) userData.coins -= eggCost;
  if (userData.orbs !== undefined) userData.orbs -= eggCost;

  // 4. สร้างข้อมูลไข่
  userData.petEgg = {
    hasEgg: true,
    totalSecondsNeeded: 60,
    remainingSeconds: 60,
    isHatched: false,
    hatchedPet: null,
    createdAt: Date.now()
  };

  // 5. บันทึกลง Redis ทันทีแบบเรียลไทม์ (ห้ามหน่วง) เพื่อป้องกันปัญหาเงินไม่ลดหรือซื้อซ้ำ
  await redis.set('server_configs', JSON.stringify(serverConfigs));

  let remainingBalance = userData.coins !== undefined ? userData.coins : userData.orbs;

  await interaction.reply({
    content: `🎉 ซื้อไข่วิญญาณสำเร็จ! หักเงินไป **${eggCost} Coins** (ยอดคงเหลือ: ${remainingBalance.toLocaleString()} Coins)\n⏳ รอฟัก 60 วินาที เช็กโปรไฟล์สัตว์เลี้ยงด้วย \`/companion\``,
    ephemeral: true
  });

  return true;
}

// ⚔️ 5. /pet-battle
const petBattleCommand = new SlashCommandBuilder()
  .setName('pet-battle')
  .setDescription('⚔️ ท้าประลองสัตว์เลี้ยงกับผู้เล่นคนอื่นเพื่อชิง Orbs')
  .addUserOption(option => 
    option.setName('target')
      .setDescription('เลือกผู้เล่นที่ต้องการท้าประลอง')
      .setRequired(true)
  )
  .addIntegerOption(option => 
    option.setName('bet')
      .setDescription('จำนวนเงิน Orbs ที่ต้องการวางเดิมพัน')
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
    .setTitle('⚔️ คำท้าประลองลานสู้สัตว์เลี้ยง (Zen Pet Battle)!')
    .setDescription(
      `<@${attackerId}> ได้ส่งคำท้าประลองถึง <@${defenderUser.id}>!\n\n` +
      `💰 **เงินเดิมพัน:** \`${betAmount.toLocaleString()} Coins\`\n\n` +
      `🔴 **ผู้ท้าประลอง:** <@${attackerId}>\n` +
      `🐾 **สัตว์เลี้ยง:** ${atkPet.name} (${'⭐'.repeat(atkPet.stars)})\n` +
      `⚔️ **พลังต่อสู้:** \`${atkPower}\`\n\n` +
      `🔵 **ผู้รับคำท้า:** <@${defenderUser.id}>\n` +
      `🐾 **สัตว์เลี้ยง:** ${defPet.name} (${'⭐'.repeat(defPet.stars)})\n` +
      `⚔️ **พลังต่อสู้:** \`${defPower}\`\n\n` +
      `*กดปุ่มด้านล่างเพื่อยอมรับหรือปฏิเสธคำท้า!*`
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
      .setDescription(`<@${defenderId}> ได้ปฏิเสธคำท้าประลองของ <@${attackerId}>`)
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

  // อัปเดตเงินผู้ชนะและผู้แพ้
  if (levels[winnerId].coins !== undefined) levels[winnerId].coins += betAmount;
  else if (levels[winnerId].orbs !== undefined) levels[winnerId].orbs += betAmount;

  if (levels[loserId].coins !== undefined) levels[loserId].coins -= betAmount;
  else if (levels[loserId].orbs !== undefined) levels[loserId].orbs -= betAmount;

  const winnerPetEgg = levels[winnerId].petEgg;
  winnerPetEgg.petXp = (winnerPetEgg.petXp || 0) + 25;
  if (winnerPetEgg.petXp >= (winnerPetEgg.petLevel || 1) * 100) {
    winnerPetEgg.petLevel = (winnerPetEgg.petLevel || 1) + 1;
    winnerPetEgg.petXp -= (winnerPetEgg.petLevel - 1) * 100;
  }

  await saveConfigs(serverConfigs);

  const resultEmbed = new EmbedBuilder()
    .setTitle('🏆 ผลการประลองสัตว์เลี้ยง!')
    .setDescription(
      `🎉 **ผู้ชนะ:** <@${winnerId}> พร้อมกับ **${winnerPet}**!\n` +
      `💰 เงินรางวัล: \`+${betAmount.toLocaleString()} Coins\` รับ EXP PET: \`+25 XP\``
    )
    .setImage(winnerPetObj.image)
    .setColor(0x00FF00);

  await interaction.update({ embeds: [resultEmbed], components: [] });
  return true;
}

// 🏆 6. /pet-leaderboard
const petLeaderboardCommand = new SlashCommandBuilder()
  .setName('pet-leaderboard')
  .setDescription('🏆 ตรวจสอบอันดับสัตว์เลี้ยงที่เก่งที่สุดในเซิร์ฟเวอร์');

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
    return await interaction.reply({ content: '🏆 ยังไม่มีสัตว์เลี้ยงที่ฟักเป็นตัวในเซิร์ฟเวอร์นี้!', ephemeral: true });
  }

  const topPets = hatchedPets.slice(0, 10);
  let description = '';

  topPets.forEach((item, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `\`#${index + 1}\``;
    description += `${medal} <@${item.userId}> — **${item.pet.name}**\n` +
                   `⭐ Level ${item.level} | ${'⭐'.repeat(item.pet.stars)} (${item.pet.type}) | ⚔️ Power: \`${item.power}\`\n\n`;
  });

  const embed = new EmbedBuilder()
    .setTitle('🏆 กระดานจัดอันดับสัตว์เลี้ยงเซิร์ฟเวอร์ (Pet Leaderboard)')
    .setDescription(description)
    .setColor(0xFFD700)
    .setFooter({ text: 'ZEN PET • Top Ranking' });

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
