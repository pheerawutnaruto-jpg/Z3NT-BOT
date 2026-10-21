const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus, 
  VoiceConnectionStatus, 
  entersState, 
  NoSubscriberBehavior,
  StreamType
} = require('@discordjs/voice');
const axios = require('axios');
const ffmpegPath = require('ffmpeg-static');

if (ffmpegPath) {
  process.env.FFMPEG_PATH = ffmpegPath;
}

const radioSessions = new Map();

const STATIONS = {
  music_st_lofi: {
    name: '☕ Lofi Chill & Study',
    desc: 'บีทสบายๆ ฟังเพลินตอนนั่งชิลล์ ทำงาน หรือคุยเล่นกับเพื่อน',
    url: 'https://streams.ilovemusic.de/iloveradio17.mp3',
    color: '#FF99CC'
  },
  music_st_pop: {
    name: '🎤 Global Pop Hits',
    desc: 'เพลงสากลฮิตติดชาร์ต ฟังสนุก ร้องตามได้ทั้งวัน',
    url: 'https://streams.ilovemusic.de/iloveradio1.mp3',
    color: '#00FFCC'
  },
  music_st_edm: {
    name: '🎧 EDM & Party Beats',
    desc: 'บีทอิเล็กทรอนิกส์และแดนซ์มันส์ๆ ปลุกเอเนอร์จี้',
    url: 'https://streams.ilovemusic.de/iloveradio2.mp3',
    color: '#FFCC00'
  },
  music_st_gaming: {
    name: '🎮 Gaming & Phonk',
    desc: 'เพลงจังหวะเท่ๆ ดุดัน เพิ่มความตื่นเต้นเวลาเล่นเกม',
    url: 'https://streams.ilovemusic.de/iloveradio109.mp3',
    color: '#FF3366'
  },
  music_st_chill: {
    name: '🌙 Night Cafe & R&B',
    desc: 'เพลงนุ่มๆ บรรยากาศคาเฟ่ยามดึกสำหรับคนนอนดึก',
    url: 'https://streams.ilovemusic.de/iloveradio10.mp3',
    color: '#9966FF'
  }
};

const musicCommand = new SlashCommandBuilder()
  .setName('music')
  .setDescription('📻 เปิดตู้เพลงวิทยุ 24/7 (กดปุ่มเลือกคลื่นฟังได้ทันที)');

function buildJukeboxUI(session) {
  const activeKey = session?.stationKey;
  const st = activeKey ? STATIONS[activeKey] : null;

  const embed = new EmbedBuilder()
    .setTitle('📻 𝙕𝙀𝙉 𝙍𝘼𝘿𝙄𝙊 • 24/7 MUSIC LOUNGE')
    .setColor(st ? st.color : '#2B2D31');

  if (st) {
    embed.setDescription(
      `### 🟢 กำลังออกอากาศ: **${st.name}**\n` +
      `> *${st.desc}*\n\n` +
      `🔊 **ห้องเสียง:** <#${session.voiceChannelId}>  •  🎧 **ดีเจผู้เปิด:** <@${session.djId}>`
    );
  } else {
    embed.setDescription(
      `### 💤 ตอนนี้วิทยุปิดอยู่\n` +
      `> *เข้าห้องเสียง (Voice Channel) แล้วจิ้มปุ่มคลื่นวิทยุด้านล่างเพื่อเปิดเพลงฟังได้เลย!*`
    );
  }

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_st_lofi').setLabel('☕ Lofi Chill').setStyle(activeKey === 'music_st_lofi' ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_st_pop').setLabel('🎤 Pop Hits').setStyle(activeKey === 'music_st_pop' ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_st_edm').setLabel('🎧 EDM Party').setStyle(activeKey === 'music_st_edm' ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_st_gaming').setLabel('🎮 Gaming').setStyle(activeKey === 'music_st_gaming' ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_st_chill').setLabel('🌙 Night R&B').setStyle(activeKey === 'music_st_chill' ? ButtonStyle.Success : ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_toggle_pause').setLabel(session?.paused ? '▶️ เล่นต่อ' : '⏸️ พักเสียงชั่วคราว').setStyle(session?.paused ? ButtonStyle.Success : ButtonStyle.Primary).setDisabled(!st),
    new ButtonBuilder().setCustomId('music_leave').setLabel('⏹️ ปิดวิทยุ / ออกจากห้อง').setStyle(ButtonStyle.Danger).setDisabled(!st)
  );

  return { embeds: [embed], components: [row1, row2] };
}

