const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const { generatePetCard } = require('./canvas_card');
const { COLORS } = require('./constants');

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
  if (rand < 48) return PET_DATABASE[0];      // 48% - 1 ดาว
  if (rand < 78) return PET_DATABASE[1];      // 30% - 2 ดาว
  if (rand < 92) return PET_DATABASE[2];      // 14% - 3 ดาว
  if (rand < 98) return PET_DATABASE[3];      // 6%  - 4 ดาว
  if (rand < 99.7) return PET_DATABASE[4];    // 1.7% - 5 ดาว
  return PET_DATABASE[5];                     // 0.3% - 6 ดาว (Cosmic)
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

// 🥚 ตรวจสอบและฟักไข่อัตโนมัติด้วยระบบ Timestamp (รอ 60 วินาที)
async function checkAndHatchPet(guild, userId, userData, client, serverConfig) {
  if (!userData.petEgg || userData.petEgg.isHatched) return false;

  const now = Date.now();
  const targetTime = userData.petEgg.hatchUntil || (userData.petEgg.createdAt ? userData.petEgg.createdAt + 60000 : now);

  if (now >= targetTime) {
    userData.petEgg.isHatched = true;
    userData.petEgg.hatchedPet = rollRandomPet();
    userData.petEgg.petLevel = 1;
    userData.petEgg.petXp = 0;
    userData.petEgg.battlesCount = 0; // 📊 เริ่มต้นนับจำนวนครั้งที่ประลอง

    const pet = userData.petEgg.hatchedPet;
    const targetChannel = findPetTargetChannel(guild, serverConfig);

    if (targetChannel) {
      const starString = '⭐'.repeat(pet.stars);
      const embed = new EmbedBuilder()
        .setTitle(pet.name)
        .setDescription(
          `Rarity: ${starString} (${pet.type})\n` +
          `${pet.baseOrb} 🔮`
        )
        .setColor(COLORS.GOLD)
        .setImage(pet.image);

      await targetChannel.send({
        content: `🎉 ไข่วิญญาณของ <@${userId}> ฟักเป็นตัวเรียบร้อยแล้ว!`,
        embeds: [embed]
      }).catch(() => {});
    }

    // แจกยศอัตโนมัติเมื่อฟักเสร็จ (ถ้ามีการตั้งค่า petRoleId ไว้)
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

// 📈 ระบบเก็บเลเวลสัตว์เลี้ยงจากกิจกรรมต่างๆ (แชท / ห้องเสียง / การประลอง)
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

// 🐾 คำสั่ง /pet (ตรวจดูการ์ดสัตว์เลี้ยง พร้อมสถิติจำนวนครั้งที่ประลอง)
const petCommand = new SlashCommandBuilder()
  .setName('pet')
  .setDescription('🐾 เปิดดูการ์ดสัตว์เลี้ยงของคุณ')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('เลือกสมาชิกที่ต้องการดูสัตว์เลี้ยง')
      .setRequired(false)
  );

async function handlePetCommand(interaction, serverConfigs, saveConfigs, client) {
  const guildId = interaction.guildId;
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const userId = targetUser.id;
  
  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  const serverConfig = serverConfigs[guildId];
  if (!serverConfig.levels) serverConfig.levels = {};
  if (!serverConfig.levels[userId]) {
    serverConfig.levels[userId] = { xp: 0, level: 1, orbs: 0 };
  }

  const userStat = serverConfig.levels[userId];
  const petEgg = userStat.petEgg;

  if (!petEgg || !petEgg.hasEgg) {
    return await interaction.reply({ content: '❌ คุณยังไม่มีไข่หรือสัตว์เลี้ยง! ไปซื้อไข่จากหน้าร้านค้าก่อน', ephemeral: true });
  }

  if (!petEgg.isHatched) {
    const hatched = await checkAndHatchPet(interaction.guild, userId, userStat, client, serverConfig);
    if (hatched) {
      if (saveConfigs) await saveConfigs(serverConfigs);
    } else {
      const now = Date.now();
      const targetTime = petEgg.hatchUntil || (petEgg.createdAt ? petEgg.createdAt + 60000 : now + 60000);
      const remainingSec = Math.max(0, Math.ceil((targetTime - now) / 1000));
      
      return await interaction.reply({
        content: `🥚 ไข่วิญญาณของคุณกำลังฟัก... เหลือเวลาอีกประมาณ **${remainingSec} วินาที**`,
        ephemeral: true
      });
    }
  }

  await interaction.deferReply({ ephemeral: true });
  const attachment = await generatePetCard(targetUser, petEgg);

  return await interaction.editReply({
    files: [attachment],
    components: []
  });
}

// 🛒 คำสั่ง /setup-pet-shop (เปิดร้านค้า 500 Orbs)
const setupShopCommand = new SlashCommandBuilder()
  .setName('setup-pet-shop')
  .setDescription('🛠️ [Admin] ส่งข้อความหน้าร้านค้าสัตว์เลี้ยงถาวรลงในห้องนี้')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function handleSetupShopCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น!', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle('🛒 ZEN PET SHOP & MARKET')
    .setDescription(
      `ยินดีต้อนรับสู่ร้านค้าสัตว์เลี้ยงประจำเซิร์ฟเวอร์!\n\n` +
      `📦 **Mystery Pet Egg (ไข่สัตว์เลี้ยงลึกลับ)**\n` +
      `✨ *ลุ้นรับสัตว์เลี้ยงระดับ 1 ดาว ถึง 6 ดาว (Cosmic)*\n` +
      `💵 **ราคา:** \`500 Orbs\``
    )
    .setColor(COLORS.GOLD)
    .setImage('https://cdn.discordapp.com/attachments/1559878908348997774/1563060185633652816/image0.jpg');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('buy_pet_egg_shop')
      .setLabel('🎁 ซื้อไข่สัตว์เลี้ยง (500 Orbs)')
      .setStyle(ButtonStyle.Success)
  );

  await interaction.reply({ content: '✅ สร้างหน้าร้านค้าเรียบร้อยแล้ว!', ephemeral: true });
  await interaction.channel.send({ embeds: [embed], components: [row] });
}

