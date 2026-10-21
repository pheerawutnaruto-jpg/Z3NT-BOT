const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
​const setupOrderTicketCommand = new SlashCommandBuilder()
.setName('setup-order-ticket')
.setDescription('💎 [PREMIUM] ส่งแผงร้านค้าแบบมีเมนูกดเลือกสินค้าและสร้างห้องออร์เดอร์ (สำหรับ Admin)');
​async function handleSetupOrderTicketCommand(interaction) {
if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
return true;
}
​const embed = new EmbedBuilder()
.setTitle('<a:emoji_93:1560403772025344101> 𝙕𝙀𝙉 𝘽𝙊𝙏 • SELECT STORE')
.setDescription('ศูนย์รวมการสั่งซื้อยศถาวรและแพ็กเกจพิเศษผ่านเมนูดรอปดาวน์ สะดวก รวดเร็ว และเป็นส่วนตัว\n\n📌 วิธีใช้งาน: เลือกรายการสินค้าที่ต้องการจากกล่องตัวเลือกด้านล่างได้ทันที')
.setColor('#00FF00')
.setImage('https://cdn.discordapp.com/attachments/1559878908348997774/1560429202589876295/1792105154505.jpg');
​const selectMenu = new StringSelectMenuBuilder()
.setCustomId('select_product_order')
.setPlaceholder('🛒 เลือกสินค้าที่ต้องการสั่งซื้อ')
.addOptions([
{
label: 'BOT PREMIUM (รายเดือน)',
description: 'สต็อกไม่จำกัด • ฿399.00 / 1 เดือน • ยศ: Bot Premium',
value: 'product_bot_premium',
emoji: '💎'
},
{
label: 'ยศ Artist ถาวร',
description: 'สต็อกไม่จำกัด • ฿69.00 / ถาวร • สิทธิ์แต่งการ์ดส่วนตัว',
value: 'product_artist_role',
emoji: '🎨'
},
{
label: 'ยศพิเศษ สายชิลล์ ถาวร',
description: 'สต็อกไม่จำกัด • ฿19.00 / ถาวร • ยศโปรไฟล์สุดชิลล์',
value: 'product_chilling_role',
emoji: '☕'
},
{
label: 'ยศพิเศษ คนนอนดึก ถาวร',
description: 'สต็อกไม่จำกัด • ฿9.00 / ถาวร • ยศโปรไฟล์สายโต้รุ่ง',
value: 'product_nightowl_role',
emoji: '🌙'
},
{
label: 'ล้างตัวเลือก',
description: 'เคลียร์ค่าตัวเลือกให้กลับมาเป็นค่าเริ่มต้น',
value: 'clear_selection',
emoji: '❌'
}
]);
​const row = new ActionRowBuilder().addComponents(selectMenu);
​await interaction.channel.send({ embeds: [embed], components: [row] });
await interaction.reply({ content: '✅ ส่งแผงร้านค้าแบบเลือกสินค้าไปยังห้องนี้สำเร็จแล้ว!', ephemeral: true });
return true;
}
​// 🧾 ฟังก์ชันส่งใบเสร็จรับเงิน (Order Receipt)
async function sendOrderReceipt(channel, user, productName, productPrice, paymentMethod = 'PromptPay QR') {
const receiptEmbed = new EmbedBuilder()
.setTitle('🧾 ZEN BOT • OFFICIAL ORDER RECEIPT')
.setDescription('ใบเสร็จรับเงินยืนยันการทำรายการสำเร็จ ขอบคุณที่ใช้บริการครับ!')
.setColor('#00FF00')
.addFields(
{ name: '👤 ผู้สั่งซื้อ', value: <@${user.id}>, inline: true },
{ name: '🛒 สินค้า', value: productName, inline: true },
{ name: '💰 ยอดชำระ', value: \${productPrice}``, inline: true },
{ name: '💳 ช่องทางชำระ', value: paymentMethod, inline: true },
{ name: '👑 สถานะ', value: '✅ ตรวจสอบสลิปและมอบสินค้าเรียบร้อย', inline: true },
{ name: '📅 วันที่ทำรายการ', value: new Date().toLocaleString('th-TH'), inline: false }
)
.setTimestamp()
.setFooter({ text: 'Zen Bot Secure Transaction', iconURL: user.displayAvatarURL() });
​await channel.send({ embeds: [receiptEmbed] });
}
​async function handleOrderTicketSelect(interaction, serverConfigs) {
if (interaction.customId !== 'select_product_order') return false;
​const selectedValue = interaction.values[0];
​if (selectedValue === 'clear_selection') {
const embed = new EmbedBuilder()
.setTitle('<a:emoji_93:1560403772025344101> 𝙕𝙀𝙉 𝘽𝙊𝙏 • SELECT STORE')
.setDescription('ศูนย์รวมการสั่งซื้อยศถาวรและแพ็กเกจพิเศษผ่านเมนูดรอปดาวน์ สะดวก รวดเร็ว และเป็นส่วนตัว\n\n📌 วิธีใช้งาน: เลือกรายการสินค้าที่ต้องการจากกล่องตัวเลือกด้านล่างได้ทันที')
.setColor('#00FF00')
.setImage('https://cdn.discordapp.com/attachments/1559878908348997774/1560429202589876295/1792105154505.jpg');
​const selectMenu = new StringSelectMenuBuilder()
.setCustomId('select_product_order')
.setPlaceholder('🛒 เลือกสินค้าที่ต้องการสั่งซื้อ')
.addOptions([
{ label: 'BOT PREMIUM (รายเดือน)', description: 'สต็อกไม่จำกัด • ฿399.00 / 1 เดือน', value: 'product_bot_premium', emoji: '💎' },
{ label: 'ยศ Artist ถาวร', description: 'สต็อกไม่จำกัด • ฿69.00 / ถาวร', value: 'product_artist_role', emoji: '🎨' },
{ label: 'ยศพิเศษ สายชิลล์ ถาวร', description: 'สต็อกไม่จำกัด • ฿19.00 / ถาวร', value: 'product_chilling_role', emoji: '☕' },
{ label: 'ยศพิเศษ คนนอนดึก ถาวร', description: 'สต็อกไม่จำกัด • ฿9.00 / ถาวร', value: 'product_nightowl_role', emoji: '🌙' },
{ label: 'ล้างตัวเลือก', description: 'เคลียร์ค่าตัวเลือก', value: 'clear_selection', emoji: '❌' }
]);
​const row = new ActionRowBuilder().addComponents(selectMenu);
await interaction.update({ embeds: [embed], components: [row] });
return true;
}
​const guild = interaction.guild;
const user = interaction.user;
const member = interaction.member;
const loadingGif = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560407479412588686/IMG_7559.gif';
​let productName = '';
let productPrice = '';
​if (selectedValue === 'product_bot_premium') { productName = 'BOT PREMIUM (รายเดือน)'; productPrice = '฿399.00'; }
else if (selectedValue === 'product_artist_role') { productName = 'ยศ Artist ถาวร'; productPrice = '฿69.00'; }
else if (selectedValue === 'product_chilling_role') { productName = 'ยศพิเศษ สายชิลล์ ถาวร'; productPrice = '฿19.00'; }
else if (selectedValue === 'product_nightowl_role') { productName = 'ยศพิเศษ คนนอนดึก ถาวร'; productPrice = '฿9.00'; }
​// 🔒 ป้องกันคนที่มี Artist ถาวรแล้ว มาซื้อซ้ำซ้อน
const artistPermRoleId = '1560224726868295740';
if (selectedValue === 'product_artist_role' && member.roles.cache.has(artistPermRoleId)) {
await interaction.reply({ content: '❌ คุณมียศ Artist ถาวร อยู่แล้วครับ! ไม่สามารถซื้อซ้ำได้', ephemeral: true });
return true;
}
​const loadingEmbed = new EmbedBuilder()
.setTitle('⏳ กำลังเตรียมช่องทางส่วนตัวของคุณ...')
.setDescription('ระบบกำลังสร้างห้องออร์เดอร์เฉพาะกิจ กรุณารอสักครู่ครับ')
.setImage(loadingGif)
.setColor('#00FFFF');
​await interaction.reply({ embeds: [loadingEmbed], ephemeral: true });
​try {
const ticketChannel = await guild.channels.create({
name: 🛒-order-${user.username},
type: ChannelType.GuildText,
permissionOverwrites: [
{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
{ id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
{ id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
],
});
​const newOrderGif = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560415906281300059/image0.gif';
​const ticketEmbed = new EmbedBuilder()
.setTitle(🎟️ รายละเอียดออร์เดอร์: ${productName})
.setDescription(• **ผู้สั่งซื้อ:** <@${user.id}>\n• **สินค้า:** ${productName}\n• **ยอดที่ต้องชำระ:** \${productPrice}`\n\n──────────────────────\n📌 ช่องทางการชำระเงิน:\nคลิกปุ่มด้านล่างเพื่อดู QR Code สำหรับโอนเงิน จากนั้นส่งสลิปหลักฐานในห้องนี้เพื่อให้แอดมินตรวจสอบครับ`)
.setImage(newOrderGif)
.setColor('#FFD700')
.setFooter({ text: 'ช่องทางชำระ' });
​// 🟢 บรรจุรหัสสินค้าและ User ID ไว้ในปุ่มทุกอันอย่างปลอดภัย
const payRow = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId(pay_promptpay_${selectedValue}_${user.id})
.setLabel('PromptPay QR')
.setEmoji('1560403647882334208')
.setStyle(ButtonStyle.Success),
new ButtonBuilder()
.setCustomId(verify_payment_${selectedValue}_${user.id})
.setLabel('แอดมินยืนยันสลิป')
.setEmoji('✅')
.setStyle(ButtonStyle.Primary),
new ButtonBuilder()
.setCustomId('close_order_ticket')
.setLabel('🔒 ปิดออร์เดอร์')
.setStyle(ButtonStyle.Danger)
);
​await ticketChannel.send({ content: 🔔 ออร์เดอร์ใหม่จาก <@${user.id}>, embeds: [ticketEmbed], components: [payRow] });
await interaction.editReply({ content: ✅ สร้างห้องออร์เดอร์ส่วนตัวให้คุณสำเร็จแล้ว: <#${ticketChannel.id}>, embeds: [] });
} catch (err) {
console.error('Error creating order ticket channel:', err);
await interaction.editReply({ content: '❌ เกิดข้อผิดพลาดในการสร้างห้องออร์เดอร์ กรุณาติดต่อแอดมินครับ', embeds: [] });
}
​return true;
}
​async function handleOrderPaymentButton(interaction) {
if (!interaction.customId.startsWith('pay_promptpay_')) return false;
​const parts = interaction.customId.split('_');
const selectedValue = parts[2];
const targetUserId = parts[3];
​let productName = '';
let productPrice = '';
if (selectedValue === 'product_bot_premium') { productName = 'BOT PREMIUM (รายเดือน)'; productPrice = '฿399.00'; }
else if (selectedValue === 'product_artist_role') { productName = 'ยศ Artist ถาวร'; productPrice = '฿69.00'; }
else if (selectedValue === 'product_chilling_role') { productName = 'ยศพิเศษ สายชิลล์ ถาวร'; productPrice = '฿19.00'; }
else if (selectedValue === 'product_nightowl_role') { productName = 'ยศพิเศษ คนนอนดึก ถาวร'; productPrice = '฿9.00'; }
​const promptPayQr = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560193260293595176/ReceiveMoney_QR_2026-10-15_14.13.55.png';
​const embed = new EmbedBuilder()
.setTitle('💳 ช่องทางชำระเงิน PromptPay QR')
.setDescription(• **สินค้า:** ${productName}\n• **ยอดชำระ:** \${productPrice}`\n\n──────────────────────\n📌 สแกน QR Code PromptPay ด้านล่างเพื่อโอนเงิน:\n\nเมื่อโอนเงินเรียบร้อยแล้ว ส่งสลิปหลักฐานในห้องนี้เพื่อให้แอดมินตรวจสอบและมอบสินค้าให้ได้เลยครับ!`)
.setImage(promptPayQr)
.setColor('#00FF00')
.setFooter({ text: 'ช่องทางชำระ' });
​// คงปุ่มทั้ง 3 ปุ่มไว้เหมือนเดิมเพื่อให้ User ID ไม่หายไปไหน
const actionRow = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId(pay_promptpay_${selectedValue}_${targetUserId})
.setLabel('PromptPay QR')
.setEmoji('1560403647882334208')
.setStyle(ButtonStyle.Success),
new ButtonBuilder()
.setCustomId(verify_payment_${selectedValue}_${targetUserId})
.setLabel('แอดมินยืนยันสลิป')
.setEmoji('✅')
.setStyle(ButtonStyle.Primary),
new ButtonBuilder()
.setCustomId('close_order_ticket')
.setLabel('🔒 ปิดออร์เดอร์')
.setStyle(ButtonStyle.Danger)
);
​await interaction.update({ embeds: [embed], components: [actionRow] });
return true;
}
​// 🟢 ฟังก์ชันจัดการปุ่ม "แอดมินยืนยันสลิป"
async function handleVerifyPaymentButton(interaction) {
if (!interaction.customId.startsWith('verify_payment_')) return false;
​if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะกดยืนยันสลิปนี้ได้!', ephemeral: true });
return true;
}
​const parts = interaction.customId.split('_');
const selectedValue = parts[2];
const targetUserId = parts[3];
​let productName = '';
let productPrice = '';
if (selectedValue === 'product_bot_premium') { productName = 'BOT PREMIUM (รายเดือน)'; productPrice = '฿399.00'; }
else if (selectedValue === 'product_artist_role') { productName = 'ยศ Artist ถาวร'; productPrice = '฿69.00'; }
else if (selectedValue === 'product_chilling_role') { productName = 'ยศพิเศษ สายชิลล์ ถาวร'; productPrice = '฿19.00'; }
else if (selectedValue === 'product_nightowl_role') { productName = 'ยศพิเศษ คนนอนดึก ถาวร'; productPrice = '฿9.00'; }
​const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);
if (!targetUser) {
await interaction.reply({ content: '❌ ไม่พบข้อมูลผู้ซื้อในระบบ', ephemeral: true });
return true;
}
​await interaction.deferUpdate();
​// ส่งใบเสร็จลงในห้อง
await sendOrderReceipt(interaction.channel, targetUser, productName, productPrice, 'PromptPay QR (Verified by Admin)');
​const successEmbed = new EmbedBuilder()
.setTitle('✅ ตรวจสอบสลิปและยืนยันการชำระเงินสำเร็จ')
.setDescription(แอดมิน <@${interaction.user.id}> ได้ตรวจสอบสลิปและยืนยันยอดเงินของ <@${targetUserId}> เรียบร้อยแล้ว!\n\n*ระบบจะทำการปิดห้องนี้อัตโนมัติใน 10 วินาที...*)
.setColor('#00FF00')
.setTimestamp();
​await interaction.editReply({ embeds: [successEmbed], components: [] });
​setTimeout(() => {
interaction.channel.delete().catch(() => {});
}, 10000);
​return true;
}
​async function handleCloseTicketButton(interaction) {
if (interaction.customId !== 'close_order_ticket') return false;
​await interaction.reply({ content: '🔒 กำลังปิดห้องออร์เดอร์ใน 5 วินาที...' });
setTimeout(() => {
interaction.channel.delete().catch(() => {});
}, 5000);
​return true;
}
​module.exports = {
setupOrderTicketCommand,
handleSetupOrderTicketCommand,
handleOrderTicketSelect,
handleOrderPaymentButton,
handleVerifyPaymentButton,
handleCloseTicketButton,
sendOrderReceipt
};
