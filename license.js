const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// 🔍 ฟังก์ชันตรวจสอบว่าเซิร์ฟเวอร์นี้เป็นพรีเมียมหรือไม่
async function isServerPremium(guildId, serverConfigs) {
  const config = serverConfigs[guildId];
  if (!config || !config.premium) return false;

  // ตรวจสอบสถานะพรีเมียม (Lifetime หรือยังไม่หมดอายุ)
  if (config.premium.isLifetime) return true;
  if (config.premium.expiresAt && Date.now() < config.premium.expiresAt) return true;

  return false;
}

// 👑 คำสั่งสำหรับเจ้าของบอทใช้เปิดสิทธิ์พรีเมียมให้เซิร์ฟเวอร์
const grantPremiumCommand = new SlashCommandBuilder()
  .setName('grant-premium')
  .setDescription('เปิดสิทธิ์พรีเมียมรายเซิร์ฟเวอร์ (สำหรับ Developer)')
  .addStringOption(option =>
    option.setName('guild_id')
      .setDescription('ระบุ Guild ID ของเซิร์ฟเวอร์ที่ต้องการเปิดสิทธิ์')
      .setRequired(true)
  )
  .addIntegerOption(option =>
    option.setName('months')
      .setDescription('จำนวนเดือนที่ต้องการให้ (ใส่ 999 สำหรับถาวร/Lifetime)')
      .setRequired(true)
  );

async function handleGrantPremiumCommand(interaction, serverConfigs, saveConfigs) {
  // 🔒 ล็อกไว้เฉพาะคุณคนเดียว (Discord User ID ของคุณ)
  const DEVELOPER_ID = '795347337773580299'; 
  if (interaction.user.id !== DEVELOPER_ID) {
    return await interaction.reply({ content: '❌ เฉพาะผู้พัฒนาบอทเท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
  }

  const targetGuildId = interaction.options.getString('guild_id').trim();
  const months = interaction.options.getInteger('months');

  if (!serverConfigs[targetGuildId]) {
    serverConfigs[targetGuildId] = {};
  }

  const now = Date.now();
  let expiresAt = now + (months * 30 * 24 * 60 * 60 * 1000);
  let isLifetime = false;

  if (months >= 999) {
    isLifetime = true;
    expiresAt = null;
  }

  serverConfigs[targetGuildId].premium = {
    enabled: true,
    isLifetime: isLifetime,
    expiresAt: expiresAt,
    grantedAt: now
  };

  await saveConfigs(serverConfigs);

  const embed = new EmbedBuilder()
    .setTitle('💎 PREMIUM LICENSE ACTIVATED')
    .setDescription(`เปิดสิทธิ์พรีเมียมสำเร็จเรียบร้อย!\n🌐 **Guild ID:** \`${targetGuildId}\`\n⏳ **ระยะเวลา:** ${isLifetime ? 'ตลอดชีพ (Lifetime)' : `${months} เดือน`}`)
    .setColor('#00FF00')
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

module.exports = {
  isServerPremium,
  grantPremiumCommand,
  handleGrantPremiumCommand
};
