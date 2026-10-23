const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { generatePetCard } = require('./canvas_card');

// 📦 ฐานข้อมูลสัตว์เลี้ยง (6 ระดับ: 1 ดาว - 6 ดาว)
const PET_DATABASE = [
  { name: 'Tiny Slime', stars: 1, type: 'Common', baseOrb: 50, image: 'https://cdn.discordapp.com/attachments/1559878908348997774/1563060183259811921/image0.jpg?ex=6adc40bb&is=6adaef3b&hm=1eaa4a8b0b722c702f5996d2866fe2dc5efd64c25444851614db0f1f7224327b&' },
  { name: 'Lazy Cat', stars: 2, type: 'Uncommon', baseOrb: 100, image: 'https://cdn.discordapp.com/attachments/1559878908348997774/1563060183763259392/image0.jpg?ex=6adc40bc&is=6adaef3c&hm=7dbcbf4c2d9905f7bbbcd8aa24496fc59b8e24b26af6e04efcc91e98406ae166&' },
  { name: 'Shadow Fox', stars: 3, type: 'Rare', baseOrb: 250, image: 'https://cdn.discordapp.com/attachments/1559878908348997774/1563060184123703317/image0.jpg?ex=6adc40bc&is=6adaef3c&hm=940fd89a6f453f737c56b95c17bfe8f87001ee5094a281dc8fd219167357fb49&' },
  { name: 'Fire Lion', stars: 4, type: 'Epic', baseOrb: 500, image: 'https://cdn.discordapp.com/attachments/1559878908348997774/1563060184518103051/image0.jpg?ex=6adc40bc&is=6adaef3c&hm=8b6a9f84e75a5e0dc05c38dacb88669635aee6f4755cbf0c58cd95fcdf9ab2d6&' },
  { name: 'Golden Dragon', stars: 5, type: 'Legendary', baseOrb: 1000, image: 'https://cdn.discordapp.com/attachments/1559878908348997774/1563060184962572338/image0.jpg?ex=6adc40bc&is=6adaef3c&hm=5c58e5139d070c9759e4199212f5a1931fb86c8b4ee7bdf58aedc96753d14c85&' },
  { name: 'Rainbow Phoenix', stars: 6, type: 'Cosmic', baseOrb: 2500, image: 'https://cdn.discordapp.com/attachments/1559878908348997774/1563060186032377906/image0.jpg?ex=6adc40bc&is=6adaef3c&hm=2b6c8f6e959e1e37ccaff25800eca30e0335c2c53afa1973713776c203f96064&' }
];

// 1. แจกไข่เริ่มต้น (ให้เฉพาะครั้งแรกที่เข้าเซิร์ฟเวอร์ และล็อกไม่ให้รับซ้ำฟรีหลังย่อยสลาย)
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
      startTime: Date.now(),
      durationMs: 60 * 1000, // 👈 [โหมดทดสอบ] ตั้งไว้ 60 วินาที (ใช้งานจริงเปลี่ยนเป็น 86400 * 1000 สำหรับ 24 ชม.)
      isHatched: false,
      hatchedPet: null,
      petLevel: 1,
      petXp: 0
    };
    userStat.hasReceivedInitialEgg = true;
  }
}

// 2. ตรวจสอบเวลาฟักไข่แบบเรียลไทม์ (เมื่อมีกิจกรรมแชท/เสียง)
async function progressEggTime(guildId, userId, secondsToReduce, client, serverConfigs, saveConfigs) {
  const config = serverConfigs[guildId];
  if (!config || !config.levels || !config.levels[userId]) return;

  const userStat = config.levels[userId];
  if (!userStat.petEgg) return;

  if (userStat.petEgg.isHatched) {
    progressPetXp(guildId, userId, 10, serverConfigs, saveConfigs);
    return;
  }

  const elapsed = Date.now() - userStat.petEgg.startTime;
  if (elapsed >= userStat.petEgg.durationMs && !userStat.petEgg.isHatched) {
    await triggerHatchEvent(guildId, userId, client, serverConfigs, saveConfigs);
  }
}

// 3. ระบบเก็บเลเวลสัตว์เลี้ยง
function progressPetXp(guildId, userId, xpAmount, serverConfigs, saveConfigs) {
  const config = serverConfigs[guildId];
  if (!config || !config.levels || !config.levels[userId]) return;

  const userStat = config.levels[userId];
  if (!userStat.petEgg || !userStat.petEgg.isHatched || !userStat.petEgg.hatchedPet) return;

  if (userStat.petEgg.petLevel === undefined) userStat.petEgg.petLevel = 1;
  if (userStat.petEgg.petXp === undefined) userStat.petEgg.petXp = 0;

  userStat.petEgg.petXp += xpAmount;
  let requiredPetXp = userStat.petEgg.petLevel * 100;

  while (userStat.petEgg.petXp >= requiredPetXp) {
    userStat.petEgg.petXp -= requiredPetXp;
    userStat.petEgg.petLevel += 1;
    requiredPetXp = userStat.petEgg.petLevel * 100;
  }

  saveConfigs(serverConfigs);
}

