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
    .setDescription('กดปุ่มด้านล่างเพื่อสุ่มรับ **Zen Coins** ฟรีประจำวัน (รีเซ็ตทุกๆ 19 ชั่วโมง) อัตราลุ้นโชคแบบ 50/50 ลุ้นรับสูงสุดถึง 100 Zen Coins!')
    .setColor('#66FFFF')
    .setImage('https://cdn.discordapp.com/attachments/1550576199829430382/1560524247216955432/IMG_7329.jpg');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('claim_daily_orb')
      .setLabel('🎁 สุ่มรับ Zen Coins ประจำวัน')
      .setStyle(ButtonStyle.Success)
  );

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ ส่งแผงป้ายเควสต์ประจำวันถาวรไปยังห้องนี้สำเร็จแล้ว!', ephemeral: true });
  return true;
}

async function handleQuestButton(interaction, serverConfigs, saveConfigs) {
  if (interaction.customId !== 'claim_daily_orb') return false;

  await interaction.deferReply({ ephemeral: true }).catch(() => {});

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
    await interaction.editReply({ content: `⏳ คุณรับรางวัลประจำวันไปแล้ว! กรุณารออีกประมาณ **${remainingHours} ชั่วโมง ${remainingMinutes} นาที** ถึงจะกดรับใหม่ได้ครับ` });
    return true;
  }

  // 🎲 ระบบสุ่มแบบ 50/50 (50% แรกได้น้อย/เกลือ, 50% หลังได้ลุ้นเยอะ)
  let rewardCoins = 0;
  const isLuckyHalf = Math.random() < 0.5;

  if (isLuckyHalf) {
    rewardCoins = Math.floor(Math.random() * (100 - 50 + 1)) + 50;
  } else {
    rewardCoins = Math.floor(Math.random() * 21);
  }
  
  userStat.orbs = (userStat.orbs || 0) + rewardCoins;
  userStat.lastDaily = now;
  await saveConfigs(serverConfigs);

  if (rewardCoins === 0) {
    await interaction.editReply({ content: `😢 น่าเสียดาย! รอบนี้ดวงไม่ดี สุ่มได้ **0 Zen Coins** (พยายามใหม่พรุ่งนี้เสี่ยงดวงใหม่นะ!)` });
  } else {
    await interaction.editReply({ content: `🎉 ยินดีด้วย! คุณสุ่มรับ **${rewardCoins} Zen Coins** ประจำวันสำเร็จแล้ว! (ยอดสะสมปัจจุบัน: ${userStat.orbs} Zen Coins)` });
  }
  return true;
}

module.exports = {
  setupQuestCommand,
  handleSetupQuestCommand,
  handleQuestButton
};
