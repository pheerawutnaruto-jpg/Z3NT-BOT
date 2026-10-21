const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// 1. คำสั่งสำหรับให้แอดมินตั้งค่าห้องโชว์ผลงาน Artist
const setupShowcaseCommand = new SlashCommandBuilder()
  .setName('setup-showcase')
  .setDescription('💎 [PREMIUM] ตั้งค่าห้องโชว์ผลงาน Artist พร้อมระบบรีแอคชันอัตโนมัติ')
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('เลือกห้องสำหรับให้สมาชิกส่งผลงานรูปภาพ')
      .setRequired(true)
  );

async function handleSetupShowcaseCommand(interaction, serverConfigs, saveConfigs) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
    return true;
  }

  const guildId = interaction.guildId;
  const channel = interaction.options.getChannel('channel');

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  serverConfigs[guildId].showcaseChannelId = channel.id;
  await saveConfigs(serverConfigs);

  const embed = new EmbedBuilder()
    .setTitle('🎨 ZEN BOT • ARTIST SHOWCASE SYSTEM')
    .setDescription(`✅ ตั้งค่าห้องโชว์ผลงานเรียบร้อยแล้วที่ห้อง <#${channel.id}>\n\n📌 เมื่อมีสมาชิกส่งรูปภาพหรือผลงานเข้ามา บอทจะช่วยกดรีแอคชันให้อัตโนมัติทันที!`)
    .setColor('#FF69B4');

  await interaction.reply({ embeds: [embed], ephemeral: true });
  return true;
}

// 2. ฟังก์ชันตรวจสอบข้อความในห้องโชว์ผลงาน
async function handleShowcaseMessage(message, serverConfigs) {
  if (!message.guild || message.author.bot) return false;

  const guildId = message.guild.id;
  const config = serverConfigs[guildId];
  if (!config || config.showcaseChannelId !== message.channel.id) return false;

  // ตรวจสอบว่ามีรูปภาพแนบมาด้วยหรือไม่ (ถือว่าเป็นผลงาน)
  const hasAttachment = message.attachments.size > 0;
  const hasImageLink = /https?:\/\/.*\.(png|jpg|jpeg|gif|webp)/i.test(message.content);

  if (hasAttachment || hasImageLink) {
    try {
      // กดรีแอคชันอัตโนมัติให้กำลังใจผลงาน
      await message.react('⭐');
      await message.react('❤️');
      await message.react('🔥');

    } catch (err) {
      console.error('Error handling showcase message:', err);
    }
  }

  return false;
}

module.exports = {
  setupShowcaseCommand,
  handleSetupShowcaseCommand,
  handleShowcaseMessage
  // ตัด handleShowcaseButton ออกไปแล้วเนื่องจากไม่ได้ใช้ปุ่มครับ
};
