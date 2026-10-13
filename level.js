const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const cron = require('node-cron');

function giveXpToUser(guildId, userId, amount, clientOrMessage, serverConfigs, saveConfigs, isVoice = false) {
  if (!serverConfigs[guildId]) return;

  const config = serverConfigs[guildId];
  if (!config.levelConfig || !config.levelConfig.enabled) return;

  if (!config.levels) config.levels = {};
  if (!config.levels[userId]) {
    config.levels[userId] = { xp: 0, level: 1 };
  }

  const userStat = config.levels[userId];
  const multiplier = config.levelConfig.xpMultiplier || 100;

  userStat.xp += amount;
  const requiredXp = userStat.level * multiplier;

  if (userStat.xp >= requiredXp) {
    userStat.xp -= requiredXp;
    userStat.level += 1;

    const customMsg = config.levelConfig.levelUpMessage
      .replace('{user}', `<@${userId}>`)
      .replace('{level}', userStat.level);

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

    if (targetChannel) {
      const embed = new EmbedBuilder()
        .setDescription(customMsg)
        .setColor(config.levelConfig.embedColor || '#66FFFF');

      if (config.levelConfig.embedImage && config.levelConfig.embedImage.trim() !== '') {
        embed.setImage(config.levelConfig.embedImage.trim());
      }

      targetChannel.send({ embeds: [embed] }).then(msg => {
        if (!config.levelConfig.channelId && !isVoice) {
          setTimeout(() => msg.delete().catch(() => {}), 6000);
        }
      });
    }
  }

  saveConfigs(serverConfigs);
}

