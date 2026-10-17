const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
​const zGenShopCommand = new SlashCommandBuilder()
.setName('zgen-shop')
.setDescription('💎 [Z GEN] ร้านค้าแลกของรางวัลพิเศษสำหรับสมาชิกยศ Z Gen (ใช้แต้มสะสม)');
​const zGenPointsCommand = new SlashCommandBuilder()
.setName('zgen-points')
.setDescription('💎 [Z GEN] เช็กยอดแต้มสะสม Z Gen และสถานะสิทธิประโยชน์ของคุณ');
​// รายการของรางวัลใน Z Gen Shop
const ZGEN_REWARDS = [
{
id: 'zreward_xp',
name: '⚡ บัฟคูณ XP 2 เท่า (3 ชม.)',
cost: 5,
type: 'xp_boost',
roleId: '1559992075095773184',
description: '• ใช้ 5 แต้ม • แลกน้ำยาคูณ XP 2 เท่า นาน 3 ชั่วโมง'
},
{
id: 'zreward_artist',
name: '🎨 บัตรปลดล็อกเปลี่ยนการ์ด /level',
cost: 3,
type: 'artist_temp',
roleId: '1560136361015513108',
description: '• ใช้ 3 แต้ม • แลกสิทธิ์อัปโหลดรูปการ์ดเลเวลส่วนตัว นาน 3 วัน'
},
{
id: 'zreward_gacha',
name: '🎁 กล่องสุ่มกาชาปองพิเศษ (Super Gacha)',
cost: 2,
type: 'super_gacha',
description: '• ใช้ 2 แต้ม • ลุ้นรับ Zen Coins จำนวนมาก (การันตีไม่มีเกลือ!)'
},
{
id: 'zreward_ticket',
name: '🎟️ ต่ออายุตั๋ว Z Gen ฟรี (1 เดือน)',
cost: 15,
type: 'zgen_ticket_renew',
roleId: 'Z_GEN_ROLE_ID', // แทนที่ด้วย ID ยศ Z Gen ของเซิร์ฟเวอร์
description: '• ใช้ 15 แต้ม • แลกรับตั๋ว Z Gen ฟรี 1 เดือนเต็ม'
}
];
​async function handleZGenPointsCommand(interaction, serverConfigs) {
const guildId = interaction.guildId;
const userId = interaction.user.id;
const config = serverConfigs[guildId] || {};
const userStat = config.levels?.[userId] || {};
​const points = userStat.zGenPoints || 0;
const totalCoinsSpent = userStat.totalSpentForPoints || 0;
​const embed = new EmbedBuilder()
.setTitle('💎 Z GEN • ยอดแต้มสะสมของคุณ')
.setDescription(
สมาชิก: <@${userId}>\n\n +
⭐ **แต้มสะสมปัจจุบัน:** \{points} แต้ม\`\n` +
`💰 **ยอดสะสมการใช้จ่าย:** \`{totalCoinsSpent} Zen Coins` (ทุกๆ 50 coins = 1 แต้ม)\n\n+ '📌 *ใช้คำสั่ง/zgen-shop` เพื่อนำแต้มไปแลกของรางวัลพิเศษได้เลยครับ!*'
)
.setColor('#FFD700')
.setTimestamp();
​await interaction.reply({ embeds: [embed], ephemeral: true });
}
​async function handleZGenShopCommand(interaction, serverConfigs) {
const guildId = interaction.guildId;
const userId = interaction.user.id;
const config = serverConfigs[guildId] || {};
const userStat = config.levels?.[userId] || {};
const userPoints = userStat.zGenPoints || 0;
​// ตรวจสอบยศ Z Gen (สมมติเช็กว่ามีแต้มหรือยศ)
const zGenRoleId = '1551183125076508713'; // ปรับตาม ID ยศ Z Gen จริง
const hasZGenRole = interaction.member.roles.cache.has(zGenRoleId);
​if (!hasZGenRole && userPoints === 0) {
return await interaction.reply({ content: '❌ เฉพาะสมาชิกยศ Z Gen หรือผู้ที่มีแต้มสะสมเท่านั้นที่จะสามารถเปิดใช้งานร้านค้านี้ได้ครับ!', ephemeral: true });
}
​const embed = new EmbedBuilder()
.setTitle('🛍️ Z GEN REWARD SHOP')
.setDescription(
⭐ **แต้มสะสมของคุณ:** \${userPoints} แต้ม`\n\n` +
'เลือกแลกของรางวัลสุดพิเศษประจำยศ Z Gen จากรายการด้านล่างนี้ได้เลยครับ:\n──────────────────────'
)
.setColor('#FFD700');
​ZGEN_REWARDS.forEach(item => {
embed.addFields({
name: ${item.name} ➔ \{item.cost} แต้ม\``,
value: `{item.description}\n──────────────────────`,
inline: false
});
});
​const row = new ActionRowBuilder();
ZGEN_REWARDS.forEach(item => {
row.addComponents(
new ButtonBuilder()
.setCustomId(buy_zreward_${item.id})
.setLabel(item.name.split(' (')[0].replace(/[^ก-ฮa-zA-Z0-9\s]/g, '').trim())
.setEmoji('⭐')
.setStyle(ButtonStyle.Primary)
);
});
​await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}
​async function handleZGenShopButton(interaction, serverConfigs, saveConfigs) {
if (!interaction.customId.startsWith('buy_zreward_')) return false;
​const guildId = interaction.guildId;
const userId = interaction.user.id;
const rewardId = interaction.customId.replace('buy_zreward_', '');
const reward = ZGEN_REWARDS.find(r => r.id === rewardId);
if (!reward) return true;
​if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
if (!serverConfigs[guildId].levels) serverConfigs[guildId].levels = {};
if (!serverConfigs[guildId].levels[userId]) {
serverConfigs[guildId].levels[userId] = { xp: 0, level: 1, orbs: 0, zGenPoints: 0, totalSpentForPoints: 0 };
}
​const userStat = serverConfigs[guildId].levels[userId];
const userPoints = userStat.zGenPoints || 0;
​if (userPoints < reward.cost) {
return await interaction.reply({ content: ❌ แต้มสะสมของคุณไม่พอ! (ต้องการ ${reward.cost} แต้ม แต่คุณมี ${userPoints} แต้ม), ephemeral: true });
}
​// หักแต้ม
userStat.zGenPoints -= reward.cost;
const now = Date.now();
​if (reward.type === 'xp_boost') {
const threeHours = 3 * 60 * 60 * 1000;
userStat.boostUntil = (userStat.boostUntil && userStat.boostUntil > now ? userStat.boostUntil : now) + threeHours;
await saveConfigs(serverConfigs);
​try {
const member = await interaction.guild.members.fetch(userId);
const role = await interaction.guild.roles.fetch(reward.roleId);
if (role) await member.roles.add(role);
} catch (e) {}
​await interaction.reply({ content: 🎉 แลกสำเร็จ! คุณได้รับสิทธิ์คูณ XP 2 เท่า นาน 3 ชั่วโมงเต็ม! (คงเหลือ ${userStat.zGenPoints} แต้ม), ephemeral: true });
return true;
}
​if (reward.type === 'artist_temp') {
const threeDays = 3 * 24 * 60 * 60 * 1000;
userStat.artistUntil = (userStat.artistUntil && userStat.artistUntil > now ? userStat.artistUntil : now) + threeDays;
await saveConfigs(serverConfigs);
​try {
const member = await interaction.guild.members.fetch(userId);
const role = await interaction.guild.roles.fetch(reward.roleId);
if (role) await member.roles.add(role);
} catch (e) {}
​await interaction.reply({ content: 🎉 แลกสำเร็จ! คุณได้รับสิทธิ์แต่งการ์ด /level ส่วนตัว นาน 3 วันเต็ม! (คงเหลือ ${userStat.zGenPoints} แต้ม), ephemeral: true });
return true;
}
​if (reward.type === 'super_gacha') {
// การันตีไม่มีเกลือ สุ่มเฉพาะ Zen Coins จำนวนสูง (เช่น 20 ถึง 100 coins)
const rewardCoins = Math.floor(Math.random() * (100 - 20 + 1)) + 20;
userStat.orbs = (userStat.orbs || 0) + rewardCoins;
await saveConfigs(serverConfigs);
​await interaction.reply({ content: 🎁 **ผลการสุ่ม Super Gacha (Z Gen Exclusive):**\n🎉 แจ็กพอต! คุณได้รับ **${rewardCoins} Zen Coins** เข้ากระเป๋าโดยไม่มีเกลือ! (ยอดเหรียญรวม: ${userStat.orbs} Coins | คงเหลือ ${userStat.zGenPoints} แต้ม), ephemeral: true });
return true;
}
​if (reward.type === 'zgen_ticket_renew') {
try {
const member = await interaction.guild.members.fetch(userId);
const zGenRoleId = '1551183125076508713';
await member.roles.add(zGenRoleId);
} catch (e) {}
​await saveConfigs(serverConfigs);
await interaction.reply({ content: 🎉 แลกสำเร็จ! ระบบได้ต่ออายุยศ Z Gen ให้คุณฟรี 1 เดือนเต็ม! (คงเหลือ ${userStat.zGenPoints} แต้ม), ephemeral: true });
return true;
}
​return true;
}
​// ฟังก์ชันช่วยคำนวนแต้มอัตโนมัติทุกครั้งที่มีการใช้จ่าย Zen Coins (ทุก 50 coins = 1 แต้ม)
function addZGenPointsSpent(userStat, spentCoins) {
if (!userStat.totalSpentForPoints) userStat.totalSpentForPoints = 0;
if (!userStat.zGenPoints) userStat.zGenPoints = 0;
​userStat.totalSpentForPoints += spentCoins;
​// คำนวณแต้มใหม่จากยอดสะสมการใช้จ่ายทุกๆ 50 coins
const calculatedPoints = Math.floor(userStat.totalSpentForPoints / 50);
const earnedNewPoints = calculatedPoints - (userStat._lastCalculatedPoints || 0);
​if (earnedNewPoints > 0) {
userStat.zGenPoints += earnedNewPoints;
userStat._lastCalculatedPoints = calculatedPoints;
}
}
​module.exports = {
zGenShopCommand,
zGenPointsCommand,
handleZGenPointsCommand,
handleZGenShopCommand,
handleZGenShopButton,
addZGenPointsSpent
};
