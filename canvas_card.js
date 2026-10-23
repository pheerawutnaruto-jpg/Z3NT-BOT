const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { AttachmentBuilder } = require('discord.js');

async function generateProfileCard(user, userStat, lConfig) {
  const canvas = createCanvas(930, 280);
  const ctx = canvas.getContext('2d');

  const multiplier = Math.max(10, lConfig.xpMultiplier || 100);
  const currentXp = userStat.xp || 0;
  const currentLevel = userStat.level || 1;
  const requiredXp = currentLevel * multiplier;
  const progress = Math.min(Math.max(currentXp / requiredXp, 0), 1);

  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let bgUrl = userStat.customTheme || lConfig.statsCardImageUrl;
  if (bgUrl && bgUrl.trim() !== '') {
    try {
      const bgImage = await loadImage(bgUrl.trim()).catch(() => null);
      if (bgImage) ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
    } catch (e) {}
  }

  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(20, 20, canvas.width - 40, canvas.height - 40);

  ctx.strokeStyle = lConfig.embedColor || '#66FFFF';
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 });
  try {
    const avatar = await loadImage(avatarUrl).catch(() => null);
    if (avatar) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(110, 140, 65, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, 45, 75, 130, 130);
      ctx.restore();
    }
    ctx.strokeStyle = lConfig.embedColor || '#66FFFF';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(110, 140, 65, 0, Math.PI * 2, true);
    ctx.stroke();
  } catch (e) {}

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText(user.username, 210, 100);

  ctx.fillStyle = lConfig.embedColor || '#66FFFF';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`LEVEL ${currentLevel}`, canvas.width - 50, 95);

  ctx.fillStyle = '#AAAAAA';
  ctx.font = '20px sans-serif';
  ctx.fillText(`XP: ${currentXp} / ${requiredXp}`, canvas.width - 50, 130);
  ctx.textAlign = 'left';

  const barX = 210, barY = 170, barWidth = 670, barHeight = 30, radius = 15;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barWidth, barHeight, radius);
  ctx.fill();

  if (progress > 0) {
    ctx.fillStyle = lConfig.embedColor || '#66FFFF';
    ctx.beginPath();
    ctx.roundRect(barX, barY, Math.max(barWidth * progress, radius * 2), barHeight, radius);
    ctx.fill();
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.floor(progress * 100)}%`, barX + (barWidth / 2), barY + 20);

  return new AttachmentBuilder(await canvas.encode('png'), { name: 'profile-card.png' });
}

async function generateWalletCard(user, userStat) {
  const canvas = createCanvas(930, 260);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#11111f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let bgUrl = userStat.customWalletTheme;
  if (bgUrl && bgUrl.trim() !== '') {
    try {
      const bgImage = await loadImage(bgUrl.trim()).catch(() => null);
      if (bgImage) ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
    } catch (e) {}
  }

  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(20, 20, canvas.width - 40, canvas.height - 40);

  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 });
  try {
    const avatar = await loadImage(avatarUrl).catch(() => null);
    if (avatar) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(110, 130, 55, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, 55, 75, 110, 110);
      ctx.restore();
    }
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(110, 130, 55, 0, Math.PI * 2, true);
    ctx.stroke();
  } catch (e) {}

  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('ZEN BOT • OFFICIAL WALLET', 200, 75);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(user.username, 200, 125);

  ctx.fillStyle = '#AAAAAA';
  ctx.font = '20px sans-serif';
  ctx.fillText('ZEN COINS BALANCE:', 200, 175);

  const coins = userStat.orbs || 0;
  ctx.fillStyle = '#00FF66';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText(`${coins.toLocaleString()} COINS`, 470, 178);

  return new AttachmentBuilder(await canvas.encode('png'), { name: 'wallet-card.png' });
}

// 🐾 การ์ดสัตว์เลี้ยง Canvas (ซ้าย: อวตารเจ้าของ | กลาง: ข้อมูล & หลอด EXP | ขวา: รูปสัตว์เลี้ยง)
async function generatePetCard(user, petEgg) {
  const canvas = createCanvas(930, 280);
  const ctx = canvas.getContext('2d');

  const pet = petEgg.hatchedPet;
  const petLevel = petEgg.petLevel || 1;
  const petXp = petEgg.petXp || 0;
  const requiredXp = petLevel * 100;
  const progress = Math.min(Math.max(petXp / requiredXp, 0), 1);
  const starString = '⭐'.repeat(pet.stars);

  ctx.fillStyle = '#11111f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(20, 20, canvas.width - 40, canvas.height - 40);

  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  // 1. 👤 ด้านซ้าย: อวตารเจ้าของสัตว์เลี้ยง
  const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 });
  try {
    const avatar = await loadImage(avatarUrl).catch(() => null);
    if (avatar) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(110, 140, 55, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, 55, 85, 110, 110);
      ctx.restore();
    }
    ctx.strokeStyle = '#66FFFF';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(110, 140, 55, 0, Math.PI * 2, true);
    ctx.stroke();
  } catch (e) {}

  // 2. 📊 ตรงกลาง: ข้อมูลสัตว์เลี้ยงและหลอด EXP
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`PET OF ${user.username.toUpperCase()}`, 190, 75);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(pet.name, 190, 115);

  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(`${starString} (${pet.type}) • Level ${petLevel}`, 190, 145);

  const barX = 190;
  const barY = 175;
  const barWidth = 470;
  const barHeight = 24;
  const radius = 12;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barWidth, barHeight, radius);
  ctx.fill();

  if (progress > 0) {
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.roundRect(barX, barY, Math.max(barWidth * progress, radius * 2), barHeight, radius);
    ctx.fill();
  }

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`EXP: ${petXp} / ${requiredXp} (${Math.floor(progress * 100)}%)`, barX + (barWidth / 2), barY + 17);
  ctx.textAlign = 'left';

  // 3. 🖼️ ด้านขวา: รูปภาพสัตว์เลี้ยง
  if (pet.image) {
    try {
      const petImg = await loadImage(pet.image).catch(() => null);
      if (petImg) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(690, 45, 195, 190, 12);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(petImg, 690, 45, 195, 190);
        ctx.restore();

        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(690, 45, 195, 190, 12);
        ctx.stroke();
      }
    } catch (e) {}
  }

  return new AttachmentBuilder(await canvas.encode('png'), { name: 'pet-card.png' });
}

async function generateWelcomeCard(member) {
  const canvas = createCanvas(930, 320);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0f0f1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(20, 20, 35, 0.85)';
  ctx.beginPath();
  ctx.roundRect(20, 20, canvas.width - 40, canvas.height - 40, 20);
  ctx.fill();

  ctx.strokeStyle = '#66FFFF';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(20, 20, canvas.width - 40, canvas.height - 40, 20);
  ctx.stroke();

  const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
  try {
    const avatar = await loadImage(avatarUrl).catch(() => null);
    if (avatar) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(130, 160, 75, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, 55, 85, 150, 150);
      ctx.restore();
    }
  } catch (e) {}

  ctx.fillStyle = '#66FFFF';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('WELCOME TO THE SERVER', 240, 105);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 38px sans-serif';
  ctx.fillText(member.user.username, 240, 155);

  ctx.fillStyle = '#AAAAAA';
  ctx.font = '22px sans-serif';
  ctx.fillText(`Member #${member.guild.memberCount} • Enjoy your stay!`, 240, 205);

  return new AttachmentBuilder(await canvas.encode('png'), { name: 'welcome-card.png' });
}

module.exports = { generateProfileCard, generateWalletCard, generatePetCard, generateWelcomeCard };
