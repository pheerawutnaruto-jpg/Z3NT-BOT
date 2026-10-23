// pet_hatch.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
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

// 1. แจกไข่เริ่มต้น (ล็อกไม่ให้รับฟรีซ้ำหลังย่อยสลาย)
function assignInitialEgg(config, userId) {
  if (!config.levels) config.levels = {};
  if (!config.levels[userId]) {
    config.levels[userId] = { xp: 0, level: 1, orbs: 0 };
  }

  const userStat = config.levels[userId];
  if (userStat.orbs === undefined) userStat.orbs = 0;
  if (userStat.hasReceivedInitialEgg) return;

  if (!userStat.petEgg) {
    userStat.petEgg = {
      hasEgg: true,
      remainingSeconds: 60, // โหมดทดสอบ: ตั้งไว้ 60 วินาที
      isHatched: false,
      hatchedPet: null,
      petLevel: 1,
      petXp: 0
    };
    userStat.hasReceivedInitialEgg = true;
  }
}

// 2. ระบบลดเวลาฟักไข่เมื่อพิมพ์แชทหรืออยู่ในห้องเสียง
async function progressEggTime(guildId, userId, secondsToReduce, client, serverConfigs, saveConfigs, shouldSave = true) {
  const config = serverConfigs[guildId];
  if (!config || !config.levels || !config.levels[userId]) return;

  const userStat = config.levels[userId];
  if (!userStat.petEgg) assignInitialEgg(config, userId);

  if (userStat.petEgg.isHatched) {
    await progressPetXp(guildId, userId, 10, client, serverConfigs, saveConfigs, shouldSave);
    return;
  }

  if (!userStat.petEgg.hasEgg) return;

  const reduction = secondsToReduce || 30;
  userStat.petEgg.remainingSeconds = Math.max(0, userStat.petEgg.remainingSeconds - reduction);

  if (userStat.petEgg.remainingSeconds <= 0 && !userStat.petEgg.isHatched) {
    await triggerHatchEvent(guildId, userId, client, serverConfigs, saveConfigs, shouldSave);
  } else if (shouldSave) {
    await saveConfigs(serverConfigs);
  }
}

// 3. ระบบเก็บเลเวลสัตว์เลี้ยง
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

// 4. เหตุการณ์ไข่แตก
async function triggerHatchEvent(guildId, userId, client, serverConfigs, saveConfigs, shouldSave = true) {
  const config = serverConfigs[guildId];
  const userStat = config?.levels?.[userId];
  if (!userStat || !userStat.petEgg || userStat.petEgg.isHatched) return;

  userStat.petEgg.isHatched = true;
  userStat.petEgg.petLevel = 1;
  userStat.petEgg.petXp = 0;

  const rand = Math.random() * 100;
  let selectedPet;
  if (rand < 48) selectedPet = PET_DATABASE[0];      // 48% - 1 ดาว
  else if (rand < 78) selectedPet = PET_DATABASE[1]; // 30% - 2 ดาว
  else if (rand < 92) selectedPet = PET_DATABASE[2]; // 14% - 3 ดาว
  else if (rand < 98) selectedPet = PET_DATABASE[3]; // 6%  - 4 ดาว
  else if (rand < 99.7) selectedPet = PET_DATABASE[4]; // 1.7% - 5 ดาว
  else selectedPet = PET_DATABASE[5];                // 0.3% - 6 ดาว (Cosmic)

  userStat.petEgg.hatchedPet = selectedPet;

  if (shouldSave) {
    await saveConfigs(serverConfigs);
  }

  if (!client || !client.guilds) return;

  try {
    const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return;

    const targetChannel = findPetTargetChannel(guild, config);

    if (targetChannel) {
      const starString = '⭐'.repeat(selectedPet.stars);

      let claimCount = 0;
      if (config.levels) {
        for (const id in config.levels) {
          const st = config.levels[id];
          if (st.petEgg?.isHatched && st.petEgg?.hatchedPet?.name === selectedPet.name) {
            claimCount++;
          }
        }
      }

      const embed = new EmbedBuilder()
        .setTitle(selectedPet.name)
        .setDescription(
          `Rarity: ${starString} (${selectedPet.type})\n` +
          `Claims: ${claimCount}\n` +
          `${selectedPet.baseOrb} 🔮`
        )
        .setColor(COLORS.GOLD)
        .setImage(selectedPet.image);

      await targetChannel.send({
        content: `<@${userId}>`,
        embeds: [embed]
      }).catch(() => {});
    }

    if (config.petRoleId) {
      const member = await guild.members.fetch(userId).catch(() => null);
      const role = guild.roles.cache.get(config.petRoleId);
      if (member && role) await member.roles.add(role).catch(() => {});
    }
  } catch (err) {
    console.error('Error triggering pet hatch event:', err);
  }
}

