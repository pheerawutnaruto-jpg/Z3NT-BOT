// 7. จัดการปุ่มกดซื้อไข่จากหน้าร้าน (สาธารณะ)
async function handlePetButton(interaction, serverConfigs, saveConfigs) {
  const customId = interaction.customId;
  if (customId !== 'buy_pet_egg_shop') return false;

  // 🛡️ รีบตอบรับปุ่มทันทีเพื่อป้องกัน Error 10062 (Unknown interaction)
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
    return await interaction.editReply({ content: `❌ คุณมีไข่ที่กำลังฟักอยู่แล้ว ต้องรอฟักให้เสร็จก่อน!` });
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
