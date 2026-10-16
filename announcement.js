const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const cron = require('node-cron');

const announcementCommand = new SlashCommandBuilder()
  .setName('setup-announcement')
  .setDescription('🎬 [PREMIUM] ตั้งค่าระบบประกาศสไตล์โรงภาพยนตร์สุดอลังการ (สำหรับ Admin)')
  .addStringOption(option => 
    option.setName('interval')
      .setDescription('เลือกความถี่ในการฉายประกาศ')
      .setRequired(true)
      .addChoices(
        { name: 'ทุกๆ 1 ชั่วโมง', value: '0 * * * *' },
        { name: 'ทุกๆ 6 ชั่วโมง', value: '0 */6 * * *' },
        { name: 'ทุกวัน เวลา 12:00 น. (รอบบ่าย)', value: '0 12 * * *' },
        { name: 'ทุกวัน เวลา 18:00 น. (รอบค่ำ)', value: '0 18 * * *' }
      )
  )
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('เลือกห้องโรงภาพยนตร์สำหรับฉายประกาศ')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  );

async function handleSetupAnnouncementCommand(interaction, serverConfigs, saveConfigs, activeCronJobs, client) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
  }

  const guildId = interaction.guildId;
  const cronExpr = interaction.options.getString('interval');
  const channel = interaction.options.getChannel('channel');

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  serverConfigs[guildId].announcement = {
    enabled: true,
    cronExpr: cronExpr,
    channelId: channel.id
  };

  await saveConfigs(serverConfigs);
  setupAnnouncementCron(guildId, cronExpr, channel.id, client, serverConfigs);

  const embed = new EmbedBuilder()
    .setTitle('🎟️ CINEMA ANNOUNCEMENT SETUP')
    .setDescription(`✅ ตั้งค่าระบบประกาศสไตล์โรงภาพยนตร์สำเร็จ!\n📌 **โรงภาพยนตร์ (ห้อง):** <#${channel.id}>\n⏰ **รอบการฉาย:** ตามกำหนดเวลาเรียบร้อยแล้ว`)
    .setColor('#E50914')
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

let activeAnnouncementCrons = {};

function setupAnnouncementCron(guildId, cronExpr, channelId, client, serverConfigs) {
  if (activeAnnouncementCrons[guildId]) {
    activeAnnouncementCrons[guildId].stop();
    delete activeAnnouncementCrons[guildId];
  }

  activeAnnouncementCrons[guildId] = cron.schedule(cronExpr, async () => {
    try {
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return;
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) return;

      const config = serverConfigs[guildId];
      if (!config || !config.announcement || !config.announcement.enabled) return;

      const embed = new EmbedBuilder()
        .setTitle('🍿 𝙕𝙀𝙉 𝘾𝙄𝙉𝙀𝙈𝘼𝙎 • NOW SHOWING & COMMUNITY BULLETIN')
        .setDescription(
          '✨ **ยินดีต้อนรับสู่โรงภาพยนตร์ Zen Cinemas! โปรดตรวจดูรอบฉายและสิทธิประโยชน์ประจำวันของคุณ:**\n\n' +
          '🎥 **FEATURED ATTRACTIONS:**\n' +
          '• 🪙 **สุ่มเหรียญประจำวัน:** แวะไปที่ห้องเควสต์แล้วกดรับ Zen Coins ฟรีทุก 24 ชั่วโมง!\n' +
          '• 🛒 **บ็อกซ์ออฟฟิศพรีเมียม:** ตรวจสอบสินค้าและยศถาวรได้ที่ `/shop`\n' +
          '• 🎙️ **โซนพูดคุย & แชท:** สะสม XP เลเวลพุ่งกระฉูดทั้งพิมพ์แชทและเข้าห้องเสียง!\n\n' +
          '🎟️ *ขอให้ทุกท่านเพลิดเพลินไปกับการรับชมและใช้เวลาในคอมมูนิตี้ของเราครับ!*'
        )
        .setColor('#FFD700')
        .setImage('https://cdn.discordapp.com/attachments/1559878908348997774/1560429202589876295/1792105154505.jpg')
        .setFooter({ text: '🎬 Zen Cinemas • Enjoy The Show!' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('🎟️ เปิดตู้ขายตั๋ว (/shop)')
          .setStyle(ButtonStyle.Link)
          .setURL('https://discord.com')
      );

      await channel.send({ content: '@everyone 📢 **ไฟในโรงภาพยนตร์หรี่ลงแล้ว! มีประกาศรอบฉายใหม่มาเสิร์ฟครับ!**', embeds: [embed], components: [row] });
    } catch (err) {
      console.error(`❌ Error sending cinema announcement for guild ${guildId}:`, err);
    }
  }, { timezone: "Asia/Bangkok" });
}

function loadAllAnnouncementCrons(client, serverConfigs) {
  for (const guildId in serverConfigs) {
    const config = serverConfigs[guildId];
    if (config && config.announcement && config.announcement.enabled && config.announcement.cronExpr && config.announcement.channelId) {
      setupAnnouncementCron(guildId, config.announcement.cronExpr, config.announcement.channelId, client, serverConfigs);
    }
  }
}

module.exports = {
  announcementCommand,
  handleSetupAnnouncementCommand,
  loadAllAnnouncementCrons
};
