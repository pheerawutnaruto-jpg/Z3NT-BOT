const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, RoleSelectMenuBuilder } = require('discord.js');
const { isServerPremium } = require('./status'); // แก้จาก ./license เป็น ./status

const pendingRoleRewardImages = new Map();

const levelCommand = new SlashCommandBuilder()
  .setName('level')
  .setDescription('📊 เช็กเลเวลและค่าประสบการณ์ (XP) ของคุณ');

async function handleLevelCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const config = serverConfigs[guildId] || {};
  const levelConfig = config.levelConfig || {};

  if (!config.levels) config.levels = {};
  const userStat = config.levels[userId] || { xp: 0, level: 1 };

  const embed = new EmbedBuilder()
    .setTitle(levelConfig.cardTitle || '📊 𝙕𝙀𝙉 𝘽𝙊𝙏 • STATS CARD')
    .setDescription(`การ์ดข้อมูลเลเวลของ **${interaction.user.username}**\n\n⭐ **Level:** \`${userStat.level}\`\n✨ **XP:** \`${userStat.xp}\``)
    .setColor(levelConfig.embedColor || '#66FFFF');

  if (levelConfig.statsCardImageUrl) {
    embed.setImage(levelConfig.statsCardImageUrl);
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

const leaderboardCommand = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('🏆 ดูอันดับผู้ที่มีเลเวลสูงสุดในเซิร์ฟเวอร์');

async function handleLeaderboardCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const config = serverConfigs[guildId] || {};
  const levels = config.levels || {};

  const sortedUsers = Object.entries(levels)
    .sort(([, a], [, b]) => b.xp - a.xp)
    .slice(0, 10);

  let desc = '';
  if (sortedUsers.length === 0) {
    desc = 'ยังไม่มีข้อมูลการจัดอันดับในขณะนี้';
  } else {
    sortedUsers.forEach(([userId, data], index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `\`#${index + 1}\``;
      desc += `${medal} <@${userId}> — Level: **${data.level}** (XP: \`${data.xp}\`)\n`;
    });
  }

  const embed = new EmbedBuilder()
    .setTitle('🏆 LEADERBOARD • อันดับผู้มีเลเวลสูงสุด')
    .setDescription(desc)
    .setColor('#FFD700')
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

const setLevelCommand = new SlashCommandBuilder()
  .setName('set-level')
  .setDescription('⚙️ [ADMIN] เปิดแผงควบคุมระบบ Level & XP');

async function handleSetLevelCommand(interaction, serverConfigs) {
  if (!interaction.member.permissions.has('Administrator')) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
  }
  const config = serverConfigs[interaction.guildId];
  return await interaction.reply({ ...getLevelDashboardContent(config), ephemeral: true });
}

function getLevelDashboardContent(config) {
  const lc = config.levelConfig;
  const statusText = lc.enabled ? '✅ เปิดอยู่' : '❌ ปิดอยู่';
  const embed = new EmbedBuilder()
    .setTitle('📊 ตั้งค่าระบบ Level & XP')
    .setDescription('จัดการเรต XP และตั้งค่ายศรางวัล')
    .setColor('#5865F2')
    .addFields({ name: '📥 Status', value: statusText, inline: true });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('toggle_level').setLabel(lc.enabled ? 'ปิดระบบ' : 'เปิดระบบ').setStyle(lc.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('edit_level_rate').setLabel('ตั้งค่าเรต XP').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('edit_level_card').setLabel('ตกแต่งการ์ด').setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

// ระบบคำนวณ XP และเลเวลอัป
async function handleLeveling(message, serverConfigs, saveConfigs) {
  if (message.author.bot || !message.guild) return;

  const guildId = message.guild.id;
  const userId = message.author.id;
  const config = serverConfigs[guildId];
  if (!config || !config.levelConfig || !config.levelConfig.enabled) return;

  if (!config.levels) config.levels = {};
  if (!config.levels[userId]) {
    config.levels[userId] = { xp: 0, level: 1, orbs: 0 };
  }

  const userStat = config.levels[userId];
  const lc = config.levelConfig;

  const minXp = lc.minXp || 15;
  const maxXp = lc.maxXp || 25;
  const earnedXp = Math.floor(Math.random() * (maxXp - minXp + 1)) + minXp;

  userStat.xp += earnedXp;

  const nextLevelXp = userStat.level * (lc.xpMultiplier || 100);
  if (userStat.xp >= nextLevelXp) {
    userStat.level += 1;
    const msg = lc.levelUpMessage
      .replace('{user}', `<@${userId}>`)
      .replace('{level}', userStat.level);

    if (lc.channelId) {
      try {
        const channel = await message.guild.channels.fetch(lc.channelId);
        if (channel) await channel.send({ content: msg });
      } catch (e) {}
    } else {
      await message.channel.send({ content: msg }).catch(() => {});
    }

    // แจกยศรางวัลตามเลเวล
    if (lc.roleRewards && lc.roleRewards[userStat.level.toString()]) {
      const rewardData = lc.roleRewards[userStat.level.toString()];
      const roleId = typeof rewardData === 'object' ? rewardData.roleId : rewardData;
      try {
        const role = await message.guild.roles.fetch(roleId);
        if (role && message.member) {
          await message.member.roles.add(role);
          const roleMsg = (lc.roleRewardMessage || '👑 ยินดีด้วยคุณ {user} ได้รับยศพิเศษ {role} เนื่องในโอกาสอัปถึง Level {level}!')
            .replace('{user}', `<@${userId}>`)
            .replace('{role}', `<@&${roleId}>`)
            .replace('{level}', userStat.level);
          
          if (lc.channelId) {
            const channel = await message.guild.channels.fetch(lc.channelId);
            if (channel) await channel.send({ content: roleMsg });
          } else {
            await message.channel.send({ content: roleMsg }).catch(() => {});
          }
        }
      } catch (err) {
        console.error('Role reward error:', err);
      }
    }
  }

  await saveConfigs(serverConfigs);
}

function handleCommandLeveling(interaction, serverConfigs, saveConfigs) {
  // ฟังก์ชันรองรับ XP จากการใช้คำสั่ง Slash Command
}

function startVoiceXpCron(client, serverConfigs, saveConfigs) {
  // ระบบ XP ห้องเสียง (ถ้ามี)
}

module.exports = {
  handleLeveling,
  handleCommandLeveling,
  levelCommand,
  handleLevelCommand,
  leaderboardCommand,
  handleLeaderboardCommand,
  setLevelCommand,
  handleSetLevelCommand,
  getLevelDashboardContent,
  startVoiceXpCron,
  pendingRoleRewardImages
};
