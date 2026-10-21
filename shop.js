// --- แทนที่คำสั่ง boostStatusCommand เดิมด้วยอันนี้ ---
const myStatusCommand = new SlashCommandBuilder( )
  .setName('my-status')
  .setDescription('💎 [PREMIUM] เช็กสถานะและเวลาคงเหลือของยศเช่าและบัฟทั้งหมดของคุณ');

async function handleMyStatusCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const config = serverConfigs[guildId] || {};
  const userStat = config.levels?.[userId];
  const now = Date.now();

  if (!userStat) {
    return await interaction.reply({ content: '❌ คุณยังไม่มีประวัติการใช้งานหรือเปิดใช้งานยศเช่า/บัฟใดๆ ครับ!', ephemeral: true });
  }

  // 1. เช็กสถานะ XP Booster
  let boostText = '❌ ยังไม่ได้เปิดใช้งาน';
  if (userStat.boostUntil && userStat.boostUntil > now) {
    const remainingMins = Math.ceil((userStat.boostUntil - now) / (1000 * 60));
    boostText = `⚡ เปิดใช้งานอยู่ (คงเหลือเวลาประมาณ ${remainingMins} นาที)`;
  }

  // 2. เช็กสถานะ Artist | 3d (เช่า 3 วัน)
  let artistText = '❌ ไม่มีสิทธิ์ใช้งาน';
  if (userStat.artistUntil && userStat.artistUntil > now) {
    const remainingDays = Math.ceil((userStat.artistUntil - now) / (1000 * 60 * 60 * 24));
    const expiryDate = new Date(userStat.artistUntil).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
    artistText = `🎨 Artist | 3d (คงเหลือ ${remainingDays} วัน)\n📅 หมดอายุวันที่: ${expiryDate}`;
  }

  // 3. เช็กสถานะตั๋วภาพยนตร์ 21 วัน
  let cinemaPermText = '❌ ไม่มีตั๋วใช้งาน';
  if (userStat.cinemaPermUntil && userStat.cinemaPermUntil > now) {
    const expiryDate = new Date(userStat.cinemaPermUntil).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
    cinemaPermText = `🎫 ตั๋วหนัง 21 วัน (ระยะยาว)\n📅 หมดอายุวันที่: ${expiryDate}`;
  }

  // 4. เช็กสถานะตั๋วภาพยนตร์ 1 วัน
  let cinemaTempText = '❌ ไม่มีตั๋วใช้งาน';
  if (userStat.cinemaTempUntil && userStat.cinemaTempUntil > now) {
    const expiryDate = new Date(userStat.cinemaTempUntil).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
    cinemaTempText = `🎟️ ตั๋วหนัง 1 วัน (รายวัน)\n📅 หมดอายุวันที่: ${expiryDate}`;
  }

  const embed = new EmbedBuilder()
    .setTitle('⏳ MY STATUS • สถานะยศเช่าและบัฟของคุณ')
    .setDescription(`ตรวจสอบระยะเวลาคงเหลือของยศเช่าและแพ็กเกจพิเศษทั้งหมดของ <@${userId}>:\n──────────────────────`)
    .setColor('#00FFFF')
    .addFields(
      { name: '⚡ สถานะ XP Booster (x2)', value: boostText, inline: false },
      { name: '🎨 สถานะยศ Artist เช่า', value: artistText, inline: false },
      { name: '🎫 สถานะตั๋วภาพยนตร์ 21 วัน', value: cinemaPermText, inline: false },
      { name: '🎟️ สถานะตั๋วภาพยนตร์ 1 วัน', value: cinemaTempText, inline: false }
    )
    .setTimestamp()
    .setFooter({ text: 'Zen Bot Status System' });

  await interaction.reply({ embeds: [embed], ephemeral: true });
  return true;
}

// อย่าลืมอัปเดต module.exports ด้านล่างสุดของไฟล์ shop.js ให้ส่งออก myStatusCommand และ handleMyStatusCommand แทนตัวเก่าด้วยครับ
