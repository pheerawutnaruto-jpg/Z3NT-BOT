const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

// 1. ฟังก์ชันแจก XP และส่งข้อความเลเวลอัปไปยังห้องที่ตั้งค่าไว้ (หรือห้องปัจจุบัน)
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
      channelId: null, // ห้องสำหรับแจ้งเตือนเลเวลอัป (ถ้าไม่เลือก จะส่งห้องที่พิมพ์)
      levelUpMessage: '🎉 ยินดีด้วยคุณ {user}! เลเวลอัปขึ้นเป็น **Level {level}** แล้ว! 🚀',
      embedColor: '#66FFFF',
      embedImage: ''
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

    // เลือกห้องส่งข้อความ (ถ้าตั้งค่าห้องไว้ จะส่งไปห้องนั้น ถ้าไม่ได้ตั้งจะส่งห้องที่พิมพ์)
    let targetChannel = message.channel;
    if (lConfig.channelId) {
      const fetchedChannel = message.guild.channels.cache.get(lConfig.channelId);
      if (fetchedChannel) targetChannel = fetchedChannel;
    }

    // สร้าง Embed แจ้งเตือนเลเวลอัปที่ตกแต่งได้
    const embed = new EmbedBuilder()
      .setDescription(customMsg)
      .setColor(lConfig.embedColor || '#66FFFF');

    if (lConfig.embedImage && lConfig.embedImage.trim() !== '') {
      embed.setImage(lConfig.embedImage.trim());
    }

    targetChannel.send({ embeds: [embed] })
      .then(msg => {
        // ถ้าส่งในห้องทั่วไป ตั้งเวลาลบได้ (แต่ถ้าเป็นห้องเฉพาะปล่อยไว้ก็ได้)
        if (!lConfig.channelId) {
          setTimeout(() => msg.delete().catch(() => {}), 6000);
        }
      });
  }

  saveConfigs(serverConfigs);
}

// 2. คำสั่งเช็กเลเวล (/level)
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

  const percentage = Math.min(Math.round((userStat.xp / requiredXp) * 10), 10);
  const progressBar = '█'.repeat(percentage) + '░'.repeat(10 - percentage);

  const embed = new EmbedBuilder()
    .setTitle(`📊 𝙕𝙀𝙉 𝘽𝙊𝙏 • STATS CARD`)
    .setDescription(`การ์ดข้อมูลเลเวลของ **${targetUser.username}**`)
    .setColor(lConfig.embedColor || '#66FFFF')
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: '✨ เลเวล (Level)', value: `\` Level ${userStat.level} \``, inline: true },
      { name: '🌟 ค่าประสบการณ์ (XP)', value: `\` ${userStat.xp} / ${requiredXp} XP \``, inline: true },
      { name: '📈 ความคืบหน้า', value: `\`[${progressBar}]\` (${Math.floor((userStat.xp / requiredXp) * 100)}%)`, inline: false }
    );

  if (lConfig.embedImage && lConfig.embedImage.trim() !== '') {
    embed.setImage(lConfig.embedImage.trim());
  }

  embed.setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
       .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// 3. แผงควบคุมตั้งค่าระบบเลเวล (/set-level) พร้อมปุ่มเลือกห้องและตกแต่ง
const setLevelCommand = new SlashCommandBuilder()
  .setName('set-level')
  .setDescription('เปิดแผงควบคุมตั้งค่าระบบเลเวลและเลือกห้องแจ้งเตือน');

function getLevelDashboardContent(config) {
  if (!config.levelConfig) {
    config.levelConfig = {
      enabled: true,
      minXp: 15,
      maxXp: 25,
      xpMultiplier: 100,
      channelId: null,
      levelUpMessage: '🎉 ยินดีด้วยคุณ {user}! เลเวลอัปขึ้นเป็น **Level {level}** แล้ว! 🚀',
      embedColor: '#66FFFF',
      embedImage: ''
    };
  }

  const lc = config.levelConfig;
  const statusText = lc.enabled ? '✅ เปิดอยู่' : '❌ ปิดอยู่';
  const channelName = lc.channelId ? `<#${lc.channelId}>` : 'ส่งในห้องที่พิมพ์ (ค่าเริ่มต้น)';

  const embed = new EmbedBuilder()
    .setTitle('⚙️ แผงควบคุมระบบเลเวล (Level Dashboard)')
    .setDescription('ตั้งค่าสถานะ เลือกห้องแจ้งเตือน ปรับเรต XP และตกแต่ง Embed เลเวลอัปได้จากด้านล่าง')
    .setColor('#5865F2')
    .addFields(
      { name: '📥 สถานะระบบเลเวล', value: statusText, inline: true },
      { name: '📢 ห้องแจ้งเตือน', value: channelName, inline: true },
      { name: '📊 เรต XP ต่อข้อความ', value: `${lc.minXp} -${lc.maxXp} XP`, inline: true },
      { name: '📈 ตัวคูณเลเวลอัป', value: `${lc.xpMultiplier} XP`, inline: true },
      { name: '🎨 สี / รูปภาพ Embed', value: `Color: \`${lc.embedColor}\` | Image: ${lc.embedImage ? 'มีรูปภาพ' : 'ไม่มี'}`, inline: false },
      { name: '💬 ข้อความแจ้งเตือน', value: `\`\`\`${lc.levelUpMessage}\`\`\``, inline: false }
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('toggle_level')
      .setLabel(lc.enabled ? 'ปิดระบบเลเวล' : 'เปิดระบบเลเวล')
      .setStyle(lc.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('edit_level_rate')
      .setLabel('ตั้งค่าเรต XP')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('edit_level_embed')
      .setLabel('ตกแต่ง Embed/ข้อความ')
      .setStyle(ButtonStyle.Secondary)
  );

  const channelRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('select_level_channel')
      .setPlaceholder('📂 เลือกห้องสำหรับส่งข้อความแจ้งเตือนเลเวลอัป')
      .addChannelTypes(ChannelType.GuildText)
  );

  return { embeds: [embed], components: [row1, channelRow] };
}

async function handleSetLevelCommand(interaction, serverConfigs) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
  }
  const config = serverConfigs[interaction.guildId];
  await interaction.reply({ ...getLevelDashboardContent(config), ephemeral: true });
}

module.exports = { handleLeveling, levelCommand, handleLevelCommand, setLevelCommand, handleSetLevelCommand, getLevelDashboardContent };
