const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

// 🛠️ คำสั่งสำหรับแอดมินใช้ส่งแผงปุ่มเควสต์ประจำวันถาวรไปไว้ในห้องแชท
const setupQuestCommand = new SlashCommandBuilder()
  .setName('setup-quest')
  .setDescription('ส่งแผงปุ่มกดรับเควสต์ประจำวันถาวรไปยังห้องนี้ (สำหรับ Admin)');

async function handleSetupQuestCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle('🎁 𝙕𝙀𝙉 𝘽𝙊𝙏 • DAILY QUEST')
    .setDescription('กดปุ่มด้านล่างเพื่อรับ **Zen Coins** ฟรีประจำวัน (รีเซ็ตทุกๆ 24 ชั่วโมง) สะสมไว้แลกของรางวัลพิเศษในเซิร์ฟเวอร์!')
    .setColor('#66FFFF');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('claim_daily_orb')
      .setLabel('🎁 รับ Zen Coins ประจำวัน')
      .setStyle(ButtonStyle.Success)
  );

  // ส่งแผงปุ่มไปที่ห้องแชทที่พิมพ์คำสั่งนี้
  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ ส่งแผงปุ่มเควสต์ประจำวันถาวรไปยังห้องนี้สำเร็จแล้ว!', ephemeral: true });
}

// 🎁 ระบบกดปุ่มรับรางวัล (เช็กคูลดาวน์ 24 ชั่วโมง และแจก Zen Coins)
async function handleQuestButton(interaction, serverConfigs, saveConfigs) {
  if (interaction.customId !== 'claim_daily_orb') return false;

  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].levels) serverConfigs[guildId].levels = {};
  if (!serverConfigs[guildId].levels[userId]) {
    serverConfigs[guildId].levels[userId] = { xp: 0, level: 1, orbs: 0, lastDaily: 0 };
  }

  const userStat = serverConfigs[guildId].levels[userId];
  const now = Date.now();
  const cooldownTime = 24 * 60 * 60 * 1000; // 24 ชั่วโมง

  // เช็กว่าครบ 24 ชั่วโมงหรือยัง
  if (userStat.lastDaily && (now - userStat.lastDaily < cooldownTime)) {
    const remainingTime = Math.ceil((cooldownTime - (now - userStat.lastDaily)) / (1000 * 60 * 60));
    return await interaction.reply({ content: `⏳ คุณรับรางวัลประจำวันไปแล้ว! กรุณารออีกประมาณ **${remainingTime} ชั่วโมง** ถึงจะกดรับใหม่ได้ครับ`, ephemeral: true });
  }

  // แจก 50 Zen Coins (ปรับจำนวนได้ตามชอบ)
  const rewardCoins = 50;
  userStat.orbs = (userStat.orbs || 0) + rewardCoins;
  userStat.lastDaily = now;
  await saveConfigs(serverConfigs);

  await interaction.reply({ content: `🎉 ยินดีด้วย! คุณกดรับ **${rewardCoins} Zen Coins** ประจำวันสำเร็จแล้ว! (ยอดสะสมปัจจุบัน: ${userStat.orbs} Zen Coins)`, ephemeral: true });
  return true;
}

module.exports = {
  setupQuestCommand,
  handleSetupQuestCommand,
  handleQuestButton
};
