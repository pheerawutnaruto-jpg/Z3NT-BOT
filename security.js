const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');

function getSecurityDashboardContent(config) {
  const sec = config.security;
  const status = sec.enabled ? '✅ เปิดใช้งาน' : '❌ ปิดใช้งาน';
  const linkStatus = sec.antiLink ? '✅ เปิด' : '❌ ปิด';
  const spamStatus = sec.antiSpam ? '✅ เปิด' : '❌ ปิด';
  const beastStatus = sec.antiMrBeast ? '✅ เปิด' : '❌ ปิด';

  const embed = new EmbedBuilder()
    .setTitle('🛡️ แผงควบคุมระบบป้องกันความปลอดภัย (Security Dashboard)')
    .setDescription('จัดการระบบป้องกันลิงก์ปลอม สแปม และบอทอันตรายได้จากปุ่มด้านล่าง')
    .setColor('#FF0000')
    .addFields(
      { name: '📥 สถานะระบบหลัก', value: status, inline: true },
      { name: '🔗 Anti-Link', value: linkStatus, inline: true },
      { name: '⚡ Anti-Spam', value: spamStatus, inline: true },
      { name: '🤖 Anti-MrBeast', value: beastStatus, inline: true },
      { name: '⚙️ ตั้งค่าสแปม', value: `${sec.spamCount} ข้อความ / ${sec.spamSeconds} วินาที (ระงับ ${sec.timeoutSeconds/1000} วิ)`, inline: false }
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sec_toggle_main').setLabel(sec.enabled ? 'ปิดระบบทั้งหมด' : 'เปิดระบบทั้งหมด').setStyle(sec.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('sec_toggle_link').setLabel('สลับ Anti-Link').setStyle(sec.antiLink ? ButtonStyle.Danger : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sec_toggle_spam').setLabel('สลับ Anti-Spam').setStyle(sec.antiSpam ? ButtonStyle.Danger : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sec_toggle_mrbeast').setLabel('สลับ Anti-MrBeast').setStyle(sec.antiMrBeast ? ButtonStyle.Danger : ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sec_config_time').setLabel('⚙️ ตั้งค่าเกณฑ์สแปมและเวลา').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('sec_reset').setLabel('🔄 รีเซ็ตค่าเริ่มต้น').setStyle(ButtonStyle.Secondary)
  );

  const channelMenu = new ChannelSelectMenuBuilder()
    .setCustomId('sec_select_ignored')
    .setPlaceholder('📂 เลือกห้องที่ไม่ต้องการให้ระบบความปลอดภัยทำงาน (ยกเว้น)')
    .setMinValues(0)
    .setMaxValues(5);

  const channelRow = new ActionRowBuilder().addComponents(channelMenu);

  return { embeds: [embed], components: [row1, row2, channelRow] };
}

function handleSecurityMessage(message, config, spamTracker) {
  if (!message.guild || message.author.bot) return false;
  if (!config || !config.security || !config.security.enabled) return false;

  const sec = config.security;
  if (sec.ignoredChannels && sec.ignoredChannels.includes(message.channel.id)) return false;
  if (message.member && message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return false;

  const content = message.content;

  // 1. ตรวจสอบ Anti-Link (ลิงก์เชิญ Discord หรือลิงก์อันตราย)
  if (sec.antiLink) {
    const inviteRegex = /(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9]+/i;
    const urlRegex = /https?:\/\/[^\s]+/i;
    if (inviteRegex.test(content) || urlRegex.test(content)) {
      message.delete().catch(() => {});
      message.channel.send({ content: `⚠️ <@${message.author.id}> ห้ามส่งลิงก์ในห้องนี้ครับ!` }).then(msg => {
        setTimeout(() => msg.delete().catch(() => {}), 4000);
      });
      return true;
    }
  }

  // 2. ตรวจสอบ Anti-MrBeast / บอทสแปมข้อความแจกเงินหลอกลวง
  if (sec.antiMrBeast) {
    const beastKeywords = ['mrbeast', 'giveaway free nitro', 'claim free nitro', 'steam gift card free'];
    const lowerContent = content.toLowerCase();
    if (beastKeywords.some(keyword => lowerContent.includes(keyword))) {
      message.delete().catch(() => {});
      message.member.timeout(sec.timeoutSeconds || 30000, 'Anti-MrBeast Auto-Timeout').catch(() => {});
      message.channel.send({ content: `🚨 ตรวจพบบอทสแปมหลอกลวง (<@${message.author.id}>) ทำการลบข้อความและระงับการใช้งานเรียบร้อย!` });
      return true;
    }
  }

  // 3. ตรวจสอบ Anti-Spam (พิมพ์รัวเกินกำหนด)
  if (sec.antiSpam) {
    const userId = message.author.id;
    const now = Date.now();
    if (!spamTracker.has(userId)) {
      spamTracker.set(userId, []);
    }
    const timestamps = spamTracker.get(userId);
    timestamps.push(now);

    const windowMs = (sec.spamSeconds || 6) * 1000;
    const recentMessages = timestamps.filter(time => now - time < windowMs);
    spamTracker.set(userId, recentMessages);

    if (recentMessages.length >= (sec.spamCount || 3)) {
      message.delete().catch(() => {});
      message.member.timeout(sec.timeoutSeconds || 30000, 'Anti-Spam Auto-Timeout').catch(() => {});
      spamTracker.set(userId, []);
      message.channel.send({ content: `⚠️ <@${userId}> คุณพิมพ์ข้อความเร็วเกินไป (สแปม) จึงถูกระงับการพิมพ์ชั่วคราว!` }).then(msg => {
        setTimeout(() => msg.delete().catch(() => {}), 5000);
      });
      return true;
    }
  }

  return false;
}

module.exports = {
  getSecurityDashboardContent,
  handleSecurityMessage
};
