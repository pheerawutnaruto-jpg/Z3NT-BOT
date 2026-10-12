const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('เช็กความเร็วและสถานะของบอท'),
  async execute(interaction) {
    return await interaction.reply({ content: 'Pong! 🏓 บอททำงานระบบ Modular Command ปกติบน Render ครับ 🚀', ephemeral: true });
  },
};
