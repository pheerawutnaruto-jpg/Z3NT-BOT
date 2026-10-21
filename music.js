const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection } = require('@discordjs/voice');

const musicCommand = new SlashCommandBuilder()
  .setName('music')
  .setDescription('🎵 [MUSIC] ควบคุมระบบเพลงและเสียงในห้อง Voice')
  .addSubcommand(sub =>
    sub.setName('join')
      .setDescription('ให้บอทเข้ามาร่วมห้องเสียงของคุณ')
  )
  .addSubcommand(sub =>
    sub.setName('leave')
      .setDescription('ให้บอทออกจากห้องเสียง')
  );

async function handleMusicCommand(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const channel = interaction.member.voice.channel;

  if (subcommand === 'join') {
    if (!channel) {
      return await interaction.reply({ content: '❌ คุณต้องเข้าห้องเสียง (Voice Channel) ก่อนใช้งานคำสั่งนี้!', ephemeral: true });
    }

    try {
      joinVoiceChannel({
        channelId: channel.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator,
      });

      await interaction.reply({ content: `✅ บอทได้เข้ามาประจำการในห้องเสียง **${channel.name}**เรียบร้อยแล้วครับ!`, ephemeral: true });
    } catch (err) {
      console.error('Join Voice Error:', err);
      await interaction.reply({ content: '❌ ไม่สามารถเชื่อมต่อเข้าห้องเสียงได้', ephemeral: true });
    }
  }

  if (subcommand === 'leave') {
    const connection = getVoiceConnection(interaction.guild.id);
    if (!connection) {
      return await interaction.reply({ content: '❌ บอทไม่ได้อยู่ในห้องเสียงใดๆ ในขณะนี้ครับ', ephemeral: true });
    }

    connection.destroy();
    await interaction.reply({ content: '🚪 บอทออกจากห้องเสียงเรียบร้อยแล้ว', ephemeral: true });
  }

  return true;
}

module.exports = {
  musicCommand,
  handleMusicCommand
};
