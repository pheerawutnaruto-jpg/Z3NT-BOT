const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } = require('@discordjs/voice');
const play = require('play-dl');

// เก็บข้อมูลคิวเพลงและเครื่องเล่นของแต่ละเซิร์ฟเวอร์
const serverQueues = new Map();

// คำสั่ง /music-panel สำหรับส่งแผงควบคุมเพลง
const musicPanelCommand = new SlashCommandBuilder()
  .setName('music-panel')
  .setDescription('🎵 [MUSIC] ส่งแผงควบคุมระบบเพลงสุดล้ำสมัย (เฉพาะ Owner/Admin)');

async function handleMusicPanelCommand(interaction) {
  // 🔒 ล็อกสิทธิ์: ให้เฉพาะ Owner หรือ Admin ใช้คำสั่งส่งแผงได้
  if (interaction.user.id !== interaction.guild.ownerId && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะเจ้าของเซิร์ฟเวอร์ (Owner) หรือ Administrator เท่านั้นที่จะสร้างแผงเพลงได้!', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle('🎵 ZEN BOT • ADVANCED MUSIC CONTROL PANEL')
    .setDescription(
      'ยินดีต้อนรับสู่ระบบควบคุมเสียงเพลงสุดล้ำสมัย!\n\n' +
      '📌 **วิธีใช้งาน:**\n' +
      '• 📥 **Join Channel:** ดึงบอทเข้าห้องเสียงของคุณ\n' +
      '• 🎶 **Play / Add Song:** ใส่ลิงก์ YouTube เพื่อเล่นหรือเพิ่มเข้าคิว\n' +
      '• ⏸️ / ▶️ / ⏹️: ควบคุมการเล่นเพลงชั่วคราว ข้าม หรือหยุด\n' +
      '• 📜 **Queue:** ดูรายการเพลงในคิวปัจจุบัน\n\n' +
      '*⚠️ หมายเหตุ: ระบบนี้ถูกล็อกสิทธิ์ให้เฉพาะเจ้าของเซิร์ฟเวอร์ควบคุมได้เท่านั้น*'
    )
    .setColor('#9900FF')
    .setImage('https://cdn.discordapp.com/attachments/1550576199829430382/1559721017583337512/1791877721245.jpg')
    .setFooter({ text: 'Powered by Zen Bot Audio Engine' });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_join').setLabel('📥 Join').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('music_play_modal').setLabel('🎶 Play / Add').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('music_pause').setLabel('⏸️ Pause/Resume').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_skip').setLabel('⏭️ Skip').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_stop').setLabel('⏹️ Stop').setStyle(ButtonStyle.Danger)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_queue').setLabel('📜 ดูคิวเพลง').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('music_leave').setLabel('📤 Disconnect').setStyle(ButtonStyle.Danger)
  );

  await interaction.channel.send({ embeds: [embed], components: [row1, row2] });
  await interaction.reply({ content: '✅ ส่งแผงควบคุมเพลงสำเร็จ!', ephemeral: true });
  return true;
}

// 🛡️ ฟังก์ชันตรวจสอบสิทธิ์เจ้าของห้อง/เซิร์ฟเวอร์
function checkMusicOwner(interaction) {
  const isOwner = interaction.user.id === interaction.guild.ownerId;
  const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
  if (!isOwner && !isAdmin) {
    interaction.reply({ content: '❌ **[LOCKED]** เฉพาะเจ้าของเซิร์ฟเวอร์ (Owner) เท่านั้นที่มีสิทธิ์ควบคุมเพลงนี้!', ephemeral: true });
    return false;
  }
  return true;
}

// ฟังก์ชันเล่นเพลงถัดไปในคิว
async function playNextSong(guildId, channel) {
  const serverQueue = serverQueues.get(guildId);
  if (!serverQueue || serverQueue.songs.length === 0) {
    serverQueue.isPlaying = false;
    return;
  }

  const song = serverQueue.songs[0];
  serverQueue.isPlaying = true;

  try {
    const stream = await play.stream(song.url);
    const resource = createAudioResource(stream.stream, { inputType: stream.type });

    serverQueue.player.play(resource);
    serverQueue.connection.subscribe(serverQueue.player);

    serverQueue.player.once(AudioPlayerStatus.Idle, () => {
      serverQueue.songs.shift(); // ลบเพลงที่เล่นจบแล้วออกจากคิว
      playNextSong(guildId, channel);
    });

    if (channel) {
      channel.send(`🎶 กำลังเล่นเพลง: **[${song.title}](${song.url})** (ขอโดย <@${song.requester}>)`).catch(() => {});
    }
  } catch (err) {
    console.error('Music Play Error:', err);
    serverQueue.songs.shift();
    playNextSong(guildId, channel);
  }
}

