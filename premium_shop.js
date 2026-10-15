const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const PREMIUM_ITEMS = [
  { 
    id: 'perm_artist', 
    name: '👑 ยศ Artist ถาวร', 
    price: 30, 
    roleId: '1560136361015513108',
    buttonLabel: 'ซื้อยศ Artist ถาวร (30 บาท)',
    description: 'ปลดล็อกยศ Artist ถาวรตลอดชีพ ไม่ต้องต่ออายุ เปลี่ยนรูปการ์ด /level ได้ตลอดไป!' 
  },
  { 
    id: 'perm_chilling', 
    name: '☕ ยศพิเศษ สายชิลล์ ถาวร', 
    price: 10, 
    roleId: '1560002494204084395',
    buttonLabel: 'ซื้อยศ สายชิลล์ ถาวร (10 บาท)',
    description: 'ยศตกแต่งโปรไฟล์สุดชิลล์ ถาวรตลอดชีพ แยกจากสายแรงค์เลเวล' 
  },
  { 
    id: 'perm_nightowl', 
    name: '🌙 ยศพิเศษ คนนอนดึก ถาวร', 
    price: 10, 
    roleId: '1560002616266854420',
    buttonLabel: 'ซื้อยศ คนนอนดึก ถาวร (10 บาท)',
    description: 'ยศตกแต่งโปรไฟล์สำหรับสายโต้รุ่ง ถาวรตลอดชีพ' 
  }
];

const premiumShopCommand = new SlashCommandBuilder()
  .setName('shop')
  .setDescription('เปิดร้านค้าพรีเมียมสำหรับซื้อสินค้าถาวรด้วยเงินจริง / สแกน QR Code');

async function handlePremiumShopCommand(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('💳 𝙕𝙀𝙉 𝘽𝙊𝙏 • PREMIUM STORE (ถาวรตลอดชีพ)')
    .setDescription('ร้านค้าพรีเมียมสำหรับซื้อยศถาวร (1 Coin = 1 บาท)\nกดปุ่มสินค้าด้านล่างเพื่อดูช่องทางชำระเงินและ QR Code ได้เลย:')
    .setColor('#FFD700');

  PREMIUM_ITEMS.forEach(item => {
    embed.addFields({
      name: `${item.name} (ราคา: ${item.price} บาท)`,
      value: `${item.description}\n──────────────────────`,
      inline: false
    });
  });

  const row = new ActionRowBuilder();
  PREMIUM_ITEMS.forEach(item => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`buy_perm_${item.id}`)
        .setLabel(item.buttonLabel)
        .setStyle(ButtonStyle.Success)
    );
  });

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handlePremiumShopButton(interaction) {
  if (!interaction.customId.startsWith('buy_perm_')) return false;

  const itemId = interaction.customId.replace('buy_perm_', '');
  const item = PREMIUM_ITEMS.find(i => i.id === itemId);
  if (!item) return true;

  const qrCodeUrl = 'ใส่_ลิงก์_QR_Code_ของคุณตรงนี้'; // <-- ใส่วางลิงก์รูป QR Code พร้อมเพย์ของคุณตรงนี้

  const embed = new EmbedBuilder()
    .setTitle(`💳 ชำระเงินค่าสินค้าพรีเมียม`)
    .setDescription(`คุณกำลังสั่งซื้อ: **${item.name}**\n💰 ยอดที่ต้องชำระ: **${item.price} บาท**\n\n──────────────────────\n📌 **สแกน QR Code พร้อมเพย์ด้านล่างเพื่อชำระเงิน:**`)
    .setImage(qrCodeUrl)
    .setColor('#00FF00')
    .setFooter({ text: 'เมื่อโอนเงินแล้ว กรุณาสส่งสลิปหลักฐานให้แอดมินเพื่อกดรับยศถาวรครับ!' });

  await interaction.reply({ embeds: [embed], ephemeral: true });
  return true;
}

module.exports = {
  premiumShopCommand,
  handlePremiumShopCommand,
  handlePremiumShopButton
};
