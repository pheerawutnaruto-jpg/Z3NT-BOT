const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');

// 1. ฟังก์ชันคำนวณและแจก XP พร้อมส่งข้อความเลเวลอัปตามที่ Customize ไว้
function handleLeveling(message, serverConfigs, saveConfigs) {
  if (!message.guild || message.author.bot) return;

  const guildId = message.guild.id;
  if (!serverConfigs[guildId]) return;

  if (!serverConfigs[guildId].levelConfig) {
    serverConfigs[guildId].levelConfig = {
      enabled: true,
      minXp: 15,
      maxXp: 25,
      xpMultiplier: 100,
      levelUpMessage: '🎉 ยินดีด้วยคุณ {user}! เลเวลอัปขึ้นเป็น **Level {level}** แล้ว! 🚀'
    };
  }

  const lConfig = serverConfigs[guildId].levelConfig;
  if (!lConfig.enabled) return;

  if (!serverConfigs[guildId].levels) {
    serverConfigs[guildId].levels = {};
  }

  const userId = message.author.id;
  if (!serverConfigs[guildId].levels[userId]) {
    serverConfigs[guildId].levels[userId] = { xp: 0, level: 1 };
  }

  const userStat = serverConfigs[guildId].levels[userId];

  const earnedXp = Math.floor(Math.random() * (lConfig.maxXp - lConfig.minXp + 1)) + lConfig.minXp;
  userStat.xp += earnedXp;

  const requiredXp = userStat.level * lConfig.xpMultiplier;

  if (userStat.xp >= requiredXp) {
    userStat.xp -= requiredXp;
    userStat.level += 1;

    const customMsg = lConfig.levelUpMessage
      .replace('{user}', `<@${userId}>`)
      .replace('{level}', userStat.level);

    message.channel.send(customMsg)
      .then(msg => {
        setTimeout(() => msg.delete().catch(() => {}), 6000);
      });
  }

  saveConfigs(serverConfigs);
}

// 2. คำสั่งเช็กเลเวล (/level) พร้อมดีไซน์ Embed สวยหรู
const levelCommand = new SlashCommandBuilder()
  .setName('level')
  .setDescription('เช็กเลเวลและค่าประสบการณ์ (XP) ของคุณ')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('เลือกสมาชิกที่ต้องการดูเลเวล')
      .setRequired(false)
  );

async function handleLevelCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const userId = targetUser.id;

  const config = serverConfigs[guildId] || {};
  const levels = config.levels || {};
  const lConfig = config.levelConfig || { xpMultiplier: 100 };

  const userStat = levels[userId] || { xp: 0, level: 1 };
  const requiredXp = userStat.level * lConfig.xpMultiplier;

  // คำนวณ Progress Bar ง่ายๆ
  const percentage = Math.min(Math.round((userStat.xp / requiredXp) * 10), 10);
  const progressBar = '█'.repeat(percentage) + '░'.repeat(10 - percentage);

  const embed = new EmbedBuilder()
    .setTitle(`📊 𝙕𝙀𝙉 𝘽𝙊𝙏 • STATS CARD`)
    .setDescription(`การ์ดข้อมูลเลเวลของ **${targetUser.username}**`)
    .setColor('#66FFFF')
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: '✨ เลเวล (Level)', value: `\` Level ${userStat.level} \``, inline: true },
      { name: '🌟 ค่าประสบการณ์ (XP)', value: `\` ${userStat.xp} / ${requiredXp} XP \``, inline: true },
      { name: '📈 ความคืบหน้า', value: `\`[${progressBar}]\` (${Math.floor((userStat.xp / requiredXp) * 100)}%)`, inline: false }
    )
    .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// 3. แผงควบคุมตั้งค่าระบบเลเวล (/set-level) แบบ Interactive Dashboard
const setLevelCommand = new SlashCommandBuilder()
  .setName('set-level')
  .setDescription('เปิดแผงควบคุมตั้งค่าระบบเลเวลและปรับแต่งข้อความ');

function getLevelDashboardContent(config) {
  if (!config.levelConfig) {
    config.levelConfig = {
      enabled: true,
      minXp: 15,
      maxXp: 25,
      xpMultiplier: 100,
      levelUpMessage: '🎉 ยินดีด้วยคุณ {user}! เลเวลอัปขึ้นเป็น **Level {level}** แล้ว! 🚀'
    };
  }

  const lc = config.levelConfig;
  const statusText = lc.enabled ? '✅ เปิดอยู่' : '❌ ปิดอยู่';

  const embed = new EmbedBuilder()
    .setTitle('⚙️ แผงควบคุมระบบเลเวล (Level Dashboard)')
    .setDescription('จัดการสถานะ ตั้งค่าเรต XP และปรับแต่งข้อความแจ้งเตือนเลเวลอัปได้จากปุ่มด้านล่าง')
    .setColor('#5865F2')
    .addFields(
      { name: '📥 สถานะระบบเลเวล', value: statusText, inline: true },
      { name: '📊 เรต XP ต่อข้อความ', value: `${lc.minXp} -${lc.maxXp} XP`, inline: true },
      { name: '📈 ตัวคูณเลเวลอัป', value: `${lc.xpMultiplier} XP`, inline: true },
      { name: '💬 ข้อความแจ้งเตือนเลเวลอัป', value: `\`\`\`${lc.levelUpMessage}\`\`\``, inline: false }
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('toggle_level')
      .setLabel(lc.enabled ? 'ปิดระบบเลเวล' : 'เปิดระบบเลเวล')
      .setStyle(lc.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('edit_level_rate')
      .setLabel('ตั้งค่าเรต XP และตัวคูณ')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('edit_level_msg')
      .setLabel('แก้ไขข้อความเลเวลอัป')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row1] };
}

async function handleSetLevelCommand(interaction, serverConfigs) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
  }
  const config = serverConfigs[interaction.guildId];
  await interaction.reply({ ...getLevelDashboardContent(config), ephemeral: true });
}

module.exports = { handleLeveling, levelCommand, handleLevelCommand, setLevelCommand, handleSetLevelCommand, getLevelDashboardContent };
