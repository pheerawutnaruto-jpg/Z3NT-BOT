const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const PET_DATABASE = [
  { name: 'สไลม์จิ๋ว', stars: 1, type: 'Common', orbValue: 50, image: 'https://cdn.discordapp.com/attachments/1550576199829430382/1559721017583337512/1791877721245.jpg' },
  { name: 'แมวเหมียวขี้เซา', stars: 2, type: 'Uncommon', orbValue: 100, image: 'https://cdn.discordapp.com/attachments/1550576199829430382/1559721017583337512/1791877721245.jpg' },
  { name: 'สุนัขจิ้งจอกนิลกาฬ', stars: 3, type: 'Rare', orbValue: 250, image: 'https://cdn.discordapp.com/attachments/1550576199829430382/1559721017583337512/1791877721245.jpg' },
  { name: 'ราชสีห์เพลิง', stars: 4, type: 'Epic', orbValue: 500, image: 'https://cdn.discordapp.com/attachments/1550576199829430382/1559721017583337512/1791877721245.jpg' },
  { name: 'มังกรทองบรรพกาล', stars: 5, type: 'Legendary', orbValue: 1000, image: 'https://cdn.discordapp.com/attachments/1550576199829430382/1559721017583337512/1791877721245.jpg' }
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
      totalSecondsNeeded: 60, // (ปรับเป็น 86400 ตอนใช้งานจริง)
      remainingSeconds: 60,
      isHatched: false,
      hatchedPet: null
    };
  }
}

async function progressEggTime(guildId, userId, secondsToReduce, client, serverConfigs, saveConfigs) {
  const config = serverConfigs[guildId];
  if (!config || !config.levels || !config.levels[userId]) return;

  const userStat = config.levels[userId];
  if (!userStat.petEgg) assignInitialEgg(config, userId);

  if (userStat.petEgg.isHatched || !userStat.petEgg.hasEgg) return;

  userStat.petEgg.remainingSeconds = Math.max(0, userStat.petEgg.remainingSeconds - secondsToReduce);

  if (userStat.petEgg.remainingSeconds <= 0 && !userStat.petEgg.isHatched) {
    await triggerHatchEvent(guildId, userId, client, serverConfigs, saveConfigs);
  } else {
    await saveConfigs(serverConfigs);
  }
}

async function triggerHatchEvent(guildId, userId, client, serverConfigs, saveConfigs) {
  const config = serverConfigs[guildId];
  const userStat = config.levels[userId];
  if (!userStat || userStat.petEgg.isHatched) return;

  userStat.petEgg.isHatched = true;

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
          `🐾 **สัตว์เลี้ยง:** \`${selectedPet.name}\`\n` +
          `✨ **ระดับ:** ${starString} (${selectedPet.type})\n` +
          `♻️ **มูลค่าการย่อย:** \`${selectedPet.orbValue} Orbs\`\n\n` +
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

// 📜 คำสั่ง /pet สำหรับเช็กสถานะไข่/สัตว์เลี้ยง และปุ่มรีไซเคิล
const petCommand = new SlashCommandBuilder()
  .setName('pet')
  .setDescription('🐾 เปิดดูสถานะสัตว์เลี้ยงหรือไข่ประจำตัวของคุณ');

async function handlePetCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const config = serverConfigs[guildId] || {};
  
  if (!config.levels) config.levels = {};
  if (!config.levels[userId]) assignInitialEgg(config, userId);

  const userStat = config.levels[userId];
  const petEgg = userStat.petEgg;

  const embed = new EmbedBuilder()
    .setTitle(`🐾 𝙕𝙀𝙉 𝙋𝙀𝙏 • สัตว์เลี้ยงของ ${interaction.user.username}`)
    .setColor('#66FFFF')
    .setTimestamp();

  const row = new ActionRowBuilder();

  if (!petEgg || !petEgg.hasEgg) {
    embed.setDescription('🥚 คุณยังไม่มีไข่ประจำตัว ลองพูดคุยแชทในเซิร์ฟเวอร์เพื่อรับไข่ใหม่ได้เลย!');
    row.addComponents(
      new ButtonBuilder().setCustomId('buy_new_egg').setLabel('🎁 ซื้อไข่ใหม่ (500 Orbs)').setStyle(ButtonStyle.Success)
    );
  } else if (!petEgg.isHatched) {
    const mins = Math.ceil(petEgg.remainingSeconds / 60);
    embed.setDescription(
      `🐣 **สถานะ:** ไข่กำลังฟัก...\n` +
      `⏳ **เวลาที่เหลือโดยประมาณ:** \`${mins} นาที\`\n\n` +
      `💬 *พิมพ์แชทหรือคุยเสียงเพื่อช่วยเร่งเวลาฟักไข่ให้เร็วขึ้น!*`
    );
  } else {
    const pet = petEgg.hatchedPet;
    const starString = '⭐'.repeat(pet.stars);
    embed.setDescription(
      `🎉 **สัตว์เลี้ยงปัจจุบันของคุณ:**\n` +
      `🐾 ชื่อ: \`${pet.name}\`\n` +
      `✨ ระดับ: ${starString} (${pet.type})\n\n` +
      `💰 Orbs สะสมของคุณ: \`${userStat.orbs || 0} Orbs\`\n\n` +
      `⚠️ *หากไม่ต้องการตัวนี้ สามารถกดปุ่มรีไซเคิลเพื่อเปลี่ยนเป็น Orbs ไปเปิดไข่ใหม่ได้!*`
    );
    row.addComponents(
      new ButtonBuilder().setCustomId('recycle_pet').setLabel(`♻️ ย่อยสลายรับ ${pet.orbValue} Orbs`).setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('buy_new_egg').setLabel('🎁 ซื้อไข่ใบใหม่ (500 Orbs)').setStyle(ButtonStyle.Success)
    );
  }

  await interaction.reply({ embeds: [embed], components: row.components.length > 0 ? [row] : [], ephemeral: true });
}

