const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const cron = require('node-cron');

const CINEMA_ROLE_ID = '1551183125076508713';

const setupCinemaCommand = new SlashCommandBuilder()
  .setName('cinema-setup')
  .setDescription('🎬 [CINEMA] ส่งแผงป้ายจุดจำหน่ายตั๋วโรงภาพยนตร์ (สำหรับ Admin)')
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('เลือกห้องสำหรับส่งแผงตั๋วภาพยนตร์')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  );

const cinemaBroadcastCommand = new SlashCommandBuilder()
  .setName('cinema-broadcast')
  .setDescription('🎥 [CINEMA] ประกาศรอบฉายภาพยนตร์ (Now Showing)')
  .addStringOption(option =>
    option.setName('title')
      .setDescription('ชื่อภาพยนตร์หรือรอบฉาย (เช่น Shang Chi)')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('time')
      .setDescription('เวลาฉาย (เช่น 20:00 น. หรือ วันนี้ 21:00)')
      .setRequired(true)
  )
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('เลือกห้องสำหรับส่งประกาศรอบฉาย')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  );

const cinemaScheduleCommand = new SlashCommandBuilder()
  .setName('cinema-schedule')
  .setDescription('⏰ [CINEMA] ตั้งเวลาประกาศรอบฉายอัตโนมัติ (สำหรับ Admin)')
  .addStringOption(option =>
    option.setName('time_str')
      .setDescription('ระบุเวลาในรูปแบบ HH:MM เช่น 18:00 (เวลาไทย)')
      .setRequired(true)
  )
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('เลือกห้องฉายประกาศอัตโนมัติ')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  );

async function handleSetupCinemaCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle('🎟️ 𝙕𝙀𝙉 𝘾𝙄𝙉𝙀𝙈𝘼𝙎 • BOX OFFICE')
    .setDescription(
      '✨ จุดจำหน่ายตั๋วเข้าชมภาพยนตร์อย่างเป็นทางการของ Zen Cinemas\n\n' +
      '📌 **สิทธิประโยชน์การจองตั๋ว:**\n' +
      '• รับยศ <@&' + CINEMA_ROLE_ID + '> เพื่อรับการแจ้งเตือนรอบฉายก่อนใคร\n' +
      '• สิทธิ์เข้าร่วมรับชมภาพยนตร์ในห้องเสียงพิเศษ\n\n' +
      '*คลิกปุ่มด้านล่างเพื่อจองตั๋วและรับยศเข้าชมทันที*'
    )
    .setColor('#E50914')
    .setImage('https://cdn.discordapp.com/attachments/1559878908348997774/1560429202589876295/1792105154505.jpg')
    .setFooter({ text: '🎬 Zen Cinemas • Box Office' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('cinema_buy_ticket')
      .setLabel('🎟️ จองตั๋วเข้าชม')
      .setStyle(ButtonStyle.Danger)
  );

  const channel = interaction.options.getChannel('channel');
  await channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: `✅ ส่งแผงป้าย Box Office ไปยังห้อง <#${channel.id}> สำเร็จแล้วครับ!`, ephemeral: true });
}

async function handleCinemaBroadcastCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
  }

  const title = interaction.options.getString('title');
  const time = interaction.options.getString('time');
  const channel = interaction.options.getChannel('channel');

  const embed = new EmbedBuilder()
    .setTitle('🍿 𝙕𝙀𝙉 𝘾𝙄𝙉𝙀𝙈𝘼𝙎 • NOW SHOWING')
    .setDescription(
      `🎬 **ภาพยนตร์:** ${title}\n` +
      `⏰ **เวลาฉาย:** ${time}`
    )
    .setColor('#E50914')
    .setImage('https://cdn.discordapp.com/attachments/1559878908348997774/1560429202589876295/1792105154505.jpg')
    .setFooter({ text: '🎬 Zen Cinemas • Now Showing' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('cinema_buy_ticket')
      .setLabel('🎟️ จองตั๋วเข้าชม')
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({ 
    content: `<@&${CINEMA_ROLE_ID}> 📢 **ประกาศรอบฉายภาพยนตร์ใหม่มาแล้ว เชิญเข้าโรงได้เลย!**`, 
    embeds: [embed], 
    components: [row] 
  });

  await interaction.reply({ content: `✅ ส่งประกาศรอบฉายไปยังห้อง <#${channel.id}> เรียบร้อยแล้วครับ!`, ephemeral: true });
}

async function handleCinemaButton(interaction) {
  if (interaction.customId !== 'cinema_buy_ticket') return false;

  const member = interaction.member;
  const roleId = CINEMA_ROLE_ID;

  if (member.roles.cache.has(roleId)) {
    return await interaction.reply({ content: '🎟️ คุณมีตั๋วและได้รับยศ <@&' + roleId + '> สำหรับเข้าชมภาพยนตร์อยู่แล้วครับ!', ephemeral: true });
  }

  try {
    await member.roles.add(roleId);
    await interaction.reply({ content: '🎉 **จองตั๋วสำเร็จ!** ระบบได้มอบยศ <@&' + roleId + '> ให้คุณเรียบร้อยแล้ว เตรียมตัวพบกันในรอบฉายได้เลยครับ!', ephemeral: true });
  } catch (err) {
    console.error('Error assigning cinema role:', err);
    await interaction.reply({ content: '❌ เกิดข้อผิดพลาดในการมอบยศ กรุณาติดต่อแอดมินเซิร์ฟเวอร์ครับ', ephemeral: true });
  }

  return true;
}

function loadCinemaCronJobs(client, serverConfigs) {
  for (const guildId in serverConfigs) {
    const config = serverConfigs[guildId];
    if (config && config.cinemaSchedule && config.cinemaSchedule.enabled) {
      // โหลดระบบตั้งเวลาอัตโนมัติ
    }
  }
}

module.exports = {
  setupCinemaCommand,
  cinemaBroadcastCommand,
  cinemaScheduleCommand,
  handleSetupCinemaCommand,
  handleCinemaBroadcastCommand,
  handleCinemaButton,
  loadCinemaCronJobs
};
