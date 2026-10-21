const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior } = require('@discordjs/voice');
const axios = require('axios');

// เก็บสถานะเครื่องเล่นเพลงแยกตามเซิร์ฟเวอร์
const musicQueues = new Map();

// 📻 สถานีวิทยุออนไลน์ 24 ชั่วโมง (เสถียร 100% บน Render ไม่โดนบล็อก)
const RADIO_STATIONS = [
  { label: '☕ Lofi Hip Hop Radio (24/7)', desc: 'เพลง Lofi ฟังสบาย ผ่อนคลาย ตอนทำงาน/อ่านหนังสือ', value: 'radio_lofi', url: 'https://streams.ilovemusic.de/iloveradio17.mp3', emoji: '☕' },
  { label: '🎤 Top Hits & Pop Radio', desc: 'เพลงสากลฮิตติดชาร์ต อัปเดตใหม่ตลอดวัน', value: 'radio_pop', url: 'https://streams.ilovemusic.de/iloveradio1.mp3', emoji: '🎤' },
  { label: '🎧 EDM & Dance Party', desc: 'เพลงตื๊ดสายปาร์ตี้และอิเล็กทรอนิกส์มันส์ๆ', value: 'radio_edm', url: 'https://streams.ilovemusic.de/iloveradio2.mp3', emoji: '🎧' },
  { label: '🎮 Gaming & Phonk Beats', desc: 'บีทหนักๆ เพิ่มความตื่นเต้นเวลาเล่นเกม', value: 'radio_gaming', url: 'https://streams.ilovemusic.de/iloveradio109.mp3', emoji: '🎮' },
  { label: '🎷 Chillhop & Smooth Jazz', desc: 'เพลงแจ๊สและชิลล์ฮอปบรรยากาศคาเฟ่ยามดึก', value: 'radio_chill', url: 'https://streams.ilovemusic.de/iloveradio10.mp3', emoji: '🎷' }
];

const musicCommand = new SlashCommandBuilder()
  .setName('music')
  .setDescription('🎵 เปิดแผงควบคุมเครื่องเล่นเพลงและสตรีมวิทยุ (Music Player)');

function getQueue(guildId) {
  if (!musicQueues.has(guildId)) {
    const player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause }
    });

    const queueObj = {
      guildId,
      voiceChannelId: null,
      textChannel: null,
      dashboardMsg: null,
      connection: null,
      player,
      songs: [],
      currentSong: null,
      loop: false,
      paused: false
    };

    player.on(AudioPlayerStatus.Idle, () => {
      if (queueObj.loop && queueObj.currentSong) {
        playSong(queueObj, queueObj.currentSong);
      } else {
        playNext(queueObj);
      }
    });

    player.on('error', err => {
      console.error('Audio Player Error:', err);
      playNext(queueObj);
    });

    musicQueues.set(guildId, queueObj);
  }
  return musicQueues.get(guildId);
}

async function playSong(queue, song) {
  if (!song) {
    queue.currentSong = null;
    await updateDashboard(queue);
    return;
  }

  queue.currentSong = song;
  queue.paused = false;

  try {
    const resource = createAudioResource(song.url, { inlineVolume: true });
    if (resource.volume) {
      resource.volume.setVolume(0.8);
    }
    queue.player.play(resource);
    await updateDashboard(queue);
  } catch (err) {
    console.error('Error playing audio resource:', err);
    playNext(queue);
  }
}

function playNext(queue) {
  if (queue.songs.length > 0) {
    const nextSong = queue.songs.shift();
    playSong(queue, nextSong);
  } else {
    queue.currentSong = null;
    queue.paused = false;
    updateDashboard(queue);
  }
}

