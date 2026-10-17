const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const cron = require('node-cron');
const { generateProfileCard } = require('./canvas_card');
const { isServerPremium } = require('./license');

const pendingRoleRewardImages = new Map();

async function giveXpToUser(guildId, userId, amount, clientOrMessage, serverConfigs, saveConfigs, isVoice = false) {
  if (!serverConfigs[guildId]) return;

  const config = serverConfigs[guildId];
  if (!config.levelConfig || !config.levelConfig.enabled) return;

  if (!config.levels) config.levels = {};
  if (!config.levels[userId]) {
    config.levels[userId] = { xp: 0, level: 1, orbs: 0, lastDaily: 0, boostUntil: 0, artistUntil: 0, customTheme: '' };
  }

  const userStat = config.levels[userId];
  const multiplier = config.levelConfig.xpMultiplier || 100;
  const now = Date.now();

  let finalAmount = amount;
  let isBoosted = false;

  if (userStat.boostUntil && now < userStat.boostUntil) {
    finalAmount *= 2; 
    isBoosted = true;
  } else if (userStat.boostUntil && now >= userStat.boostUntil) {
    userStat.boostUntil = 0;
    const guild = isVoice ? clientOrMessage : clientOrMessage.guild;
    if (guild) {
      try {
        const member = await guild.members.fetch(userId).catch(() => null);
        const boostRoleId = '1559992075095773184';
        if (member && member.roles.cache.has(boostRoleId)) {
          await member.roles.remove(boostRoleId);
        }
      } catch (err) {
        console.error('Error removing expired boost role:', err);
      }
    }
  }

  const artistRoleId = '1560136361015513108';
  if (userStat.artistUntil && now >= userStat.artistUntil) {
    userStat.artistUntil = 0;
    userStat.customTheme = ''; 
    const guild = isVoice ? clientOrMessage : clientOrMessage.guild;
    if (guild) {
      try {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member && member.roles.cache.has(artistRoleId)) {
          await member.roles.remove(artistRoleId);
        }
      } catch (err) {
        console.error('Error removing expired artist role:', err);
      }
    }
  }

  userStat.xp += finalAmount;
  const requiredXp = userStat.level * multiplier;

  if (userStat.xp >= requiredXp) {
    userStat.xp -= requiredXp;
    userStat.level += 1;

    let boostText = isBoosted ? ' *(⚡ กำลังใช้งาน XP Booster x2)*' : '';
    const customMsg = (config.levelConfig.levelUpMessage || 'ยินดีด้วยคุณ {user}! เลเวลอัปขึ้นเป็น **Level {level}** แล้ว!')
      .replace('{user}', `<@${userId}>`)
      .replace('{level}', userStat.level) + boostText;

    let targetChannel = null;
    let guild = null;

    if (isVoice) {
      guild = clientOrMessage;
      if (guild && config.levelConfig.channelId) {
        targetChannel = guild.channels.cache.get(config.levelConfig.channelId);
      }
      if (!targetChannel && guild) {
        targetChannel = guild.systemChannel;
      }
    } else {
      const messageOrInteraction = clientOrMessage;
      guild = messageOrInteraction.guild;
      if (config.levelConfig.channelId) {
        targetChannel = guild.channels.cache.get(config.levelConfig.channelId);
      }
      if (!targetChannel) {
        targetChannel = messageOrInteraction.channel;
      }
    }

    if (guild) {
      try {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member && config.levelConfig.roleRewards) {
          const rewardData = config.levelConfig.roleRewards[userStat.level];
          if (rewardData) {
            const rewardRoleId = typeof rewardData === 'object' ? rewardData.roleId : rewardData;
            const rewardImgUrl = typeof rewardData === 'object' ? rewardData.imageUrl : '';

            const roleToGive = guild.roles.cache.get(rewardRoleId);
            if (roleToGive) {
              const allRewardRoleIds = Object.values(config.levelConfig.roleRewards).map(r => typeof r === 'object' ? r.roleId : r);
              for (const oldRoleId of allRewardRoleIds) {
                if (oldRoleId !== rewardRoleId && member.roles.cache.has(oldRoleId)) {
                  await member.roles.remove(oldRoleId).catch(() => {});
                }
              }

              await member.roles.add(roleToGive);
              if (targetChannel) {
                const customRewardMsg = (config.levelConfig.roleRewardMessage || '👑 ยินดีด้วยคุณ {user} ได้รับยศพิเศษ {role} เนื่องในโอกาสอัปถึง Level {level}!')
                  .replace('{user}', `<@${userId}>`)
                  .replace('{role}', `<@&${rewardRoleId}>`)
                  .replace('{level}', userStat.level);

                const embed = new EmbedBuilder()
                  .setTitle('👑 ยศรางวัลเลเวลอัปพิเศษ!')
                  .setDescription(customRewardMsg)
                  .setColor(config.levelConfig.embedColor || '#66FFFF');

                if (rewardImgUrl && rewardImgUrl.trim() !== '') {
                  const urls = rewardImgUrl.split(/,|\n/).map(s => s.trim()).filter(Boolean);
                  if (urls.length > 0) {
                    const randomImg = urls[Math.floor(Math.random() * urls.length)];
                    embed.setImage(randomImg);
                  }
                }

                targetChannel.send({ embeds: [embed] });
              }
            }
          }
        }
      } catch (err) {
        console.error('Error assigning level role reward:', err);
      }
    }

    if (targetChannel) {
      targetChannel.send({ content: customMsg }).then(msg => {
        if (!config.levelConfig.channelId && !isVoice) {
          setTimeout(() => msg.delete().catch(() => {}), 6000);
        }
      });
    }
  }

  await saveConfigs(serverConfigs);

  if (isBoosted && !isVoice && clientOrMessage.channel) {
    try {
      clientOrMessage.channel.send({ content: `⚡ <@${userId}> ได้รับ XP +${finalAmount} [XP Boost x2]` }).then(msg => {
        setTimeout(() => msg.delete().catch(() => {}), 4000);
      });
    } catch (err) {}
  }
}

