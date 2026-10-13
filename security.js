const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');

// 1. ฟังก์ชันสร้างหน้าตาแดชบอร์ดความปลอดภัย
function getSecurityDashboardContent(config) {
  const sec = config.security;
  let ignoredTags = 'ไม่มีห้องยกเว้น (ดูแลทุกห้อง)';
  if (sec.ignoredChannels && sec.ignoredChannels.length > 0) {
    ignoredTags = sec.ignoredChannels.map(id => `<#${id}>`).join(', ');
  }

  const act = sec.actions;
  const formatAct = (a) => `[${a.timeout ? '✓' : '✗'} Timeout] [${a.kick ? '✓' : '✗'} Kick] [${a.ban ? '✓' : '✗'} Ban]`;

  const embed = new EmbedBuilder()
    .setTitle('⚙️ ตั้งค่าระบบกันสแปมและความปลอดภัย')
    .setDescription('จัดการระบบป้องกันภัยคุกคาม กำหนดบทลงโทษผ่านดรอปดาวน์ และเลือกห้องยกเว้นได้จากด้านล่าง')
    .setColor('#66FFFF')
    .addFields(
      { name: 'สถานะ', value: sec.enabled ? 'เปิด' : 'ปิด', inline: true },
      { name: 'ลบลิงก์เชิญ', value: sec.antiLink ? 'เปิด' : 'ปิด', inline: true },
      { name: 'ลบข้อความสแปม', value: sec.antiSpam ? 'เปิด' : 'ปิด', inline: true },
      { name: 'ลบสแปม MrBeast', value: sec.antiMrBeast ? 'เปิด' : 'ปิด', inline: true },
      { name: 'สแปม', value: `${sec.spamCount} ข้อความ / ${sec.spamSeconds} วินาที`, inline: true },
      { name: 'ระงับผู้ใช้', value: `${sec.timeoutSeconds} วินาที`, inline: true },
      { name: 'Invite Actions', value: formatAct(act.invite), inline: false },
      { name: 'Spam Actions', value: formatAct(act.spam), inline: false },
      { name: 'ห้องยกเว้น (ไม่ต้องดูแล)', value: ignoredTags, inline: false }
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sec_toggle_main').setLabel(sec.enabled ? 'เปิดระบบ' : 'ปิดระบบ').setStyle(sec.enabled ? ButtonStyle.Success : ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('sec_toggle_link').setLabel(`ลิงก์: ${sec.antiLink ? 'เปิด' : 'ปิด'}`).setStyle(sec.antiLink ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sec_toggle_spam').setLabel(`สแปม: ${sec.antiSpam ? 'เปิด' : 'ปิด'}`).setStyle(sec.antiSpam ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sec_toggle_mrbeast').setLabel(`MrBeast: ${sec.antiMrBeast ? 'เปิด' : 'ปิด'}`).setStyle(sec.antiMrBeast ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sec_config_time').setLabel('ตั้งเวลา').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('sec_reset').setLabel('รีเซ็ตทั้งหมด').setStyle(ButtonStyle.Danger)
  );

  const rowInviteSelect = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('act_invite_select')
      .setPlaceholder('⚙️ เลือก Action สำหรับ Invite Link (เลือกหลายอันได้)')
      .setMinValues(0)
      .setMaxValues(3)
      .addOptions([
        { label: 'Timeout (ระงับการพิมพ์)', value: 'timeout' },
        { label: 'Kick (เตะออกจากเซิร์ฟเวอร์)', value: 'kick' },
        { label: 'Ban (แบนถาวร)', value: 'ban' }
      ])
  );

  const rowSpamSelect = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('act_spam_select')
      .setPlaceholder('⚙️ เลือก Action สำหรับ Spam (เลือกหลายอันได้)')
      .setMinValues(0)
      .setMaxValues(3)
      .addOptions([
        { label: 'Timeout (ระงับการพิมพ์)', value: 'timeout' },
        { label: 'Kick (เตะออกจากเซิร์ฟเวอร์)', value: 'kick' },
        { label: 'Ban (แบนถาวร)', value: 'ban' }
      ])
  );

  const rowChannel = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('sec_select_ignored')
      .setPlaceholder('📂 เลือกห้องที่ไม่ต้องดูแล (ห้องยกเว้น)')
      .setMinValues(0)
      .setMaxValues(5)
      .addChannelTypes(ChannelType.GuildText)
  );

  return { embeds: [embed], components: [row1, row2, rowInviteSelect, rowSpamSelect, rowChannel] };
}

