const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');

function getSecurityDashboardContent(config) {
  const sec = config.security;
  const status = sec.enabled ? '✅ เปิดใช้งาน' : '❌ ปิดใช้งาน';
  const linkStatus = sec.antiLink ? '✅ เปิด' : '❌ ปิด';
  const spamStatus = sec.antiSpam ? '✅ เปิด' : '❌ ปิด';
  const beastStatus = sec.antiMrBeast ? '✅ เปิด' : '❌ ปิด';

  const timeoutSecDisplay = sec.timeoutSeconds >= 1000 ? Math.floor(sec.timeoutSeconds / 1000) : (sec.timeoutSeconds || 60);

  const formatActions = (act) => {
    if (!act) return 'Timeout';
    const list = [];
    if (act.timeout) list.push('Timeout');
    if (act.kick) list.push('Kick');
    if (act.ban) list.push('Ban');
    return list.length > 0 ? list.join(' + ') : 'ลบข้อความอย่างเดียว';
  };

  const embed = new EmbedBuilder()
    .setTitle('🛡️ แผงควบคุมระบบป้องกันความปลอดภัย (Security Dashboard)')
    .setDescription('จัดการระบบป้องกันลิงก์ปลอม สแปม และบอทอันตรายได้จากปุ่มด้านล่าง')
    .setColor('#FF0000')
    .addFields(
      { name: '📥 สถานะระบบหลัก', value: status, inline: true },
      { name: '🔗 Anti-Link', value: `${linkStatus} (${formatActions(sec.actions?.invite)})`, inline: true },
      { name: '⚡ Anti-Spam', value: `${spamStatus} (${formatActions(sec.actions?.spam)})`, inline: true },
      { name: '🤖 Anti-MrBeast', value: beastStatus, inline: true },
      { name: '⚙️ ตั้งค่าสแปม', value: `${sec.spamCount} ข้อความ / ${sec.spamSeconds} วินาที (ระงับ ${timeoutSecDisplay} วินาที)`, inline: false }
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

  const inviteActionMenu = new StringSelectMenuBuilder()
    .setCustomId('act_invite_select')
    .setPlaceholder('🔗 เลือกบทลงโทษ Anti-Link (เลือกได้หลายข้อ)')
    .setMinValues(0)
    .setMaxValues(3)
    .addOptions([
      { label: 'ระงับการพิมพ์ (Timeout)', value: 'timeout', emoji: '⏳' },
      { label: 'เตะออกจากเซิร์ฟเวอร์ (Kick)', value: 'kick', emoji: '👢' },
      { label: 'แบนถาวร (Ban)', value: 'ban', emoji: '🔨' }
    ]);

  const spamActionMenu = new StringSelectMenuBuilder()
    .setCustomId('act_spam_select')
    .setPlaceholder('⚡ เลือกบทลงโทษ Anti-Spam (เลือกได้หลายข้อ)')
    .setMinValues(0)
    .setMaxValues(3)
    .addOptions([
      { label: 'ระงับการพิมพ์ (Timeout)', value: 'timeout', emoji: '⏳' },
      { label: 'เตะออกจากเซิร์ฟเวอร์ (Kick)', value: 'kick', emoji: '👢' },
      { label: 'แบนถาวร (Ban)', value: 'ban', emoji: '🔨' }
    ]);

  const channelMenu = new ChannelSelectMenuBuilder()
    .setCustomId('sec_select_ignored')
    .setPlaceholder('📂 เลือกห้องที่ไม่ต้องการให้ระบบความปลอดภัยทำงาน (ยกเว้น)')
    .setMinValues(0)
    .setMaxValues(5);

  return {
    embeds: [embed],
    components: [
      row1,
      row2,
      new ActionRowBuilder().addComponents(inviteActionMenu),
      new ActionRowBuilder().addComponents(spamActionMenu),
      new ActionRowBuilder().addComponents(channelMenu)
    ]
  };
}

async function applyPunishment(member, actionConfig, timeoutMs, reason) {
  if (!member) return;
  try {
    if (actionConfig?.ban && member.bannable) {
      await member.ban({ reason });
    } else if (actionConfig?.kick && member.kickable) {
      await member.kick(reason);
    } else if (actionConfig?.timeout && member.moderatable) {
      await member.timeout(timeoutMs, reason);
    }
  } catch (err) {
    console.error(`Error applying security punishment (${reason}):`, err);
  }
}

async function handleSecurityMessage(message, config, spamTracker) {
  if (!message.guild || message.author.bot) return false;
  if (!config || !config.security || !config.security.enabled) return false;

  const sec = config.security;
  if (sec.ignoredChannels && sec.ignoredChannels.includes(message.channel.id)) return false;
  if (message.member && message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return false;

  const content = message.content;
  const rawTimeout = sec.timeoutSeconds || 60;
  const timeoutMs = rawTimeout >= 1000 ? rawTimeout : rawTimeout * 1000;

  // 1. ตรวจสอบ Anti-Link
  if (sec.antiLink) {
    const inviteRegex = /(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9]+/i;
    const urlRegex = /https?:\/\/[^\s]+/i;
    if (inviteRegex.test(content) || urlRegex.test(content)) {
      await message.delete().catch(() => {});
      await applyPunishment(message.member, sec.actions?.invite, timeoutMs, 'Anti-Link Protection');
      message.channel.send({ content: `⚠️ <@${message.author.id}> ห้ามส่งลิงก์ในห้องนี้ครับ!` }).then(msg => {
        setTimeout(() => msg.delete().catch(() => {}), 4000);
      }).catch(() => {});
      return true;
    }
  }

  // 2. ตรวจสอบ Anti-MrBeast
  if (sec.antiMrBeast) {
    const beastKeywords = ['mrbeast', 'giveaway free nitro', 'claim free nitro', 'steam gift card free'];
    const lowerContent = content.toLowerCase();
    if (beastKeywords.some(keyword => lowerContent.includes(keyword))) {
      await message.delete().catch(() => {});
      await applyPunishment(message.member, sec.actions?.mrbeast || { timeout: true }, timeoutMs, 'Anti-MrBeast Auto-Punish');
      await message.channel.send({ content: `🚨 ตรวจพบบอทสแปมหลอกลวง (<@${message.author.id}>) ทำการลบข้อความและลงโทษเรียบร้อย!` }).catch(() => {});
      return true;
    }
  }

  // 3. ตรวจสอบ Anti-Spam
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
      await message.delete().catch(() => {});
      spamTracker.set(userId, []);
      await applyPunishment(message.member, sec.actions?.spam || { timeout: true }, timeoutMs, 'Anti-Spam Auto-Punish');
      message.channel.send({ content: `⚠️ <@${userId}> คุณพิมพ์ข้อความเร็วเกินไป (สแปม) จึงถูกลงโทษตามกฎของเซิร์ฟเวอร์!` }).then(msg => {
        setTimeout(() => msg.delete().catch(() => {}), 5000);
      }).catch(() => {});
      return true;
    }
  }

  return false;
}

module.exports = {
  getSecurityDashboardContent,
  handleSecurityMessage
};
