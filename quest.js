const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { IMAGES, COLORS } = require('./constants');
const { isServerPremium } = require('./license');

const setupQuestCommand = new SlashCommandBuilder()
  .setName('setup-quest')
  .setDescription('💎 [PREMIUM] ส่งแผงปุ่มกดรับเควสต์ประจำวันถาวรไปยังห้องนี้ (สำหรับ Admin)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function handleSetupQuestCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
    return true;
  }

  const embed = new EmbedBuilder()
    .setTitle('<a:emoji_142:1564170617240948767> 𝙕𝙀𝙉 𝘽𝙊𝙏 • DAILY QUEST')
    .setDescription('ลุ้นรับ **`coin`** ฟรีประจำเซิร์ฟเวอร์! (`สูงสุดถึง 100 coins`)')
    .setColor(COLORS.PRIMARY)
    .setImage(IMAGES.QUEST_BANNER);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('claim_daily_orb')
      .setLabel('Daily')
      .setEmoji('<a:emoji_142:1564170617240948767>')
      .setStyle(ButtonStyle.Success)
  );

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ ส่งแผงป้ายเควสต์ประจำวันถาวรไปยังห้องนี้สำเร็จแล้ว!', ephemeral: true });
  return true;
}

async function handleQuestButton(interaction, serverConfigs, saveConfigs) {
  if (interaction.customId !== 'claim_daily_orb') return false;

  const guildId = interaction.guildId;
  if (!(await isServerPremium(guildId, serverConfigs))) {
    await interaction.reply({ content: '❌ ระบบเควสต์ประจำวันใช้งานได้เฉพาะเซิร์ฟเวอร์พรีเมียมเท่านั้นครับ!', ephemeral: true });
    return true;
  }

  await interaction.deferReply({ ephemeral: true }).catch(() => {});

  const userId = interaction.user.id;

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].levels) serverConfigs[guildId].levels = {};
  if (!serverConfigs[guildId].levels[userId]) {
    serverConfigs[guildId].levels[userId] = {
      xp: 0, level: 1, orbs: 0, lastDaily: 0,
      boostUntil: 0, artistUntil: 0, cinemaPermUntil: 0, cinemaTempUntil: 0,
      customTheme: '', customWalletTheme: ''
    };
  }

  const userStat = serverConfigs[guildId].levels[userId];
  const now = Date.now();
  const cooldownTime = 19 * 60 * 60 * 1000;

  if (userStat.lastDaily && (now - userStat.lastDaily < cooldownTime)) {
    const remainingMs = cooldownTime - (now - userStat.lastDaily);
    const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
    const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    await interaction.editReply({ content: `⏳ คุณรับไปแล้ว!\n กลับมาอีกครั้งใน **${remainingHours} h ${remainingMinutes} min.**` });
    return true;
  }

  const isLuckyHalf = Math.random() < 0.5;
  const rewardCoins = isLuckyHalf
    ? Math.floor(Math.random() * (100 - 50 + 1)) + 50
    : Math.floor(Math.random() * 21);

  userStat.orbs = (userStat.orbs || 0) + rewardCoins;
  userStat.lastDaily = now;
  await saveConfigs(serverConfigs);

  if (rewardCoins === 0) {
    await interaction.editReply({ content: '<a:kitty:1563350578375950496> น่าเสียดาย! พรุ่งนี้เอาใหม่นะ!' });
  } else {
    await interaction.editReply({ 
      content: `<a:emoji_142:1564170617240948767> **ผลการสุ่มกาชาปอง:** คุณได้รับ **+${rewardCoins} coins** 🎉\n\`Wallet : ${userStat.orbs.toLocaleString()} coins\`` 
    });
  }

  return true;
}

module.exports = {
  setupQuestCommand,
  handleSetupQuestCommand,
  handleQuestButton
};
