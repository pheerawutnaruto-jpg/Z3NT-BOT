const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { AttachmentBuilder } = require('discord.js');

async function generateProfileCard(user, userStat, lConfig) {
  const canvas = createCanvas(930, 280);
  const ctx = canvas.getContext('2d');

  const multiplier = lConfig.xpMultiplier || 100;
  const currentXp = userStat.xp || 0;
  const currentLevel = userStat.level || 1;
  const requiredXp = currentLevel * multiplier;
  const progress = Math.min(Math.max(currentXp / requiredXp, 0), 1);

  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let bgUrl = userStat.customTheme || lConfig.statsCardImageUrl;
  if (bgUrl && bgUrl.trim() !== '') {
    try {
      const bgImage = await loadImage(bgUrl.trim());
      ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
    } catch (e) {
      console.error('Failed to load custom background image:', e);
    }
  }

  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(20, 20, canvas.width - 40, canvas.height - 40);

  ctx.strokeStyle = lConfig.embedColor || '#66FFFF';
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 });
  try {
    const avatar = await loadImage(avatarUrl);
    ctx.save();
    ctx.beginPath();
    ctx.arc(110, 140, 65, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, 45, 75, 130, 130);
    ctx.restore();

    ctx.strokeStyle = lConfig.embedColor || '#66FFFF';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(110, 140, 65, 0, Math.PI * 2, true);
    ctx.stroke();
  } catch (e) {
    console.error('Failed to load user avatar:', e);
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText(user.username, 210, 100);

  ctx.fillStyle = lConfig.embedColor || '#66FFFF';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`LEVEL ${currentLevel}`, canvas.width - 50, 95);

  ctx.fillStyle = '#AAAAAA';
  ctx.font = '20px sans-serif';
  ctx.fillText(`XP: ${currentXp} /${requiredXp}`, canvas.width - 50, 130);
  ctx.textAlign = 'left';

  const barX = 210;
  const barY = 170;
  const barWidth = 670;
  const barHeight = 30;
  const radius = 15;

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
  ctx.textAlign = 'left';

  return new AttachmentBuilder(await canvas.encode('png'), { name: 'profile-card.png' });
}

// 💰 ฟังก์ชันสร้างการ์ดกระเป๋าเงิน Wallet Canvas
async function generateWalletCard(user, userStat) {
  const canvas = createCanvas(930, 260);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#11111f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let bgUrl = userStat.customWalletTheme;
  if (bgUrl && bgUrl.trim() !== '') {
    try {
      const bgImage = await loadImage(bgUrl.trim());
      ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
    } catch (e) {
      console.error('Failed to load wallet background:', e);
    }
  }

  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(20, 20, canvas.width - 40, canvas.height - 40);

  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 });
  try {
    const avatar = await loadImage(avatarUrl);
    ctx.save();
    ctx.beginPath();
    ctx.arc(110, 130, 55, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, 55, 75, 110, 110);
    ctx.restore();

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

async function generateWelcomeCard(member) {
  const canvas = createCanvas(930, 320);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0f0f1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const zenBotBgUrl = 'https://cdn.discordapp.com/attachments/1550576199829430382/1559721017583337512/1791877721245.jpg';
  try {
    const zenImage = await loadImage(zenBotBgUrl);
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.drawImage(zenImage, canvas.width - 400, 0, 400, canvas.height);
    ctx.restore();
  } catch (e) {}

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
    const avatar = await loadImage(avatarUrl);
    ctx.save();
    ctx.beginPath();
    ctx.arc(130, 160, 75, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, 55, 85, 150, 150);
    ctx.restore();

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
