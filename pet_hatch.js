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

  // ถ้าสัตว์เลี้ยงฟักแล้ว แสดงผลเป็นการ์ด Canvas อยู่ใน Embed สวยๆ
  if (petEgg && petEgg.isHatched && petEgg.hatchedPet) {
    await interaction.deferReply();
    const attachment = await generatePetCard(targetUser, petEgg);
    
    const pet = petEgg.hatchedPet;
    const petLevel = petEgg.petLevel || 1;
    const petXp = petEgg.petXp || 0;
    const reqXp = petLevel * 100;
    const starString = '⭐'.repeat(pet.stars);
    const totalOrbValue = (pet.baseOrb || 50) + ((petLevel - 1) * 20);

    const embed = new EmbedBuilder()
      .setTitle(`🐾 ZEN PET COMPANION • ${pet.name}`)
      .setDescription(
        `👤 **Owner:** <@${userId}>\n` +
        `✨ **Rarity:** ${starString} (${pet.type})\n` +
        `📊 **Level:** ${petLevel} (\`XP: ${petXp} / ${reqXp}\`)\n` +
        `♻️ **Recycle Value:** \`${totalOrbValue} Orbs\``
      )
      .setColor('#FFD700')
      .setImage('attachment://pet-card.png')
      .setFooter({ text: `Zen Pet System • Requested by ${interaction.user.username}` });

    const row = new ActionRowBuilder();
    if (isSelf) {
      row.addComponents(
        new ButtonBuilder().setCustomId(`recycle_pet_${userId}`).setLabel(`♻️ ย่อยสลายรับ ${totalOrbValue} Orbs`).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`buy_new_egg_${userId}`).setLabel('🎁 ซื้อไข่ใบใหม่ (500 Orbs)').setStyle(ButtonStyle.Success)
      );
    }

    return await interaction.editReply({ 
      embeds: [embed],
      files: [attachment], 
      components: row.components.length > 0 ? [row] : [] 
    });
  }

  // กรณียังเป็นไข่
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
      `💬 *พิมพ์แชทเพื่อสะสมเวลาฟักและเพิ่ม Pet XP หลังจากฟักเสร็จ!*`
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