// 🖱️ ระบบจัดการปุ่มกด (ย่อยสลาย หรือ ซื้อไข่ใหม่)
async function handlePetButton(interaction, serverConfigs, saveConfigs) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const config = serverConfigs[guildId];
  if (!config || !config.levels || !config.levels[userId]) return false;

  const userStat = config.levels[userId];
  const customId = interaction.customId;

  if (customId === 'recycle_pet') {
    if (!userStat.petEgg || !userStat.petEgg.isHatched) {
      return await interaction.reply({ content: '❌ คุณยังไม่มีสัตว์เลี้ยงที่ฟักแล้วให้ย่อยสลาย!', ephemeral: true });
    }

    const pet = userStat.petEgg.hatchedPet;
    const earnedOrbs = pet.orbValue || 50;
    userStat.orbs = (userStat.orbs || 0) + earnedOrbs;

    // ล้างสถานะสัตว์เลี้ยงเก่า เพื่อให้กดรับ/ซื้อไข่ใหม่ได้
    userStat.petEgg = null; 
    await saveConfigs(serverConfigs);

    return await interaction.update({
      content: `♻️ ย่อยสลาย **${pet.name} (${'⭐'.repeat(pet.stars)})** สำเร็จ!\n🎁 คุณได้รับ **+${earnedOrbs} Orbs** เรียบร้อยแล้ว!`,
      embeds: [],
      components: []
    });
  }

  if (customId === 'buy_new_egg') {
    const cost = 500; // ค่าไข่ใบใหม่
    if ((userStat.orbs || 0) < cost) {
      return await interaction.reply({ content: `❌ Orbs ของคุณไม่พอ! (ต้องการ ${cost} Orbs แต่คุณมี ${userStat.orbs || 0} Orbs)`, ephemeral: true });
    }

    if (userStat.petEgg && userStat.petEgg.hasEgg && !userStat.petEgg.isHatched) {
      return await interaction.reply({ content: '❌ คุณมีไข่ที่กำลังฟักอยู่แล้ว ต้องฟักตัวเก่าให้เสร็จก่อนซื้อใบใหม่!', ephemeral: true });
    }

    userStat.orbs -= cost;
    userStat.petEgg = {
      hasEgg: true,
      totalSecondsNeeded: 60, // (ปรับเป็น 86400 เมื่อใช้จริง)
      remainingSeconds: 60,
      isHatched: false,
      hatchedPet: null
    };

    await saveConfigs(serverConfigs);
    return await interaction.update({
      content: `🎉 ใช้ ${cost} Orbs ซื้อไข่ใบใหม่สำเร็จ! ไข่ใบใหม่ถูกส่งเข้าคลังเรียบร้อยแล้ว พิมพ์แชทเพื่อฟักได้เลย!`,
      embeds: [],
      components: []
    });
  }

  return false;
}

module.exports = {
  assignInitialEgg,
  progressEggTime,
  petCommand,
  handlePetCommand,
  handlePetButton
};
