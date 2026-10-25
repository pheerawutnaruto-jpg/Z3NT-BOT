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

  let serverConfigs = await loadConfigs();
  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].levels) serverConfigs[guildId].levels = {};

  const serverConfig = serverConfigs[guildId];
  const levels = serverConfig.levels;

  const atkData = levels[attackerId];
  const defData = levels[defenderId];

  if (!atkData?.petEgg?.isHatched || !defData?.petEgg?.isHatched) {
    await interaction.reply({ content: '❌ มีฝ่ายใดฝ่ายหนึ่งไม่มีสัตว์เลี้ยงที่พร้อมประลอง!', ephemeral: true });
    return true;
  }

  const atkOrbs = atkData?.orbs !== undefined ? atkData.orbs : (atkData?.coins || 0);
  const defOrbs = defData?.orbs !== undefined ? defData.orbs : (defData?.coins || 0);

  if (atkOrbs < betAmount || defOrbs < betAmount) {
    await interaction.reply({ content: '❌ ยอด Orbs ของผู้เล่นไม่พอสำหรับการเดิมพันแล้ว การประลองถูกยกเลิก', ephemeral: true });
    return true;
  }

  const atkPet = atkData.petEgg.hatchedPet;
  const defPet = defData.petEgg.hatchedPet;

  const atkPower = atkPet.baseOrb + ((atkData.petEgg.petLevel || 1) * 20);
  const defPower = defPet.baseOrb + ((defData.petEgg.petLevel || 1) * 20);

  // คำนวณผลแพ้ชนะ (เทียบ Power ตรงๆ + สุ่มเหลื่อมล้ำ 5%)
  const atkScore = atkPower * (0.95 + Math.random() * 0.1);
  const defScore = defPower * (0.95 + Math.random() * 0.1);
  const isAttackerWin = atkScore > defScore;

  const winnerId = isAttackerWin ? attackerId : defenderId;
  const loserId = isAttackerWin ? defenderId : attackerId;
  const winnerData = levels[winnerId];
  const loserData = levels[loserId];
  const winnerPet = isAttackerWin ? atkPet : defPet;

  // โอนเงินเดิมพัน
  if (winnerData.orbs !== undefined) winnerData.orbs += betAmount;
  else winnerData.coins += betAmount;

  if (loserData.orbs !== undefined) loserData.orbs -= betAmount;
  else loserData.coins -= betAmount;

  // 🏆 ผู้ชนะได้ XP สะสมเพิ่มจากสัตว์เลี้ยงตัวที่แพ้
  const loserXpValue = (loserData.petEgg.petLevel || 1) * 50 + (loserData.petEgg.petXp || 0);
  winnerData.petEgg.petXp = (winnerData.petEgg.petXp || 0) + loserXpValue;

  // เช็กเลเวลอัปให้สัตว์เลี้ยงตัวชนะ
  while (winnerData.petEgg.petXp >= (winnerData.petEgg.petLevel || 1) * 100) {
    winnerData.petEgg.petXp -= (winnerData.petEgg.petLevel || 1) * 100;
    winnerData.petEgg.petLevel += 1;
  }

  // 💀 ลบข้อมูลสัตว์เลี้ยงและไข่ของผู้แพ้ทิ้งอย่างถาวรทันที (สัตว์เลี้ยงตาย)
  delete loserData.petEgg;

  // บันทึกลง Redis ทันที
  await saveConfigs(serverConfigs);

  const resultEmbed = new EmbedBuilder()
    .setTitle('🏆 ผลการประลองฮาร์ดคอร์!')
    .setDescription(
      `🎉 **ผู้ชนะ:** <@${winnerId}> (${winnerPet.name})!\n` +
      `💀 **ผู้แพ้:** <@${loserId}> สัตว์เลี้ยงเสียชีวิตและหายไปจากโลกนี้แล้ว! (ต้องซื้อไข่และฟักใหม่)\n\n` +
      `💰 เงินรางวัล: \`+${betAmount.toLocaleString()} Orbs\`\n` +
      `✨ ได้รับ XP จากคู่ต่อสู้: \`+${loserXpValue} XP\``
    )
    .setImage(winnerPet.image)
    .setColor(0x00FF00);

  await interaction.update({ embeds: [resultEmbed], components: [] });
  return true;
}
