const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const setupShopCommand = new SlashCommandBuilder()
  .setName('setup-in-game-shop')
  .setDescription('🎮 [IN-GAME] ส่งแผงร้านค้าภายในเกม (สำหรับ Admin)');

async function handleSetupShopCommand(interaction) {
  if (!interaction.member.permissions.has('Administrator')) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle('🎮 𝙕𝙀𝙉 𝘽𝙊𝙏 • IN-GAME SHOP')
    .setDescription('ยินดีต้อนรับสู่ร้านค้าภายในเกม! เลือกซื้อไอเทมและไอเทมพิเศษได้ที่นี่')
    .setColor('#00FFFF');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('buy_item_1').setLabel('🗡️ ซื้อดาบพรีเมียม (50 Coins)').setStyle(ButtonStyle.Primary)
  );

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ ส่งแผงร้านค้า In-Game สำเร็จ!', ephemeral: true });
}

async function handleShopButton(interaction, serverConfigs, saveConfigs) {
  if (interaction.customId === 'buy_item_1') {
    return await interaction.reply({ content: '🛒 ระบบซื้อไอเทม In-Game กำลังพัฒนาครับ!', ephemeral: true });
  }
  return false;
}

module.exports = {
  setupShopCommand,
  handleSetupShopCommand,
  handleShopButton
};
