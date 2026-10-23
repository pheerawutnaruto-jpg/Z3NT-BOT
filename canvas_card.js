// 🐾 การ์ดสัตว์เลี้ยง Canvas (ซ้าย: เจ้าของ | กลาง: ข้อมูล & หลอด EXP | ขวา: รูปสัตว์เลี้ยง)
async function generatePetCard(user, petEgg) {
  const canvas = createCanvas(930, 280);
  const ctx = canvas.getContext('2d');

  const pet = petEgg.hatchedPet;
  const petLevel = petEgg.petLevel || 1;
  const petXp = petEgg.petXp || 0;
  const requiredXp = petLevel * 100;
  const progress = Math.min(Math.max(petXp / requiredXp, 0), 1);
  const starString = '⭐'.repeat(pet.stars);

  // พื้นหลังการ์ดโทนดาร์กแฟนตาซี
  ctx.fillStyle = '#11111f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(20, 20, canvas.width - 40, canvas.height - 40);

  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  // 1. 👤 ด้านซ้าย: รูปอวตารเจ้าของสัตว์เลี้ยง (Owner Avatar)
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

  // 2. 📊 ตรงกลาง: ข้อมูลสัตว์เลี้ยง (ชื่อ, เลเวล, และหลอด EXP)
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`PET OF ${user.username.toUpperCase()}`, 190, 75);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(pet.name, 190, 115);

  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(`${starString} (${pet.type}) • Level ${petLevel}`, 190, 145);

  // หลอด EXP ตรงกลาง
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

  // 3. 🖼️ ด้านขวา: กรอบรูปภาพอาร์ตเวิร์กประจำตัวสัตว์เลี้ยง (Pet Artwork on the right)
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

        // กรอบขอบทองล้อมรอบรูปสัตว์เลี้ยงด้านขวา
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
