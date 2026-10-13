const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('ลบข้อความในแชทจำนวน 1-100 ข้อความ')
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('จำนวนข้อความที่ต้องการลบ (1-100)')
        .setRequired(true)
    ),
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return await interaction.reply({ content: '❌ คุณไม่มีสิทธิ์จัดการข้อความ (Manage Messages) ครับ', ephemeral: true });
    }

    const amount = interaction.options.getInteger('amount');
    if (amount < 1 || amount > 100) {
      return await interaction.reply({ content: '⚠️ กรุณาระบุจำนวนข้อความระหว่าง 1 ถึง 100 ครับ', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const messages = await interaction.channel.messages.fetch({ limit: amount });
      await interaction.channel.bulkDelete(messages, true);
      await interaction.editReply({ content: `🧹 ลบข้อความจำนวน **${amount}** ข้อความเรียบร้อยแล้ว!` });
    } catch (err) {
      console.error(err);
      await interaction.editReply({ content: '❌ เกิดข้อผิดพลาด ไม่สามารถลบข้อความที่เก่าเกิน 14 วันได้ครับ' });
    }
  },
};