// 4. เหตุการณ์ไข่แตก (สุ่มกาชา 6 ระดับ พร้อมส่งการ์ด Canvas)
async function triggerHatchEvent(guildId, userId, client, serverConfigs, saveConfigs) {
  const config = serverConfigs[guildId];
  const userStat = config.levels[userId];
  if (!userStat || userStat.petEgg.isHatched) return;

  userStat.petEgg.isHatched = true;
  userStat.petEgg.petLevel = 1;
  userStat.petEgg.petXp = 0;

  // 🎲 ระบบสุ่มเรตติ้ง 6 ระดับ
  const rand = Math.random() * 100;
  let selectedPet;
  
  if (rand < 48) selectedPet = PET_DATABASE[0];        // 48% - Tiny Slime (1⭐)
  else if (rand < 78) selectedPet = PET_DATABASE[1];   // 30% - Lazy Cat (2⭐)
  else if (rand < 92) selectedPet = PET_DATABASE[2];   // 14% - Shadow Fox (3⭐)
  else if (rand < 98) selectedPet = PET_DATABASE[3];   // 6%  - Fire Lion (4⭐)
  else if (rand < 99.7) selectedPet = PET_DATABASE[4]; // 1.7% - Golden Dragon (5⭐)
  else selectedPet = PET_DATABASE[5];                  // 0.3% - Rainbow Phoenix (6⭐)

  userStat.petEgg.hatchedPet = selectedPet;
  await saveConfigs(serverConfigs);

  try {
    const guild = await client.guilds.fetch(guildId);
    if (!guild) return;

    let targetChannel = null;
    if (config.petChannelId) {
      targetChannel = guild.channels.cache.get(config.petChannelId);
    }
    if (!targetChannel) {
      targetChannel = guild.channels.cache.find(c => 
        c.type === 0 && 
        !c.name.toLowerCase().includes('staff') && 
        !c.name.toLowerCase().includes('admin') && 
        !c.name.toLowerCase().includes('log') && 
        c.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages)
      );
    }

    if (targetChannel) {
      const member = await guild.members.fetch(userId).catch(() => null);
      const userObj = member ? member.user : { username: 'Adventurer', displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png' };
      
      const attachment = await generatePetCard(userObj, userStat.petEgg);

      const starString = '⭐'.repeat(selectedPet.stars);
      const embed = new EmbedBuilder()
        .setTitle('🌟 [ZEN PET HATCHING] ไข่ฟักออกมาแล้ว! 🐣')
        .setDescription(
          `🎉 ยินดีด้วยครับคุณ <@${userId}>!\n` +
          `ไข่ของคุณฟักออกมากลายเป็น **${selectedPet.name}** แล้ว!\n\n` +
          `✨ **Rarity:** ${starString} (${selectedPet.type})\n` +
          `🏰 *เปิดสิทธิ์เข้าห้อง **🐉・dragon-nest** เรียบร้อย!*`
        )
        .setColor('#FFD700')
        .setImage('attachment://pet-card.png')
        .setTimestamp();

      await targetChannel.send({ embeds: [embed], files: [attachment] }).catch(() => {});
    }

    const petRoleId = config.petRoleId || null;
    if (petRoleId) {
      const member = await guild.members.fetch(userId).catch(() => null);
      const role = guild.roles.cache.get(petRoleId);
      if (member && role) await member.roles.add(role).catch(() => {});
    }

  } catch (err) {
    console.error('Error triggering pet hatch event:', err);
  }
}