function startVoiceXpCron(client, serverConfigs, saveConfigs) {
  cron.schedule('* * * * *', () => {
    for (const guildId in serverConfigs) {
      const config = serverConfigs[guildId];
      if (!config || !config.levelConfig || !config.levelConfig.enabled || !config.levelConfig.voiceXpEnabled) continue;

      const guild = client.guilds.cache.get(guildId);
      if (!guild) continue;

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
  }, { timezone: "Asia/Bangkok" });
}

function handleLeveling(message, serverConfigs, saveConfigs) {
  if (!message.guild || message.author.bot) return;

  const guildId = message.guild.id;
  if (!serverConfigs[guildId]) return;

  if (!serverConfigs[guildId].levelConfig) {
    serverConfigs[guildId].levelConfig = {
      enabled: true,
      minXp: 15,
      maxXp: 25,
      cmdXp: 20,
      xpMultiplier: 100,
      channelId: null,
      levelUpMessage: 'ยินดีด้วยคุณ {user}! เลเวลอัปขึ้นเป็น **Level {level}** แล้ว!',
      cardTitle: '📊 𝙕𝙀𝙉 𝘽𝙊𝙏 • STATS CARD',
      cardDescription: 'การ์ดข้อมูลเลเวลของ **{user}**',
      embedColor: '#66FFFF',
      embedImage: '',
      voiceXpEnabled: false,
      voiceXpAmount: 10
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

  const cmdXp = config.levelConfig.cmdXp || 20;
  giveXpToUser(guildId, interaction.user.id, cmdXp, interaction, serverConfigs, saveConfigs, false);
}

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
  const lConfig = config.levelConfig || { xpMultiplier: 100, cardTitle: '📊 𝙕𝙀𝙉 𝘽𝙊𝙏 • STATS CARD', cardDescription: 'การ์ดข้อมูลเลเวลของ **{user}**', embedColor: '#66FFFF' };

  const userStat = levels[userId] || { xp: 0, level: 1 };
  const requiredXp = userStat.level * lConfig.xpMultiplier;

  const percentage = Math.min(Math.round((userStat.xp / requiredXp) * 10), 10);
  const progressBar = '█'.repeat(percentage) + '░'.repeat(10 - percentage);

  const finalTitle = (lConfig.cardTitle || '📊 𝙕𝙀𝙉 𝘽𝙊𝙏 • STATS CARD').replace('{user}', `<@${userId}>`);
  const finalDesc = (lConfig.cardDescription || 'การ์ดข้อมูลเลเวลของ **{user}**').replace('{user}', `<@${userId}>`);

  // ตรวจสอบความถูกต้องของรหัสอีโมจิให้มี < > ครบถ้วน
  const embed = new EmbedBuilder()
    .setTitle(finalTitle)
    .setDescription(finalDesc)
    .setColor(lConfig.embedColor || '#66FFFF')
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: '<:emoji_41:1557174553887768727> เลเวล (Level)', value: `\` Level ${userStat.level} \``, inline: true },
      { name: '<a:emoji_87:1557232624664191048> ค่าประสบการณ์ (XP)', value: `\` ${userStat.xp} / ${requiredXp} XP \``, inline: true },
      { name: '<:emoji_77:1557189348389298258> ความคืบหน้า', value: `\`[${progressBar}]\` (${Math.floor((userStat.xp / requiredXp) * 100)}%)`, inline: false }
    );

  if (lConfig.embedImage && lConfig.embedImage.trim() !== '') {
    embed.setImage(lConfig.embedImage.trim());
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

const setLevelCommand = new SlashCommandBuilder()
  .setName('set-level')
  .setDescription('เปิดแผงควบคุมตั้งค่าระบบเลเวลและห้องเสียง');

function getLevelDashboardContent(config) {
  if (!config.levelConfig) {
    config.levelConfig = {
      enabled: true,
      minXp: 15,
      maxXp: 25,
      cmdXp: 20,
      xpMultiplier: 100,
      channelId: null,
      levelUpMessage: 'ยินดีด้วยคุณ {user}! เลเวลอัปขึ้นเป็น **Level {level}** แล้ว!',
      cardTitle: '📊 𝙕𝙀𝙉 𝘽𝙊𝙏 • STATS CARD',
      cardDescription: 'การ์ดข้อมูลเลเวลของ **{user}**',
      embedColor: '#66FFFF',
      embedImage: '',
      voiceXpEnabled: false,
      voiceXpAmount: 10
    };
  }

  const lc = config.levelConfig;
  const statusText = lc.enabled ? '✅ เปิดอยู่' : '❌ ปิดอยู่';
  const voiceStatus = lc.voiceXpEnabled ? `✅ เปิดอยู่ (${lc.voiceXpAmount} XP/นาที)` : '❌ ปิดอยู่';
  const channelName = lc.channelId ? `<#${lc.channelId}>` : 'ส่งในห้องที่พิมพ์ (ค่าเริ่มต้น)';

  const embed = new EmbedBuilder()
    .setTitle('⚙️ แผงควบคุมระบบเลเวล (Level Dashboard)')
    .setDescription('จัดการสถานะ เลือกห้องแจ้งเตือน ปรับเรต XP แชท/คำสั่ง/ห้องเสียง และตกแต่งการ์ด Level ได้จากด้านล่าง')
    .setColor('#5865F2')
    .addFields(
      { name: '📥 สถานะเลเวลแชท', value: statusText, inline: true },
      { name: '🎙️ ระบบ XP ห้องเสียง', value: voiceStatus, inline: true },
      { name: '📢 ห้องแจ้งเตือน', value: channelName, inline: true },
      { name: '📊 เรต XP (แชท / คำสั่ง)', value: `${lc.minXp}-${lc.maxXp} XP / ${lc.cmdXp} XP`, inline: true },
      { name: '💬 ข้อความเลเวลอัป', value: `\`\`\`${lc.levelUpMessage}\`\`\``, inline: false }
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('toggle_level')
      .setLabel(lc.enabled ? 'ปิด/เปิด เลเวลแชท' : 'เปิดเลเวลแชท')
      .setStyle(lc.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('toggle_voice_xp')
      .setLabel(lc.voiceXpEnabled ? 'ปิด XP ห้องเสียง' : 'เปิด XP ห้องเสียง')
      .setStyle(lc.voiceXpEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('edit_voice_amount')
      .setLabel('ตั้งค่า XP ห้องเสียง')
      .setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('edit_level_rate')
      .setLabel('ตั้งค่าเรต XP แชท/คำสั่ง')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('edit_level_card')
      .setLabel('ตกแต่งการ์ด Level')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('edit_level_msg')
      .setLabel('ข้อความเลเวลอัป')
      .setStyle(ButtonStyle.Secondary)
  );

  const channelRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('select_level_channel')
      .setPlaceholder('📂 เลือกห้องสำหรับส่งข้อความแจ้งเตือนเลเวลอัป')
      .addChannelTypes(ChannelType.GuildText)
  );

  return { embeds: [embed], components: [row1, row2, channelRow] };
}

async function handleSetLevelCommand(interaction, serverConfigs) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
  }
  const config = serverConfigs[interaction.guildId];
  await interaction.reply({ ...getLevelDashboardContent(config), ephemeral: true });
}

module.exports = { handleLeveling, handleCommandLeveling, levelCommand, handleLevelCommand, setLevelCommand, handleSetLevelCommand, getLevelDashboardContent, startVoiceXpCron };
