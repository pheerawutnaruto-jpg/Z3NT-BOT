const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

const setupQuestCommand = new SlashCommandBuilder()
  .setName('setup-quest')
  .setDescription('💎 [PREMIUM] ส่งแผงปุ่มกดรับเควสต์ประจำวันถาวรไปยังห้องนี้ (สำหรับ Admin)');

async function handleSetupQuestCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
    return true;
  }

  const embed = new EmbedBuilder()
    .setTitle('🎁 𝙕𝙀𝙉 𝘽𝙊𝙏 • DAILY QUEST')
    .setDescription('กดปุ่มด้านล่างเพื่อสุ่มรับ **Zen Coins** ฟรีประจำวัน (รีเซ็ตทุกๆ 19 ชั่วโมง) ลุ้นรับสูงสุดถึง 100 Zen Coins ทุกวัน!')
    .setColor('#66FFFF')
    .setImage('https://cdn.discordapp.com/attachments/1550576199829430382/1560524247216955432/IMG_7329.jpg?ex=6ad8f5b5&is=6ad7a435&hm=368998fdee4b3a8b5e2a4bb7fe808e4470b24faab8581314d9d7a8f3a43235a8&');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('claim_daily_orb')
      .setLabel('🎁 สุ่มรับ Zen Coins ประจำวัน')
      .setStyle(ButtonStyle.Success)
  );

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ ส่งแผงปุ่มเควสต์ประจำวันถาวรไปยังห้องนี้สำเร็จแล้ว!', ephemeral: true });
  return true;
}

async function handleQuestButton(interaction, serverConfigs, saveConfigs) {
  if (interaction.customId !== 'claim_daily_orb') return false;

  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].levels) serverConfigs[guildId].levels = {};
  if (!serverConfigs[guildId].levels[userId]) {
    serverConfigs[guildId].levels[userId] = { xp: 0, level: 1, orbs: 0, lastDaily: 0, boostUntil: 0, artistUntil: 0, customTheme: '' };
  }

  const userStat = serverConfigs[guildId].levels[userId];
  const now = Date.now();
  const cooldownTime = 19 * 60 * 60 * 1000;

  if (userStat.lastDaily && (now - userStat.lastDaily < cooldownTime)) {
    const remainingMs = cooldownTime - (now - userStat.lastDaily);
    const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
    const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    await interaction.reply({ content: `⏳ คุณรับรางวัลประจำวันไปแล้ว! กรุณารออีกประมาณ **${remainingHours} ชั่วโมง ${remainingMinutes} นาที** ถึงจะกดรับใหม่ได้ครับ`, ephemeral: true });
    return true;
  }

  // ปรับอัตราการสุ่มรางวัลให้กว้างขึ้น (20 ถึง 100 Coins)
  const rewardCoins = Math.floor(Math.random() * (100 - 20 + 1)) + 20;
  
  userStat.orbs = (userStat.orbs || 0) + rewardCoins;
  userStat.lastDaily = now;
  await saveConfigs(serverConfigs);

  await interaction.reply({ content: `🎉 ยินดีด้วย! คุณสุ่มรับ **${rewardCoins} Zen Coins** ประจำวันสำเร็จแล้ว! (ยอดสะสมปัจจุบัน: ${userStat.orbs} Zen Coins)`, ephemeral: true });
  return true;
}

module.exports = {
  setupQuestCommand,
  handleSetupQuestCommand,
  handleQuestButton
};
