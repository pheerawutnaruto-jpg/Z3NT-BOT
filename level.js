// ⏱️ ระบบตรวจสอบและถอดยศ Boost อัตโนมัติทุก 1 นาทีเมื่อหมดเวลา
function startBoostExpiryCron(client, serverConfigs, saveConfigs) {
  cron.schedule('* * * * *', async () => {
    const now = Date.now();
    for (const guildId in serverConfigs) {
      const config = serverConfigs[guildId];
      if (!config || !config.levels) continue;

      const guild = client.guilds.cache.get(guildId);
      if (!guild) continue;

      // ค้นหา ID ยศ Boost จาก shop.js หรือกำหนดตายตัวไว้เช็ก
      // (แนะนำให้เช็กสมาชิกที่หมดเวลา boostUntil แต่ยังมียศอยู่)
      for (const userId in config.levels) {
        const userStat = config.levels[userId];
        if (userStat.boostUntil && userStat.boostUntil <= now) {
          userStat.boostUntil = 0; // เคลียร์เวลา
          await saveConfigs(serverConfigs);

          try {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member) {
              // สมมติ ID ยศ Boost ของคุณ (แทนที่ด้วย ID ยศจริง หรือดึงจาก config)
              const boostRoleId = 'ใส่_ID_ยศ_XP_Boost_ในเซิร์ฟเวอร์_ตรงนี้'; 
              if (member.roles.cache.has(boostRoleId)) {
                await member.roles.remove(boostRoleId);
              }
            }
          } catch (err) {
            console.error('Error removing expired boost role:', err);
          }
        }
      }
    }
  }, { timezone: "Asia/Bangkok" });
}
