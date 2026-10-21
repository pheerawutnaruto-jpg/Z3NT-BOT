const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
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

// 📻 คลื่นวิทยุ 5 สไตล์
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
  .setDescription('📻 เปิดตู้เพลงวิทยุ 24/7 และใส่ลิงก์เพลงเองได้');

function buildJukeboxUI(session) {
  const activeKey = session?.stationKey;
  const st = activeKey ? STATIONS[activeKey] : null;

  const embed = new EmbedBuilder()
    .setTitle('📻 𝙕𝙀𝙉 𝙍𝘼𝘿𝙄𝙊 • 24/7 MUSIC LOUNGE')
    .setColor(st ? st.color : '#2B2D31');

  if (activeKey === 'custom_url') {
    embed.setDescription(
      `### 🟢 กำลังออกอากาศ: **🔗 Custom Audio URL**\n` +
      `> *เปิดเพลงจากลิงก์เสียงที่คุณกำหนดเอง*\n\n` +
      `🔊 **ห้องเสียง:** <#${session.voiceChannelId}>  •  🎧 **ดีเจผู้เปิด:** <@${session.djId}>`
    );
  } else if (st) {
    embed.setDescription(
      `### 🟢 กำลังออกอากาศ: **${st.name}**\n` +
      `> *${st.desc}*\n\n` +
      `🔊 **ห้องเสียง:** <#${session.voiceChannelId}>  •  🎧 **ดีเจผู้เปิด:** <@${session.djId}>`
    );
  } else {
    embed.setDescription(
      `### 💤 ตอนนี้วิทยุปิดอยู่\n` +
      `> *เข้าห้องเสียง แล้วจิ้มปุ่มคลื่นวิทยุ หรือใส่ลิงก์เพลงเองด้านล่างได้เลย!*`
    );
  }

  // แถวที่ 1: ปุ่มคลื่นวิทยุ 5 สถานีหลัก
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_st_lofi').setLabel('☕ Lofi').setStyle(activeKey === 'music_st_lofi' ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_st_pop').setLabel('🎤 Pop').setStyle(activeKey === 'music_st_pop' ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_st_edm').setLabel('🎧 EDM').setStyle(activeKey === 'music_st_edm' ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_st_gaming').setLabel('🎮 Gaming').setStyle(activeKey === 'music_st_gaming' ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_st_chill').setLabel('🌙 R&B').setStyle(activeKey === 'music_st_chill' ? ButtonStyle.Success : ButtonStyle.Secondary)
  );

  // แถวที่ 2: ปุ่มเพิ่มลิงก์ URL เอง + ปุ่มควบคุมเครื่องเล่น
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('music_open_url_modal')
      .setLabel('🔗 ใส่ลิงก์ URL เอง')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('music_toggle_pause')
      .setLabel(session?.paused ? '▶️ เล่นต่อ' : '⏸️ พักเสียง')
      .setStyle(session?.paused ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(!activeKey),
    new ButtonBuilder()
      .setCustomId('music_leave')
      .setLabel('⏹️ ปิดวิทยุ')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!activeKey)
  );

  return { embeds: [embed], components: [row1, row2] };
}

async function startRadioStream(session, streamUrl) {
  const response = await axios({
    method: 'get',
    url: streamUrl,
    responseType: 'stream',
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
    await interaction.reply({ content: '🎧 **เข้าห้องพูดคุย (Voice Channel) ก่อนนะครับ** ถึงจะกดใช้งานตู้เพลงได้!', ephemeral: true });
    return true;
  }

  const guildId = interaction.guildId;
  let session = radioSessions.get(guildId);

  // ปุ่มเปิดหน้าต่าง Modal สำหรับใส่ลิงก์ URL เอง
  if (id === 'music_open_url_modal') {
    const modal = new ModalBuilder()
      .setCustomId('musicCustomUrlModal')
      .setTitle('🔗 เปิดเพลงจากลิงก์ URL');

    const urlInput = new TextInputBuilder()
      .setCustomId('directAudioUrl')
      .setLabel('วางลิงก์ไฟล์เสียงตรง (.mp3 / .ogg / สตรีม)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://example.com/song.mp3')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(urlInput));
    await interaction.showModal(modal);
    return true;
  }

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

  // กรณีเลือกคลื่นวิทยุหลัก
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
        customUrl: null,
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

      radioSessions.set(guildId, session);
    }

    session.stationKey = id;
    session.customUrl = null;
    session.djId = interaction.user.id;
    session.paused = false;

    try {
      if (!session.connection || session.voiceChannelId !== memberVoice.id) {
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
      console.error('Radio stream error:', err);
      await interaction.followUp({ content: '❌ ไม่สามารถเชื่อมต่อห้องเสียงได้ กรุณาตรวจสอบสิทธิ์บอท', ephemeral: true });
    }
    return true;
  }

  return false;
}

// 🔗 จัดการรับค่าลิงก์ URL ที่สมาชิกกรอกเข้ามาผ่าน Modal
async function handleMusicModal(interaction) {
  if (interaction.customId !== 'musicCustomUrlModal') return false;

  const memberVoice = interaction.member.voice?.channel;
  if (!memberVoice) {
    await interaction.reply({ content: '❌ คุณหลุดออกจากห้องเสียงแล้ว!', ephemeral: true });
    return true;
  }

  const urlVal = interaction.fields.getTextInputValue('directAudioUrl').trim();
  if (!urlVal.startsWith('http://') && !urlVal.startsWith('https://')) {
    await interaction.reply({ content: '❌ ลิงก์ URL ไม่ถูกต้อง! ต้องขึ้นต้นด้วย http:// หรือ https://', ephemeral: true });
    return true;
  }

  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guildId;
  let session = radioSessions.get(guildId);

  if (!session) {
    const player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Play }
    });

    session = {
      guildId,
      voiceChannelId: memberVoice.id,
      djId: interaction.user.id,
      stationKey: 'custom_url',
      customUrl: urlVal,
      paused: false,
      connection: null,
      player
    };

    radioSessions.set(guildId, session);
  } else {
    session.stationKey = 'custom_url';
    session.customUrl = urlVal;
    session.djId = interaction.user.id;
    session.paused = false;
  }

  try {
    if (!session.connection || session.voiceChannelId !== memberVoice.id) {
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

    await startRadioStream(session, urlVal);
    
    // อัปเดตหน้าแผงตู้เพลงหลัก
    if (session.dashboardMsg) {
      await session.dashboardMsg.edit(buildJukeboxUI(session)).catch(() => {});
    }

    await interaction.editReply({ content: `✅ เริ่มเปิดเพลงจากลิงก์ URL ของคุณในห้อง <#${memberVoice.id}> เรียบร้อยแล้ว!` });
  } catch (err) {
    console.error('Custom URL play error:', err);
    await interaction.editReply({ content: '❌ ไม่สามารถเล่นเพลงจากลิงก์นี้ได้ (ลิงก์อาจไม่ใช่ไฟล์เสียงตรง หรือเซิร์ฟเวอร์ปลายทางไม่อนุญาต)' });
  }

  return true;
}

async function handleMusicSelect() { return false; }

module.exports = {
  musicCommand,
  handleMusicCommand,
  handleMusicButton,
  handleMusicSelect,
  handleMusicModal
};
