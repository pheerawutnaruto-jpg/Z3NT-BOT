const { progressEggTime } = require('./pet_hatch');

function handleLeveling(message, serverConfigs, saveConfigs) {
  if (!message.guild || message.author.bot) return;

  const guildId = message.guild.id;
  if (!serverConfigs[guildId]) serverConfigs[guildId] = { levels: {} };

  // เรียกเช็กเวลาฟักไข่และเพิ่ม Pet XP ทุกครั้งที่พิมพ์แชท
  progressEggTime(guildId, message.author.id, 60, message.client, serverConfigs, saveConfigs);

  // ระบบเลเวลสมาชิกปกติ
  if (!serverConfigs[guildId].levels[message.author.id]) {
    serverConfigs[guildId].levels[message.author.id] = { xp: 0, level: 1, orbs: 0 };
  }
  const userStat = serverConfigs[guildId].levels[message.author.id];
  userStat.xp += 15;

  saveConfigs(serverConfigs);
}

module.exports = { handleLeveling };
