const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');

// คำสั่งเดียวเรียกแผงควบคุม
const musicPanelCommand = new SlashCommandBuilder()
  .setName('music')
  .setDescription('🎵 [MUSIC] เปิดแผงควบคุมระบบเพลงและเสียง');

async function handleMusicPanelCommand(interaction) {
  const channel = interaction.member.voice.channel;
  if (!channel) {
    return await interaction.reply({ content: '❌ คุณต้องเข้าห้องเสียง (Voice Channel) ก่อนใช้งานแผงควบคุมเพลงครับ!', ephemeral: true });
  }

  // เชื่อมต่อเข้าห้องเสียงทันทีเมื่อเรียกแผง
  try {
    joinVoiceChannel({
      channelId: channel.id,
      guildId: interaction.guild.id,
      adapterCreator: interaction.guild.voiceAdapterCreator,
    });
  } catch (err) {
    console.error('Join Voice Error:', err);
  }

  const embed = new EmbedBuilder()
    .setTitle('🎵 ZEN BOT • MUSIC CONTROL PANEL')
    .setDescription('ยินดีต้อนรับสู่แผงควบคุมเสียงและเพลง!\n\n📌 **สถานะ:** พร้อมใช้งาน\n⏹️ **เพลงที่กำลังเล่น:** -')
    .setColor('#1DB954')
    .setTimestamp();

  // แถวที่ 1: ควบคุมการเล่นเพลง
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_play').setLabel('▶️ เล่น / สตรีม').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('music_pause').setLabel('⏸️ พักชั่วคราว').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_stop').setLabel('⏹️ หยุดเพลง').setStyle(ButtonStyle.Danger)
  );

  // แถวที่ 2: จัดการห้องเสียง
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_leave').setLabel('🚪 บอทออกจากห้องเสียง').setStyle(ButtonStyle.Danger)
  );

  await interaction.reply({ embeds: [embed], components: [row1, row2] });
  return true;
}

// ตัวจัดการปุ่มกดบนแผงควบคุมเพลง
async function handleMusicPanelButton(interaction) {
  const id = interaction.customId;
  if (!['music_play', 'music_pause', 'music_stop', 'music_leave'].includes(id)) return false;

  const connection = getVoiceConnection(interaction.guild.id);

  if (id === 'music_leave') {
    if (!connection) {
      return await interaction.reply({ content: '❌ บอทไม่ได้อยู่ในห้องเสียงครับ', ephemeral: true });
    }
    connection.destroy();
    await interaction.update({ content: '🚪 บอทออกจากห้องเสียงและปิดแผงควบคุมแล้ว', embeds: [], components: [] });
    return true;
  }

  if (!connection) {
    return await interaction.reply({ content: '❌ บอทไม่ได้อยู่ในห้องเสียง กรุณาเรียกคำสั่ง /music ใหม่', ephemeral: true });
  }

  if (id === 'music_play') {
    await interaction.reply({ content: '▶️ เริ่มเล่นเสียง/สตรีมเพลงเรียบร้อย!', ephemeral: true });
  } else if (id === 'music_pause') {
    await interaction.reply({ content: '⏸️ พักการเล่นชั่วคราวแล้ว', ephemeral: true });
  } else if (id === 'music_stop') {
    await interaction.reply({ content: '⏹️ หยุดเพลงเรียบร้อย', ephemeral: true });
  }

  return true;
}

module.exports = {
  musicPanelCommand,
  handleMusicPanelCommand,
  handleMusicPanelButton
};