// ⚙️ คำสั่งตั้งค่าห้องแจ้งเตือน (/set-pet-channel)
const setPetChannelCommand = new SlashCommandBuilder()
  .setName('set-pet-channel')
  .setDescription('📢 ตั้งค่าห้องสำหรับส่งแจ้งเตือนฟักไข่สัตว์เลี้ยง (เฉพาะแอดมิน)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('เลือกห้องที่ต้องการให้บอทรายงาน')
      .setRequired(true)
  );

// ⚙️ คำสั่งตั้งค่ายศที่จะแจกเมื่อซื้อ/ฟักไข่ (/set-pet-role)
const setPetRoleCommand = new SlashCommandBuilder()
  .setName('set-pet-role')
  .setDescription('🎭 ตั้งค่ายศที่จะได้รับอัตโนมัติเมื่อมีสัตว์เลี้ยง (เฉพาะแอดมิน)')
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

// 🎁 จัดการปุ่มกดซื้อไข่จากหน้าร้าน
async function handlePetButton(interaction, serverConfigs, saveConfigs) {
  if (interaction.customId !== 'buy_pet_egg_shop') return false;

  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  
  const configs = typeof serverConfigs === 'function' ? await serverConfigs() : serverConfigs;

  if (!configs[guildId]) configs[guildId] = {};
  if (!configs[guildId].levels) configs[guildId].levels = {};
  if (!configs[guildId].levels[userId]) {
    configs[guildId].levels[userId] = { xp: 0, level: 1, orbs: 0 };
  }

  const userStat = configs[guildId].levels[userId];
  if (userStat.orbs === undefined) userStat.orbs = 0;
  const cost = 500;

  if (userStat.petEgg && userStat.petEgg.hasEgg) {
    const now = Date.now();
    const targetTime = userStat.petEgg.hatchUntil || (userStat.petEgg.createdAt ? userStat.petEgg.createdAt + 60000 : now + 60000);
    
    if (!userStat.petEgg.isHatched && now < targetTime) {
      const remainingSec = Math.ceil((targetTime - now) / 1000);
      return await interaction.editReply({ content: `❌ คุณมีไข่วิญญาณที่กำลังฟักอยู่! (เหลือเวลาอีกประมาณ ${remainingSec} วินาที)` });
    } else {
      return await interaction.editReply({ content: `❌ คุณมีสัตว์เลี้ยงหรือไข่อยู่แล้ว! ซื้อได้แค่ตัวเดียวเท่านั้น` });
    }
  }

  if (userStat.orbs < cost) {
    return await interaction.editReply({ content: `❌ Orbs ของคุณไม่พอ! (ต้องการ ${cost} Orbs แต่คุณมี ${userStat.orbs.toLocaleString()} Orbs)` });
  }

  userStat.orbs -= cost;
  
  const now = Date.now();
  userStat.petEgg = {
    hasEgg: true,
    isHatched: false,
    hatchUntil: now + 60000,
    hatchedPet: null,
    petLevel: 1,
    petXp: 0,
    battlesCount: 0,
    createdAt: now
  };

  if (typeof saveConfigs === 'function') {
    await saveConfigs(configs);
  }

  return await interaction.editReply({
    content: `🎉 ซื้อไข่วิญญาณสำเร็จ! หักไป **${cost} Orbs** (ยอดคงเหลือ: ${userStat.orbs.toLocaleString()} Orbs)\n⏳ กำลังฟักไข่ ใช้เวลา **60 วินาที** พิมพ์ \`/pet\` เพื่อเช็กสถานะได้เลย!`
  });
}

