const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');

const LEVEL_FILE = './levels.json';

function loadLevels() {
  try {
    if (fs.existsSync(LEVEL_FILE)) {
      const data = fs.readFileSync(LEVEL_FILE, 'utf8');
      if (data.trim() !== '') return JSON.parse(data);
    }
  } catch (e) { console.error('Error loading levels:', e); }
  return {};
}

function saveLevels(levels) {
  try { fs.writeFileSync(LEVEL_FILE, JSON.stringify(levels, null, 2)); }
  catch (e) { console.error('Error saving levels:', e); }
}

let levelData = loadLevels();
const xpCooldown = new Set();

// คำสั่ง Slash Commands สำหรับระบบเลเวล
const levelCommands = [
  new SlashCommandBuilder()
    .setName('level')
    .setDescription('เช็กเลเวลและค่าประสบการณ์ (XP) ของคุณ')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('เลือกสมาชิกที่ต้องการดูเลเวล')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('set-level')
    .setDescription('เปิดแผงควบคุมตั้งค่าระบบเลเวล (Level Dashboard)')
].map(c => c.toJSON());

function getRequiredXp(level) {
  return level * 100 + 150;
}

// ฟังก์ชันสร้างหน้าแผงควบคุม Level Dashboard
function getLevelDashboardContent(guildConfig) {
  const cfg = guildConfig.levelConfig || { enabled: true, minXp: 15, maxXp: 25, ignoredChannels: [] };
  const statusText = cfg.enabled ? '✅ เปิดอยู่' : '❌ ปิดอยู่';
  let ignoredTags = 'ไม่มีห้องยกเว้น (เก็บ XP ทุกห้อง)';
  if (cfg.ignoredChannels && cfg.ignoredChannels.length > 0) {
    ignoredTags = cfg.ignoredChannels.map(id => `<#${id}>`).join(', ');
  }

  const embed = new EmbedBuilder()
    .setTitle('⚙️ ตั้งค่าระบบเลเวล (Level Dashboard)')
    .setDescription('จัดการเปิด/ปิดระบบ, ตั้งค่าจำนวน XP ที่ได้รับ และเลือกห้องยกเว้นได้จากปุ่มด้านล่าง')
    .setColor('#66FFFF')
    .addFields(
      { name: '📥 สถานะระบบเลเวล', value: statusText, inline: true },
      { name: '✨ อตตราสุ่ม XP', value: `${cfg.minXp} - ${cfg.maxXp} XP ต่อข้อความ`, inline: true },
      { name: '📂 ห้องยกเว้น (ไม่นับ XP)', value: ignoredTags, inline: false }
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('lvl_toggle_main').setLabel(cfg.enabled ? 'ปิดระบบเลเวล' : 'เปิดระบบเลเวล').setStyle(cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('lvl_config_xp').setLabel('ตั้งค่าจำนวน XP').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('lvl_reset_all').setLabel('รีเซ็ตเลเวลทั้งหมด').setStyle(ButtonStyle.Danger)
  );

  const rowChannel = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('lvl_select_ignored')
      .setPlaceholder('📂 เลือกห้องที่ไม่ต้องการให้คิด XP (ห้องยกเว้น)')
      .setMinValues(0)
      .setMaxValues(5)
      .addChannelTypes(ChannelType.GuildText)
  );

  return { embeds: [embed], components: [row1, rowChannel] };
}

// ฟังก์ชันจัดการ XP ตอนพิมพ์ข้อความ
function handleLevelMessage(message, serverConfigs, saveServerConfigs) {
  if (!message.guild || message.author.bot) return;

  const guildId = message.guild.id;
  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  const config = serverConfigs[guildId];

  if (!config.levelConfig) {
    config.levelConfig = { enabled: true, minXp: 15, maxXp: 25, ignoredChannels: [] };
  }

  const cfg = config.levelConfig;
  if (!cfg.enabled) return;

  // ตรวจสอบห้องยกเว้น
  if (cfg.ignoredChannels && cfg.ignoredChannels.includes(message.channel.id)) return;

  const userId = message.author.id;
  const cooldownKey = `${guildId}-${userId}`;

  if (xpCooldown.has(cooldownKey)) return;
  xpCooldown.add(cooldownKey);
  setTimeout(() => xpCooldown.delete(cooldownKey), 60000); // คูลดาวน์ 1 นาที

  if (!levelData[guildId]) levelData[guildId] = {};
  if (!levelData[guildId][userId]) {
    levelData[guildId][userId] = { xp: 0, level: 1, totalXp: 0 };
  }

  const userData = levelData[guildId][userId];
  const gainedXp = Math.floor(Math.random() * (cfg.maxXp - cfg.minXp + 1)) + cfg.minXp;
  userData.xp += gainedXp;
  userData.totalXp += gainedXp;

  const requiredXp = getRequiredXp(userData.level);

  if (userData.xp >= requiredXp) {
    userData.xp -= requiredXp;
    userData.level += 1;
    saveLevels(levelData);

    message.channel.send(`🎉 ยินดีด้วย <@${userId}>! คุณเลเวลอัปขึ้นสู่ **Level ${userData.level}** แล้ว! 🚀`).catch(() => {});
  } else {
    saveLevels(levelData);
  }
}

// ฟังก์ชันคำสั่ง /level
async function handleLevelCommand(interaction) {
  const guildId = interaction.guildId;
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const userId = targetUser.id;

  if (!levelData[guildId] || !levelData[guildId][userId]) {
    return await interaction.reply({ content: `📊 คุณ <@${userId}> ยังไม่มีข้อมูลเลเวล (ลองพิมพ์ข้อความในแชทก่อนนะ!)`, ephemeral: true });
  }

  const userData = levelData[guildId][userId];
  const requiredXp = getRequiredXp(userData.level);

  const embed = new EmbedBuilder()
    .setTitle(`📊 ข้อมูลเลเวลของ ${targetUser.username}`)
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
    .setColor('#66FFFF')
    .addFields(
      { name: '🏆 Level', value: `${userData.level}`, inline: true },
      { name: '✨ XP ปัจจุบัน', value: `${userData.xp} / ${requiredXp}`, inline: true },
      { name: '📈 XP สะสมทั้งหมด', value: `${userData.totalXp} XP`, inline: false }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: false });
}

module.exports = { levelCommands, getLevelDashboardContent, handleLevelMessage, handleLevelCommand, levelData, saveLevels };