function startVoiceXpCron(client, serverConfigs, saveConfigs) {
  cron.schedule('* * * * *', async () => {
    const now = Date.now();
    const boostRoleId = '1559992075095773184';
    const artistRoleId = '1560136361015513108';

    for (const guildId in serverConfigs) {
      const config = serverConfigs[guildId];
      if (!config || !config.levels) continue;

      const guild = client.guilds.cache.get(guildId);
      if (!guild) continue;

      let updated = false;

      const hasPremium = await isServerPremium(guildId, serverConfigs);
      if (hasPremium && config.levelConfig && config.levelConfig.enabled && config.levelConfig.voiceXpEnabled) {
        const xpPerMin = config.levelConfig.voiceXpAmount || 10;
        guild.channels.cache.forEach(channel => {
          if (channel.type === ChannelType.GuildVoice) {
            channel.members.forEach(member => {
              if (member.user.bot) return;
              giveXpToUser(guildId, member.user.id, xpPerMin, guild, serverConfigs, saveConfigs, true);
            });
          }
        });
      }

      for (const userId in config.levels) {
        const userStat = config.levels[userId];

        if (userStat.boostUntil && now >= userStat.boostUntil) {
          userStat.boostUntil = 0;
          try {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member && member.roles.cache.has(boostRoleId)) {
              await member.roles.remove(boostRoleId);
            }
          } catch (err) {
            console.error('Error cron removing expired boost role:', err);
          }
          updated = true;
        }

        if (userStat.artistUntil && now >= userStat.artistUntil) {
          userStat.artistUntil = 0;
          userStat.customTheme = '';
          try {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member && member.roles.cache.has(artistRoleId)) {
              await member.roles.remove(artistRoleId);
            }
          } catch (err) {
            console.error('Error cron removing expired artist role:', err);
          }
          updated = true;
        }
      }

      if (updated) {
        await saveConfigs(serverConfigs);
      }
    }
  }, { timezone: "Asia/Bangkok" });
}

function handleLeveling(message, serverConfigs, saveConfigs) {
  if (!message.guild || message.author.bot) return;

  const guildId = message.guild.id;
  if (!serverConfigs[guildId]) return;

  if (!serverConfigs[guildId].levelConfig) {
    serverConfigs[guildId].levelConfig = {
      enabled: true, minXp: 15, maxXp: 25, cmdXp: 20, xpMultiplier: 100, channelId: null,
      levelUpMessage: 'ยินดีด้วยคุณ {user}! เลเวลอัปขึ้นเป็น **Level {level}** แล้ว!',
      roleRewardMessage: '👑 ยินดีด้วยคุณ {user} ได้รับยศพิเศษ {role} เนื่องในโอกาสอัปถึง Level {level}!',
      cardTitle: '📊 𝙕𝙀𝙉 𝘽𝙊𝙏 • STATS CARD',
      cardDescription: 'การ์ดข้อมูลเลเวลของ **{user}**',
      embedColor: '#66FFFF',
      statsCardImageUrl: '',
      voiceXpEnabled: false, voiceXpAmount: 10,
      roleRewards: {}
    };
  }

  const lConfig = serverConfigs[guildId].levelConfig;
  if (!lConfig.enabled) return;

  const earnedXp = Math.floor(Math.random() * (lConfig.maxXp - lConfig.minXp + 1)) + lConfig.minXp;
  giveXpToUser(guildId, message.author.id, earnedXp, message, serverConfigs, saveConfigs, false);
}

