const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

const setupQuestCommand = new SlashCommandBuilder()
  .setName('setup-quest')
  .setDescription('ส่งแผงปุ่มกดรับเควสต์ประจำวันถาวรไปยังห้องนี้ (สำหรับ Admin)');

async function handleSetupQuestCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle('🌟 𝕯𝖆𝖎𝖑𝖞 𝕺𝖗𝖇𝖘 • ระบบเควสต์ประจำวัน')
    .setDescription(
      '> *ยินดีด้วยคุณก้าวเข้าสู่วิหารแห่งความมั่งคั่ง! กดรับ **Discord Orbs** เพื่อสะสมแต้มและเตรียมตัวแลกรับสิทธิพิเศษระดับพรีเมียมในเซิร์ฟเวอร์*\n\n' +
      '💎 **รางวัลที่จะได้รับ:** `50 Orbs`\n' +
      '⏳ **ระยะเวลาคูลดาวน์:** `ทุกๆ 24 ชั่วโมง`'
    )
    .setColor('#FFD700') // สีทองหรูหรา
    .setFooter({ text: 'ZEN BOT • Exclusive Daily Rewards' }); 
    // ❌ นำ .setTimestamp() ออกเรียบร้อยแล้วตามคำขอ

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('claim_daily_orb')
      .setLabel('💎 กดรับ Daily Orbs')
      .setStyle(ButtonStyle.Success)
  );

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ ส่งแผงปุ่มเควสต์ประจำวันแบบพรีเมียมไปยังห้องนี้สำเร็จแล้ว!', ephemeral: true });
}

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

  if (userStat.lastDaily && (now - userStat.lastDaily < cooldownTime)) {
    const remainingTime = Math.ceil((cooldownTime - (now - userStat.lastDaily)) / (1000 * 60 * 60));
    return await interaction.reply({ content: `⏳ คุณได้ทำภารกิจวันนี้ไปแล้ว! โปรดรออีกประมาณ **${remainingTime} ชั่วโมง** ค่อยกลับมารับใหม่นะคับ`, ephemeral: true });
  }

  const rewardOrbs = 50;
  userStat.orbs = (userStat.orbs || 0) + rewardOrbs;
  userStat.lastDaily = now;
  await saveConfigs(serverConfigs);

  await interaction.reply({ content: `🎉 **ยอดเยี่ยม!** คุณได้รับ **${rewardOrbs} Discord Orbs** เข้ากระเป๋าเรียบร้อยแล้ว (ยอดสะสม: \`${userStat.orbs} Orbs\`)`, ephemeral: true });
  return true;
}

module.exports = {
  setupQuestCommand,
  handleSetupQuestCommand,
  handleQuestButton
};
