const { progressEggTime } = require('./pet_hatch');

function handleLeveling(message, serverConfigs, saveConfigs) {
  if (!message.guild || message.author.bot) return;

  const guildId = message.guild.id;
  if (!serverConfigs[guildId]) serverConfigs[guildId] = { levels: {} };

  // เรียกใช้ระบบฟักไข่ / เพิ่ม XP สัตว์เลี้ยงทุกครั้งที่พิมพ์แชท
  progressEggTime(guildId, message.author.id, 60, message.client, serverConfigs, saveConfigs);

  // โค้ดระบบเลเวลปกติของคุณ (เช่น เพิ่ม XP ให้ User)
  const userStat = serverConfigs[guildId].levels[message.author.id] || { xp: 0, level: 1, orbs: 0 };
  userStat.xp += 15; // ตัวอย่างการบวก XP
  
  // บันทึกข้อมูล
  saveConfigs(serverConfigs);
}

module.exports = { handleLeveling };