function handleCommandLeveling(interaction, serverConfigs, saveConfigs) {
  if (!interaction.guild || interaction.user.bot) return;

  const guildId = interaction.guild.id;
  if (!serverConfigs[guildId]) return;

  const config = serverConfigs[guildId];
  if (!config.levelConfig || !config.levelConfig.enabled) return;
  if (!config.levelConfig.roleRewards) config.levelConfig.roleRewards = {};

  const cmdXp = config.levelConfig.cmdXp || 20;
  giveXpToUser(guildId, interaction.user.id, cmdXp, interaction, serverConfigs, saveConfigs, false);
}

const levelCommand = new SlashCommandBuilder()
  .setName('level')
  .setDescription('📜 เช็กเลเวลและค่าประสบการณ์ (XP)')
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
  const lConfig = config.levelConfig || { xpMultiplier: 100, cardTitle: '📊 𝙕𝙀𝙉 𝘽𝙊𝙏 • STATS CARD', cardDescription: 'การ์ดข้อมูลเลเวลของ **{user}**', embedColor: '#66FFFF', statsCardImageUrl: '' };

  const userStat = levels[userId] || { xp: 0, level: 1, customTheme: '' };
  const hasPremium = await isServerPremium(guildId, serverConfigs);

  if (hasPremium) {
    await interaction.deferReply();
    const attachment = await generateProfileCard(targetUser, userStat, lConfig);
    return await interaction.editReply({ files: [attachment] });
  } 
  
  const requiredXp = userStat.level * (lConfig.xpMultiplier || 100);
  const percentage = Math.min(Math.round((userStat.xp / requiredXp) * 10), 10);
  const progressBar = '█'.repeat(percentage) + '░'.repeat(10 - percentage);

  const finalTitle = (lConfig.cardTitle || '📊 𝙕𝙀𝙉 𝘽𝙊𝙏 • STATS CARD').replace('{user}', `<@${userId}>`);
  const finalDesc = (lConfig.cardDescription || 'การ์ดข้อมูลเลเวลของ **{user}**').replace('{user}', `<@${userId}>`);

  const embed = new EmbedBuilder()
    .setTitle(finalTitle)
    .setDescription(finalDesc)
    .setColor(lConfig.embedColor || '#66FFFF')
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: 'เลเวล (Level)', value: `\` Level ${userStat.level} \``, inline: true },
      { name: 'ค่าประสบการณ์ (XP)', value: `\` ${userStat.xp} / ${requiredXp} XP \``, inline: true },
      { name: 'ความคืบหน้า', value: `\`[${progressBar}]\` (${Math.floor((userStat.xp / requiredXp) * 100)}%)`, inline: false }
    );

  if (lConfig.statsCardImageUrl && lConfig.statsCardImageUrl.trim() !== '') {
    embed.setImage(lConfig.statsCardImageUrl.trim());
  }

  await interaction.reply({ embeds: [embed] });
}

const leaderboardCommand = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('📊 ดูอันดับผู้ที่มีเลเวลและ XP สูงสุดในเซิร์ฟเวอร์');

async function handleLeaderboardCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const config = serverConfigs[guildId] || {};
  const levels = config.levels || {};

  const sortedUsers = Object.entries(levels)
    .sort((a, b) => {
      if (b[1].level !== a[1].level) {
        return b[1].level - a[1].level;
      }
      return b[1].xp - a[1].xp;
    })
    .slice(0, 10);

  if (sortedUsers.length === 0) {
    return await interaction.reply({ content: '📊 ยังไม่มีข้อมูลการเก็บเลเวลในเซิร์ฟเวอร์นี้ครับ!', ephemeral: true });
  }

  let description = '';
  for (let i = 0; i < sortedUsers.length; i++) {
    const [userId, stat] = sortedUsers[i];
    let medal = `\`#${i + 1}\``;
    if (i === 0) medal = '🥇';
    else if (i === 1) medal = '🥈';
    else if (i === 2) medal = '🥉';

    description += `${medal} <@${userId}> ➔ Level **${stat.level}** (\`${stat.xp} XP\`)\n`;
  }

  const embed = new EmbedBuilder()
    .setTitle('🏆 LEADERBOARD • 10 อันดับสูงสุด')
    .setDescription(description)
    .setColor(config.levelConfig?.embedColor || '#66FFFF')
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