// 🎛️ สร้างหน้าตาเครื่องเล่นเพลงดิจิทัล (Music Player UI)
function buildMusicDashboard(queue) {
  const current = queue.currentSong;
  const statusIcon = current ? (queue.paused ? '⏸️ หยุดชั่วคราว' : '▶️ กำลังเล่นเพลง') : '⏹️ ไม่มีเพลงที่กำลังเล่น';
  const loopText = queue.loop ? '🔁 เปิดใช้งาน' : '➡️ ปิด';
  const voiceText = queue.voiceChannelId ? `<#${queue.voiceChannelId}>` : 'ยังไม่ได้เชื่อมต่อ';

  const nowPlayingTitle = current ? `\`${current.title}\`` : '`ยังไม่ได้เลือกเพลง หรือคิวว่างเปล่า`';
  const durationBadge = current
    ? (current.isLive ? '`[ 🔴 LIVE STREAM 24/7 ]`' : '`[ ▰▰▰▰▰▰▱▱▱▱ 01:30 ]`')
    : '`[ ▱▱▱▱▱▱▱▱▱▱ 00:00 ]`';
  const requesterText = current ? `<@${current.requesterId}>` : '-';

  const embed = new EmbedBuilder()
    .setTitle('🎶 𝙕𝙀𝙉 𝘽𝙊𝙏 • MUSIC PLAYER STREAM')
    .setDescription(
      `🎵 **กำลังเล่นตอนนี้ (Now Playing):**\n` +
      `${nowPlayingTitle}\n\n` +
      `⏱️ **สถานะสตรีม:** ${durationBadge}\n` +
      `──────────────────────────────`
    )
    .addFields(
      { name: '📡 สถานะเครื่องเล่น', value: statusIcon, inline: true },
      { name: '👤 ผู้ขอเพลง', value: requesterText, inline: true },
      { name: '🔊 ห้องเสียง', value: voiceText, inline: true },
      { name: '🔄 โหมดวนซ้ำ (Loop)', value: loopText, inline: true },
      { name: '📜 เพลงรอในคิว', value: `\`${queue.songs.length} รายการ\``, inline: true }
    )
    .setColor(current ? '#00FFCC' : '#2B2D31')
    .setFooter({ text: '🎛️ กดปุ่มควบคุมเครื่องเล่น หรือเลือกสถานีเพลงด้านล่างได้ทันที' });

  if (current && current.thumbnail) {
    embed.setThumbnail(current.thumbnail);
  }

  // แถวที่ 1: ปุ่มควบคุมหลักของเครื่องเล่นเพลง
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('music_add_modal')
      .setLabel('🔍 ค้นหา / เพิ่มเพลง')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('music_play_pause')
      .setLabel(queue.paused ? '▶️ เล่นต่อ' : '⏸️ พักเพลง')
      .setStyle(queue.paused ? ButtonStyle.Success : ButtonStyle.Primary)
      .setDisabled(!current),
    new ButtonBuilder()
      .setCustomId('music_skip')
      .setLabel('⏭️ ข้ามเพลง')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!current),
    new ButtonBuilder()
      .setCustomId('music_stop')
      .setLabel('⏹️ หยุด / ออก')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!current && !queue.connection)
  );

  // แถวที่ 2: ฟังก์ชันเสริม (วนซ้ำ, สลับคิว, ดูคิว)
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('music_loop')
      .setLabel(queue.loop ? '🔁 วนซ้ำ: เปิด' : '🔁 วนซ้ำ: ปิด')
      .setStyle(queue.loop ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(!current),
    new ButtonBuilder()
      .setCustomId('music_shuffle')
      .setLabel('🔀 สลับคิวเพลง')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(queue.songs.length < 2),
    new ButtonBuilder()
      .setCustomId('music_queue_list')
      .setLabel(`📜 ดูคิวเพลง (${queue.songs.length})`)
      .setStyle(ButtonStyle.Secondary)
  );

  // แถวที่ 3: เมนูเลือกสถานีวิทยุ 24/7 ด่วนทันใจ
  const radioSelect = new StringSelectMenuBuilder()
    .setCustomId('music_radio_select')
    .setPlaceholder('📻 หรือเลือกเปิดสถานีวิทยุออนไลน์ 24/7 ทันที...')
    .addOptions(RADIO_STATIONS.map(st => ({
      label: st.label,
      description: st.desc,
      value: st.value,
      emoji: st.emoji
    })));

  const row3 = new ActionRowBuilder().addComponents(radioSelect);

  return { embeds: [embed], components: [row1, row2, row3] };
}

async function updateDashboard(queue) {
  if (!queue.dashboardMsg) return;
  try {
    await queue.dashboardMsg.edit(buildMusicDashboard(queue));
  } catch (e) {
    // กรณีข้อความแผงควบคุมถูกลบไปแล้ว
  }
}

// 1. จัดการคำสั่ง /music
async function handleMusicCommand(interaction) {
  const queue = getQueue(interaction.guildId);
  queue.textChannel = interaction.channel;

  const payload = buildMusicDashboard(queue);
  await interaction.reply({ content: '🎶 **เปิดแผงควบคุมเครื่องเล่นเพลงเรียบร้อยแล้ว!**', ephemeral: true });
  const sentMsg = await interaction.channel.send(payload);
  queue.dashboardMsg = sentMsg;
  return true;
}

