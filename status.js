const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

async function isServerPremium(guildId, serverConfigs) {
  const config = serverConfigs[guildId];
  if (config && config.isPremium === true) {
    return true;
  }
  return false;
}

const boostStatusCommand = new SlashCommandBuilder()
  .setName('boost-status')
  .setDescription('💎 เช็กสถานะสิทธิ์พรีเมียมของเซิร์ฟเวอร์นี้');

async function handleBoostStatusCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const isPrem = await isServerPremium(guildId, serverConfigs);

  const embed = new EmbedBuilder()
    .setTitle('💎 SERVER PREMIUM STATUS')
    .setDescription(isPrem ? '✅ เซิร์ฟเวอร์นี้ **เปิดใช้งานสถานะพรีเมียม** เรียบร้อยแล้ว!' : '❌ เซิร์ฟเวอร์นี้ยังไม่ได้เปิดใช้งานสถานะพรีเมียม')
    .setColor(isPrem ? '#00FF00' : '#FF0000')
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

const grantPremiumCommand = new SlashCommandBuilder()
  .setName('grant-premium')
  .setDescription('💎 [ADMIN] เปิด/ปิดสถานะพรีเมียมให้เซิร์ฟเวอร์')
  .addBooleanOption(option => option.setName('status').setDescription('True เพื่อเปิด / False เพื่อปิด').setRequired(true));

async function handleGrantPremiumCommand(interaction, serverConfigs, saveConfigs) {
  if (!interaction.member.permissions.has('Administrator')) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
  }

  const status = interaction.options.getBoolean('status');
  const guildId = interaction.guildId;

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  serverConfigs[guildId].isPremium = status;
  await saveConfigs(serverConfigs);

  await interaction.reply({ content: `✅ อัปเดตสถานะพรีเมียมของเซิร์ฟเวอร์นี้เป็น: **${status ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}**`, ephemeral: true });
}

module.exports = {
  isServerPremium,
  boostStatusCommand,
  grantPremiumCommand,
  handleBoostStatusCommand,
  handleGrantPremiumCommand
};