// 5. คำสั่ง /pet (เช็กสถานะ/เปิดดูการ์ด Canvas)
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
  const isSelf = interaction.user.id === userId;

  if (petEgg && petEgg.isHatched && petEgg.hatchedPet) {
    await interaction.deferReply();
    const attachment = await generatePetCard(targetUser, petEgg);
    
    const pet = petEgg.hatchedPet;
    const petLevel = petEgg.petLevel || 1;
    const totalOrbValue = (pet.baseOrb || 50) + ((petLevel - 1) * 20);

    const row = new ActionRowBuilder();
    if (isSelf) {
      row.addComponents(
        new ButtonBuilder().setCustomId(`recycle_pet_${userId}`).setLabel(`♻️ ย่อยสลายรับ ${totalOrbValue} Orbs`).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`buy_new_egg_${userId}`).setLabel('🎁 ซื้อไข่ใหม่ (500 Orbs)').setStyle(ButtonStyle.Success)
      );
    }

    return await interaction.editReply({ 
      files: [attachment], 
      components: row.components.length > 0 ? [row] : [] 
    });
  }

  const embed = new EmbedBuilder()
    .setTitle(`🐾 Pet Status: ${targetUser.username}`)
    .setColor('#66FFFF');

  const row = new ActionRowBuilder();

  if (!petEgg || !petEgg.hasEgg) {
    embed.setDescription('🥚 คุณไม่มีไข่ในครอบครอง สามารถใช้ Orbs ซื้อไข่ใบใหม่ได้เลย');
    if (isSelf) {
      row.addComponents(new ButtonBuilder().setCustomId(`buy_new_egg_${userId}`).setLabel('🎁 ซื้อไข่ใหม่ (500 Orbs)').setStyle(ButtonStyle.Success));
    }
  } else {
    const elapsed = Date.now() - petEgg.startTime;
    const remainingMs = Math.max(0, petEgg.durationMs - elapsed);
    const minsLeft = Math.ceil(remainingMs / 60000);

    embed.setDescription(
      `🐣 **สถานะ:** ไข่กำลังฟักตามเวลาจริง...\n` +
      `⏳ **เวลาที่เหลือโดยประมาณ:** \`${minsLeft} นาที\`\n\n` +
      `💬 *พิมพ์แชทหรือคุยเสียงเพื่อช่วยเพิ่ม Pet XP ให้สัตว์เลี้ยงหลังจากฟักเสร็จ!*`
    );
    if (isSelf) {
      row.addComponents(new ButtonBuilder().setCustomId(`buy_new_egg_${userId}`).setLabel('🎁 ซื้อไข่ใหม่ (500 Orbs)').setStyle(ButtonStyle.Success));
    }
  }

  await interaction.reply({ 
    embeds: [embed], 
    components: row.components.length > 0 ? [row] : [],
    ephemeral: true 
  });
}

// 6. จัดการปุ่มกด (ย่อยสลาย / ซื้อไข่ใหม่)
async function handlePetButton(interaction, serverConfigs, saveConfigs) {
  const customId = interaction.customId;
  if (!customId.startsWith('recycle_pet_') && !customId.startsWith('buy_new_egg_')) return false;

  const parts = customId.split('_');
  const ownerId = parts[parts.length - 1];
  
  if (interaction.user.id !== ownerId) {
    return await interaction.reply({ content: '❌ นี่ไม่ใช่สัตว์เลี้ยงของคุณ!', ephemeral: true });
  }

  const guildId = interaction.guildId;
  const config = serverConfigs[guildId];
  if (!config || !config.levels || !config.levels[ownerId]) return false;

  const userStat = config.levels[ownerId];

  if (customId.startsWith('recycle_pet_')) {
    if (!userStat.petEgg || !userStat.petEgg.isHatched) {
      return await interaction.reply({ content: '❌ คุณไม่มีสัตว์เลี้ยงที่ฟักแล้วให้ย่อยสลาย!', ephemeral: true });
    }

    const pet = userStat.petEgg.hatchedPet;
    const petLevel = userStat.petEgg.petLevel || 1;
    const earnedOrbs = (pet.baseOrb || 50) + ((petLevel - 1) * 20);
    
    userStat.orbs = (userStat.orbs || 0) + earnedOrbs;
    userStat.petEgg = null; 
    await saveConfigs(serverConfigs);

    await interaction.message.delete().catch(() => {});

    return await interaction.reply({
      content: `♻️ ย่อยสลาย **${pet.name} (Lv.${petLevel})** สำเร็จ รับ **+${earnedOrbs} Orbs** เข้ากระเป๋าเรียบร้อยแล้ว!`,
      ephemeral: true
    });
  }

  if (customId.startsWith('buy_new_egg_')) {
    const cost = 500;
    if ((userStat.orbs || 0) < cost) {
      return await interaction.reply({ content: `❌ Orbs ของคุณไม่พอ! (ต้องการ ${cost} Orbs แต่คุณมี ${userStat.orbs || 0} Orbs)`, ephemeral: true });
    }

    if (userStat.petEgg && userStat.petEgg.hasEgg && !userStat.petEgg.isHatched) {
      return await interaction.reply({ content: `❌ คุณมีไข่ที่กำลังฟักอยู่แล้ว ต้องรอฟักให้เสร็จก่อน!`, ephemeral: true });
    }

    userStat.orbs -= cost;
    userStat.petEgg = {
      hasEgg: true,
      startTime: Date.now(),
      durationMs: 60 * 1000,
      isHatched: false,
      hatchedPet: null,
      petLevel: 1,
      petXp: 0
    };

    await saveConfigs(serverConfigs);

    await interaction.message.delete().catch(() => {});

    return await interaction.reply({
      content: `🎉 ใช้ ${cost} Orbs ซื้อไข่ใบใหม่สำเร็จ! เริ่มนับเวลาฟักไข่เรียบร้อยแล้ว!`,
      ephemeral: true
    });
  }

  return false;
}

module.exports = {
  assignInitialEgg,
  progressEggTime,
  progressPetXp,
  petCommand,
  handlePetCommand,
  handlePetButton
};
