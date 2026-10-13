const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('ลบข้อความในแชท 1-100 ข้อความ')
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('จำนวนข้อความ')
        .setRequired(true)
    ),
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return await interaction.reply({ content: '❌ ไม่มีสิทธิ์จัดการข้อความ', ephemeral: true });
    }
    const amount = interaction.options.getInteger('amount');
    await interaction.deferReply({ ephemeral: true });
    try {
      const messages = await interaction.channel.messages.fetch({ limit: amount });
      await interaction.channel.bulkDelete(messages, true);
      await interaction.editReply({ content: `🧹 ลบข้อความจำนวน ${amount} ข้อความเรียบร้อย` });
    } catch (err) {
      await interaction.editReply({ content: '❌ ลบข้อความไม่สำเร็จ' });
    }
  },
};