// จัดการปุ่มกดแผงเพลง
async function handleMusicButton(interaction) {
  const id = interaction.customId;
  if (!['music_join', 'music_play_modal', 'music_pause', 'music_skip', 'music_stop', 'music_queue', 'music_leave'].includes(id)) {
    return false;
  }

  // 🔒 ล็อกสิทธิ์เฉพาะเจ้าของเซิร์ฟเวอร์หรือแอดมินเท่านั้นที่กดปุ่มควบคุมได้
  if (!checkMusicOwner(interaction)) return true;

  const guildId = interaction.guildId;
  let serverQueue = serverQueues.get(guildId);

  if (id === 'music_join') {
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      await interaction.reply({ content: '❌ คุณต้องเข้าห้องเสียง (Voice Channel) ก่อนกด Join ครับ!', ephemeral: true });
      return true;
    }

    try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: interaction.guild.voiceAdapterCreator,
      });

      const player = createAudioPlayer();
      serverQueues.set(guildId, { connection, player, songs: [], isPlaying: false });

      await interaction.reply({ content: `✅ บอทเชื่อมต่อเข้าห้องเสียง **${voiceChannel.name}** เรียบร้อยแล้ว!`, ephemeral: true });
    } catch (e) {
      console.error(e);
      await interaction.reply({ content: '❌ ไม่สามารถเข้าห้องเสียงได้', ephemeral: true });
    }
    return true;
  }

  if (id === 'music_play_modal') {
    const connection = getVoiceConnection(guildId);
    if (!connection) {
      await interaction.reply({ content: '❌ กรุณากดปุ่ม **Join** ดึงบอทเข้าห้องเสียงก่อนพิมพ์ค้นหาเพลงครับ!', ephemeral: true });
      return true;
    }

    const modal = new ModalBuilder().setCustomId('musicPlayModal').setTitle('ใส่ลิงก์เพลง YouTube');
    const urlInput = new TextInputBuilder()
      .setCustomId('songUrlInput')
      .setLabel('ลิงก์เพลง YouTube (URL)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://www.youtube.com/watch?v=...')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(urlInput));
    await interaction.showModal(modal);
    return true;
  }

  if (id === 'music_pause') {
    if (!serverQueue || !serverQueue.isPlaying) {
      await interaction.reply({ content: '❌ ไม่มีเพลงกำลังเล่นอยู่', ephemeral: true });
      return true;
    }
    // สลับสถานะ เล่น/หยุดชั่วคราว
    serverQueue.player.pause() ? await interaction.reply({ content: '⏸️ หยุดเพลงชั่วคราวแล้ว', ephemeral: true }) : serverQueue.player.unpause() ? await interaction.reply({ content: '▶️ เล่นเพลงต่อแล้ว', ephemeral: true }) : null;
    return true;
  }

  if (id === 'music_skip') {
    if (!serverQueue || serverQueue.songs.length === 0) {
      await interaction.reply({ content: '❌ ไม่มีเพลงในคิวให้ข้าม', ephemeral: true });
      return true;
    }
    serverQueue.player.stop(); // สั่งหยุดเพื่อข้ามไปเพลงถัดไปอัตโนมัติ
    await interaction.reply({ content: '⏭️ ข้ามเพลงเรียบร้อย!', ephemeral: true });
    return true;
  }

  if (id === 'music_stop') {
    if (serverQueue) {
      serverQueue.songs = [];
      serverQueue.player.stop();
    }
    await interaction.reply({ content: '⏹️ หยุดเพลงและเคลียร์คิวทั้งหมดแล้ว', ephemeral: true });
    return true;
  }

  if (id === 'music_queue') {
    if (!serverQueue || serverQueue.songs.length === 0) {
      await interaction.reply({ content: '📜 คิวเพลงว่างเปล่าในขณะนี้', ephemeral: true });
      return true;
    }

    const queueList = serverQueue.songs.map((song, idx) => `${idx === 1 ? '▶️' : `${idx + 1}.`} **${song.title}** (ขอโดย <@${song.requester}>)`).join('\n');
    const embed = new EmbedBuilder()
      .setTitle('📜 คิวเพลงปัจจุบัน (Music Queue)')
      .setDescription(queueList)
      .setColor('#9900FF');

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return true;
  }

  if (id === 'music_leave') {
    const connection = getVoiceConnection(guildId);
    if (connection) {
      connection.destroy();
      serverQueues.delete(guildId);
    }
    await interaction.reply({ content: '📤 บอทออกจากห้องเสียงแล้ว', ephemeral: true });
    return true;
  }

  return false;
}

// จัดการการส่งลิงก์เพลงผ่าน Modal
async function handleMusicModal(interaction) {
  if (interaction.customId !== 'musicPlayModal') return false;

  const url = interaction.fields.getTextInputValue('songUrlInput').trim();
  const guildId = interaction.guildId;

  await interaction.reply({ content: '⏳กำลังค้นหาและโหลดเพลง...', ephemeral: true });

  try {
    const validate = await play.validate(url);
    if (!validate) {
      await interaction.editReply({ content: '❌ ลิงก์ไม่ถูกต้อง กรุณาใช้ลิงก์ YouTube ที่ใช้งานได้' });
      return true;
    }

    const songInfo = await play.video_info(url);
    const song = {
      title: songInfo.video_details.title,
      url: songInfo.video_details.url,
      requester: interaction.user.id
    };

    let serverQueue = serverQueues.get(guildId);
    if (!serverQueue) {
      const voiceChannel = interaction.member.voice.channel;
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: interaction.guild.voiceAdapterCreator,
      });
      const player = createAudioPlayer();
      serverQueue = { connection, player, songs: [], isPlaying: false };
      serverQueues.set(guildId, serverQueue);
    }

    serverQueue.songs.push(song);

    if (!serverQueue.isPlaying) {
      playNextSong(guildId, interaction.channel);
      await interaction.editReply({ content: `✅ เพิ่มและเริ่มเล่นเพลง: **${song.title}**` });
    } else {
      await interaction.editReply({ content: `✅ เพิ่มเพลงลงในคิวลำดับที่ ${serverQueue.songs.length}: **${song.title}**` });
    }

  } catch (err) {
    console.error('Modal Play Error:', err);
    await interaction.editReply({ content: '❌ เกิดข้อผิดพลาดในการโหลดเพลง' });
  }

  return true;
}

module.exports = {
  musicPanelCommand,
  handleMusicPanelCommand,
  handleMusicButton,
  handleMusicModal
};
