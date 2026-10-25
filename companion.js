const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const { COLORS } = require('./constants');

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

// 📢 ฟังก์ชันเช็กและฟักไข่อัตโนมัติ (แสดงการ์ด Embed สวยงามเมื่อไข่ฟัก)
async function checkAndHatchPet(guild, userId, userData, client, serverConfig) {
  if (!userData.petEgg || userData.petEgg.isHatched) return false;

  const now = Date.now();
  if (now >= userData.petEgg.hatchUntil) {
    userData.petEgg.isHatched = true;
    userData.petEgg.hatchedPet = rollRandomPet();
    userData.petEgg.petLevel = 1;
    userData.petEgg.petXp = 0;
    userData.petEgg.battlesCount = 0;

    const pet = userData.petEgg.hatchedPet;
    const targetChannel = findPetTargetChannel(guild, serverConfig);

    if (targetChannel) {
      const embed = new EmbedBuilder()
        .setTitle(pet.name)
        .setDescription(
          `**Rarity:** ${'⭐'.repeat(pet.stars)} (${pet.type})\n` +
          `**Base Orb:** ${pet.baseOrb} 🔮`
        )
        .setImage(pet.image)
        .setColor(0xFFD700);

      await targetChannel.send({
        content: `<@${userId}>`,
        embeds: [embed]
      }).catch(() => {});
    }

    if (serverConfig.petRoleId && guild) {
      try {
        const member = await guild.members.fetch(userId).catch(() => null);
        const role = guild.roles.cache.get(serverConfig.petRoleId);
        if (member && role && !member.roles.cache.has(role.id)) {
          await member.roles.add(role).catch(() => {});
        }
      } catch (err) {
        console.error('Error assigning pet role:', err);
      }
    }

    return true;
  }
  return false;
}

// 📈 ระบบเก็บเลเวลสัตว์เลี้ยง (แจ้งเตือนรูปแบบ [ZEN PET] เมื่อเลเวลอัป)
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
          content: `[ZEN PET] ยินดีด้วยคุณ <@${userId}>! **${pet.name}** ของคุณอัปเลเวลเป็น **Level ${newLevel}** แล้ว!`
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
    .setDescription('ซื้อไข่วิญญาณลึกลับเพื่อฟักเป็นสัตว์เลี้ยงคู่กาย!\n\n**ราคา:** `500 Orbs`\n**ระยะเวลาฟัก:** `60 วินาที`')
    .setImage('https://cdn.discordapp.com/attachments/1559878908348997774/1563060185633652816/image0.jpg')
    .setColor(0xFFD700);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('buy_pet_egg')
      .setLabel('🟢 ซื้อไข่วิญญาณ (500 Orbs)')
      .setStyle(ButtonStyle.Success)
  );

  await interaction.reply({ content: '🛒 เปิดหน้าร้านค้าเรียบร้อย!', ephemeral: true });
  await interaction.channel.send({ embeds: [embed], components: [row] });
}

// ⚙️ คำสั่งตั้งค่าห้องแจ้งเตือน
const setPetChannelCommand = new SlashCommandBuilder()
  .setName('set-pet-channel')
  .setDescription('📢 ตั้งค่าห้องสำหรับส่งแจ้งเตือนฟักไข่สัตว์เลี้ยง (เฉพาะแอดมิน)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('เลือกห้องที่ต้องการให้บอทรายงาน')
      .setRequired(true)
  );

// ⚙️ คำสั่งตั้งค่ายศที่จะแจกเมื่อซื้อไข่
const setPetRoleCommand = new SlashCommandBuilder()
  .setName('set-pet-role')
  .setDescription('🎭 ตั้งค่ายศที่จะได้รับอัตโนมัติเมื่อซื้อไข่สัตว์เลี้ยง (เฉพาะแอดมิน)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addRoleOption(option =>
    option.setName('role')
      .setDescription('เลือกยศที่ต้องการแจก')
      .setRequired(true)
  );

