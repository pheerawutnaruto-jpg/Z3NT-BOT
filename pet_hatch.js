const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { generatePetCard } = require('./canvas_card');

const PET_DATABASE = [
  { name: 'สไลม์จิ๋ว', stars: 1, type: 'Common', baseOrb: 50, image: 'https://cdn.discordapp.com/attachments/1550576199829430382/1559721017583337512/1791877721245.jpg' },
  { name: 'แมวเหมียวขี้เซา', stars: 2, type: 'Uncommon', baseOrb: 100, image: 'https://cdn.discordapp.com/attachments/1550576199829430382/1559721017583337512/1791877721245.jpg' },
  { name: 'สุนัขจิ้งจอกนิลกาฬ', stars: 3, type: 'Rare', baseOrb: 250, image: 'https://cdn.discordapp.com/attachments/1550576199829430382/1559721017583337512/1791877721245.jpg' },
  { name: 'ราชสีห์เพลิง', stars: 4, type: 'Epic', baseOrb: 500, image: 'https://cdn.discordapp.com/attachments/1550576199829430382/1559721017583337512/1791877721245.jpg' },
  { name: 'มังกรทองบรรพกาล', stars: 5, type: 'Legendary', baseOrb: 1000, image: 'https://cdn.discordapp.com/attachments/1550576199829430382/1559721017583337512/1791877721245.jpg' }
];

function assignInitialEgg(config, userId) {
  if (!config.levels) config.levels = {};
  if (!config.levels[userId]) {
    config.levels[userId] = { xp: 0, level: 1, orbs: 0 };
  }

  const userStat = config.levels[userId];
  if (userStat.orbs === undefined) userStat.orbs = 0;

  if (!userStat.petEgg) {
    userStat.petEgg = {
      hasEgg: true,
      totalSecondsNeeded: 60, // (ปรับเป็น 86400 เมื่อใช้งานจริง)
      remainingSeconds: 60,
      isHatched: false,
      hatchedPet: null,
      petLevel: 1,
      petXp: 0
    };
  }
}

async function progressEggTime(guildId, userId, secondsToReduce, client, serverConfigs, saveConfigs) {
  const config = serverConfigs[guildId];
  if (!config || !config.levels || !config.levels[userId]) return;

  const userStat = config.levels[userId];
  if (!userStat.petEgg) assignInitialEgg(config, userId);

  if (userStat.petEgg.isHatched) {
    progressPetXp(guildId, userId, 10, serverConfigs, saveConfigs);
    return;
  }

  if (!userStat.petEgg.hasEgg) return;

  userStat.petEgg.remainingSeconds = Math.max(0, userStat.petEgg.remainingSeconds - secondsToReduce);

  if (userStat.petEgg.remainingSeconds <= 0 && !userStat.petEgg.isHatched) {
    await triggerHatchEvent(guildId, userId, client, serverConfigs, saveConfigs);
  } else {
    await saveConfigs(serverConfigs);
  }
}

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

