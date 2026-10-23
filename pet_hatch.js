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

  // กรณีสัตว์เลี้ยงฟักเป็นตัวแล้ว ส่งการ์ด Canvas ล้วนๆ พร้อมปุ่มจัดการ
  if (petEgg && petEgg.isHatched && petEgg.hatchedPet) {
    await interaction.deferReply({ ephemeral: true }); // หรือเอา { ephemeral: true } ออกถ้าต้องการให้คนอื่นส่องแบบสาธารณะ
    const attachment = await generatePetCard(targetUser, petEgg);
    
    const pet = petEgg.hatchedPet;
    const petLevel = petEgg.petLevel || 1;
    const totalOrbValue = (pet.baseOrb || 50) + ((petLevel - 1) * 20);

    const row = new ActionRowBuilder();
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

  // กรณียังเป็นไข่ (ใช้ Embed แจ้งสถานะเวลาฟักตามเดิม)
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
    const mins = Math.ceil(petEgg.remainingSeconds / 60);
    embed.setDescription(`🐣 ไข่กำลังฟัก...\n⏳ เวลาโดยประมาณ: ${mins} นาที\n\n💬 *พิมพ์แชท 1 ครั้งเพื่อเร่งเวลาฟัก!*`);
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
