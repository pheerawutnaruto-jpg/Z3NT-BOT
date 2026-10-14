const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

// 🛠️ คำสั่งสำหรับแอดมินใช้ส่งแผงปุ่มเควสต์ถาวรไปไว้ในห้องแชท
const setupQuestCommand = new SlashCommandBuilder()
  .setName('setup-quest')
  .setDescription('ส่งแผงปุ่มกดรับเควสต์ประจำวันถาวรไปยังห้องนี้ (สำหรับ Admin)');

async function handleSetupQuestCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle('🎁 𝐃𝐀𝐈𝐋𝐘 𝐐𝐔𝐄𝐒𝐓𝐒')
    .setDescription(
      '> 🎁 **รางวัล:** รับรางวัล **50 Discord Orbs**\n\n' +
      '_แต้มที่คุณสะสมสามารถนำไปใช้แลกของรางวัลพิเศษภายในเซิร์ฟเวอร์ได้ในอนาคต!_'
    )
    .setColor('#66FFFF')
    .setFooter({ text: '𝙕𝙀𝙉 𝘽𝙊𝙏 • ระบบเควสต์อัตโนมัติ' });
    // เอา .setTimestamp() ออก เพื่อไม่ให้แสดงเวลาครับ

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('claim_daily_orb')
      .setLabel('🎁 รับ Daily Orbs ประจำวัน')
      .setStyle(ButtonStyle.Success)
  );

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ ส่งแผงปุ่มเควสต์ประจำวันถาวรไปยังห้องนี้สำเร็จแล้ว!', ephemeral: true });
}

// 🎁 ระบบกดปุ่มรับรางวัล (เช็กคูลดาวน์ 24 ชั่วโมง และแจก Orbs)
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

  // แจก 50 Orbs
  const rewardOrbs = 50;
  userStat.orbs = (userStat.orbs || 0) + rewardOrbs;
  userStat.lastDaily = now;
  await saveConfigs(serverConfigs);

  const successEmbed = new EmbedBuilder()
    .setTitle('🎉 รับรางวัลประจำวันสำเร็จ!')
    .setDescription(`คุณได้รับ **+${rewardOrbs} Discord Orbs** เข้ากระเป๋าเรียบร้อยแล้ว!\n🔮 **ยอดสะสมปัจจุบัน:** \`${userStat.orbs} Orbs\``)
    .setColor('#66FFFF');

  await interaction.reply({ embeds: [successEmbed], ephemeral: true });
  return true;
}

module.exports = {
  setupQuestCommand,
  handleSetupQuestCommand,
  handleQuestButton
};