// 5. คำสั่ง /pet
const petCommand = new SlashCommandBuilder()
  .setName('pet')
  .setDescription('🐾 เปิดดูการ์ดสัตว์เลี้ยงของคุณ')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('เลือกสมาชิกที่ต้องการดูสัตว์เลี้ยง')
      .setRequired(false)
  );

async function handlePetCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const userId = targetUser.id;
  const config = serverConfigs[guildId] || {};

  if (!config.levels) config.levels = {};
  if (!config.levels[userId]) assignInitialEgg(config, userId);

  const userStat = config.levels[userId];
  const petEgg = userStat.petEgg;

  if (petEgg && petEgg.isHatched && petEgg.hatchedPet) {
    await interaction.deferReply({ ephemeral: true });
    const attachment = await generatePetCard(targetUser, petEgg);

    return await interaction.editReply({
      files: [attachment],
      components: []
    });
  }

  const embed = new EmbedBuilder()
    .setTitle(`🐾 Pet Status: ${targetUser.username}`)
    .setColor(COLORS.PRIMARY);

  if (!petEgg || !petEgg.hasEgg) {
    embed.setDescription('🥚 คุณไม่มีไข่ในครอบครอง สามารถไปกดซื้อได้ที่หน้าร้านค้า');
  } else {
    const mins = Math.ceil(petEgg.remainingSeconds / 60);
    embed.setDescription(`🐣 ไข่กำลังฟัก...\n⏳ เวลาโดยประมาณ: ${mins} นาที\n\n💬 *พิมพ์แชท 2 ครั้งเพื่อเร่งเวลาฟัก!*`);
  }

  await interaction.reply({
    embeds: [embed],
    components: [],
    ephemeral: true
  });
}

// 6. คำสั่ง /setup-pet-shop
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

// 7. จัดการปุ่มกดซื้อไข่จากหน้าร้าน
async function handlePetButton(interaction, serverConfigs, saveConfigs) {
  if (interaction.customId !== 'buy_pet_egg_shop') return false;

  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const config = serverConfigs[guildId];
  if (!config || !config.levels) {
    return await interaction.editReply({ content: '❌ เกิดข้อผิดพลาดในการโหลดข้อมูลเซิร์ฟเวอร์' });
  }
  if (!config.levels[userId]) {
    config.levels[userId] = { xp: 0, level: 1, orbs: 0 };
  }

  const userStat = config.levels[userId];
  const cost = 500;

  if ((userStat.orbs || 0) < cost) {
    return await interaction.editReply({ content: `❌ Orbs ของคุณไม่พอ! (ต้องการ ${cost} Orbs แต่คุณมี ${userStat.orbs || 0} Orbs)` });
  }

  if (userStat.petEgg && userStat.petEgg.hasEgg && !userStat.petEgg.isHatched) {
    if (userStat.petEgg.remainingSeconds <= 60) {
      return await interaction.editReply({ content: `❌ คุณมีไข่ที่กำลังฟักอยู่แล้ว ต้องรอฟักให้เสร็จก่อน!` });
    }
  }

  userStat.orbs -= cost;
  userStat.petEgg = {
    hasEgg: true,
    remainingSeconds: 60,
    isHatched: false,
    hatchedPet: null,
    petLevel: 1,
    petXp: 0
  };

  await saveConfigs(serverConfigs);

  return await interaction.editReply({
    content: `🎉 ใช้ ${cost} Orbs ซื้อไข่ใบใหม่สำเร็จ! ไปที่ห้องแชทแล้วพิมพ์ข้อความ 2 ครั้งเพื่อฟักไข่ได้เลย!`
  });
}

module.exports = {
  assignInitialEgg,
  progressEggTime,
  progressPetXp,
  petCommand,
  setupShopCommand,
  handlePetCommand,
  handleSetupShopCommand,
  handlePetButton
};