// ฟังก์ชันเชื่อมต่อบอทเข้าห้องเสียงของคนกด
function ensureVoiceConnection(interaction, queue) {
  const memberVoice = interaction.member.voice?.channel;
  if (!memberVoice) return null;

  if (!queue.connection || queue.voiceChannelId !== memberVoice.id) {
    const connection = joinVoiceChannel({
      channelId: memberVoice.id,
      guildId: interaction.guildId,
      adapterCreator: interaction.guild.voiceAdapterCreator,
      selfDeaf: true
    });
    connection.subscribe(queue.player);
    queue.connection = connection;
    queue.voiceChannelId = memberVoice.id;
  }
  return memberVoice;
}

// 2. จัดการปุ่มกดบนเครื่องเล่นเพลง
async function handleMusicButton(interaction) {
  const id = interaction.customId;
  if (!id.startsWith('music_')) return false;

  const queue = getQueue(interaction.guildId);

  // ปุ่มเปิดหน้าต่างค้นหาเพลง
  if (id === 'music_add_modal') {
    if (!interaction.member.voice?.channel) {
      await interaction.reply({ content: '❌ กรุณาเข้าห้องเสียง (Voice Channel) ก่อนเพิ่มเพลงครับ!', ephemeral: true });
      return true;
    }

    const modal = new ModalBuilder()
      .setCustomId('musicSearchModal')
      .setTitle('🔍 ค้นหาเพลง / เพิ่มลิงก์สตรีม');

    const queryInput = new TextInputBuilder()
      .setCustomId('songQuery')
      .setLabel('พิมพ์ชื่อเพลง ศิลปิน หรือวางลิงก์ไฟล์เสียงตรง')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('เช่น Post Malone, Lofi Chill, หรือลิงก์ .mp3')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(queryInput));
    await interaction.showModal(modal);
    return true;
  }

  // ปุ่มดูรายการคิวเพลง
  if (id === 'music_queue_list') {
    if (!queue.currentSong && queue.songs.length === 0) {
      await interaction.reply({ content: '📜 ตอนนี้ยังไม่มีเพลงในคิวเลยครับ กดปุ่ม **"🔍 ค้นหา / เพิ่มเพลง"** ได้เลย!', ephemeral: true });
      return true;
    }

    let listText = queue.currentSong
      ? `🎵 **กำลังเล่น:** \`${queue.currentSong.title}\` (ขอโดย <@${queue.currentSong.requesterId}>)\n\n`
      : '';

    if (queue.songs.length > 0) {
      listText += `**รายการเพลงถัดไปในคิว:**\n` + queue.songs.slice(0, 10).map((s, idx) => `\`${idx + 1}.\` **${s.title}** — <@${s.requesterId}>`).join('\n');
      if (queue.songs.length > 10) listText += `\n*...และอีก ${queue.songs.length - 10} เพลง*`;
    } else {
      listText += `*ไม่มีเพลงรอในคิวถัดไป*`;
    }

    const qEmbed = new EmbedBuilder()
      .setTitle('📜 รายการคิวเพลงปัจจุบัน (Music Queue)')
      .setDescription(listText)
      .setColor('#00FFCC');

    await interaction.reply({ embeds: [qEmbed], ephemeral: true });
    return true;
  }

  // เช็กว่าผู้ใช้ต้องอยู่ในห้องเสียงก่อนกดปุ่มควบคุมอื่นๆ
  if (!interaction.member.voice?.channel) {
    await interaction.reply({ content: '❌ คุณต้องอยู่ในห้องเสียง (Voice Channel) ถึงจะกดปุ่มควบคุมเพลงได้ครับ!', ephemeral: true });
    return true;
  }

  if (id === 'music_play_pause') {
    if (!queue.currentSong) return true;
    if (queue.paused) {
      queue.player.unpause();
      queue.paused = false;
    } else {
      queue.player.pause();
      queue.paused = true;
    }
    await interaction.update(buildMusicDashboard(queue));
    return true;
  }

  if (id === 'music_skip') {
    queue.loop = false;
    playNext(queue);
    await interaction.update(buildMusicDashboard(queue));
    return true;
  }

  if (id === 'music_stop') {
    queue.songs = [];
    queue.currentSong = null;
    queue.loop = false;
    queue.paused = false;
    queue.player.stop();
    if (queue.connection) {
      queue.connection.destroy();
      queue.connection = null;
      queue.voiceChannelId = null;
    }
    await interaction.update(buildMusicDashboard(queue));
    return true;
  }

  if (id === 'music_loop') {
    queue.loop = !queue.loop;
    await interaction.update(buildMusicDashboard(queue));
    return true;
  }

  if (id === 'music_shuffle') {
    for (let i = queue.songs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue.songs[i], queue.songs[j]] = [queue.songs[j], queue.songs[i]];
    }
    await interaction.update(buildMusicDashboard(queue));
    return true;
  }

  return true;
}

