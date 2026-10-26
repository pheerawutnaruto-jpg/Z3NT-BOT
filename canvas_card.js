// canvas_card.js
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { AttachmentBuilder } = require('discord.js');

// 🛡️ Helper Function: วาดสี่เหลี่ยมขอบมนแบบปลอดภัย (ป้องกัน roundRect พัง)
function safeRoundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
  }
  ctx.closePath();
}

// 🛡️ Helper Function: โหลดรูปภาพแบบมี Timeout ป้องกันลิงก์เสียทำให้บอทค้าง
async function safeLoadImage(url) {
  if (!url || typeof url !== 'string' || !url.trim().startsWith('http')) return null;
  try {
    return await Promise.race([
      loadImage(url.trim()),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Image load timeout')), 5000))
    ]);
  } catch (e) {
    return null;
  }
}

// 📊 การ์ดเลเวลหลักของบอท
async function generateProfileCard(user, userStat, lConfig = {}) {
  const canvas = createCanvas(930, 280);
  const ctx = canvas.getContext('2d');

  const multiplier = Math.max(10, lConfig.xpMultiplier || 100);
  const currentXp = userStat.xp || 0;
  const currentLevel = userStat.level || 1;
  const requiredXp = currentLevel * multiplier;
  const progress = Math.min(Math.max(currentXp / requiredXp, 0), 1);
  const themeColor = lConfig.embedColor || '#66FFFF';

  // 1. พื้นหลังเริ่มต้น
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. รูปพื้นหลัง (ถ้ามี)
  const bgUrl = userStat.customTheme || lConfig.statsCardImageUrl;
  const bgImage = await safeLoadImage(bgUrl);
  if (bgImage) {
    ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
  }

  // 3. เลเยอร์กรองแสงและกรอบ
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(20, 20, canvas.width - 40, canvas.height - 40);

  ctx.strokeStyle = themeColor;
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  // 4. รูปโปรไฟล์ผู้ใช้
  const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 });
  const avatar = await safeLoadImage(avatarUrl);
  if (avatar) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(110, 140, 65, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, 45, 75, 130, 130);
    ctx.restore();
  }

  ctx.strokeStyle = themeColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(110, 140, 65, 0, Math.PI * 2, true);
  ctx.stroke();

  // 5. ข้อความและตัวเลข
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText(user.username, 210, 100);

  ctx.fillStyle = themeColor;
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`LEVEL ${currentLevel}`, canvas.width - 50, 95);

  ctx.fillStyle = '#AAAAAA';
  ctx.font = '20px sans-serif';
  ctx.fillText(`XP: ${currentXp} / ${requiredXp}`, canvas.width - 50, 130);
  ctx.textAlign = 'left';

  // 6. หลอด EXP
  const barX = 210;
  const barY = 170;
  const barWidth = 670;
  const barHeight = 30;
  const radius = 15;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  safeRoundRect(ctx, barX, barY, barWidth, barHeight, radius);
  ctx.fill();

  if (progress > 0) {
    ctx.fillStyle = themeColor;
    safeRoundRect(ctx, barX, barY, Math.max(barWidth * progress, radius * 2), barHeight, radius);
    ctx.fill();
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.floor(progress * 100)}%`, barX + (barWidth / 2), barY + 20);
  ctx.textAlign = 'left';

  return new AttachmentBuilder(await canvas.encode('png'), { name: 'profile-card.png' });
}

// 💰 การ์ดกระเป๋าเงิน (Wallet)
async function generateWalletCard(user, userStat = {}) {
  const canvas = createCanvas(930, 260);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#11111f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const bgImage = await safeLoadImage(userStat.customWalletTheme);
  if (bgImage) {
    ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
  }

  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(20, 20, canvas.width - 40, canvas.height - 40);

  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 });
  const avatar = await safeLoadImage(avatarUrl);
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

// 🚪 การ์ดต้อนรับ (Welcome Card)
async function generateWelcomeCard(member) {
  const canvas = createCanvas(930, 320);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0f0f1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(20, 20, 35, 0.85)';
  safeRoundRect(ctx, 20, 20, canvas.width - 40, canvas.height - 40, 20);
  ctx.fill();

  ctx.strokeStyle = '#66FFFF';
  ctx.lineWidth = 3;
  safeRoundRect(ctx, 20, 20, canvas.width - 40, canvas.height - 40, 20);
  ctx.stroke();

  const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
  const avatar = await safeLoadImage(avatarUrl);
  if (avatar) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(130, 160, 75, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, 55, 85, 150, 150);
    ctx.restore();
  }

    ctx.strokeStyle = '#66FFFF';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(130, 160, 75, 0, Math.PI * 2, true);
    ctx.stroke();
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

  ctx.fillStyle = 'rgba(102, 255, 255, 0.15)';
  ctx.beginPath();
  ctx.roundRect(240, 225, 280, 40, 10);
  ctx.fill();

  ctx.fillStyle = '#66FFFF';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('ZEN TH COMMUNITY', 260, 252);

  return new AttachmentBuilder(await canvas.encode('png'), { name: 'welcome-card.png' });
}

module.exports = { generateProfileCard, generateWalletCard, generateWelcomeCard };