// ⚔️ ระบบลานประลอง Hardcore (นับจำนวนครั้งที่ประลอง + ผู้แพ้ตาย)
const petBattleCommand = new SlashCommandBuilder()
  .setName('pet-battle')
  .setDescription('⚔️ ท้าประลองสัตว์เลี้ยงกับผู้เล่นคนอื่นเพื่อชิง Orbs และ EXP (ผู้แพ้สัตว์เลี้ยงตาย!)')
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

  const atkOrbs = atkData.orbs || 0;
  const defOrbs = defData.orbs || 0;

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
      `💀 **กติกา:** ผู้แพ้สัตว์เลี้ยงจะตายและหายไปจากระบบทันที!\n` +
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

  let serverConfigs = typeof loadConfigs === 'function' ? await loadConfigs() : loadConfigs;
  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].levels) serverConfigs[guildId].levels = {};

  const levels = serverConfigs[guildId].levels;
  const atkData = levels[attackerId];
  const defData = levels[defenderId];

  const atkOrbs = atkData?.orbs || 0;
  const defOrbs = defData?.orbs || 0;

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

  // โอนเงินเดิมพัน
  winnerData.orbs += betAmount;
  loserData.orbs -= betAmount;

  // 📊 เพิ่มจำนวนครั้งที่ประลองให้กับทั้งสองฝ่าย
  winnerData.petEgg.battlesCount = (winnerData.petEgg.battlesCount || 0) + 1;
  loserData.petEgg.battlesCount = (loserData.petEgg.battlesCount || 0) + 1;

  // 🏆 ผู้ชนะได้ XP สะสมเพิ่มจากสัตว์เลี้ยงตัวที่แพ้
  const loserXpValue = (loserData.petEgg.petLevel || 1) * 50 + (loserData.petEgg.petXp || 0);
  winnerData.petEgg.petXp = (winnerData.petEgg.petXp || 0) + loserXpValue;

  while (winnerData.petEgg.petXp >= (winnerData.petEgg.petLevel || 1) * 100) {
    winnerData.petEgg.petXp -= (winnerData.petEgg.petLevel || 1) * 100;
    winnerData.petEgg.petLevel += 1;
  }

  // 💀 ลบข้อมูลสัตว์เลี้ยงของผู้แพ้ทิ้ง (ตาย)
  delete loserData.petEgg;

  if (typeof saveConfigs === 'function') {
    await saveConfigs(serverConfigs);
  }

  const resultEmbed = new EmbedBuilder()
    .setTitle('🏆 ผลการประลองฮาร์ดคอร์!')
    .setDescription(
      `🎉 **ผู้ชนะ:** <@${winnerId}> (${winnerPet.name})!\n` +
      `💀 **ผู้แพ้:** <@${loserId}> สัตว์เลี้ยงเสียชีวิตและหายไปจากระบบแล้ว! (ต้องซื้อไข่และฟักใหม่)\n\n` +
      `💰 เงินรางวัล: \`+${betAmount.toLocaleString()} Orbs\`\n` +
      `✨ ได้รับ XP จากคู่ต่อสู้: \`+${loserXpValue} XP\``
    )
    .setImage(winnerPet.image)
    .setColor(0x00FF00);

  await interaction.update({ embeds: [resultEmbed], components: [] });
  return true;
}

// 🏆 คำสั่งแสดงตารางจัดอันดับสัตว์เลี้ยง (/pet-leaderboard)
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
  petCommand,
  setupShopCommand,
  setPetChannelCommand,
  setPetRoleCommand,
  handlePetRoleCommand: handleSetPetRoleCommand,
  handlePetCommand,
  handleSetupShopCommand,
  handlePetButton,
  petBattleCommand,
  handlePetBattleCommand,
  handleBattleButtons,
  petLeaderboardCommand,
  handlePetLeaderboardCommand
};