async function handleSetPetRoleCommand(interaction, serverConfigs, saveConfigs) {
  const guildId = interaction.guildId;
  const role = interaction.options.getRole('role');

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  serverConfigs[guildId].petRoleId = role.id;
  await saveConfigs(serverConfigs);

  await interaction.reply({ content: `✅ ตั้งค่ายศสัตว์เลี้ยงเป็น <@&${role.id}> สำเร็จแล้ว!`, ephemeral: true });
  return true;
}

// 🐾 คำสั่งดูโปรไฟล์สัตว์เลี้ยง (/pet)
const petCommand = new SlashCommandBuilder()
  .setName('pet')
  .setDescription('🐾 ตรวจสอบการ์ดโปรไฟล์และสเตตัสคู่หูวิญญาณของคุณ');

async function handlePetCommand(interaction, serverConfigs, saveConfigs, client) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  const serverConfig = serverConfigs[guildId];
  const userData = serverConfig.levels?.[userId];
  const petEgg = userData?.petEgg;

  if (!petEgg || !petEgg.hasEgg) {
    return await interaction.reply({ content: '❌ คุณยังไม่มีไข่หรือสัตว์เลี้ยง! ไปซื้อไข่จากหน้าร้านก่อน', ephemeral: true });
  }

  if (!petEgg.isHatched) {
    const hatched = await checkAndHatchPet(interaction.guild, userId, userData, client, serverConfig);
    if (hatched) {
      if (saveConfigs) await saveConfigs(serverConfigs);
    } else {
      const remainingSec = Math.ceil((petEgg.hatchUntil - Date.now()) / 1000);
      return await interaction.reply({
        content: `🥚 ไข่วิญญาณของคุณกำลังฟัก... เหลือเวลาอีกประมาณ **${remainingSec} วินาที**`,
        ephemeral: true
      });
    }
  }

  const pet = petEgg.hatchedPet || PET_DATABASE[0];
  const totalPower = pet.baseOrb + ((petEgg.petLevel || 1) * 20);
  const battlesCount = petEgg.battlesCount || 0;

  const embed = new EmbedBuilder()
    .setTitle(`🛡️ โปรไฟล์คู่หู: ${pet.name}`)
    .setDescription(
      `⭐ **ระดับดาว:** ${'⭐'.repeat(pet.stars)} (${pet.type})\n` +
      `📈 **เลเวล:** Level ${petEgg.petLevel || 1}\n` +
      `✨ **ค่าประสบการณ์ (XP):** ${petEgg.petXp || 0}/${(petEgg.petLevel || 1) * 100}\n` +
      `⚔️ **พลังต่อสู้ (Power):** \`${totalPower}\`\n` +
      `🔮 **Base Orb:** ${pet.baseOrb} Orbs\n` +
      `📊 **สถิติประลอง:** \`${battlesCount} ครั้ง\``
    )
    .setColor(0x00FF99)
    .setImage(pet.image)
    .setFooter({ text: `Owner: ${interaction.user.tag} • ZEN PET PROFILE` });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// 💰 เช็กเงิน Orbs
const coinsCommand = new SlashCommandBuilder()
  .setName('coins')
  .setDescription('💰 ตรวจสอบยอดเงิน Orbs ของคุณ');

async function handleCoinsCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  const userData = serverConfigs[guildId]?.levels?.[userId];
  const userCoins = userData?.orbs !== undefined ? userData.orbs : (userData?.coins || 0);
  await interaction.reply({ content: `🔮 ยอด Orbs ของคุณคือ: **${userCoins.toLocaleString()} Orbs**`, ephemeral: true });
}

