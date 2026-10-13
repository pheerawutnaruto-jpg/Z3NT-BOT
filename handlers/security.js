const { PermissionFlagsBits } = require('discord.js');
const spamTracker = new Map();

async function handleMessageSecurity(message, serverConfigs) {
  if (!message.guild || message.author.bot) return;

  const guildId = message.guild.id;
  const config = serverConfigs[guildId];
  if (!config || !config.security || !config.security.enabled) return;

  if (config.security.ignoredChannels && config.security.ignoredChannels.includes(message.channel.id)) {
    return;
  }

  if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return;
  const sec = config.security;

  if (sec.antiLink) {
    const linkRegex = /(https?:\/\/[^\s]+)/gi;
    if (linkRegex.test(message.content)) {
      try {
        await message.delete();
        await executeActions(message.member, sec.actions?.invite, sec.timeoutSeconds || 3000);
        const warning = await message.channel.send(`⚠️ <@${message.author.id}> ตรวจพบลิงก์ห้ามส่งในห้องนี้!`);
        setTimeout(() => warning.delete().catch(() => {}), 4000);
        return;
      } catch (err) { console.error(err); }
    }
  }

  if (sec.antiMrBeast) {
    const scamKeywords = ['mrbeast', 'free nitro', 'claim free', 'nitro generator'];
    const contentLower = message.content.toLowerCase();
    if (scamKeywords.some(kw => contentLower.includes(kw))) {
      try {
        await message.delete();
        await executeActions(message.member, sec.actions?.mrbeast, sec.timeoutSeconds || 3000);
        const warning = await message.channel.send(`⚠️ <@${message.author.id}> ตรวจพบสแปมอันตราย (MrBeast/Scam)!`);
        setTimeout(() => warning.delete().catch(() => {}), 4000);
        return;
      } catch (err) { console.error(err); }
    }
  }

  if (sec.antiSpam) {
    const userId = message.author.id;
    const now = Date.now();
    const limitSec = sec.spamSeconds || 6;
    const maxMsg = sec.spamCount || 3;

    let userSpam = spamTracker.get(userId) || { count: 0, startTime: now };
    if (now - userSpam.startTime < limitSec * 1000) {
      userSpam.count++;
      if (userSpam.count > maxMsg) {
        try {
          await message.delete();
          await executeActions(message.member, sec.actions?.spam, sec.timeoutSeconds || 3000);
          const warning = await message.channel.send(`⚠️ <@${userId}> ส่งข้อความเร็วเกินกำหนด (Anti-Spam)`);
          setTimeout(() => warning.delete().catch(() => {}), 4000);
          spamTracker.set(userId, { count: 0, startTime: now });
          return;
        } catch (err) { console.error(err); }
      }
    } else {
      userSpam.count = 1;
      userSpam.startTime = now;
    }
    spamTracker.set(userId, userSpam);
  }
}

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

module.exports = { handleMessageSecurity };
