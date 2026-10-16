const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const cron = require('node-cron');
​const activeAnnouncementJobs = {};
​const setupAnnouncementCommand = new SlashCommandBuilder()
.setName('setup-announcement')
.setDescription('💎 [PREMIUM] ตั้งค่าระบบส่งประกาศข้อความอัตโนมัติประจำวัน (สำหรับ Admin)');
​async function handleSetupAnnouncementCommand(interaction, serverConfigs) {
if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
}
​const config = serverConfigs[interaction.guildId] || {};
const annConfig = config.announcement || { enabled: false, channelId: null, time: '12:00', message: '📢 ประกาศประจำวันจากทางเซิร์ฟเวอร์! อย่าลืมมาร่วมกิจกรรมกันนะครับ ✨' };
​const statusText = annConfig.enabled ? '✅ เปิดอยู่' : '❌ ปิดอยู่';
const channelName = annConfig.channelId ? <#${annConfig.channelId}> : 'ยังไม่ได้เลือกช่อง';
​const embed = new EmbedBuilder()
.setTitle('📢 แผงควบคุมระบบประกาศอัตโนมัติ (Announcement Dashboard)')
.setDescription('ตั้งเวลาและเลือกช่องสำหรับส่งข้อความประกาศอัตโนมัติประจำวันได้จากปุ่มด้านล่าง')
.setColor('#5865F2')
.addFields(
{ name: '📥 สถานะระบบ', value: statusText, inline: true },
{ name: '📢 ห้องประกาศ', value: channelName, inline: true },
{ name: '⏰ เวลาส่งประกาศ', value: \{annConfig.time} น. (Asia/Bangkok)\``, inline: true },
{ name: '📝 ข้อความปัจจุบัน', value: `\`\`\`{annConfig.message}````, inline: false }
);
​const row1 = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId('toggle_announcement')
.setLabel(annConfig.enabled ? 'ปิดระบบประกาศ' : 'เปิดระบบประกาศ')
.setStyle(annConfig.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
new ButtonBuilder()
.setCustomId('edit_announcement_msg')
.setLabel('✏️ แก้ไขข้อความประกาศ')
.setStyle(ButtonStyle.Primary),
new ButtonBuilder()
.setCustomId('edit_announcement_time')
.setLabel('⏰ ตั้งเวลา (HH:MM)')
.setStyle(ButtonStyle.Secondary)
);
​const channelRow = new ActionRowBuilder().addComponents(
new ChannelSelectMenuBuilder()
.setCustomId('select_announcement_channel')
.setPlaceholder('📂 เลือกห้องสำหรับส่งประกาศอัตโนมัติ')
.addChannelTypes(ChannelType.GuildText)
);
​await interaction.reply({ embeds: [embed], components: [row1, channelRow], ephemeral: true });
}
​// ฟังก์ชันเริ่ม Cron Job สำหรับส่งประกาศอัตโนมัติ
function startAnnouncementCron(client, serverConfigs) {
for (const guildId in serverConfigs) {
const config = serverConfigs[guildId];
if (config && config.announcement && config.announcement.enabled && config.announcement.time && config.announcement.channelId) {
setupAnnouncementCronJob(client, guildId, config.announcement.time, config.announcement.channelId, config.announcement.message);
}
}
}
​function setupAnnouncementCronJob(client, guildId, timeStr, channelId, messageText) {
const jobKey = announcement_${guildId};
if (activeAnnouncementJobs[jobKey]) {
activeAnnouncementJobs[jobKey].stop();
delete activeAnnouncementJobs[jobKey];
}
​const [hour, minute] = timeStr.split(':');
if (!hour || !minute) return;
​const cronExpression = ${minute} ${hour} * * *;
​activeAnnouncementJobs[jobKey] = cron.schedule(cronExpression, async () => {
try {
const guild = await client.guilds.fetch(guildId).catch(() => null);
if (!guild) return;
const channel = await guild.channels.fetch(channelId).catch(() => null);
if (channel && channel.isTextBased()) {
const embed = new EmbedBuilder()
.setTitle('📢 ZEN BOT • AUTOMATED ANNOUNCEMENT')
.setDescription(messageText)
.setColor('#00FF00')
.setTimestamp();
​await channel.send({ embeds: [embed] });
console.log(✅ ส่งประกาศอัตโนมัติสำเร็จในเซิร์ฟเวอร์ ${guild.name} ห้อง #${channel.name});
}
} catch (err) {
console.error(❌ เกิดข้อผิดพลาดในการส่งประกาศอัตโนมัติ (Guild: ${guildId}):, err);
}
}, { timezone: "Asia/Bangkok" });
}
​module.exports = {
setupAnnouncementCommand,
handleSetupAnnouncementCommand,
startAnnouncementCron,
setupAnnouncementCronJob
};