async function triggerHatchEvent(guildId, userId, client, serverConfigs, saveConfigs) {
  const config = serverConfigs[guildId];
  const userStat = config.levels[userId];
  if (!userStat || userStat.petEgg.isHatched) return;

  userStat.petEgg.isHatched = true;
  userStat.petEgg.petLevel = 1;
  userStat.petEgg.petXp = 0;

  const rand = Math.random() * 100;
  let selectedPet;
  if (rand < 50) selectedPet = PET_DATABASE[0];
  else if (rand < 80) selectedPet = PET_DATABASE[1];
  else if (rand < 95) selectedPet = PET_DATABASE[2];
  else if (rand < 99) selectedPet = PET_DATABASE[3];
  else selectedPet = PET_DATABASE[4];

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
      const starString = '⭐'.repeat(selectedPet.stars);
      const embed = new EmbedBuilder()
        .setTitle('🌟 [ZEN PET HATCHING] ไข่ปริศนาฟักออกมาแล้ว! 🐣')
        .setDescription(
          `🎉 ยินดีด้วยครับคุณ <@${userId}>!\n` +
          `ไข่ปริศนาประจำตัวฟักออกมากลายเป็นเพื่อนคู่กายตัวใหม่แล้ว!\n\n` +
          `🐾 **สัตว์เลี้ยง:** \`${selectedPet.name}\` (Lv.1)\n` +
          `✨ **ระดับ:** ${starString} (${selectedPet.type})\n\n` +
          `🏰 *ระบบได้เปิดสิทธิ์เข้าห้อง **🐉・dragon-nest** ให้คุณแล้ว!*`
        )
        .setColor('#FFD700')
        .setImage(selectedPet.image)
        .setTimestamp()
        .setFooter({ text: 'Zen Pet Automatic System' });

      await targetChannel.send({ embeds: [embed] }).catch(() => {});
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

// 📜 คำสั่ง /pet (รองรับการเลือกดูเพื่อนสมาชิกคนอื่นได้ และแสดงผลสาธารณะ)
const petCommand = new SlashCommandBuilder()
  .setName('pet')
  .setDescription('🐾 เปิดดูสถานะสัตว์เลี้ยงหรือไข่ประจำตัวของคุณ')
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

  // ถ้าสัตว์เลี้ยงฟักแล้ว ส่งการ์ด Canvas ออกไปแบบสาธารณะ (ให้คนอื่นเห็นด้วย)
  if (petEgg && petEgg.isHatched && petEgg.hatchedPet) {
    await interaction.deferReply(); // ไม่ใส่ ephemeral เพื่อให้ทุกคนเห็น
    const attachment = await generatePetCard(targetUser, petEgg);
    
    const pet = petEgg.hatchedPet;
    const petLevel = petEgg.petLevel || 1;
    const totalOrbValue = (pet.baseOrb || 50) + ((petLevel - 1) * 20);

    const row = new ActionRowBuilder();
    // ปุ่มจัดการจะแสดงเฉพาะเจ้าของโปรไฟล์เท่านั้น
    if (isSelf) {
      row.addComponents(
        new ButtonBuilder().setCustomId(`recycle_pet_${userId}`).setLabel(`♻️ ย่อยสลายรับ ${totalOrbValue} Orbs`).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`buy_new_egg_${userId}`).setLabel('🎁 ซื้อไข่ใบใหม่ (500 Orbs)').setStyle(ButtonStyle.Success)
      );
    }

    return await interaction.editReply({ 
      files: [attachment], 
      components: row.components.length > 0 ? [row] : [] 
    });
  }

  // ถ้ายังเป็นไข่ หรือยังไม่มีไข่ ส่ง Embed แบบสาธารณะ
  const embed = new EmbedBuilder()
    .setTitle(`🐾 𝙕𝙀𝙉 𝗣𝗘𝗧 • สถานะไข่ของ ${targetUser.username}`)
    .setColor('#66FFFF')
    .setTimestamp();

  const row = new ActionRowBuilder();

  if (!petEgg || !petEgg.hasEgg) {
    embed.setDescription(`🥚 คุณ **${targetUser.username}** ยังไม่มีไข่ประจำตัว`);
    if (isSelf) {
      row.addComponents(new ButtonBuilder().setCustomId(`buy_new_egg_${userId}`).setLabel('🎁 ซื้อไข่ใหม่ (500 Orbs)').setStyle(ButtonStyle.Success));
    }
  } else {
    const mins = Math.ceil(petEgg.remainingSeconds / 60);
    embed.setDescription(
      `🐣 **สถานะ:** ไข่กำลังฟัก...\n` +
      `⏳ **เวลาที่เหลือโดยประมาณ:** \`${mins} นาที\``
    );
  }

  await interaction.reply({ 
    embeds: [embed], 
    components: row.components.length > 0 ? [row] : [] 
  });
}

// 🖱️ ระบบปุ่มกด (ตรวจสอบเจ้าของปุ่มเพื่อความปลอดภัย)
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
      return await interaction.reply({ content: '❌ คุณยังไม่มีสัตว์เลี้ยงที่ฟักแล้วให้ย่อยสลาย!', ephemeral: true });
    }

    const pet = userStat.petEgg.hatchedPet;
    const petLevel = userStat.petEgg.petLevel || 1;
    const earnedOrbs = (pet.baseOrb || 50) + ((petLevel - 1) * 20);
    
    userStat.orbs = (userStat.orbs || 0) + earnedOrbs;
    userStat.petEgg = null; 
    await saveConfigs(serverConfigs);

    return await interaction.update({
      content: `♻️ ย่อยสลาย **${pet.name} (Lv.${petLevel})** สำเร็จ!\n🎁 คุณได้รับ **+${earnedOrbs} Orbs** เข้ากระเป๋าเรียบร้อยแล้ว!`,
      files: [],
      components: []
    });
  }

  if (customId.startsWith('buy_new_egg_')) {
    const cost = 500;
    if ((userStat.orbs || 0) < cost) {
      return await interaction.reply({ content: `❌ Orbs ของคุณไม่พอ! (ต้องการ ${cost} Orbs แต่คุณมี ${userStat.orbs || 0} Orbs)`, ephemeral: true });
    }

    if (userStat.petEgg && userStat.petEgg.hasEgg && !userStat.petEgg.isHatched) {
      return await interaction.reply({ content: '❌ คุณมีไข่ที่กำลังฟักอยู่แล้ว ต้องฟักตัวเก่าให้เสร็จก่อนซื้อใบใหม่!', ephemeral: true });
    }

    userStat.orbs -= cost;
    userStat.petEgg = {
      hasEgg: true,
      totalSecondsNeeded: 60,
      remainingSeconds: 60,
      isHatched: false,
      hatchedPet: null,
      petLevel: 1,
      petXp: 0
    };

    await saveConfigs(serverConfigs);
    return await interaction.update({
      content: `🎉 ใช้ ${cost} Orbs ซื้อไข่ใบใหม่สำเร็จ! ไข่ใบใหม่ถูกส่งเข้าคลังเรียบร้อยแล้ว พิมพ์แชทเพื่อฟักได้เลย!`,
      files: [],
      components: []
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
