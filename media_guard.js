const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');

const setupMediaGuardCommand = new SlashCommandBuilder()
  .setName('setup-media-guard')
  .setDescription('💎 [PREMIUM] เปิดใช้งานระบบบังคับส่งเฉพาะรูปภาพ/มีเดียในห้องนี้ (สำหรับ Admin)')
  .addBooleanOption(option =>
    option.setName('status')
      .setDescription('เลือก เปิด หรือ ปิด ระบบ Media Guard ในห้องนี้')
      .setRequired(true)
  );

async function handleSetupMediaGuardCommand(interaction, serverConfigs, saveConfigs) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
  }

  const guildId = interaction.guildId;
  const channelId = interaction.channelId;
  const status = interaction.options.getBoolean('status');

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].mediaGuardChannels) {
    serverConfigs[guildId].mediaGuardChannels = [];
  }

  const channels = serverConfigs[guildId].mediaGuardChannels;
  const index = channels.indexOf(channelId);

  if (status && index === -1) {
    channels.push(channelId);
  } else if (!status && index !== -1) {
    channels.splice(index, 1);
  }

  await saveConfigs(serverConfigs);

  const embed = new EmbedBuilder()
    .setTitle('🛡️ MEDIA-ONLY CHANNEL GUARD')
    .setDescription(status 
      ? `✅ เปิดใช้งานระบบคุมห้องเรียบร้อย!\nห้องนี้จะ **อนุญาตให้ส่งเฉพาะรูปภาพ ไฟล์มีเดีย หรือลิงก์เท่านั้น** ข้อความตัวอักษรธรรมดาจะถูกลบอัตโนมัติ`
      : `❌ ปิดใช้งานระบบคุมห้องในห้องนี้แล้ว`)
    .setColor(status ? '#00FF00' : '#FF0000');

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

function handleMediaGuardMessage(message, serverConfigs) {
  if (!message.guild || message.author.bot) return false;

  const guildId = message.guild.id;
  const config = serverConfigs[guildId];
  if (!config || !config.mediaGuardChannels || !config.mediaGuardChannels.includes(message.channel.id)) {
    return false;
  }

  if (message.member && message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    return false;
  }

  const hasAttachment = message.attachments.size > 0;
  const hasLink = /https?:\/\/[^\s]+/gi.test(message.content);
  const hasEmbedImage = message.embeds.some(embed => embed.image || embed.thumbnail);

  if (!hasAttachment && !hasLink && !hasEmbedImage) {
    message.delete().catch(() => {});
    
    message.channel.send({ 
      content: `⚠️ <@${message.author.id}> ห้องนี้อนุญาตให้ส่ง **เฉพาะรูปภาพ ผลงาน หรือลิงก์มีเดียเท่านั้น** ครับ! (ข้อความตัวอักษรธรรมดาจะถูกลบ)` 
    }).then(msg => {
      setTimeout(() => msg.delete().catch(() => {}), 5000);
    }).catch(() => {});

    return true;
  }

  return false;
}

module.exports = {
  setupMediaGuardCommand,
  handleSetupMediaGuardCommand,
  handleMediaGuardMessage
};