const setLevelCommand = new SlashCommandBuilder()
  .setName('set-level')
  .setDescription('⚙️ เปิดแผงควบคุมตั้งค่าเลเวลและเสียง');

function getLevelDashboardContent(config) {
  if (!config.levelConfig) {
    config.levelConfig = {
      enabled: true, minXp: 15, maxXp: 25, cmdXp: 20, xpMultiplier: 100, channelId: null,
      levelUpMessage: 'ยินดีด้วยคุณ {user}! เลเวลอัปขึ้นเป็น **Level {level}** แล้ว!',
      roleRewardMessage: '👑 ยินดีด้วยคุณ {user} ได้รับยศพิเศษ {role} เนื่องในโอกาสอัปถึง Level {level}!',
      cardTitle: '📊 𝙕𝙀𝙉 𝘽𝙊𝙏 • STATS CARD',
      cardDescription: 'การ์ดข้อมูลเลเวลของ **{user}**',
      embedColor: '#66FFFF',
      statsCardImageUrl: '',
      voiceXpEnabled: false, voiceXpAmount: 10,
      roleRewards: {}
    };
  }
  if (!config.levelConfig.roleRewards) config.levelConfig.roleRewards = {};

  const lc = config.levelConfig;
  const statusText = lc.enabled ? '✅ เปิดอยู่' : '❌ ปิดอยู่';
  const voiceStatus = lc.voiceXpEnabled ? `✅ เปิดอยู่ (${lc.voiceXpAmount} XP/นาที)` : '❌ ปิดอยู่';
  const channelName = lc.channelId ? `<#${lc.channelId}>` : 'ส่งในห้องที่พิมพ์';
  
  let rewardsList = Object.entries(lc.roleRewards)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .map(([lvl, data]) => {
      const rId = typeof data === 'object' ? data.roleId : data;
      return `Lv.${lvl} ➔ <@&${rId}>`;
    })
    .join(', ');
  if (!rewardsList) rewardsList = 'ยังไม่ได้ตั้งค่ายศรางวัล';

  const embed = new EmbedBuilder()
    .setTitle('⚙️ แผงควบคุมระบบเลเวล (Level Dashboard)')
    .setDescription('จัดการสถานะ เลือกห้องแจ้งเตือน ปรับเรต XP และตั้งค่าข้อความได้จากปุ่มด้านล่าง')
    .setColor('#5865F2')
    .addFields(
      { name: '📥 สถานะเลเวลแชท', value: statusText, inline: true },
      { name: '🎙️ ระบบ XP ห้องเสียง', value: voiceStatus, inline: true },
      { name: '📢 ห้องแจ้งเตือน', value: channelName, inline: true },
      { name: '👑 ยศรางวัลตามเลเวล', value: rewardsList, inline: false },
      { name: '📊 เรต XP (แชท / คำสั่ง)', value: `${lc.minXp}-${lc.maxXp} XP / ${lc.cmdXp} XP`, inline: true }
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('toggle_level').setLabel(lc.enabled ? 'ปิด/เปิด เลเวลแชท' : 'เปิดเลเวลแชท').setStyle(lc.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('toggle_voice_xp').setLabel(lc.voiceXpEnabled ? 'ปิด XP ห้องเสียง' : 'เปิด XP ห้องเสียง').setStyle(lc.voiceXpEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('edit_voice_amount').setLabel('ตั้งค่า XP ห้องเสียง').setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('edit_level_rate').setLabel('เรต XP').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('edit_level_card').setLabel('ตกแต่งการ์ด').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('edit_level_messages').setLabel('✉️ ตั้งค่าข้อความ').setStyle(ButtonStyle.Secondary)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('set_role_reward').setLabel('➕ ตั้งค่ายศรางวัลเลเวล').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('delete_role_reward').setLabel('🗑️ ลบยศรางวัลเลเวล').setStyle(ButtonStyle.Danger)
  );

  const channelRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder().setCustomId('select_level_channel').setPlaceholder('📂 เลือกห้องสำหรับส่งข้อความแจ้งเตือนเลเวลอัป').addChannelTypes(ChannelType.GuildText)
  );

  return { embeds: [embed], components: [row1, row2, row3, channelRow] };
}

async function handleSetLevelCommand(interaction, serverConfigs) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
  }
  const config = serverConfigs[interaction.guildId];
  await interaction.reply({ ...getLevelDashboardContent(config), ephemeral: true });
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
