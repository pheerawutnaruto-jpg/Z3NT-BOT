const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// รายชื่อสัตว์เลี้ยง 5 ระดับดาว
const PET_DATABASE = [
  { name: 'สไลม์จิ๋ว', stars: 1, type: 'Common' },
  { name: 'แมวเหมียวขี้เซา', stars: 2, type: 'Uncommon' },
  { name: 'สุนัขจิ้งจอกนิลกาฬ', stars: 3, type: 'Rare' },
  { name: 'ราชสีห์เพลิง', stars: 4, type: 'Epic' },
  { name: 'มังกรทองบรรพกาล', stars: 5, type: 'Legendary' }
];

// 1. ฟังก์ชันแจกไข่เริ่มต้นเมื่อสมาชิกเข้าเซิร์ฟเวอร์
function assignInitialEgg(config, userId) {
  if (!config.levels) config.levels = {};
  if (!config.levels[userId]) {
    config.levels[userId] = { xp: 0, level: 1, orbs: 0 };
  }

  const userStat = config.levels[userId];
  if (!userStat.petEgg) {
    userStat.petEgg = {
      hasEgg: true,
      totalSecondsNeeded: 86400, // 24 ชั่วโมง
      remainingSeconds: 86400,
      isHatched: false,
      hatchedPet: null
    };
  }
}

// 2. ฟังก์ชันลดเวลาไข่จากกิจกรรม (พิมพ์แชท / คุยเสียง)
async function progressEggTime(guildId, userId, secondsToReduce, client, serverConfigs, saveConfigs) {
  const config = serverConfigs[guildId];
  if (!config || !config.levels || !config.levels[userId]) return;

  const userStat = config.levels[userId];
  if (!userStat.petEgg || userStat.petEgg.isHatched || !userStat.petEgg.hasEgg) return;

  // ลดเวลาตามกิจกรรม
  userStat.petEgg.remainingSeconds = Math.max(0, userStat.petEgg.remainingSeconds - secondsToReduce);

  // ถ้าเวลาหมด ฟักไข่อัตโนมัติทันที
  if (userStat.petEgg.remainingSeconds <= 0 && !userStat.petEgg.isHatched) {
    await triggerHatchEvent(guildId, userId, client, serverConfigs, saveConfigs);
  } else {
    await saveConfigs(serverConfigs);
  }
}

// 3. ฟังก์ชันเหตุการณ์ไข่แตก (Hatch Event & เซอร์ไพรส์)
async function triggerHatchEvent(guildId, userId, client, serverConfigs, saveConfigs) {
  const config = serverConfigs[guildId];
  const userStat = config.levels[userId];
  if (!userStat || userStat.petEgg.isHatched) return;

  userStat.petEgg.isHatched = true;

  // สุ่มเรตความหายาก (ดาว 1-5)
  const rand = Math.random() * 100;
  let selectedPet;
  if (rand < 50) selectedPet = PET_DATABASE[0];      // 50% ได้ 1 ดาว
  else if (rand < 80) selectedPet = PET_DATABASE[1]; // 30% ได้ 2 ดาว
  else if (rand < 95) selectedPet = PET_DATABASE[2]; // 15% ได้ 3 ดาว
  else if (rand < 99) selectedPet = PET_DATABASE[3]; // 4% ได้ 4 ดาว
  else selectedPet = PET_DATABASE[4];                // 1% ได้ 5 ดาว

  userStat.petEgg.hatchedPet = selectedPet;
  await saveConfigs(serverConfigs);

  try {
    const guild = await client.guilds.fetch(guildId);
    if (!guild) return;

    // หาห้องสำหรับประกาศข้อความ
    let targetChannel = guild.systemChannel;
    if (!targetChannel && config.levelConfig?.channelId) {
      targetChannel = guild.channels.cache.get(config.levelConfig.channelId);
    }
    if (!targetChannel) {
      targetChannel = guild.channels.cache.find(c => c.type === 0 && c.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages));
    }

    if (targetChannel) {
      const starString = '⭐'.repeat(selectedPet.stars);
      const embed = new EmbedBuilder()
        .setTitle('🌟 [ZEN PET HATCHING] ไข่ปริศนาฟักออกมาแล้ว! 🐣')
        .setDescription(
          `🎉 ยินดีด้วยครับคุณ <@${userId}>!\n` +
          `ไข่ปริศนาประจำตัวฟักออกมากลายเป็นเพื่อนคู่กายตัวใหม่แล้ว!\n\n` +
          `🐾 **สัตว์เลี้ยงที่ได้รับ:** \`${selectedPet.name}\`\n` +
          `✨ **ระดับความหายาก:** ${starString} (${selectedPet.type})\n\n` +
          `🏰 *ระบบได้มอบยศและเปิดสิทธิ์เข้าห้องลับให้คุณเรียบร้อยแล้ว!*`
        )
        .setColor('#FFD700')
        .setTimestamp()
        .setFooter({ text: 'Zen Pet Automatic System' });

      await targetChannel.send({ embeds: [embed] }).catch(() => {});
    }

    // แจกยศเปิดห้องลับอัตโนมัติ
    const petRoleId = config.petRoleId || null;
    if (petRoleId) {
      const member = await guild.members.fetch(userId).catch(() => null);
      const role = guild.roles.cache.get(petRoleId);
      if (member && role) {
        await member.roles.add(role).catch(() => {});
      }
    }

  } catch (err) {
    console.error('Error triggering pet hatch event:', err);
  }
}

module.exports = {
  assignInitialEgg,
  progressEggTime
};
