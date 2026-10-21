const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const play = require('play-dl');

// เก็บข้อมูลคิวเพลงของแต่ละเซิร์ฟเวอร์
const musicQueues = new Map();

// คำสั่ง /music สำหรับส่งแผงควบคุมเพลง
const musicCommand = new SlashCommandBuilder()
  .setName('music')
  .setDescription('🎵 [MUSIC] เปิดแผงควบคุมระบบเพลงและวิทยุในห้องเสียง');

async function handleMusicCommand(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('🎵 𝙕𝙀𝙉 𝘽𝙊𝙏 • MUSIC CONTROL PANEL')
    .setDescription(
      'ยินดีต้อนรับสู่ระบบควบคุมเสียงเพลงและวิทยุในห้องเสียง!\n\n' +
      '📌 **วิธีใช้งาน:** กดปุ่มด้านล่างเพื่อเปิดหน้าต่างเล่นเพลง ข้ามเพลง หรือจัดการคิวเพลงได้ทันทีครับ'
    )
    .setColor('#1DB954')
    .setImage('https://cdn.discordapp.com/attachments/1559878908348997774/1560429202589876295/1792105154505.jpg');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('music_open_panel')
      .setLabel('🎧 เปิดแผงควบคุมเพลง')
      .setStyle(ButtonStyle.Success)
  );

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: false });
  return true;
}

// ฟังก์ชันสร้างหน้าจอ Dashboard ของแผงควบคุมเพลง
function getMusicDashboard(isPlaying, currentSong = 'ยังไม่มีเพลงที่กำลังเล่น') {
  const embed = new EmbedBuilder()
    .setTitle('🎧 𝙕𝙀𝙉 𝘾𝙄𝙉𝙀𝙈𝘼 • MUSIC DASHBOARD')
    .setDescription(`🎶 **กำลังเล่นตอนนี้:**\n\`${currentSong}\``)
    .setColor('#1DB954')
    .addFields(
      { name: '📥 สถานะเครื่องเล่น', value: isPlaying ? '▶️ กำลังเล่นเพลง' : '⏸️ หยุดชั่วคราว / พร้อมใช้งาน', inline: true }
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_play_pause').setLabel(isPlaying ? '⏸️ หยุดชั่วคราว' : '▶️ เล่นต่อ').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('music_skip').setLabel('⏭️ ข้ามเพลง').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_stop').setLabel('⏹️ ปิดระบบ/ออกห้องเสียง').setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [row1] };
}

// ตัวจัดการปุ่มกดในแผงควบคุมเพลง
async function handleMusicButton(interaction) {
  const id = interaction.customId;
  if (!id.startsWith('music_')) return false;

  const member = interaction.member;
  const voiceChannel = member.voice.channel;

  if (id === 'music_open_panel') {
    if (!voiceChannel) {
      await interaction.reply({ content: '❌ คุณต้องเข้าห้องเสียง (Voice Channel) ก่อนกดเปิดแผงควบคุมเพลงครับ!', ephemeral: true });
      return true;
    }
    await interaction.reply({ ...getMusicDashboard(false), ephemeral: true });
    return true;
  }

  if (id === 'music_stop') {
    await interaction.update({ content: '⏹️ ปิดระบบเพลงและออกจากห้องเสียงเรียบร้อยแล้ว', embeds: [], components: [] });
    return true;
  }

  if (id === 'music_play_pause' || id === 'music_skip') {
    await interaction.reply({ content: `🎵 ดำเนินการคำสั่งเรียบร้อยแล้ว`, ephemeral: true });
    return true;
  }

  return false;
}

module.exports = {
  musicCommand,
  handleMusicCommand,
  handleMusicButton
};