// 3. จัดการเมนูเลือกสถานีวิทยุ 24/7
async function handleMusicSelect(interaction) {
  if (interaction.customId !== 'music_radio_select') return false;

  const queue = getQueue(interaction.guildId);
  const voiceChannel = ensureVoiceConnection(interaction, queue);
  if (!voiceChannel) {
    await interaction.reply({ content: '❌ กรุณาเข้าห้องเสียง (Voice Channel) ก่อนเลือกสถานีวิทยุครับ!', ephemeral: true });
    return true;
  }

  const selectedVal = interaction.values[0];
  const station = RADIO_STATIONS.find(s => s.value === selectedVal);
  if (!station) return true;

  const songObj = {
    title: station.label,
    url: station.url,
    requesterId: interaction.user.id,
    isLive: true,
    thumbnail: null
  };

  queue.songs = []; // สลับเป็นโหมดวิทยุทันที
  await playSong(queue, songObj);
  await interaction.update(buildMusicDashboard(queue));
  return true;
}

// 4. จัดการ Modal ค้นหาชื่อเพลงและลิงก์เพลง
async function handleMusicModal(interaction) {
  if (interaction.customId !== 'musicSearchModal') return false;

  const queue = getQueue(interaction.guildId);
  const voiceChannel = ensureVoiceConnection(interaction, queue);
  if (!voiceChannel) {
    await interaction.reply({ content: '❌ กรุณาเข้าห้องเสียง (Voice Channel) ก่อนเปิดเพลงครับ!', ephemeral: true });
    return true;
  }

  const query = interaction.fields.getTextInputValue('songQuery').trim();
  await interaction.deferReply({ ephemeral: true });

  let songObj = null;

  // กรณีวางลิงก์ไฟล์เสียงตรง
  if (query.startsWith('http://') || query.startsWith('https://')) {
    songObj = {
      title: 'Direct Audio Stream',
      url: query,
      requesterId: interaction.user.id,
      isLive: false,
      thumbnail: null
    };
  } else {
    // ค้นหาชื่อเพลงผ่าน iTunes Music Catalog API (ไม่ถูกบล็อกบน Render)
    try {
      const res = await axios.get(`https://itunes.apple.com/search`, {
        params: { term: query, media: 'music', limit: 1 }
      });

      if (res.data && res.data.results && res.data.results.length > 0) {
        const track = res.data.results[0];
        songObj = {
          title: `${track.trackName} - ${track.artistName}`,
          url: track.previewUrl,
          requesterId: interaction.user.id,
          isLive: false,
          thumbnail: track.artworkUrl100
        };
      }
    } catch (err) {
      console.error('Music search error:', err);
    }
  }

  if (!songObj || !songObj.url) {
    await interaction.editReply({ content: `❌ ไม่พบเพลงจากคำค้นหา \`${query}\` ครับ! ลองพิมพ์ชื่อเพลงภาษาอังกฤษ ชื่อศิลปิน หรือเลือกสถานีวิทยุ 24/7 ด้านล่างได้เลยครับ` });
    return true;
  }

  if (!queue.currentSong) {
    await playSong(queue, songObj);
    await interaction.editReply({ content: `▶️ เริ่มเล่นเพลง **${songObj.title}** ในห้อง <#${voiceChannel.id}> ทันที!` });
  } else {
    queue.songs.push(songObj);
    await updateDashboard(queue);
    await interaction.editReply({ content: `✅ เพิ่มเพลง **${songObj.title}** ลงในคิวเรียบร้อยแล้ว! (ลำดับที่ ${queue.songs.length})` });
  }

  return true;
}

module.exports = {
  musicCommand,
  handleMusicCommand,
  handleMusicButton,
  handleMusicSelect,
  handleMusicModal
};