// 🛒 ปุ่มซื้อไข่ (เชื่อมตรงกับ serverConfigs ตัวกลาง 100%)
async function handleCompanionButton(interaction, serverConfigs, saveConfigs) {
  if (!interaction.isButton() || interaction.customId !== 'buy_pet_egg') return false;

  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].levels) serverConfigs[guildId].levels = {};
  if (!serverConfigs[guildId].levels[userId]) {
    serverConfigs[guildId].levels[userId] = { xp: 0, level: 1, coins: 1000, orbs: 1000 };
  }

  const serverConfig = serverConfigs[guildId];
  const userData = serverConfig.levels[userId];
  const now = Date.now();

  if (userData.petEgg && userData.petEgg.hasEgg) {
    if (!userData.petEgg.isHatched && now < userData.petEgg.hatchUntil) {
      const remainingSec = Math.ceil((userData.petEgg.hatchUntil - now) / 1000);
      await interaction.reply({ content: `❌ คุณมีไข่วิญญาณที่กำลังฟักอยู่! (เหลือเวลาอีกประมาณ ${remainingSec} วินาที)`, ephemeral: true });
    } else {
      await interaction.reply({ content: `❌ คุณมีสัตว์เลี้ยงหรือไข่อยู่แล้ว! ซื้อได้แค่ตัวเดียวเท่านั้น`, ephemeral: true });
    }
    return true;
  }

  let currentOrbs = userData.orbs !== undefined ? userData.orbs : (userData.coins !== undefined ? userData.coins : 0);
  const eggCost = 500;

  if (currentOrbs < eggCost) {
    await interaction.reply({ content: `❌ Orbs ของคุณไม่พอ! (ต้องการ ${eggCost} Orbs แต่คุณมี ${currentOrbs.toLocaleString()} Orbs)`, ephemeral: true });
    return true;
  }

  if (userData.orbs !== undefined) userData.orbs -= eggCost;
  else if (userData.coins !== undefined) userData.coins -= eggCost;

  userData.petEgg = {
    hasEgg: true,
    isHatched: false,
    hatchUntil: now + (60 * 1000),
    hatchedPet: null,
    petLevel: 1,
    petXp: 0,
    battlesCount: 0,
    createdAt: now
  };

  if (typeof saveConfigs === 'function') {
    await saveConfigs(serverConfigs);
  }

  if (serverConfig.petRoleId) {
    try {
      const member = await interaction.guild.members.fetch(userId);
      const role = await interaction.guild.roles.fetch(serverConfig.petRoleId);
      if (role && !member.roles.cache.has(role.id)) {
        await member.roles.add(role);
      }
    } catch (err) {
      console.error('Error assigning pet role:', err);
    }
  }

  let remainingBalance = userData.orbs !== undefined ? userData.orbs : userData.coins;

  await interaction.reply({
    content: `🎉 ซื้อไข่วิญญาณสำเร็จ! หักไป **${eggCost} Orbs** (ยอดคงเหลือ: \`${remainingBalance.toLocaleString()} Orbs\`)\n🎭 ได้รับยศสัตว์เลี้ยงเรียบร้อย!\n⏳ กำลังฟักไข่ ใช้เวลา **60 วินาที** พิมพ์ \`/pet\` เพื่อเช็กสถานะได้เลย!`,
    ephemeral: true
  });

  return true;
}

// ⚔️ ลานประลอง (Hardcore Mode)
const petBattleCommand = new SlashCommandBuilder()
  .setName('pet-battle')
  .setDescription('⚔️ ท้าประลองสัตว์เลี้ยงกับผู้เล่นคนอื่นเพื่อชิงเงินและชิง EXP (ผู้แพ้สัตว์เลี้ยงตาย!)')
  .addUserOption(option => 
    option.setName('target')
      .setDescription('เลือกผู้เล่นที่ต้องการท้าประลอง')
      .setRequired(true)
  )
  .addIntegerOption(option => 
    option.setName('bet')
      .setDescription('จำนวน Orbs ที่ต้องการวางเดิมพัน')
      .setRequired(true)
      .setMinValue(10)
  );

