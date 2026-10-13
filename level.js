const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// 1. ฟังก์ชันคำนวณและแจก XP พร้อมรองรับการตั้งค่าปรับแต่ง
function handleLeveling(message, serverConfigs, saveConfigs) {
  if (!message.guild || message.author.bot) return;

  const guildId = message.guild.id;
  if (!serverConfigs[guildId]) return;

  if (!serverConfigs[guildId].levels) {
    serverConfigs[guildId].levels = {};
  }

  // ค่าตั้งค่าพื้นฐาน (ถ้ายังไม่ได้ตั้ง ใช้ค่าเริ่มต้น)
  if (!serverConfigs[guildId].levelSettings) {
    serverConfigs[guildId].levelSettings = { minXp: 15, maxXp: 25, xpMultiplier: 100 };
  }

  const settings = serverConfigs[guildId].levelSettings;
  const userId = message.author.id;
  
  if (!serverConfigs[guildId].levels[userId]) {
    serverConfigs[guildId].levels[userId] = { xp: 0, level: 1 };
  }

  const userStat = serverConfigs[guildId].levels[userId];

  // สุ่ม XP ตามที่ตั้งค่าไว้
  const earnedXp = Math.floor(Math.random() * (settings.maxXp - settings.minXp + 1)) + settings.minXp;
  userStat.xp += earnedXp;

  // คำนวณ XP ที่ต้องใช้ (Level * ตัวคูณที่ตั้งค่า)
  const requiredXp = userStat.level * settings.xpMultiplier;

  if (userStat.xp >= requiredXp) {
    userStat.xp -= requiredXp;
    userStat.level += 1;

    message.channel.send(`🎉 ยินดีด้วยคุณ <@${userId}>! เลเวลอัปขึ้นเป็น **Level ${userStat.level}** แล้ว! 🚀`)
      .then(msg => {
        setTimeout(() => msg.delete().catch(() => {}), 5000);
      });
  }

  saveConfigs(serverConfigs);
}

// 2. คำสั่งเช็กเลเวล (/level)
const levelCommand = new SlashCommandBuilder()
  .setName('level')
  .setDescription('เช็กเลเวลและค่าประสบการณ์ (XP) ของคุณหรือสมาชิกคนอื่น')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('เลือกสมาชิกที่ต้องการดูเลเวล (เว้นว่างไว้เพื่อดูของตัวเอง)')
      .setRequired(false)
  );

async function handleLevelCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const userId = targetUser.id;

  const config = serverConfigs[guildId] || {};
  const levels = config.levels || {};
  const settings = config.levelSettings || { xpMultiplier: 100 };

  const userStat = levels[userId] || { xp: 0, level: 1 };
  const requiredXp = userStat.level * settings.xpMultiplier;

  const embed = new EmbedBuilder()
    .setTitle(`📊 𝙕𝙀𝙉 𝘽𝙊𝙏 • ระดับเลเวลของคุณ`)
    .setDescription(`ข้อมูลเลเวลของ **${targetUser.username}**`)
    .setColor('#66FFFF')
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: '✨ เลเวลปัจจุบัน', value: `**Level ${userStat.level}**`, inline: true },
      { name: '🌟 ค่าประสบการณ์ (XP)', value: `**${userStat.xp} / ${requiredXp} XP**`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// 3. คำสั่งตั้งค่าระบบเลเวลสำหรับแอดมิน (/set-level)
const setLevelCommand = new SlashCommandBuilder()
  .setName('set-level')
  .setDescription('ตั้งค่าระบบเลเวลและอัตราการได้รับ XP')
  .addIntegerOption(option =>
    option.setName('min_xp')
      .setDescription('XP น้อยที่สุดที่ได้รับต่อข้อความ (ค่าเดิม: 15)')
      .setRequired(false)
  )
  .addIntegerOption(option =>
    option.setName('max_xp')
      .setDescription('XP มากที่สุดที่ได้รับต่อข้อความ (ค่าเดิม: 25)')
      .setRequired(false)
  )
  .addIntegerOption(option =>
    option.setName('multiplier')
      .setDescription('ตัวคูณใช้คำนวณเลเวลถัดไป (Level * ตัวคูณ, ค่าเดิม: 100)')
      .setRequired(false)
  );

async function handleSetLevelCommand(interaction, serverConfigs, saveConfigs) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นถึงจะใช้งานคำสั่งนี้ได้', ephemeral: true });
  }

  const guildId = interaction.guildId;
  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].levelSettings) {
    serverConfigs[guildId].levelSettings = { minXp: 15, maxXp: 25, xpMultiplier: 100 };
  }

  const minXp = interaction.options.getInteger('min_xp');
  const maxXp = interaction.options.getInteger('max_xp');
  const multiplier = interaction.options.getInteger('multiplier');

  const settings = serverConfigs[guildId].levelSettings;

  if (minXp !== null) settings.minXp = minXp;
  if (maxXp !== null) settings.maxXp = maxXp;
  if (multiplier !== null) settings.xpMultiplier = multiplier;

  saveConfigs(serverConfigs);

  const embed = new EmbedBuilder()
    .setTitle('⚙️ อัปเดตการตั้งค่าระบบเลเวลสำเร็จ')
    .setColor('#00FFCC')
    .addFields(
      { name: '📥 สุ่ม XP ต่อข้อความ', value: `${settings.minXp} - ${settings.maxXp} XP`, inline: true },
      { name: '📈 ตัวคูณเลเวลอัป', value: `${settings.xpMultiplier} XP ต่อเลเวล`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

module.exports = { handleLeveling, levelCommand, handleLevelCommand, setLevelCommand, handleSetLevelCommand };
