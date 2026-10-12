const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('เช็กสถานะบอท'),
  async execute(interaction) {
    return await interaction.reply({ content: 'Pong! 🏓 บอททำงานปกติครับ 🚀', ephemeral: true });
  },
};