async function handlePetBattleCommand(interaction, serverConfigs, client) {
  const guildId = interaction.guildId;
  const attackerId = interaction.user.id;
  const defenderUser = interaction.options.getUser('target');
  const betAmount = interaction.options.getInteger('bet');

  if (defenderUser.id === attackerId || defenderUser.bot) {
    return await interaction.reply({ content: '❌ เป้าหมายท้าประลองไม่ถูกต้อง!', ephemeral: true });
  }

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  const serverConfig = serverConfigs[guildId];
  const levels = serverConfig.levels || {};
  const atkData = levels[attackerId];
  const defData = levels[defenderUser.id];

  if (atkData?.petEgg && !atkData.petEgg.isHatched) {
    await checkAndHatchPet(interaction.guild, attackerId, atkData, client, serverConfig);
  }
  if (defData?.petEgg && !defData.petEgg.isHatched) {
    await checkAndHatchPet(interaction.guild, defenderUser.id, defData, client, serverConfig);
  }

  if (!atkData?.petEgg?.isHatched) {
    return await interaction.reply({ content: '❌ คุณยังไม่มีสัตว์เลี้ยงที่ฟักเป็นตัว!', ephemeral: true });
  }
  if (!defData?.petEgg?.isHatched) {
    return await interaction.reply({ content: `❌ <@${defenderUser.id}> ยังไม่มีสัตว์เลี้ยงที่ฟักเป็นตัวพร้อมประลอง!`, ephemeral: true });
  }

  const atkOrbs = atkData.orbs !== undefined ? atkData.orbs : (atkData.coins || 0);
  const defOrbs = defData.orbs !== undefined ? defData.orbs : (defData.coins || 0);

  if (atkOrbs < betAmount) {
    return await interaction.reply({ content: `❌ Orbs ของคุณไม่พอสำหรับการเดิมพัน!`, ephemeral: true });
  }
  if (defOrbs < betAmount) {
    return await interaction.reply({ content: `❌ <@${defenderUser.id}> มี Orbs ไม่พอสำหรับการเดิมพันนี้!`, ephemeral: true });
  }

  const atkPet = atkData.petEgg.hatchedPet;
  const defPet = defData.petEgg.hatchedPet;

  const atkPower = atkPet.baseOrb + ((atkData.petEgg.petLevel || 1) * 20);
  const defPower = defPet.baseOrb + ((defData.petEgg.petLevel || 1) * 20);

  const embed = new EmbedBuilder()
    .setTitle('⚔️ คำท้าประลองลานสู้สัตว์เลี้ยง (Hardcore Mode)!')
    .setDescription(
      `<@${attackerId}> ได้ส่งคำท้าประลองถึง <@${defenderUser.id}>!\n\n` +
      `💀 **กติกา:** ผู้แพ้สัตว์เลี้ยงจะตายและหายไปทันที!\n` +
      `💰 **เดิมพัน:** \`${betAmount.toLocaleString()} Orbs\`\n\n` +
      `🔴 **ผู้ท้า:** <@${attackerId}> (${atkPet.name} [Power: ${atkPower}])\n` +
      `🔵 **ผู้รับ:** <@${defenderUser.id}> (${defPet.name} [Power: ${defPower}])\n\n` +
      `*กดปุ่มด้านล่างเพื่อตัดสินชะตากรรม!*`
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

async function handleBattleButtons(interaction, serverConfigs, saveConfigs) {
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

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  const serverConfig = serverConfigs[guildId];
  const levels = serverConfig.levels || {};

  const atkData = levels[attackerId];
  const defData = levels[defenderId];

  if (!atkData?.petEgg?.isHatched || !defData?.petEgg?.isHatched) {
    await interaction.reply({ content: '❌ ข้อมูลสัตว์เลี้ยงของผู้เล่นไม่ถูกต้องหรือสัตว์เลี้ยงหายไปแล้ว', ephemeral: true });
    return true;
  }

  const atkOrbs = atkData.orbs !== undefined ? atkData.orbs : (atkData.coins || 0);
  const defOrbs = defData.orbs !== undefined ? defData.orbs : (defData.coins || 0);

  if (atkOrbs < betAmount || defOrbs < betAmount) {
    await interaction.reply({ content: '❌ ยอด Orbs ของผู้เล่นไม่พอสำหรับการเดิมพันแล้ว การประลองถูกยกเลิก', ephemeral: true });
    return true;
  }

  const atkPet = atkData.petEgg.hatchedPet;
  const defPet = defData.petEgg.hatchedPet;

  const atkPower = atkPet.baseOrb + ((atkData.petEgg.petLevel || 1) * 20);
  const defPower = defPet.baseOrb + ((defData.petEgg.petLevel || 1) * 20);

  const atkScore = atkPower * (0.95 + Math.random() * 0.1);
  const defScore = defPower * (0.95 + Math.random() * 0.1);
  const isAttackerWin = atkScore > defScore;

  const winnerId = isAttackerWin ? attackerId : defenderId;
  const loserId = isAttackerWin ? defenderId : attackerId;
  const winnerData = levels[winnerId];
  const loserData = levels[loserId];
  const winnerPet = isAttackerWin ? atkPet : defPet;

  const loserLevel = loserData.petEgg?.petLevel || 1;
  const loserXp = loserData.petEgg?.petXp || 0;
  const loserXpValue = (loserLevel * 50) + loserXp;

  if (winnerData.orbs !== undefined) winnerData.orbs += betAmount;
  else winnerData.coins += betAmount;

  if (loserData.orbs !== undefined) loserData.orbs -= betAmount;
  else loserData.coins -= betAmount;

  winnerData.petEgg.battlesCount = (winnerData.petEgg.battlesCount || 0) + 1;
  loserData.petEgg.battlesCount = (loserData.petEgg.battlesCount || 0) + 1;

  winnerData.petEgg.petXp = (winnerData.petEgg.petXp || 0) + loserXpValue;

  while (winnerData.petEgg.petXp >= (winnerData.petEgg.petLevel || 1) * 100) {
    winnerData.petEgg.petXp -= (winnerData.petEgg.petLevel || 1) * 100;
    winnerData.petEgg.petLevel += 1;
  }

  loserData.petEgg = null;

  if (serverConfig.petRoleId) {
    try {
      const loserMember = await interaction.guild.members.fetch(loserId).catch(() => null);
      const role = interaction.guild.roles.cache.get(serverConfig.petRoleId);
      if (loserMember && role && loserMember.roles.cache.has(role.id)) {
        await loserMember.roles.remove(role).catch(() => {});
      }
    } catch (err) {
      console.error('Error removing pet role from loser:', err);
    }
  }

  if (typeof saveConfigs === 'function') {
    await saveConfigs(serverConfigs);
  }

  const resultEmbed = new EmbedBuilder()
    .setTitle('🏆 ผลการประลองฮาร์ดคอร์!')
    .setDescription(
      `🎉 **ผู้ชนะ:** <@${winnerId}> (${winnerPet.name})!\n` +
      `💀 **ผู้แพ้:** <@${loserId}> สัตว์เลี้ยงเสียชีวิตและหายไปจากโลกนี้แล้ว!\n\n` +
      `💰 เงินรางวัล: \`+${betAmount.toLocaleString()} Orbs\`\n` +
      `✨ ได้รับ XP สะสมจากคู่ต่อสู้: \`+${loserXpValue.toLocaleString()} XP\``
    )
    .setImage(winnerPet.image)
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
    return await interaction.reply({ content: '🏆 ยังไม่มีสัตว์เลี้ยงที่ฟักเป็นตัวในเซิร์ฟเวอร์นี้!', ephemeral: true });
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
  checkAndHatchPet,
  progressPetXp,
  petShopCommand,
  handlePetShopCommand,
  setPetChannelCommand,
  setPetRoleCommand,
  handleSetPetRoleCommand,
  petCommand,
  handlePetCommand,
  coinsCommand,
  handleCoinsCommand,
  handleCompanionButton,
  petBattleCommand,
  handlePetBattleCommand,
  handleBattleButtons,
  petLeaderboardCommand,
  handlePetLeaderboardCommand
};