async function startRadioStream(session, stationUrl) {
  const response = await axios({
    method: 'get',
    url: stationUrl,
    responseType: 'stream',
    timeout: 10000,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });

  const resource = createAudioResource(response.data, {
    inputType: StreamType.Arbitrary,
    inlineVolume: true
  });

  if (resource.volume) {
    resource.volume.setVolume(0.8);
  }

  session.player.play(resource);
}

async function handleMusicCommand(interaction) {
  const guildId = interaction.guildId;
  const session = radioSessions.get(guildId) || null;
  await interaction.reply(buildJukeboxUI(session));
  return true;
}

async function handleMusicButton(interaction) {
  const id = interaction.customId;
  if (!id.startsWith('music_')) return false;

  const memberVoice = interaction.member.voice?.channel;
  if (!memberVoice) {
    await interaction.reply({ content: '🎧 **เข้าห้องพูดคุย (Voice Channel) ก่อนนะครับ** แล้วค่อยมากดปุ่มเปิดวิทยุ!', ephemeral: true });
    return true;
  }

  // เช็กสิทธิ์ Connect และ Speak ของบอทในห้องนั้น
  const permissions = memberVoice.permissionsFor(interaction.client.user);
  if (!permissions || !permissions.has('Connect') || !permissions.has('Speak')) {
    await interaction.reply({ content: '❌ บอทไม่มีสิทธิ์ **Connect** หรือ **Speak** ในห้องเสียงนี้ กรุณาตรวจสอบสิทธิ์ของยศบอทครับ', ephemeral: true });
    return true;
  }

  const guildId = interaction.guildId;
  let session = radioSessions.get(guildId);

  if (id === 'music_leave') {
    if (session) {
      session.player.stop();
      if (session.connection) session.connection.destroy();
      radioSessions.delete(guildId);
    }
    await interaction.update(buildJukeboxUI(null));
    return true;
  }

  if (id === 'music_toggle_pause') {
    if (!session) return true;
    if (session.paused) {
      session.player.unpause();
      session.paused = false;
    } else {
      session.player.pause();
      session.paused = true;
    }
    await interaction.update(buildJukeboxUI(session));
    return true;
  }

  if (STATIONS[id]) {
    await interaction.deferUpdate();

    if (!session) {
      const player = createAudioPlayer({
        behaviors: { noSubscriber: NoSubscriberBehavior.Play }
      });

      session = {
        guildId,
        voiceChannelId: memberVoice.id,
        djId: interaction.user.id,
        stationKey: id,
        paused: false,
        connection: null,
        player
      };

      player.on(AudioPlayerStatus.Idle, () => {
        const currentSt = STATIONS[session.stationKey];
        if (currentSt && !session.paused) {
          startRadioStream(session, currentSt.url).catch(() => {});
        }
      });

      player.on('error', err => {
        console.error('Radio Player Error:', err);
      });

      radioSessions.set(guildId, session);
    }

    session.stationKey = id;
    session.djId = interaction.user.id;
    session.paused = false;

    try {
      if (!session.connection || session.voiceChannelId !== memberVoice.id) {
        if (session.connection) {
          session.connection.destroy();
        }

        const connection = joinVoiceChannel({
          channelId: memberVoice.id,
          guildId: guildId,
          adapterCreator: interaction.guild.voiceAdapterCreator,
          selfDeaf: true,
          selfMute: false
        });

        await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
        connection.subscribe(session.player);
        session.connection = connection;
        session.voiceChannelId = memberVoice.id;
      }

      await startRadioStream(session, STATIONS[id].url);
      await interaction.editReply(buildJukeboxUI(session));
    } catch (err) {
      console.error('Radio connection/stream error:', err);
      await interaction.followUp({ content: '❌ ไม่สามารถเชื่อมต่อห้องเสียงหรือส่งสัญญาณเสียงได้ กรุณาลองใหม่อีกครั้งครับ', ephemeral: true });
    }
    return true;
  }

  return false;
}

async function handleMusicSelect() { return false; }
async function handleMusicModal() { return false; }

module.exports = {
  musicCommand,
  handleMusicCommand,
  handleMusicButton,
  handleMusicSelect,
  handleMusicModal
};
