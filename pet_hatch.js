// 6. คำสั่ง /setup-pet-shop (สำหรับแอดมินสร้างหน้าร้านถาวร - เช็กสิทธิ์แอดมินภายในตัว)
const setupShopCommand = new SlashCommandBuilder()
  .setName('setup-pet-shop')
  .setDescription('🛠️ [Admin] ส่งข้อความหน้าร้านค้าสัตว์เลี้ยงถาวรลงในห้องนี้')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function handleSetupShopCommand(interaction) {
  // 🛡️ เช็กสิทธิ์แอดมินตรงนี้ เพื่อป้องกันสมาชิกธรรมดากดใช้คำสั่ง
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้!', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle('🛒 ZEN PET SHOP & MARKET')
    .setDescription(
      `ยินดีต้อนรับสู่ร้านค้าสัตว์เลี้ยงประจำเซิร์ฟเวอร์!\n\n` +
      `📦 **Mystery Pet Egg (ไข่สัตว์เลี้ยงลึกลับ)**\n` +
      `✨ *ลุ้นรับสัตว์เลี้ยงระดับ 1 ดาว ถึง 6 ดาว (Cosmic)*\n` +
      `💵 **ราคา:** \`500 Orbs\`\n\n` +
      `👇 **กดปุ่มด้านล่างเพื่อซื้อไข่ได้ทันที!**`
    )
    .setColor('#FFD700')
    .setImage('https://cdn.discordapp.com/attachments/1559878908348997774/1563060185633652816/image0.jpg?ex=6adc40bc&is=6adaef3c&hm=67a61c3443ccdddeefe9272b417ec4dc9cb24d1e5112da608b4076f8a8bf4a7b&')
    .setFooter({ text: 'Zen Pet Storefront System' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('buy_pet_egg_shop')
      .setLabel('🎁 ซื้อไข่สัตว์เลี้ยง (500 Orbs)')
      .setStyle(ButtonStyle.Success)
  );

  await interaction.reply({ content: '✅ สร้างหน้าร้านค้าเรียบร้อยแล้ว!', ephemeral: true });
  await interaction.channel.send({ embeds: [embed], components: [row] });
}