// 2. ฟังก์ชันประเมินบทลงโทษ
async function executeActions(member, actionConfig, timeoutSec) {
  if (!member || !actionConfig) return;
  try {
    if (actionConfig.timeout) {
      await member.timeout(timeoutSec * 1000, 'Security Violation').catch(() => {});
    }
    if (actionConfig.kick) {
      if (member.kickable) await member.kick('Security Violation').catch(() => {});
    }
    if (actionConfig.ban) {
      if (member.bannable) await member.ban({ reason: 'Security Violation' }).catch(() => {});
    }
  } catch (e) { console.error('Execution error:', e); }
}

// 3. ฟังก์ชันตรวจสอบข้อความ (Anti-Link, Anti-Spam, Anti-MrBeast)
function handleSecurityMessage(message, config, spamTracker) {
  if (!message.guild || message.author.bot) return false;
  if (!config || !config.security || !config.security.enabled) return false;

  if (config.security.ignoredChannels && config.security.ignoredChannels.includes(message.channel.id)) {
    return false;
  }

  if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return false;
  const sec = config.security;

  // Anti-Link
  if (sec.antiLink) {
    const linkRegex = /(https?:\/\/[^\s]+)/gi;
    if (linkRegex.test(message.content)) {
      message.delete().catch(() => {});
      executeActions(message.member, sec.actions?.invite, sec.timeoutSeconds || 3000);
      message.channel.send(`⚠️ <@${message.author.id}> ตรวจพบลิงก์ห้ามส่งในห้องนี้!`).then(msg => {
        setTimeout(() => msg.delete().catch(() => {}), 4000);
      });
      return true;
    }
  }

  // Anti-MrBeast
  if (sec.antiMrBeast) {
    const scamKeywords = ['mrbeast', 'free nitro', 'claim free', 'nitro generator'];
    const contentLower = message.content.toLowerCase();
    if (scamKeywords.some(kw => contentLower.includes(kw))) {
      message.delete().catch(() => {});
      executeActions(message.member, sec.actions?.mrbeast, sec.timeoutSeconds || 3000);
      message.channel.send(`⚠️ <@${message.author.id}> ตรวจพบสแปมอันตราย (MrBeast/Scam)!`).then(msg => {
        setTimeout(() => msg.delete().catch(() => {}), 4000);
      });
      return true;
    }
  }

  // Anti-Spam
  if (sec.antiSpam) {
    const userId = message.author.id;
    const now = Date.now();
    const limitSec = sec.spamSeconds || 6;
    const maxMsg = sec.spamCount || 3;

    let userSpam = spamTracker.get(userId) || { count: 0, startTime: now };
    if (now - userSpam.startTime < limitSec * 1000) {
      userSpam.count++;
      if (userSpam.count > maxMsg) {
        message.delete().catch(() => {});
        executeActions(message.member, sec.actions?.spam, sec.timeoutSeconds || 3000);
        message.channel.send(`⚠️ <@${userId}> ส่งข้อความเร็วเกินกำหนด (Anti-Spam)`).then(msg => {
          setTimeout(() => msg.delete().catch(() => {}), 4000);
        });
        spamTracker.set(userId, { count: 0, startTime: now });
        return true;
      }
    } else {
      userSpam.count = 1;
      userSpam.startTime = now;
    }
    spamTracker.set(userId, spamTracker.set(userId, userSpam) ? userSpam : userSpam);
  }
  return false;
}

module.exports = { getSecurityDashboardContent, handleSecurityMessage };
