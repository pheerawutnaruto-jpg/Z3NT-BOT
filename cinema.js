งั้นลองดูโค้ดทั้งหมด

// artist_card.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const { ROLES, IMAGES, COLORS } = require('./constants');
const { isServerPremium } = require('./license');

const setupArtistCommand = new SlashCommandBuilder()
  .setName('setup-artist-card')
  .setDescription('💎 [PREMIUM] ส่งแผงปุ่มตั้งค่ารูปการ์ดส่วนตัวสำหรับคนมียศ Artist (สำหรับ Admin)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function handleSetupArtistCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
    return true;
  }

  const embed = new EmbedBuilder()
    .setTitle('<a:emoji_146:1564300643378667670> 𝙕𝙀𝙉 𝘽𝙊𝙏 • ARTIST CARD')
    .setDescription(
      'สำหรับยศ `Artist` หรือ `Artist | 3d`'
    )
    .setColor(COLORS.PINK)
    .setImage(IMAGES.ARTIST_BANNER);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('open_artist_level_card_modal')
      .setLabel('เปลี่ยนรูปการ์ด Level')
      .setEmoji('<:emoji_143:1564202161309483048>')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('open_artist_wallet_card_modal')
      .setLabel('เปลี่ยนรูปการ์ด Wallet')
      .setEmoji('<a:emoji_100:1560416789211516938>')
      .setStyle(ButtonStyle.Success)
  );

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ ส่งแผงปุ่มตั้งค่าการ์ด Artist ไปยังห้องนี้สำเร็จแล้ว!', ephemeral: true });
  return true;
}

async function handleArtistButton(interaction, serverConfigs) {
  if (interaction.customId !== 'open_artist_level_card_modal' && interaction.customId !== 'open_artist_wallet_card_modal') return false;

  const guildId = interaction.guildId;
  if (!(await isServerPremium(guildId, serverConfigs))) {
    await interaction.reply({ content: '❌ ฟีเจอร์นี้ใช้งานได้เฉพาะเซิร์ฟเวอร์พรีเมียมเท่านั้นครับ!', ephemeral: true });
    return true;
  }

  const userId = interaction.user.id;
  const member = interaction.member;
  const config = serverConfigs[guildId] || {};
  const userStat = config.levels?.[userId] || {};
  const now = Date.now();

  const hasArtistRole = member.roles.cache.has(ROLES.ARTIST_PERM);
  const hasArtist3dRole = member.roles.cache.has(ROLES.ARTIST_TEMP);
  const hasTempAccess = userStat.artistUntil && userStat.artistUntil > now;

  if (!hasArtistRole && !hasArtist3dRole && !hasTempAccess) {
    await interaction.reply({
      content: '❌ คุณไม่มีสิทธิ์ใช้งาน! เฉพาะผู้ที่มี **ยศ Artist** หรือ **Artist | 3d** เท่านั้นที่จะเปลี่ยนพื้นหลังการ์ดได้',
      ephemeral: true
    });
    return true;
  }

  const isWallet = interaction.customId === 'open_artist_wallet_card_modal';
  const modal = new ModalBuilder()
    .setCustomId(isWallet ? 'artistWalletCardModal' : 'artistLevelCardModal')
    .setTitle(isWallet ? '💰 ปรับแต่งรูปการ์ด Wallet ส่วนตัว' : '🎨 ปรับแต่งรูปการ์ด Level ส่วนตัว');

  const imageUrlInput = new TextInputBuilder()
    .setCustomId('cardImageUrl')
    .setLabel('ลิงก์รูปภาพพื้นหลัง (Image URL)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://example.com/my-image.png')
    .setValue(isWallet ? (userStat.customWalletTheme || '') : (userStat.customTheme || ''))
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(imageUrlInput));
  await interaction.showModal(modal).catch(() => {});
  return true;
}

async function handleArtistModalSubmit(interaction, serverConfigs, saveConfigs) {
  if (interaction.customId !== 'artistLevelCardModal' && interaction.customId !== 'artistWalletCardModal') return false;

  await interaction.deferReply({ ephemeral: true }).catch(() => {});

  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const imageUrl = interaction.fields.getTextInputValue('cardImageUrl').trim();

  if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
    await interaction.editReply({ content: '❌ ลิงก์ไม่ถูกต้อง! กรุณาระบุลิงก์รูปภาพที่ขึ้นต้นด้วย http:// หรือ https://' });
    return true;
  }

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].levels) serverConfigs[guildId].levels = {};
  if (!serverConfigs[guildId].levels[userId]) {
    serverConfigs[guildId].levels[userId] = {
      xp: 0, level: 1, orbs: 0, lastDaily: 0,
      boostUntil: 0, artistUntil: 0, cinemaPermUntil: 0, cinemaTempUntil: 0,
      customTheme: '', customWalletTheme: ''
    };
  }

  const isWallet = interaction.customId === 'artistWalletCardModal';
  if (isWallet) {
    serverConfigs[guildId].levels[userId].customWalletTheme = imageUrl;
  } else {
    serverConfigs[guildId].levels[userId].customTheme = imageUrl;
  }
  await saveConfigs(serverConfigs);

  await interaction.editReply({ content: `✅ บันทึกรูปภาพพื้นหลังการ์ดสำเร็จ! ลองพิมพ์ \`${isWallet ? '/coins' : '/level'}\` ดูการเปลี่ยนแปลงได้เลย` });
  return true;
}

module.exports = {
  setupArtistCommand,
  handleSetupArtistCommand,
  handleArtistButton,
  handleArtistModalSubmit
};

// auto_cinema.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder } = require('discord.js');
const cron = require('node-cron');
const { ROLES, IMAGES, COLORS } = require('./constants');
const { isServerPremium } = require('./license');

const autoCinemaCommand = new SlashCommandBuilder()
  .setName('auto-cinema')
  .setDescription('⏰ [CINEMA] แผงควบคุมรอบฉาย NOW SHOWING (สำหรับ Admin)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function handleAutoCinemaCommand(interaction, serverConfigs) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
  }

  const guildId = interaction.guildId;
  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].autoCinema) {
    serverConfigs[guildId].autoCinema = {
      enabled: false,
      timeStr: '20:00',
      showTimeStr: '20:00',
      channelId: null,
      roleId: ROLES.CINEMA_PERM,
      title: 'ภาพยนตร์รอบพิเศษประจำวัน',
      imageUrl: IMAGES.DEFAULT_CINEMA
    };
  }

  return await interaction.reply({ ...getAutoCinemaDashboard(serverConfigs[guildId].autoCinema), ephemeral: true });
}

function getAutoCinemaDashboard(config) {
  const channelText = config.channelId ? `<#${config.channelId}>` : 'ยังไม่ได้เลือกห้อง';
  const roleText = `<@&${config.roleId || ROLES.CINEMA_PERM}>`;
  const statusText = config.enabled ? '✅ เปิดใช้งานอยู่' : '❌ ปิดใช้งานอยู่';

  const embed = new EmbedBuilder()
    .setTitle('⏰ 𝙕𝙀𝙉 𝘾𝙄𝙉𝙀𝙈𝘼 • NOW SHOWING CONTROL PANEL')
    .setDescription('แผงควบคุมรอบฉาย NOW SHOWING สามารถตั้งเวลาส่งอัตโนมัติ ชื่อเรื่อง เวลาฉาย รูปภาพ และทดลองส่งได้ที่นี่ครับ')
    .setColor(COLORS.RED)
    .addFields(
      { name: '📥 สถานะระบบ', value: statusText, inline: true },
      { name: '⏰ เวลาส่งอัตโนมัติ (Cron HH:MM)', value: `\`${config.timeStr || '20:00'}\``, inline: true },
      { name: '🎬 เวลาฉายบนการ์ด', value: `\`${config.showTimeStr || '20:00'}\``, inline: true },
      { name: '📢 ห้องส่งประกาศ', value: channelText, inline: true },
      { name: '👥 ยศที่แท็ก', value: roleText, inline: true },
      { name: '🎬 ชื่อเรื่องภาพยนตร์', value: `\`${config.title || 'ภาพยนตร์รอบพิเศษประจำวัน'}\``, inline: false }
    );

  const toggleBtn = new ButtonBuilder()
    .setCustomId('autocinema_toggle')
    .setLabel(config.enabled ? '🔴 ปิดระบบอัตโนมัติ' : '🟢 เปิดระบบอัตโนมัติ')
    .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success);

  const row1 = new ActionRowBuilder().addComponents(
    toggleBtn,
    new ButtonBuilder()
      .setCustomId('autocinema_edit_info')
      .setLabel('✏️ ตั้งค่าข้อมูล (เวลา/ชื่อ/รูป)')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('autocinema_edit_role')
      .setLabel('👑 เปลี่ยนยศที่แท็ก')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('autocinema_test_send')
      .setLabel('🚀 ทดลองส่งเข้าห้องจริง (ลบใน 20 นาที)')
      .setStyle(ButtonStyle.Secondary)
  );

  const channelRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('autocinema_select_channel')
      .setPlaceholder('📂 เลือกห้องสำหรับส่งประกาศ NOW SHOWING')
      .addChannelTypes(ChannelType.GuildText)
  );

  return { embeds: [embed], components: [row1, channelRow] };
}

let activeAutoCinemaCrons = {};

function setupAutoCinemaCron(guildId, timeStr, channelId, client, serverConfigs) {
  if (activeAutoCinemaCrons[guildId]) {
    activeAutoCinemaCrons[guildId].stop();
    delete activeAutoCinemaCrons[guildId];
  }

  const [hour, minute] = (timeStr || '').split(':');
  if (!hour || !minute) return;

  const cronExpression = `${minute} ${hour} * * *`;

  activeAutoCinemaCrons[guildId] = cron.schedule(cronExpression, async () => {
    try {
      if (!(await isServerPremium(guildId, serverConfigs))) return;

      const config = serverConfigs[guildId]?.autoCinema;
      if (!config || !config.enabled) return;

      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return;
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) return;

      const imageUrl = (config.imageUrl && config.imageUrl.trim() !== '') ? config.imageUrl.trim() : IMAGES.DEFAULT_CINEMA;

      const embed = new EmbedBuilder()
        .setTitle('🍿 𝙕𝙀𝙉 𝘾𝙄𝙉𝙀𝙈𝘼 • NOW SHOWING')
        .setDescription(
          `🎬 **ชื่อเรื่อง:** ${config.title}\n` +
          `⏰ **เวลาฉาย:** ${config.showTimeStr || config.timeStr}`
        )
        .setColor(COLORS.RED)
        .setImage(imageUrl)
        .setFooter({ text: `วันที่ฉาย: ${new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })}` });

      const sentMsg = await channel.send({
        content: `<@&${config.roleId || ROLES.CINEMA_PERM}>`,
        embeds: [embed]
      });

      setTimeout(async () => {
        try {
          if (sentMsg) await sentMsg.delete().catch(() => {});
        } catch (e) {}
      }, 20 * 60 * 1000);

      console.log(`✅ ส่ง Auto-Cinema NOW SHOWING สำเร็จสำหรับ Guild ${guildId} เวลา ${timeStr} (จะลบใน 20 นาที)`);
    } catch (err) {
      console.error(`❌ Error auto cinema cron for guild ${guildId}:`, err);
    }
  }, { timezone: "Asia/Bangkok" });
}

function loadAllAutoCinemaCrons(client, serverConfigs) {
  for (const guildId in serverConfigs) {
    const config = serverConfigs[guildId];
    if (config?.autoCinema?.enabled && config.autoCinema.timeStr && config.autoCinema.channelId) {
      setupAutoCinemaCron(guildId, config.autoCinema.timeStr, config.autoCinema.channelId, client, serverConfigs);
    }
  }
}

async function handleAutoCinemaButton(interaction, serverConfigs, saveConfigs, client) {
  const id = interaction.customId;
  const autoCinemaBtns = ['autocinema_toggle', 'autocinema_edit_info', 'autocinema_edit_role', 'autocinema_test_send'];
  if (!autoCinemaBtns.includes(id)) return false;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้นถึงจะกดใช้งานปุ่มนี้ได้!', ephemeral: true });
    return true;
  }

  const guildId = interaction.guildId;
  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].autoCinema) {
    serverConfigs[guildId].autoCinema = {
      enabled: false, timeStr: '20:00', showTimeStr: '20:00', channelId: null, roleId: ROLES.CINEMA_PERM,
      title: 'ภาพยนตร์รอบพิเศษประจำวัน', imageUrl: IMAGES.DEFAULT_CINEMA
    };
  }
  const config = serverConfigs[guildId].autoCinema;

  if (id === 'autocinema_toggle') {
    config.enabled = !config.enabled;
    await saveConfigs(serverConfigs);

    if (config.enabled && config.channelId && config.timeStr) {
      setupAutoCinemaCron(guildId, config.timeStr, config.channelId, client, serverConfigs);
    } else if (!config.enabled && activeAutoCinemaCrons[guildId]) {
      activeAutoCinemaCrons[guildId].stop();
      delete activeAutoCinemaCrons[guildId];
    }

    await interaction.update(getAutoCinemaDashboard(config)).catch(() => {});
    return true;
  }

  if (id === 'autocinema_edit_info') {
    const modal = new ModalBuilder().setCustomId('autoCinemaInfoModal').setTitle('ตั้งค่ารอบฉาย NOW SHOWING');
    const timeInput = new TextInputBuilder().setCustomId('timeInput').setLabel('เวลาส่งอัตโนมัติ (HH:MM เช่น 20:00)').setStyle(TextInputStyle.Short).setValue(config.timeStr || '').setRequired(true);
    const showTimeInput = new TextInputBuilder().setCustomId('showTimeInput').setLabel('เวลาฉายบนการ์ด (เช่น 20:00)').setStyle(TextInputStyle.Short).setValue(config.showTimeStr || config.timeStr || '').setRequired(true);
    const titleInput = new TextInputBuilder().setCustomId('titleInput').setLabel('ชื่อภาพยนตร์').setStyle(TextInputStyle.Short).setValue(config.title || '').setRequired(true);
    const imageInput = new TextInputBuilder().setCustomId('imageInput').setLabel('ลิงก์รูปภาพโปสเตอร์ (Image URL)').setStyle(TextInputStyle.Short).setValue(config.imageUrl || '').setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(timeInput),
      new ActionRowBuilder().addComponents(showTimeInput),
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(imageInput)
    );
    await interaction.showModal(modal).catch(() => {});
    return true;
  }

  if (id === 'autocinema_edit_role') {
    const modal = new ModalBuilder().setCustomId('autoCinemaRoleModal').setTitle('เปลี่ยนยศประกาศ NOW SHOWING');
    const roleInput = new TextInputBuilder().setCustomId('roleIdInput').setLabel('ระบุ Role ID ที่ต้องการแท็ก').setStyle(TextInputStyle.Short).setValue(config.roleId || ROLES.CINEMA_PERM).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(roleInput));
    await interaction.showModal(modal).catch(() => {});
    return true;
  }

  if (id === 'autocinema_test_send') {
    if (!config.channelId) {
      await interaction.reply({ content: '❌ กรุณาเลือกห้องส่งประกาศจากเมนูด้านล่างแผงควบคุมก่อนทดลองส่งครับ!', ephemeral: true });
      return true;
    }

    await interaction.deferReply({ ephemeral: true }).catch(() => {});

    try {
      const channel = await interaction.guild.channels.fetch(config.channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) {
        await interaction.editReply({ content: '❌ ไม่พบห้องที่เลือก กรุณาเลือกห้องใหม่อีกครั้งครับ' });
        return true;
      }

      const imageUrl = (config.imageUrl && config.imageUrl.trim() !== '') ? config.imageUrl.trim() : IMAGES.DEFAULT_CINEMA;

      const embed = new EmbedBuilder()
        .setTitle('🍿 𝙕𝙀𝙉 𝘾𝙄𝙉𝙀𝙈𝘼 • NOW SHOWING')
        .setDescription(
          `🎬 **ชื่อเรื่อง:** ${config.title}\n` +
          `⏰ **เวลาฉาย:** ${config.showTimeStr || config.timeStr}`
        )
        .setColor(COLORS.RED)
        .setImage(imageUrl)
        .setFooter({ text: `วันที่ฉาย: ${new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })}` });

      const sentMsg = await channel.send({
        content: `🧪 **[ทดลองส่งเข้าห้องจริง] (ข้อความนี้จะหายไปเองใน 20 นาที):** <@&${config.roleId || ROLES.CINEMA_PERM}>`,
        embeds: [embed]
      });

      setTimeout(async () => {
        try {
          if (sentMsg) await sentMsg.delete().catch(() => {});
        } catch (e) {}
      }, 20 * 60 * 1000);

      await interaction.editReply({ content: `✅ ส่งข้อความทดลองไปยังห้อง <#${config.channelId}> เรียบร้อยแล้ว! (ข้อความจะหายไปใน 20 นาที)` });
      return true;
    } catch (err) {
      console.error('Error testing auto cinema:', err);
      await interaction.editReply({ content: '❌ เกิดข้อผิดพลาดในการทดลองส่ง กรุณาตรวจสอบสิทธิ์ของบอทครับ' });
      return true;
    }
  }

  return false;
}

async function handleAutoCinemaSelect(interaction, serverConfigs, saveConfigs, client) {
  if (interaction.customId !== 'autocinema_select_channel') return false;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้นถึงจะเลือกห้องนี้ได้!', ephemeral: true });
    return true;
  }

  const guildId = interaction.guildId;
  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};

  const channelId = interaction.values[0];
  if (!serverConfigs[guildId].autoCinema) {
    serverConfigs[guildId].autoCinema = {
      enabled: false, timeStr: '20:00', showTimeStr: '20:00', roleId: ROLES.CINEMA_PERM,
      title: 'ภาพยนตร์รอบพิเศษประจำวัน', imageUrl: IMAGES.DEFAULT_CINEMA
    };
  }
  serverConfigs[guildId].autoCinema.channelId = channelId;
  await saveConfigs(serverConfigs);

  if (serverConfigs[guildId].autoCinema.enabled && serverConfigs[guildId].autoCinema.timeStr) {
    setupAutoCinemaCron(guildId, serverConfigs[guildId].autoCinema.timeStr, channelId, client, serverConfigs);
  }

  await interaction.update(getAutoCinemaDashboard(serverConfigs[guildId].autoCinema)).catch(() => {});
  return true;
}

async function handleAutoCinemaModal(interaction, serverConfigs, saveConfigs, client) {
  const modalIds = ['autoCinemaInfoModal', 'autoCinemaRoleModal'];
  if (!modalIds.includes(interaction.customId)) return false;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้นถึงจะบันทึกค่าได้!', ephemeral: true });
    return true;
  }

  const guildId = interaction.guildId;
  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};

  if (interaction.customId === 'autoCinemaInfoModal') {
    if (!serverConfigs[guildId].autoCinema) serverConfigs[guildId].autoCinema = {};
    const config = serverConfigs[guildId].autoCinema;

    const timeVal = interaction.fields.getTextInputValue('timeInput').trim();
    if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeVal)) {
      config.timeStr = timeVal;
    }
    const showTimeVal = interaction.fields.getTextInputValue('showTimeInput').trim();
    if (showTimeVal) config.showTimeStr = showTimeVal;

    config.title = interaction.fields.getTextInputValue('titleInput').trim();
    const imgVal = interaction.fields.getTextInputValue('imageInput').trim();
    if (imgVal) config.imageUrl = imgVal;

    await saveConfigs(serverConfigs);

    if (config.enabled && config.channelId && config.timeStr) {
      setupAutoCinemaCron(guildId, config.timeStr, config.channelId, client, serverConfigs);
    }

    await interaction.reply({ content: '✅ บันทึกการตั้งค่า NOW SHOWING เรียบร้อยแล้ว!', ephemeral: true });
    return true;
  }

  if (interaction.customId === 'autoCinemaRoleModal') {
    if (!serverConfigs[guildId].autoCinema) serverConfigs[guildId].autoCinema = {};
    const config = serverConfigs[guildId].autoCinema;

    config.roleId = interaction.fields.getTextInputValue('roleIdInput').trim();
    await saveConfigs(serverConfigs);
    await interaction.reply({ content: `✅ เปลี่ยนยศประกาศ NOW SHOWING เป็น <@&${config.roleId}> เรียบร้อยแล้ว!`, ephemeral: true });
    return true;
  }

  return false;
}

module.exports = {
  autoCinemaCommand,
  handleAutoCinemaCommand,
  handleAutoCinemaButton,
  handleAutoCinemaSelect,
  handleAutoCinemaModal,
  loadAllAutoCinemaCrons
};

// canvas_card.js
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { AttachmentBuilder } = require('discord.js');

// 🛡️ Helper Function: วาดสี่เหลี่ยมขอบมนแบบปลอดภัย (ป้องกัน roundRect พัง)
function safeRoundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
  }
  ctx.closePath();
}

// 🛡️ Helper Function: โหลดรูปภาพแบบมี Timeout ป้องกันลิงก์เสียทำให้บอทค้าง
async function safeLoadImage(url) {
  if (!url || typeof url !== 'string' || !url.trim().startsWith('http')) return null;
  try {
    return await Promise.race([
      loadImage(url.trim()),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Image load timeout')), 5000))
    ]);
  } catch (e) {
    return null;
  }
}

// 📊 การ์ดเลเวลหลักของบอท
async function generateProfileCard(user, userStat, lConfig = {}) {
  const canvas = createCanvas(930, 280);
  const ctx = canvas.getContext('2d');

  const multiplier = Math.max(10, lConfig.xpMultiplier || 100);
  const currentXp = userStat.xp || 0;
  const currentLevel = userStat.level || 1;
  const requiredXp = currentLevel * multiplier;
  const progress = Math.min(Math.max(currentXp / requiredXp, 0), 1);
  const themeColor = lConfig.embedColor || '#66FFFF';

  // 1. พื้นหลังเริ่มต้น
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. รูปพื้นหลัง (ถ้ามี)
  const bgUrl = userStat.customTheme || lConfig.statsCardImageUrl;
  const bgImage = await safeLoadImage(bgUrl);
  if (bgImage) {
    ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
  }

  // 3. เลเยอร์กรองแสงและกรอบ
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(20, 20, canvas.width - 40, canvas.height - 40);

  ctx.strokeStyle = themeColor;
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  // 4. รูปโปรไฟล์ผู้ใช้
  const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 });
  const avatar = await safeLoadImage(avatarUrl);
  if (avatar) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(110, 140, 65, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, 45, 75, 130, 130);
    ctx.restore();
  }

  ctx.strokeStyle = themeColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(110, 140, 65, 0, Math.PI * 2, true);
  ctx.stroke();

  // 5. ข้อความและตัวเลข
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText(user.username, 210, 100);

  ctx.fillStyle = themeColor;
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`LEVEL ${currentLevel}`, canvas.width - 50, 95);

  ctx.fillStyle = '#AAAAAA';
  ctx.font = '20px sans-serif';
  ctx.fillText(`XP: ${currentXp} / ${requiredXp}`, canvas.width - 50, 130);
  ctx.textAlign = 'left';

  // 6. หลอด EXP
  const barX = 210;
  const barY = 170;
  const barWidth = 670;
  const barHeight = 30;
  const radius = 15;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  safeRoundRect(ctx, barX, barY, barWidth, barHeight, radius);
  ctx.fill();

  if (progress > 0) {
    ctx.fillStyle = themeColor;
    safeRoundRect(ctx, barX, barY, Math.max(barWidth * progress, radius * 2), barHeight, radius);
    ctx.fill();
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.floor(progress * 100)}%`, barX + (barWidth / 2), barY + 20);
  ctx.textAlign = 'left';

  return new AttachmentBuilder(await canvas.encode('png'), { name: 'profile-card.png' });
}

// 💰 การ์ดกระเป๋าเงิน (Wallet)
async function generateWalletCard(user, userStat = {}) {
  const canvas = createCanvas(930, 260);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#11111f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const bgImage = await safeLoadImage(userStat.customWalletTheme);
  if (bgImage) {
    ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
  }

  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(20, 20, canvas.width - 40, canvas.height - 40);

  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 });
  const avatar = await safeLoadImage(avatarUrl);
  if (avatar) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(110, 130, 55, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, 55, 75, 110, 110);
    ctx.restore();
  }

  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(110, 130, 55, 0, Math.PI * 2, true);
  ctx.stroke();

  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('ZEN BOT • OFFICIAL WALLET', 200, 75);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(user.username, 200, 125);

  ctx.fillStyle = '#AAAAAA';
  ctx.font = '20px sans-serif';
  ctx.fillText('ZEN COINS BALANCE:', 200, 175);

  const coins = userStat.orbs || 0;
  ctx.fillStyle = '#00FF66';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText(`${coins.toLocaleString()} COINS`, 470, 178);

  return new AttachmentBuilder(await canvas.encode('png'), { name: 'wallet-card.png' });
}

// 🚪 การ์ดต้อนรับ (Welcome Card)
async function generateWelcomeCard(member) {
  const canvas = createCanvas(930, 320);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0f0f1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(20, 20, 35, 0.85)';
  safeRoundRect(ctx, 20, 20, canvas.width - 40, canvas.height - 40, 20);
  ctx.fill();

  ctx.strokeStyle = '#66FFFF';
  ctx.lineWidth = 3;
  safeRoundRect(ctx, 20, 20, canvas.width - 40, canvas.height - 40, 20);
  ctx.stroke();

  const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
  const avatar = await safeLoadImage(avatarUrl);
  if (avatar) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(130, 160, 75, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, 55, 85, 150, 150);
    ctx.restore();
  }

  // กรอบวงกลมรอบรูปโปรไฟล์ (ลบ catch ที่เกินออกแล้ว)
  ctx.strokeStyle = '#66FFFF';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(130, 160, 75, 0, Math.PI * 2, true);
  ctx.stroke();

  ctx.fillStyle = '#66FFFF';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('WELCOME TO THE SERVER', 240, 105);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 38px sans-serif';
  ctx.fillText(member.user.username, 240, 155);

  ctx.fillStyle = '#AAAAAA';
  ctx.font = '22px sans-serif';
  ctx.fillText(`Member #${member.guild.memberCount} • Enjoy your stay!`, 240, 205);

  // กล่องข้อความ ZEN TH COMMUNITY ด้านล่าง
  ctx.fillStyle = 'rgba(102, 255, 255, 0.15)';
  ctx.beginPath();
  ctx.roundRect(240, 225, 280, 40, 10);
  ctx.fill();

  ctx.fillStyle = '#66FFFF';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('ZEN TH COMMUNITY', 260, 252);

  return new AttachmentBuilder(await canvas.encode('png'), { name: 'welcome-card.png' });
}
module.exports = { generateProfileCard, generateWalletCard, generateWelcomeCard };

// cinema.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder } = require('discord.js');
const { ROLES, IMAGES, COLORS } = require('./constants');
const { isServerPremium } = require('./license');

const setupCinemaCommand = new SlashCommandBuilder()
  .setName('cinema-setup')
  .setDescription('🎬 [CINEMA] ส่งแผงป้าย Box Office จุดจำหน่ายตั๋ว (สำหรับ Admin)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('เลือกห้องสำหรับส่งแผงตั๋วภาพยนตร์')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('image')
      .setDescription('ลิงก์รูปภาพประกอบ Box Office (ไม่ใส่จะใช้ค่าเริ่มต้น)')
      .setRequired(false)
  );

async function handleSetupCinemaCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
    return true;
  }

  const channel = interaction.options.getChannel('channel');
  const customImage = interaction.options.getString('image');
  const imageUrl = (customImage && customImage.trim() !== '') ? customImage.trim() : IMAGES.DEFAULT_CINEMA;

  const embed = new EmbedBuilder()
    .setTitle('🎟️ 𝙕𝙀𝙉 𝘾𝙄𝙉𝙀𝙈𝘼 • BOX OFFICE')
    .setDescription(
      '✨ **บริการจำหน่ายตั๋วรับชมภาพยนตร์** ✨\n\n' +
      `> <@&${ROLES.CINEMA_TEMP}> ( 250c / 1 วัน )\n\n` +
      '📍 กรุณาตรวจสอบเหรียญในกระเป๋าของคุณก่อนกดซื้อตั๋ว'
    )
    .setColor(COLORS.RED)
    .setImage(imageUrl);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('cinema_temp_ticket')
      .setLabel('🎟️ ซื้อตั๋ว (1 วัน)')
      .setStyle(ButtonStyle.Success)
  );

  await channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: `✅ ส่งแผงป้าย Box Office ไปยังห้อง <#${channel.id}> เรียบร้อยแล้วครับ!`, ephemeral: true });
  return true;
}

const cinemaBroadcastCommand = new SlashCommandBuilder()
  .setName('cinema-broadcast')
  .setDescription('🎥 [CINEMA] แผงควบคุมและส่งประกาศ COMING SOON (สำหรับ Admin)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function handleCinemaBroadcastCommand(interaction, serverConfigs) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
    return true;
  }

  const guildId = interaction.guildId;
  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].cinemaBroadcast) {
    serverConfigs[guildId].cinemaBroadcast = {
      title: 'ภาพยนตร์ฟอร์มยักษ์เรื่องใหม่',
      dateStr: '01/01/1999',
      channelId: null,
      roleId: ROLES.CINEMA_COMING_SOON,
      imageUrl: IMAGES.DEFAULT_CINEMA
    };
  }

  await interaction.reply({ ...getCinemaBroadcastDashboard(serverConfigs[guildId].cinemaBroadcast), ephemeral: true });
  return true;
}

function getCinemaBroadcastDashboard(config) {
  const channelText = config.channelId ? `<#${config.channelId}>` : 'ยังไม่ได้เลือกห้อง';
  const roleText = `<@&${config.roleId || ROLES.CINEMA_COMING_SOON}>`;

  const embed = new EmbedBuilder()
    .setTitle('🍿 𝙕𝙀𝙉 𝘾𝙄𝙉𝙀𝙈𝘼 • COMING SOON CONTROL PANEL')
    .setDescription('แผงควบคุมประกาศ COMING SOON สามารถตั้งค่าข้อมูลและกดส่งประกาศได้ทันทีที่นี่ครับ')
    .setColor(COLORS.GOLD)
    .addFields(
      { name: '🎬 ชื่อเรื่อง', value: `\`${config.title || 'ภาพยนตร์ฟอร์มยักษ์เรื่องใหม่'}\``, inline: false },
      { name: '📅 วันที่ฉาย (d/m/y)', value: `\`${config.dateStr || '01/01/1999'}\``, inline: true },
      { name: '📢 ห้องที่จะส่ง', value: channelText, inline: true },
      { name: '👥 ยศที่แท็ก', value: roleText, inline: true }
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('cinemabc_edit_info')
      .setLabel('✏️ ตั้งค่าข้อมูล (ชื่อ/วันที่/รูป)')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('cinemabc_edit_role')
      .setLabel('👑 เปลี่ยนยศที่แท็ก')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('cinemabc_test_send')
      .setLabel('🚀 ส่งประกาศ COMING SOON')
      .setStyle(ButtonStyle.Success)
  );

  const channelRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('cinemabc_select_channel')
      .setPlaceholder('📂 เลือกห้องสำหรับส่งประกาศ COMING SOON')
      .addChannelTypes(ChannelType.GuildText)
  );

  return { embeds: [embed], components: [row1, channelRow] };
}

async function handleCinemaButton(interaction, serverConfigs, saveConfigs) {
  const id = interaction.customId;
  const cinemaButtons = ['cinema_perm_ticket', 'cinema_temp_ticket', 'cinemabc_edit_info', 'cinemabc_edit_role', 'cinemabc_test_send'];
  if (!cinemaButtons.includes(id)) return false;

  const adminActionIds = ['cinemabc_edit_info', 'cinemabc_edit_role', 'cinemabc_test_send'];
  if (adminActionIds.includes(id)) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะกดใช้งานปุ่มนี้ได้ครับ!', ephemeral: true });
      return true;
    }
  }

  const guildId = interaction.guildId;
  if (!(await isServerPremium(guildId, serverConfigs))) {
    await interaction.reply({ content: '❌ ระบบโรงภาพยนตร์ใช้งานได้เฉพาะเซิร์ฟเวอร์พรีเมียมเท่านั้นครับ!', ephemeral: true });
    return true;
  }

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].levels) serverConfigs[guildId].levels = {};

  const userId = interaction.user.id;
  if (!serverConfigs[guildId].levels[userId]) {
    serverConfigs[guildId].levels[userId] = {
      xp: 0, level: 1, orbs: 0, lastDaily: 0,
      boostUntil: 0, artistUntil: 0, cinemaPermUntil: 0, cinemaTempUntil: 0,
      customTheme: '', customWalletTheme: ''
    };
  }
  const userStat = serverConfigs[guildId].levels[userId];
  const now = Date.now();

  if (id === 'cinema_perm_ticket') {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});

    const member = interaction.member;
    const cost = 350;

    if (member.roles.cache.has(ROLES.CINEMA_PERM)) {
      await interaction.editReply({ content: `❌ คุณมีตั๋ว 21 วันอยู่แล้ว ขอให้สนุกกับการรับชมนะครับ!` });
      return true;
    }

    const userCoins = userStat.orbs || 0;
    if (userCoins < cost) {
      await interaction.editReply({ content: `❌ Zen Coins ของคุณไม่เพียงพอ! ต้องการ ${cost} Coins แต่คุณมี ${userCoins} Coins` });
      return true;
    }

    try {
      userStat.orbs -= cost;
      userStat.cinemaPermUntil = now + (21 * 24 * 60 * 60 * 1000);
      userStat.cinemaTempUntil = 0;
      await saveConfigs(serverConfigs);

      if (member.roles.cache.has(ROLES.CINEMA_TEMP)) {
        await member.roles.remove(ROLES.CINEMA_TEMP).catch(() => {});
      }
      await member.roles.add(ROLES.CINEMA_PERM);

      await interaction.editReply({ content: `🎉 **ซื้อตั๋วสำเร็จ!** ระบบได้หัก ${cost} Zen Coins (คงเหลือ ${userStat.orbs.toLocaleString()} Coins) และมอบยศ <@&${ROLES.CINEMA_PERM}> ให้คุณเรียบร้อยแล้ว` });
      return true;
    } catch (err) {
      console.error('Error assigning 21-day cinema role:', err);
      await interaction.editReply({ content: '❌ เกิดข้อผิดพลาดในการมอบยศ กรุณาตรวจสอบสิทธิ์ของบอทครับ' });
      return true;
    }
  }

  if (id === 'cinema_temp_ticket') {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});

    const member = interaction.member;
    const cost = 250;

    if (member.roles.cache.has(ROLES.CINEMA_PERM)) {
      await interaction.editReply({ content: `❌ คุณมียศตั๋ว 21 วันอยู่แล้วครับ! ไม่สามารถซื้อตั๋ว 1 วันทับซ้อนได้` });
      return true;
    }

    if (member.roles.cache.has(ROLES.CINEMA_TEMP)) {
      await interaction.editReply({ content: `❌ คุณมีตั๋ว 1 วันอยู่แล้ว ขอให้สนุกกับการรับชมนะครับ!` });
      return true;
    }

    const userCoins = userStat.orbs || 0;
    if (userCoins < cost) {
      await interaction.editReply({ content: `❌ Zen Coins ของคุณไม่เพียงพอ! ต้องการ ${cost} Coins แต่คุณมี ${userCoins} Coins` });
      return true;
    }

    try {
      userStat.orbs -= cost;
      userStat.cinemaTempUntil = now + (1 * 24 * 60 * 60 * 1000);
      await saveConfigs(serverConfigs);
      await member.roles.add(ROLES.CINEMA_TEMP);

      await interaction.editReply({ content: `🎉 **ซื้อตั๋วสำเร็จ!** ระบบได้หัก ${cost} Zen Coins (คงเหลือ ${userStat.orbs.toLocaleString()} Coins) และมอบยศให้คุณเรียบร้อยแล้ว` });
      return true;
    } catch (err) {
      console.error('Error assigning temp cinema role:', err);
      await interaction.editReply({ content: '❌ เกิดข้อผิดพลาดในการมอบยศ กรุณาตรวจสอบสิทธิ์ของบอทครับ' });
      return true;
    }
  }

  if (id === 'cinemabc_edit_info') {
    const config = serverConfigs[guildId].cinemaBroadcast || {};
    const modal = new ModalBuilder().setCustomId('cinemaBcInfoModal').setTitle('ตั้งค่าประกาศ COMING SOON');

    const titleInput = new TextInputBuilder().setCustomId('titleInput').setLabel('ชื่อภาพยนตร์').setStyle(TextInputStyle.Short).setValue(config.title || '').setRequired(true);
    const dateInput = new TextInputBuilder().setCustomId('dateInput').setLabel('วันที่ฉาย (d/m/y)').setStyle(TextInputStyle.Short).setValue(config.dateStr || '01/01/1999').setRequired(true);
    const imageInput = new TextInputBuilder().setCustomId('imageInput').setLabel('ลิงก์รูปภาพโปสเตอร์ (Image URL)').setStyle(TextInputStyle.Short).setValue(config.imageUrl || '').setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(dateInput),
      new ActionRowBuilder().addComponents(imageInput)
    );
    await interaction.showModal(modal).catch(() => {});
    return true;
  }

  if (id === 'cinemabc_edit_role') {
    const config = serverConfigs[guildId].cinemaBroadcast || {};
    const modal = new ModalBuilder().setCustomId('cinemaBcRoleModal').setTitle('เปลี่ยนยศประกาศ COMING SOON');
    const roleInput = new TextInputBuilder().setCustomId('roleIdInput').setLabel('ระบุ Role ID ที่ต้องการแท็ก').setStyle(TextInputStyle.Short).setValue(config.roleId || ROLES.CINEMA_COMING_SOON).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(roleInput));
    await interaction.showModal(modal).catch(() => {});
    return true;
  }

  if (id === 'cinemabc_test_send') {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});

    const config = serverConfigs[guildId].cinemaBroadcast;
    if (!config || !config.channelId) {
      await interaction.editReply({ content: '❌ กรุณาเลือกห้องส่งประกาศ COMING SOON จากเมนูด้านล่างแผงควบคุมก่อนกดส่งครับ!' });
      return true;
    }

    try {
      const channel = await interaction.guild.channels.fetch(config.channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) {
        await interaction.editReply({ content: '❌ ไม่พบห้องที่เลือก กรุณาเลือกห้องใหม่อีกครั้งครับ' });
        return true;
      }

      const imageUrl = (config.imageUrl && config.imageUrl.trim() !== '') ? config.imageUrl.trim() : IMAGES.DEFAULT_CINEMA;

      const embed = new EmbedBuilder()
        .setTitle('🍿 𝙕𝙀𝙉 𝘾𝙄𝙉𝙀𝙈𝘼 • COMING SOON')
        .setDescription(
          `🎬 **ชื่อเรื่อง:** ${config.title}\n` +
          `📅 **วันที่ฉาย:** ${config.dateStr}\n\n` +
          `> <@&${ROLES.CINEMA_PERM}> ( 350c / 21 วัน )`
        )
        .setColor(COLORS.GOLD)
        .setImage(imageUrl)
        .setFooter({ text: '💡 แนะนำพิเศษ: ซื้อตั๋ว 21 วันคุ้มกว่า รับชมภาพยนตร์ยาวๆ!' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('cinema_perm_ticket')
          .setLabel('🎫 ซื้อตั๋ว (21 วัน)')
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        content: `<@&${config.roleId || ROLES.CINEMA_COMING_SOON}>`,
        embeds: [embed],
        components: [row]
      });

      await interaction.editReply({ content: `✅ ส่งประกาศไปยังห้อง <#${config.channelId}> เรียบร้อยแล้ว!` });
      return true;
    } catch (err) {
      console.error('Error sending cinema broadcast:', err);
      await interaction.editReply({ content: '❌ เกิดข้อผิดพลาดในการส่งประกาศ กรุณาตรวจสอบสิทธิ์ของบอทครับ' });
      return true;
    }
  }

  return false;
}

async function handleCinemaSelect(interaction, serverConfigs, saveConfigs) {
  if (interaction.customId !== 'cinemabc_select_channel') return false;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้งานเมนูนี้ได้ครับ!', ephemeral: true });
    return true;
  }

  const guildId = interaction.guildId;
  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};

  await interaction.deferUpdate().catch(() => {});

  const channelId = interaction.values[0];
  if (!serverConfigs[guildId].cinemaBroadcast) {
    serverConfigs[guildId].cinemaBroadcast = {
      title: 'ภาพยนตร์ฟอร์มยักษ์เรื่องใหม่',
      dateStr: '01/01/1999',
      roleId: ROLES.CINEMA_COMING_SOON,
      imageUrl: IMAGES.DEFAULT_CINEMA
    };
  }
  serverConfigs[guildId].cinemaBroadcast.channelId = channelId;
  await saveConfigs(serverConfigs);

  await interaction.editReply(getCinemaBroadcastDashboard(serverConfigs[guildId].cinemaBroadcast)).catch(() => {});
  return true;
}

async function handleCinemaModal(interaction, serverConfigs, saveConfigs) {
  const guildId = interaction.guildId;
  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};

  if (interaction.customId === 'cinemaBcInfoModal') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะบันทึกค่านี้ได้ครับ!', ephemeral: true });
      return true;
    }

    await interaction.deferReply({ ephemeral: true }).catch(() => {});

    if (!serverConfigs[guildId].cinemaBroadcast) serverConfigs[guildId].cinemaBroadcast = {};
    const config = serverConfigs[guildId].cinemaBroadcast;

    config.title = interaction.fields.getTextInputValue('titleInput').trim();
    config.dateStr = interaction.fields.getTextInputValue('dateInput').trim();
    const imgVal = interaction.fields.getTextInputValue('imageInput').trim();
    if (imgVal) config.imageUrl = imgVal;

    await saveConfigs(serverConfigs);
    await interaction.editReply({ content: '✅ บันทึกข้อมูลประกาศ COMING SOON เรียบร้อยแล้ว!' });
    return true;
  }

  if (interaction.customId === 'cinemaBcRoleModal') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะเปลี่ยนยศนี้ได้ครับ!', ephemeral: true });
      return true;
    }

    await interaction.deferReply({ ephemeral: true }).catch(() => {});

    if (!serverConfigs[guildId].cinemaBroadcast) serverConfigs[guildId].cinemaBroadcast = {};
    const config = serverConfigs[guildId].cinemaBroadcast;

    config.roleId = interaction.fields.getTextInputValue('roleIdInput').trim();
    await saveConfigs(serverConfigs);
    await interaction.editReply({ content: `✅ เปลี่ยนยศประกาศ COMING SOON เป็น <@&${config.roleId}> เรียบร้อยแล้ว!` });
    return true;
  }

  return false;
}

module.exports = {
  setupCinemaCommand,
  cinemaBroadcastCommand,
  handleSetupCinemaCommand,
  handleCinemaBroadcastCommand,
  handleCinemaButton,
  handleCinemaSelect,
  handleCinemaModal
};

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const cron = require('node-cron');
const { COLORS } = require('./constants');

// 📦 ฐานข้อมูลสัตว์เลี้ยง 6 ระดับดาว
const PET_DATABASE = [
  { name: 'Tiny Slime', stars: 1, type: 'Common', baseOrb: 50, image: 'https://cdn.discordapp.com/attachments/1559878908348997774/1563060183259811921/image0.jpg' },
  { name: 'Lazy Cat', stars: 2, type: 'Uncommon', baseOrb: 100, image: 'https://cdn.discordapp.com/attachments/1559878908348997774/1563060183763259392/image0.jpg' },
  { name: 'Shadow Fox', stars: 3, type: 'Rare', baseOrb: 250, image: 'https://cdn.discordapp.com/attachments/1559878908348997774/1563060184123703317/image0.jpg' },
  { name: 'Fire Lion', stars: 4, type: 'Epic', baseOrb: 500, image: 'https://cdn.discordapp.com/attachments/1559878908348997774/1563060184518103051/image0.jpg' },
  { name: 'Golden Dragon', stars: 5, type: 'Legendary', baseOrb: 1000, image: 'https://cdn.discordapp.com/attachments/1559878908348997774/1563060184962572338/image0.jpg' },
  { name: 'Rainbow Phoenix', stars: 6, type: 'Cosmic', baseOrb: 2500, image: 'https://cdn.discordapp.com/attachments/1559878908348997774/1563060186032377906/image0.jpg' }
];

function rollRandomPet() {
  const rand = Math.random() * 100;
  if (rand < 1) return PET_DATABASE[5];
  if (rand < 4) return PET_DATABASE[4];
  if (rand < 10) return PET_DATABASE[3];
  if (rand < 20) return PET_DATABASE[2];
  if (rand < 40) return PET_DATABASE[1];
  return PET_DATABASE[0];
}

function findPetTargetChannel(guild, config) {
  if (!guild) return null;
  if (config.petChannelId) {
    const ch = guild.channels.cache.get(config.petChannelId);
    if (ch && ch.isTextBased()) return ch;
  }
  return guild.channels.cache.find(c =>
    c.type === ChannelType.GuildText &&
    !c.name.toLowerCase().includes('staff') &&
    !c.name.toLowerCase().includes('admin') &&
    !c.name.toLowerCase().includes('log') &&
    c.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages)
  ) || null;
}

// 📢 ฟังก์ชันเช็กและฟักไข่อัตโนมัติ (แสดงการ์ด Embed สวยงามเมื่อไข่ฟัก)
async function checkAndHatchPet(guild, userId, userData, client, serverConfig) {
  if (!userData.petEgg || userData.petEgg.isHatched) return false;

  const now = Date.now();
  if (now >= userData.petEgg.hatchUntil) {
    userData.petEgg.isHatched = true;
    userData.petEgg.hatchedPet = rollRandomPet();
    userData.petEgg.petLevel = 1;
    userData.petEgg.petXp = 0;
    userData.petEgg.battlesCount = 0;

    const pet = userData.petEgg.hatchedPet;
    const targetChannel = findPetTargetChannel(guild, serverConfig);

    if (targetChannel) {
      const embed = new EmbedBuilder()
        .setTitle(pet.name)
        .setDescription(
          `**Rarity:** ${'⭐'.repeat(pet.stars)} (${pet.type})\n` +
          `**Base Orb:** ${pet.baseOrb} 🔮`
        )
        .setImage(pet.image)
        .setColor(0xFFD700);

      await targetChannel.send({
        content: `<@${userId}> <a:egghatch:1564110551305682994>`,
        embeds: [embed]
      }).catch(() => {});
    }

    if (serverConfig.petRoleId && guild) {
      try {
        const member = await guild.members.fetch(userId).catch(() => null);
        const role = guild.roles.cache.get(serverConfig.petRoleId);
        if (member && role && !member.roles.cache.has(role.id)) {
          await member.roles.add(role).catch(() => {});
        }
      } catch (err) {
        console.error('Error assigning pet role:', err);
      }
    }

    return true;
  }
  return false;
}

// ⏳ Cron Job เช็กและฟักไข่อัตโนมัติทุกๆ 10 วินาที
function startPetHatchCron(client, serverConfigs, saveConfigs) {
  cron.schedule('*/10 * * * * *', async () => {
    let globalUpdated = false;

    for (const guildId in serverConfigs) {
      const config = serverConfigs[guildId];
      if (!config || !config.levels) continue;

      const guild = client.guilds.cache.get(guildId);
      if (!guild) continue;

      for (const userId in config.levels) {
        const userData = config.levels[userId];
        if (userData && userData.petEgg && !userData.petEgg.isHatched) {
          const hatched = await checkAndHatchPet(guild, userId, userData, client, config);
          if (hatched) {
            globalUpdated = true;
          }
        }
      }
    }

    if (globalUpdated && typeof saveConfigs === 'function') {
      await saveConfigs(serverConfigs);
    }
  });
}

// 📈 ระบบเก็บเลเวลสัตว์เลี้ยง (แจ้งเตือนรูปแบบ [ZEN PET] เมื่อเลเวลอัป)
async function progressPetXp(guildId, userId, xpAmount, client, serverConfigs, saveConfigs, shouldSave = true) {
  const config = serverConfigs[guildId];
  if (!config || !config.levels || !config.levels[userId]) return;

  const userStat = config.levels[userId];
  if (!userStat.petEgg || !userStat.petEgg.isHatched || !userStat.petEgg.hatchedPet) return;

  if (userStat.petEgg.petLevel === undefined) userStat.petEgg.petLevel = 1;
  if (userStat.petEgg.petXp === undefined) userStat.petEgg.petXp = 0;

  userStat.petEgg.petXp += xpAmount;
  let requiredPetXp = userStat.petEgg.petLevel * 100;
  let leveledUp = false;
  let newLevel = userStat.petEgg.petLevel;

  while (userStat.petEgg.petXp >= requiredPetXp) {
    userStat.petEgg.petXp -= requiredPetXp;
    userStat.petEgg.petLevel += 1;
    newLevel = userStat.petEgg.petLevel;
    leveledUp = true;
    requiredPetXp = userStat.petEgg.petLevel * 100;
  }

  if (shouldSave) {
    await saveConfigs(serverConfigs);
  }

  if (leveledUp && client && client.guilds) {
    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      const targetChannel = findPetTargetChannel(guild, config);

      if (targetChannel) {
        const pet = userStat.petEgg.hatchedPet;
        await targetChannel.send({
          content: `[ZEN PET] ยินดีด้วยคุณ <@${userId}>! **${pet.name}** ของคุณอัปเลเวลเป็น **Level ${newLevel}** แล้ว!`
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Error sending pet level up notification:', err);
    }
  }
}

// 🛒 คำสั่งเปิดร้านค้า (เพิ่มการเช็กสิทธิ์ Admin ป้องกันคนทั่วไปพิมพ์คำสั่ง)
const petShopCommand = new SlashCommandBuilder()
  .setName('pet-shop')
  .setDescription('🛒 เปิดร้านค้าไข่วิญญาณ (เฉพาะแอดมิน)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function handlePetShopCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้นถึงจะใช้คำสั่งนี้ได้!', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle('<a:egg:1564110672801824818> 𝙕𝙀𝙉 𝙎𝙃𝙊𝙋')
    .setDescription('ซื้อไข่วิญญาณลึกลับเพื่อฟักเป็นสัตว์เลี้ยงคู่กาย!\n\n**ราคา:** `500 Orbs`\n**ระยะเวลาฟัก:** `60 วินาที`')
    .setImage('https://cdn.discordapp.com/attachments/1559878908348997774/1563060185633652816/image0.jpg')
    .setColor(0xFFD700);

  const row = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId('buy_pet_egg')
    .setLabel('ซื้อไข่วิญญาณ (500 Orbs)') // ใส่เฉพาะข้อความ
    .setEmoji({ name: 'egghatch', id: '1564110551305682994', animated: true }) // ย้ายอีโมจิมาใส่ตรงนี้ (ใส่ animated: true สำหรับดุ๊กดิ๊ก)
    .setStyle(ButtonStyle.Success)
);

  await interaction.reply({ content: '🛒 เปิดหน้าร้านค้าเรียบร้อย!', ephemeral: true });
  await interaction.channel.send({ embeds: [embed], components: [row] });
}

// ⚙️ คำสั่งตั้งค่าห้องแจ้งเตือน
const setPetChannelCommand = new SlashCommandBuilder()
  .setName('set-pet-channel')
  .setDescription('📢 ตั้งค่าห้องสำหรับส่งแจ้งเตือนฟักไข่สัตว์เลี้ยง (เฉพาะแอดมิน)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('เลือกห้องที่ต้องการให้บอทรายงาน')
      .setRequired(true)
  );

// ⚙️ คำสั่งตั้งค่ายศที่จะแจกเมื่อซื้อไข่
const setPetRoleCommand = new SlashCommandBuilder()
  .setName('set-pet-role')
  .setDescription('🎭 ตั้งค่ายศที่จะได้รับอัตโนมัติเมื่อซื้อไข่สัตว์เลี้ยง (เฉพาะแอดมิน)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addRoleOption(option =>
    option.setName('role')
      .setDescription('เลือกยศที่ต้องการแจก')
      .setRequired(true)
  );

async function handleSetPetRoleCommand(interaction, serverConfigs, saveConfigs) {
  const guildId = interaction.guildId;
  const role = interaction.options.getRole('role');

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  serverConfigs[guildId].petRoleId = role.id;
  await saveConfigs(serverConfigs);

  await interaction.reply({ content: `✅ ตั้งค่ายศสัตว์เลี้ยงเป็น <@&${role.id}> สำเร็จแล้ว!`, ephemeral: true });
  return true;
}

// 🐾 คำสั่งดูโปรไฟล์สัตว์เลี้ยง (/pet)
const petCommand = new SlashCommandBuilder()
  .setName('pet')
  .setDescription('🐾 ตรวจสอบการ์ดโปรไฟล์และสเตตัสคู่หูวิญญาณของคุณ');

async function handlePetCommand(interaction, serverConfigs, saveConfigs, client) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  const serverConfig = serverConfigs[guildId];
  const userData = serverConfig.levels?.[userId];
  const petEgg = userData?.petEgg;

  if (!petEgg || !petEgg.hasEgg) {
    return await interaction.reply({ content: '❌ คุณยังไม่มีไข่หรือสัตว์เลี้ยง! ไปซื้อไข่จากหน้าร้านก่อน', ephemeral: true });
  }

  if (!petEgg.isHatched) {
    const hatched = await checkAndHatchPet(interaction.guild, userId, userData, client, serverConfig);
    if (hatched) {
      if (saveConfigs) await saveConfigs(serverConfigs);
    } else {
      const remainingSec = Math.ceil((petEgg.hatchUntil - Date.now()) / 1000);
      return await interaction.reply({
        content: `🥚 ไข่วิญญาณของคุณกำลังฟัก... เหลือเวลาอีกประมาณ **${remainingSec} วินาที**`,
        ephemeral: true
      });
    }
  }

  const pet = petEgg.hatchedPet || PET_DATABASE[0];
  const totalPower = pet.baseOrb + ((petEgg.petLevel || 1) * 20);
  const battlesCount = petEgg.battlesCount || 0;

  const embed = new EmbedBuilder()
    .setTitle(`🛡️ โปรไฟล์คู่หู: ${pet.name}`)
    .setDescription(
      `⭐ **ระดับดาว:** ${'⭐'.repeat(pet.stars)} (${pet.type})\n` +
      `📈 **เลเวล:** Level ${petEgg.petLevel || 1}\n` +
      `✨ **ค่าประสบการณ์ (XP):** ${petEgg.petXp || 0}/${(petEgg.petLevel || 1) * 100}\n` +
      `⚔️ **พลังต่อสู้ (Power):** \`${totalPower}\`\n` +
      `🔮 **Base Orb:** ${pet.baseOrb} Orbs\n` +
      `📊 **สถิติประลอง:** \`${battlesCount} ครั้ง\``
    )
    .setColor(0x00FF99)
    .setImage(pet.image)
    .setFooter({ text: `Owner: ${interaction.user.tag} • ZEN PET PROFILE` });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// 💰 เช็กเงิน Orbs
const coinsCommand = new SlashCommandBuilder()
  .setName('coins')
  .setDescription('💰 ตรวจสอบยอดเงิน Orbs ของคุณ');

async function handleCoinsCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  const userData = serverConfigs[guildId]?.levels?.[userId];
  const userCoins = userData?.orbs !== undefined ? userData.orbs : (userData?.coins || 0);
  await interaction.reply({ content: `🔮 ยอด Orbs ของคุณคือ: **${userCoins.toLocaleString()} Orbs**`, ephemeral: true });
}

// 🛒 ปุ่มซื้อไข่ (เชื่อมตรงกับ serverConfigs ตัวกลาง 100%)
async function handleCompanionButton(interaction, serverConfigs, saveConfigs) {
  if (!interaction.isButton() || interaction.customId !== 'buy_pet_egg') return false;

  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].levels) serverConfigs[guildId].levels = {};
  if (!serverConfigs[guildId].levels[userId]) {
    serverConfigs[guildId].levels[userId] = { xp: 0, level: 1, coins: 1000, orbs: 1000 };
  }

  const serverConfig = serverConfigs[guildId];
  const userData = serverConfig.levels[userId];
  const now = Date.now();

  if (userData.petEgg && userData.petEgg.hasEgg) {
    if (!userData.petEgg.isHatched && now < userData.petEgg.hatchUntil) {
      const remainingSec = Math.ceil((userData.petEgg.hatchUntil - now) / 1000);
      await interaction.reply({ content: `❌ คุณมีไข่วิญญาณที่กำลังฟักอยู่! (เหลือเวลาอีกประมาณ ${remainingSec} วินาที)`, ephemeral: true });
    } else {
      await interaction.reply({ content: `❌ คุณมีสัตว์เลี้ยงหรือไข่อยู่แล้ว! ซื้อได้แค่ตัวเดียวเท่านั้น`, ephemeral: true });
    }
    return true;
  }

  let currentOrbs = userData.orbs !== undefined ? userData.orbs : (userData.coins !== undefined ? userData.coins : 0);
  const eggCost = 500;

  if (currentOrbs < eggCost) {
    await interaction.reply({ content: `❌ Orbs ของคุณไม่พอ! (ต้องการ ${eggCost} Orbs แต่คุณมี ${currentOrbs.toLocaleString()} Orbs)`, ephemeral: true });
    return true;
  }

  if (userData.orbs !== undefined) userData.orbs -= eggCost;
  else if (userData.coins !== undefined) userData.coins -= eggCost;

  userData.petEgg = {
    hasEgg: true,
    isHatched: false,
    hatchUntil: now + (60 * 1000),
    hatchedPet: null,
    petLevel: 1,
    petXp: 0,
    battlesCount: 0,
    createdAt: now
  };

  if (typeof saveConfigs === 'function') {
    await saveConfigs(serverConfigs);
  }

  if (serverConfig.petRoleId) {
    try {
      const member = await interaction.guild.members.fetch(userId);
      const role = await interaction.guild.roles.fetch(serverConfig.petRoleId);
      if (role && !member.roles.cache.has(role.id)) {
        await member.roles.add(role);
      }
    } catch (err) {
      console.error('Error assigning pet role:', err);
    }
  }

  let remainingBalance = userData.orbs !== undefined ? userData.orbs : userData.coins;

  await interaction.reply({
    content: `<a:cuteghost:1563345975597080686> ซื้อไข่วิญญาณสำเร็จ!\nพิมพ์ \`/pet\` เพื่อเช็กสถานะ!`,
    ephemeral: true
  });

  return true;
}

// ⚔️ ลานประลอง (Hardcore Mode)
const petBattleCommand = new SlashCommandBuilder()
  .setName('pet-battle')
  .setDescription('⚔️ ท้าประลองสัตว์เลี้ยงกับผู้เล่นคนอื่นเพื่อชิงเงินและชิง EXP (ผู้แพ้สัตว์เลี้ยงตาย!)')
  .addUserOption(option => 
    option.setName('target')
      .setDescription('เลือกผู้เล่นที่ต้องการท้าประลอง')
      .setRequired(true)
  )
  .addIntegerOption(option => 
    option.setName('bet')
      .setDescription('จำนวน Orbs ที่ต้องการวางเดิมพัน')
      .setRequired(true)
      .setMinValue(10)
  );

async function handlePetBattleCommand(interaction, serverConfigs, client) {
  const guildId = interaction.guildId;
  const attackerId = interaction.user.id;
  const defenderUser = interaction.options.getUser('target');
  const betAmount = interaction.options.getInteger('bet');

  if (defenderUser.id === attackerId || defenderUser.bot) {
    return await interaction.reply({ content: '❌ เป้าหมายท้าประลองไม่ถูกต้อง!', ephemeral: true });
  }

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  const serverConfig = serverConfigs[guildId];
  const levels = serverConfig.levels || {};
  const atkData = levels[attackerId];
  const defData = levels[defenderUser.id];

  if (atkData?.petEgg && !atkData.petEgg.isHatched) {
    await checkAndHatchPet(interaction.guild, attackerId, atkData, client, serverConfig);
  }
  if (defData?.petEgg && !defData.petEgg.isHatched) {
    await checkAndHatchPet(interaction.guild, defenderUser.id, defData, client, serverConfig);
  }

  if (!atkData?.petEgg?.isHatched) {
    return await interaction.reply({ content: '❌ คุณยังไม่มีสัตว์เลี้ยงที่ฟักเป็นตัว!', ephemeral: true });
  }
  if (!defData?.petEgg?.isHatched) {
    return await interaction.reply({ content: `❌ <@${defenderUser.id}> ยังไม่มีสัตว์เลี้ยงที่ฟักเป็นตัวพร้อมประลอง!`, ephemeral: true });
  }

  const atkOrbs = atkData.orbs !== undefined ? atkData.orbs : (atkData.coins || 0);
  const defOrbs = defData.orbs !== undefined ? defData.orbs : (defData.coins || 0);

  if (atkOrbs < betAmount) {
    return await interaction.reply({ content: `❌ Orbs ของคุณไม่พอสำหรับการเดิมพัน!`, ephemeral: true });
  }
  if (defOrbs < betAmount) {
    return await interaction.reply({ content: `❌ <@${defenderUser.id}> มี Orbs ไม่พอสำหรับการเดิมพันนี้!`, ephemeral: true });
  }

  const atkPet = atkData.petEgg.hatchedPet;
  const defPet = defData.petEgg.hatchedPet;

  const atkPower = atkPet.baseOrb + ((atkData.petEgg.petLevel || 1) * 20);
  const defPower = defPet.baseOrb + ((defData.petEgg.petLevel || 1) * 20);

  const embed = new EmbedBuilder()
    .setTitle('⚔️ คำท้าประลองลานสู้สัตว์เลี้ยง (Hardcore Mode)!')
    .setDescription(
      `<@${attackerId}> ได้ส่งคำท้าประลองถึง <@${defenderUser.id}>!\n\n` +
      `💀 **กติกา:** ผู้แพ้สัตว์เลี้ยงจะตายและหายไปทันที!\n` +
      `💰 **เดิมพัน:** \`${betAmount.toLocaleString()} Orbs\`\n\n` +
      `🔴 **ผู้ท้า:** <@${attackerId}> (${atkPet.name} [Power: ${atkPower}])\n` +
      `🔵 **ผู้รับ:** <@${defenderUser.id}> (${defPet.name} [Power: ${defPower}])\n\n` +
      `*กดปุ่มด้านล่างเพื่อตัดสินชะตากรรม!*`
    )
    .setColor(0xFF4500);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`accept_battle_${attackerId}_${defenderUser.id}_${betAmount}`)
      .setLabel('⚔️ ยอมรับการประลอง')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`decline_battle_${attackerId}_${defenderUser.id}`)
      .setLabel('❌ ปฏิเสธ')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.reply({ content: `<@${defenderUser.id}> คุณถูกท้าประลอง!`, embeds: [embed], components: [row] });
}

async function handleBattleButtons(interaction, serverConfigs, saveConfigs) {
  if (!interaction.isButton() || !interaction.customId) return false;
  
  const customId = interaction.customId;
  if (!customId.startsWith('accept_battle_') && !customId.startsWith('decline_battle_')) return false;

  const parts = customId.split('_');
  const action = parts[0];
  const attackerId = parts[2];
  const defenderId = parts[3];

  if (interaction.user.id !== defenderId) {
    await interaction.reply({ content: '❌ คุณไม่ใช่คนที่ถูกท้าประลอง!', ephemeral: true });
    return true;
  }

  if (action === 'decline') {
    const cancelEmbed = new EmbedBuilder()
      .setTitle('❌ การประลองถูกยกเลิก')
      .setDescription(`<@${defenderId}> ได้ปฏิเสธคำท้าประลอง`)
      .setColor(0x808080);

    await interaction.update({ embeds: [cancelEmbed], components: [] });
    return true;
  }

  const betAmount = parseInt(parts[4]);
  const guildId = interaction.guildId;

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  const serverConfig = serverConfigs[guildId];
  const levels = serverConfig.levels || {};

  const atkData = levels[attackerId];
  const defData = levels[defenderId];

  if (!atkData?.petEgg?.isHatched || !defData?.petEgg?.isHatched) {
    await interaction.reply({ content: '❌ ข้อมูลสัตว์เลี้ยงของผู้เล่นไม่ถูกต้องหรือสัตว์เลี้ยงหายไปแล้ว', ephemeral: true });
    return true;
  }

  const atkOrbs = atkData.orbs !== undefined ? atkData.orbs : (atkData.coins || 0);
  const defOrbs = defData.orbs !== undefined ? defData.orbs : (defData.coins || 0);

  if (atkOrbs < betAmount || defOrbs < betAmount) {
    await interaction.reply({ content: '❌ ยอด Orbs ของผู้เล่นไม่พอสำหรับการเดิมพันแล้ว การประลองถูกยกเลิก', ephemeral: true });
    return true;
  }

  const atkPet = atkData.petEgg.hatchedPet;
  const defPet = defData.petEgg.hatchedPet;

  const atkPower = atkPet.baseOrb + ((atkData.petEgg.petLevel || 1) * 20);
  const defPower = defPet.baseOrb + ((defData.petEgg.petLevel || 1) * 20);

  const atkScore = atkPower * (0.95 + Math.random() * 0.1);
  const defScore = defPower * (0.95 + Math.random() * 0.1);
  const isAttackerWin = atkScore > defScore;

  const winnerId = isAttackerWin ? attackerId : defenderId;
  const loserId = isAttackerWin ? defenderId : attackerId;
  const winnerData = levels[winnerId];
  const loserData = levels[loserId];
  const winnerPet = isAttackerWin ? atkPet : defPet;

  const loserLevel = loserData.petEgg?.petLevel || 1;
  const loserXp = loserData.petEgg?.petXp || 0;
  const loserXpValue = (loserLevel * 50) + loserXp;

  if (winnerData.orbs !== undefined) winnerData.orbs += betAmount;
  else winnerData.coins += betAmount;

  if (loserData.orbs !== undefined) loserData.orbs -= betAmount;
  else loserData.coins -= betAmount;

  winnerData.petEgg.battlesCount = (winnerData.petEgg.battlesCount || 0) + 1;
  loserData.petEgg.battlesCount = (loserData.petEgg.battlesCount || 0) + 1;

  // 📈 คำนวณเลเวลเดิมก่อนดูดซับ XP และเช็กเลเวลใหม่หลังดูดซับ
  const oldLevel = winnerData.petEgg.petLevel || 1;
  winnerData.petEgg.petXp = (winnerData.petEgg.petXp || 0) + loserXpValue;

  while (winnerData.petEgg.petXp >= (winnerData.petEgg.petLevel || 1) * 100) {
    winnerData.petEgg.petXp -= (winnerData.petEgg.petLevel || 1) * 100;
    winnerData.petEgg.petLevel += 1;
  }
  const newLevel = winnerData.petEgg.petLevel;

  loserData.petEgg = null;

  if (serverConfig.petRoleId) {
    try {
      const loserMember = await interaction.guild.members.fetch(loserId).catch(() => null);
      const role = interaction.guild.roles.cache.get(serverConfig.petRoleId);
      if (loserMember && role && loserMember.roles.cache.has(role.id)) {
        await loserMember.roles.remove(role).catch(() => {});
      }
    } catch (err) {
      console.error('Error removing pet role from loser:', err);
    }
  }

  if (typeof saveConfigs === 'function') {
    await saveConfigs(serverConfigs);
  }

  // 📢 ส่งข้อความแจ้งเตือนเลเวลอัปทันทีหากสัตว์เลี้ยงเลเวลพุ่งขึ้นจากการชนะประลอง
  if (newLevel > oldLevel) {
    const targetChannel = findPetTargetChannel(interaction.guild, serverConfig);
    if (targetChannel) {
      await targetChannel.send({
        content: `[ZEN PET] ยินดีด้วยคุณ <@${winnerId}>! **${winnerPet.name}** ของคุณชนะการประลองและอัปเลเวลพุ่งพรวดเป็น **Level ${newLevel}** แล้ว!`
      }).catch(() => {});
    }
  }

  const resultEmbed = new EmbedBuilder()
    .setTitle('🏆 ผลการประลอง!')
    .setDescription(
      `🎉 **ผู้ชนะ:** <@${winnerId}> (${winnerPet.name})!\n` +
      `💀 **ผู้แพ้:** <@${loserId}> สัตว์เลี้ยงเสียชีวิตและหายไปจากโลกนี้แล้ว!\n\n` +
      `💰 เงินรางวัล: \`+${betAmount.toLocaleString()} Orbs\`\n` +
      `✨ ได้รับ XP สะสมจากคู่ต่อสู้: \`+${loserXpValue.toLocaleString()} XP\``
    )
    .setImage(winnerPet.image)
    .setColor(0x00FF00);

  await interaction.update({ embeds: [resultEmbed], components: [] });
  return true;
}

const petLeaderboardCommand = new SlashCommandBuilder()
  .setName('pet-leaderboard')
  .setDescription('🏆 ตรวจสอบอันดับสัตว์เลี้ยงในเซิร์ฟเวอร์');

async function handlePetLeaderboardCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const levels = serverConfigs[guildId]?.levels || {};

  const entries = Object.entries(levels);
  const hatchedPets = entries
    .filter(([_, userData]) => userData?.petEgg?.hasEgg && userData?.petEgg?.isHatched && userData?.petEgg?.hatchedPet)
    .map(([userId, userData]) => {
      const petEgg = userData.petEgg;
      const pet = petEgg.hatchedPet;
      const level = petEgg.petLevel || 1;
      const power = pet.baseOrb + (level * 20);
      return { userId, pet, level, power };
    })
    .sort((a, b) => b.level - a.level || b.pet.stars - a.pet.stars || b.power - a.power);

  if (hatchedPets.length === 0) {
    return await interaction.reply({ content: '🏆 ยังไม่มีสัตว์เลี้ยงที่ฟักเป็นตัวในเซิร์ฟเวอร์นี้!', ephemeral: true });
  }

  const topPets = hatchedPets.slice(0, 10);
  let description = '';

  topPets.forEach((item, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `\`#${index + 1}\``;
    description += `${medal} <@${item.userId}> — **${item.pet.name}** (Level ${item.level} | ⚔️ Power: \`${item.power}\`)\n`;
  });

  const embed = new EmbedBuilder()
    .setTitle('🏆 Pet Leaderboard')
    .setDescription(description)
    .setColor(0xFFD700);

  await interaction.reply({ embeds: [embed] });
}

module.exports = {
  PET_DATABASE,
  rollRandomPet,
  findPetTargetChannel,
  checkAndHatchPet,
  startPetHatchCron,
  progressPetXp,
  petShopCommand,
  handlePetShopCommand,
  setPetChannelCommand,
  setPetRoleCommand,
  handleSetPetRoleCommand,
  petCommand,
  handlePetCommand,
  coinsCommand,
  handleCoinsCommand,
  handleCompanionButton,
  petBattleCommand,
  handlePetBattleCommand,
  handleBattleButtons,
  petLeaderboardCommand,
  handlePetLeaderboardCommand
};

// constants.js - ศูนย์รวม Role IDs, Developer ID, รูปภาพ และค่าคงที่ทั้งหมดของ Zen Bot

module.exports = {
  DEVELOPER_ID: '795347337773580299',

  // 👑 Role IDs ทั้งหมดในระบบ
  ROLES: {
    ARTIST_PERM: '1560224726868295740',    // ยศ Artist ถาวร
    ARTIST_TEMP: '1560136361015513108',    // ยศ Artist | 3d (เช่า 3 วัน)
    XP_BOOSTER: '1559992075095773184',     // ยศ XP Booster x2
    CINEMA_PERM: '1560731553766707241',    // ตั๋วหนัง 21 วัน / แจ้งเตือน Now Showing
    CINEMA_TEMP: '1551006184272560148',    // ตั๋วหนัง 1 วัน
    CINEMA_COMING_SOON: '1551183125076508713', // ยศแท็ก Coming Soon
    CHILLING: '1560002494204084395',       // ยศสายชิลล์
    NIGHTOWL: '1560002616266854420'        // ยศคนนอนดึก
  },

  // 🖼️ ลิงก์รูปภาพและไอคอนมาตรฐาน (รวมระบบหลัก + Zen Pet System)
  IMAGES: {
    DEFAULT_CINEMA: 'https://cdn.discordapp.com/attachments/1559878908348997774/1564120542607450176/052d6f31-ad4d-4217-99c9-f7be6b62da3a.jpg?ex=6ae01c45&is=6adecac5&hm=6e42267478aad349a31ed553db57edbdca3d00e5a90a843859c2ee65de9142cb&',
    ARTIST_BANNER: 'https://cdn.discordapp.com/attachments/1550576199829430382/1559721936588636220/IMG_7335.jpg',
    QUEST_BANNER: 'https://cdn.discordapp.com/attachments/1550576199829430382/1560524247216955432/IMG_7329.jpg',
    SHOP_STOREFRONT: 'https://cdn.discordapp.com/attachments/1559878908348997774/1560429209522806814/1792105478227.jpg',
    BOT_PRESENTATION: 'https://cdn.discordapp.com/attachments/1550576199829430382/1559721017583337512/1791877721245.jpg',
    PROMPTPAY_QR: 'https://cdn.discordapp.com/attachments/1559878908348997774/1560193260293595176/ReceiveMoney_QR_2026-10-15_14.13.55.png',
    ORDER_LOADING_GIF: 'https://cdn.discordapp.com/attachments/1559878908348997774/1560407479412588686/IMG_7559.gif',
    NEW_ORDER_GIF: 'https://cdn.discordapp.com/attachments/1559878908348997774/1560415906281300059/image0.gif',

    // 🐾 รูปภาพระบบ Zen Pet (ไข่ และ สัตว์เลี้ยง 1-6 ดาว)
    PET_EGG: 'https://cdn.discordapp.com/attachments/1559878908348997774/1563060185633652816/image0.jpg',
    PET_1_STAR: 'https://cdn.discordapp.com/attachments/1559878908348997774/1563060183259811921/image0.jpg',
    PET_2_STAR: 'https://cdn.discordapp.com/attachments/1559878908348997774/1563060183763259392/image0.jpg',
    PET_3_STAR: 'https://cdn.discordapp.com/attachments/1559878908348997774/1563060184123703317/image0.jpg',
    PET_4_STAR: 'https://cdn.discordapp.com/attachments/1559878908348997774/1563060184518103051/image0.jpg',
    PET_5_STAR: 'https://cdn.discordapp.com/attachments/1559878908348997774/1563060184962572338/image0.jpg',
    PET_6_STAR: 'https://cdn.discordapp.com/attachments/1559878908348997774/1563060186032377906/image0.jpg'
  },

  // 🎨 สีมาตรฐานของ Embed
  COLORS: {
    PRIMARY: '#66FFFF',
    GOLD: '#FFD700',
    PINK: '#FF69B4',
    RED: '#FF0000',
    GREEN: '#00FF00',
    DISCORD_BLURPLE: '#5865F2'
  }
};

// level.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const cron = require('node-cron');
const { generateProfileCard } = require('./canvas_card');
const { isServerPremium } = require('./license');
const { ROLES, COLORS } = require('./constants');
const { progressPetXp } = require('./companion'); // 🐾 นำเข้าฟังก์ชันเพิ่ม XP ให้สัตว์เลี้ยง

const pendingRoleRewardImages = new Map();

// 🛡️ Helper: ตรวจสอบและถอดยศเช่า/ตั๋วหนังที่หมดอายุ
async function checkAndRemoveExpiredRoles(guild, userId, userStat, now) {
  let updated = false;

  if (userStat.boostUntil && now >= userStat.boostUntil) {
    userStat.boostUntil = 0;
    updated = true;
    if (guild) {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member && member.roles.cache.has(ROLES.XP_BOOSTER)) {
        await member.roles.remove(ROLES.XP_BOOSTER).catch(() => {});
      }
    }
  }

  if (userStat.artistUntil && now >= userStat.artistUntil) {
    userStat.artistUntil = 0;
    updated = true;
    if (guild) {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member) {
        if (member.roles.cache.has(ROLES.ARTIST_TEMP)) {
          await member.roles.remove(ROLES.ARTIST_TEMP).catch(() => {});
        }
        if (!member.roles.cache.has(ROLES.ARTIST_PERM)) {
          userStat.customTheme = '';
          userStat.customWalletTheme = '';
        }
      }
    }
  }

  if (userStat.cinemaPermUntil && now >= userStat.cinemaPermUntil) {
    userStat.cinemaPermUntil = 0;
    updated = true;
    if (guild) {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member && member.roles.cache.has(ROLES.CINEMA_PERM)) {
        await member.roles.remove(ROLES.CINEMA_PERM).catch(() => {});
      }
    }
  }

  if (userStat.cinemaTempUntil && now >= userStat.cinemaTempUntil) {
    userStat.cinemaTempUntil = 0;
    updated = true;
    if (guild) {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member && member.roles.cache.has(ROLES.CINEMA_TEMP)) {
        await member.roles.remove(ROLES.CINEMA_TEMP).catch(() => {});
      }
    }
  }

  return updated;
}

async function giveXpToUser(guildId, userId, amount, contextObj, serverConfigs, saveConfigs, isVoice = false, shouldSave = true, client = null) {
  if (!serverConfigs[guildId]) return false;

  const config = serverConfigs[guildId];
  if (!config.levelConfig || !config.levelConfig.enabled) return false;

  if (!config.levels) config.levels = {};
  if (!config.levels[userId]) {
    config.levels[userId] = {
      xp: 0, level: 1, orbs: 0, lastDaily: 0,
      boostUntil: 0, artistUntil: 0, cinemaPermUntil: 0, cinemaTempUntil: 0,
      customTheme: '', customWalletTheme: ''
    };
  }

  const userStat = config.levels[userId];
  const multiplier = Math.max(10, config.levelConfig.xpMultiplier || 100);
  const now = Date.now();

  const guild = isVoice ? contextObj : contextObj?.guild;

  await checkAndRemoveExpiredRoles(guild, userId, userStat, now);

  let finalAmount = amount;
  let isBoosted = false;

  if (userStat.boostUntil && now < userStat.boostUntil) {
    finalAmount *= 2;
    isBoosted = true;
  }

  userStat.xp += finalAmount;
  let requiredXp = userStat.level * multiplier;
  let leveledUp = false;

  while (userStat.xp >= requiredXp) {
    userStat.xp -= requiredXp;
    userStat.level += 1;
    leveledUp = true;
    requiredXp = userStat.level * multiplier;
  }

  // 🐾 เพิ่ม XP ให้สัตว์เลี้ยงอัตโนมัติ พร้อมส่ง client ไปด้วยเพื่อให้แจ้งเตือนได้
  const petXpGain = Math.max(5, Math.floor(finalAmount / 2));
  await progressPetXp(guildId, userId, petXpGain, client, serverConfigs, saveConfigs, false);

  if (leveledUp && guild) {
    const boostText = isBoosted ? ' *(⚡ กำลังใช้งาน XP Booster x2)*' : '';
    const customMsg = (config.levelConfig.levelUpMessage || 'ยินดีด้วยคุณ {user}! เลเวลอัปขึ้นเป็น **Level {level}** แล้ว!')
      .replace('{user}', `<@${userId}>`)
      .replace('{level}', userStat.level) + boostText;

    let targetChannel = null;
    if (config.levelConfig.channelId) {
      targetChannel = guild.channels.cache.get(config.levelConfig.channelId);
    }
    if (!targetChannel) {
      targetChannel = isVoice ? guild.systemChannel : contextObj?.channel;
    }

    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member && config.levelConfig.roleRewards) {
        const rewardData = config.levelConfig.roleRewards[userStat.level];
        if (rewardData) {
          const rewardRoleId = typeof rewardData === 'object' ? rewardData.roleId : rewardData;
          const rewardImgUrl = typeof rewardData === 'object' ? rewardData.imageUrl : '';

          const roleToGive = guild.roles.cache.get(rewardRoleId);
          if (roleToGive) {
            const allRewardRoleIds = Object.values(config.levelConfig.roleRewards).map(r => typeof r === 'object' ? r.roleId : r);
            for (const oldRoleId of allRewardRoleIds) {
              if (oldRoleId !== rewardRoleId && member.roles.cache.has(oldRoleId)) {
                await member.roles.remove(oldRoleId).catch(() => {});
              }
            }

            await member.roles.add(roleToGive).catch(() => {});
            if (targetChannel) {
              const customRewardMsg = (config.levelConfig.roleRewardMessage || '<a:spinningcrown:1563350810652446901> ยินดีด้วยคุณ {user} ได้รับยศพิเศษ {role} เนื่องในโอกาสอัปถึง Level {level}!')
                .replace('{user}', `<@${userId}>`)
                .replace('{role}', `<@&${rewardRoleId}>`)
                .replace('{level}', userStat.level);

              const embed = new EmbedBuilder()
                .setTitle('<a:spinningcrown:1563350810652446901> ยศรางวัลเลเวลอัปพิเศษ!')
                .setDescription(customRewardMsg)
                .setColor(config.levelConfig.embedColor || COLORS.PRIMARY);

              if (rewardImgUrl && rewardImgUrl.trim() !== '') {
                const urls = rewardImgUrl.split(/,|\n/).map(s => s.trim()).filter(Boolean);
                if (urls.length > 0) {
                  const randomImg = urls[Math.floor(Math.random() * urls.length)];
                  embed.setImage(randomImg);
                }
              }

              await targetChannel.send({ embeds: [embed] }).catch(() => {});
            }
          }
        }
      }
    } catch (err) {
      console.error('Error assigning level role reward:', err);
    }

    if (targetChannel) {
      targetChannel.send({ content: customMsg }).then(msg => {
        if (!config.levelConfig.channelId && !isVoice) {
          setTimeout(() => msg.delete().catch(() => {}), 6000);
        }
      }).catch(() => {});
    }
  }

  if (shouldSave) {
    await saveConfigs(serverConfigs);
  }

  if (isBoosted && !isVoice && contextObj?.channel) {
    contextObj.channel.send({ content: `⚡ <@${userId}> ได้รับ XP +${finalAmount} [XP Boost x2]` }).then(msg => {
      setTimeout(() => msg.delete().catch(() => {}), 4000);
    }).catch(() => {});
  }

  return true;
}

// ⏳ Cron Job ทำงานทุกๆ 1 นาที: แจก XP ห้องเสียง + เช็กถอดยศหมดอายุ
function startVoiceXpCron(client, serverConfigs, saveConfigs) {
  cron.schedule('* * * * *', async () => {
    const now = Date.now();
    let globalUpdated = false;

    for (const guildId in serverConfigs) {
      const config = serverConfigs[guildId];
      if (!config || !config.levels) continue;

      const guild = client.guilds.cache.get(guildId);
      if (!guild) continue;

      const hasPremium = await isServerPremium(guildId, serverConfigs);
      if (hasPremium && config.levelConfig && config.levelConfig.enabled && config.levelConfig.voiceXpEnabled) {
        const xpPerMin = config.levelConfig.voiceXpAmount || 10;
        const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice);

        for (const [, channel] of voiceChannels) {
          for (const [, member] of channel.members) {
            if (member.user.bot) continue;
            const changed = await giveXpToUser(guildId, member.user.id, xpPerMin, guild, serverConfigs, saveConfigs, true, false, client);
            if (changed) globalUpdated = true;
          }
        }
      }

      for (const userId in config.levels) {
        const userStat = config.levels[userId];
        const roleExpired = await checkAndRemoveExpiredRoles(guild, userId, userStat, now);
        if (roleExpired) globalUpdated = true;
      }
    }

    if (globalUpdated) {
      await saveConfigs(serverConfigs);
    }
  }, { timezone: "Asia/Bangkok" });
}

function handleLeveling(message, serverConfigs, saveConfigs, client) {
  if (!message.guild || message.author.bot) return;

  const guildId = message.guild.id;
  if (!serverConfigs[guildId]) return;

  const config = serverConfigs[guildId];
  if (!config.levelConfig) {
    config.levelConfig = {
      enabled: true, minXp: 15, maxXp: 25, cmdXp: 20, xpMultiplier: 100, channelId: null,
      levelUpMessage: 'ยินดีด้วยคุณ {user}! เลเวลอัปขึ้นเป็น **Level {level}** แล้ว!',
      roleRewardMessage: '<a:spinningcrown:1563350810652446901> ยินดีด้วยคุณ {user} ได้รับยศพิเศษ {role} เนื่องในโอกาสอัปถึง Level {level}!',
      cardTitle: '📊 𝙕𝙀𝙉 𝘽𝙊𝙏 • STATS CARD',
      cardDescription: 'การ์ดข้อมูลเลเวลของ **{user}**',
      embedColor: COLORS.PRIMARY,
      statsCardImageUrl: '',
      voiceXpEnabled: false, voiceXpAmount: 10,
      roleRewards: {}
    };
  }

  const lConfig = serverConfigs[guildId].levelConfig;
  if (!lConfig.enabled) return;

  const min = Math.min(lConfig.minXp || 15, lConfig.maxXp || 25);
  const max = Math.max(lConfig.minXp || 15, lConfig.maxXp || 25);
  const earnedXp = Math.floor(Math.random() * (max - min + 1)) + min;
  
  // ✅ ส่ง client เข้าไปเพื่อให้ระบบสัตว์เลี้ยงทำงานแจ้งเตือนได้สมบูรณ์
  giveXpToUser(guildId, message.author.id, earnedXp, message, serverConfigs, saveConfigs, false, true, client);
}

function handleCommandLeveling(interaction, serverConfigs, saveConfigs, client) {
  if (!interaction.guild || interaction.user.bot) return;

  const guildId = interaction.guild.id;
  if (!serverConfigs[guildId]) return;

  const config = serverConfigs[guildId];
  if (!config.levelConfig || !config.levelConfig.enabled) return;
  if (!config.levelConfig.roleRewards) config.levelConfig.roleRewards = {};

  const cmdXp = config.levelConfig.cmdXp || 20;
  giveXpToUser(guildId, interaction.user.id, cmdXp, interaction, serverConfigs, saveConfigs, false, true, client);
}

const levelCommand = new SlashCommandBuilder()
  .setName('level')
  .setDescription('📜 เช็กเลเวลและค่าประสบการณ์ (XP)')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('เลือกสมาชิกที่ต้องการดูเลเวล')
      .setRequired(false)
  );

async function handleLevelCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const userId = targetUser.id;

  const config = serverConfigs[guildId] || {};
  const levels = config.levels || {};
  const lConfig = config.levelConfig || { xpMultiplier: 100, cardTitle: '📊 𝙕𝙀𝙉 𝘽𝙊𝙏 • STATS CARD', cardDescription: 'การ์ดข้อมูลเลเวลของ **{user}**', embedColor: COLORS.PRIMARY, statsCardImageUrl: '' };

  const userStat = levels[userId] || { xp: 0, level: 1, customTheme: '' };
  const hasPremium = await isServerPremium(guildId, serverConfigs);

  if (hasPremium) {
    await interaction.deferReply();
    const attachment = await generateProfileCard(targetUser, userStat, lConfig);
    return await interaction.editReply({ files: [attachment] });
  }

  const requiredXp = userStat.level * Math.max(10, lConfig.xpMultiplier || 100);
  const percentage = Math.min(Math.round((userStat.xp / requiredXp) * 10), 10);
  const progressBar = '█'.repeat(percentage) + '░'.repeat(10 - percentage);

  const finalTitle = (lConfig.cardTitle || '📊 𝙕𝙀𝙉 𝘽𝙊𝙏 • STATS CARD').replace('{user}', `<@${userId}>`);
  const finalDesc = (lConfig.cardDescription || 'การ์ดข้อมูลเลเวลของ **{user}**').replace('{user}', `<@${userId}>`);

  const embed = new EmbedBuilder()
    .setTitle(finalTitle)
    .setDescription(finalDesc)
    .setColor(lConfig.embedColor || COLORS.PRIMARY)
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: 'เลเวล (Level)', value: `\` Level ${userStat.level} \``, inline: true },
      { name: 'ค่าประสบการณ์ (XP)', value: `\` ${userStat.xp} / ${requiredXp} XP \``, inline: true },
      { name: 'ความคืบหน้า', value: `\`[${progressBar}]\` (${Math.floor((userStat.xp / requiredXp) * 100)}%)`, inline: false }
    );

  if (lConfig.statsCardImageUrl && lConfig.statsCardImageUrl.trim() !== '') {
    embed.setImage(lConfig.statsCardImageUrl.trim());
  }

  await interaction.reply({ embeds: [embed] });
}

const leaderboardCommand = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('📊 ดูอันดับผู้ที่มีเลเวลและ XP สูงสุดในเซิร์ฟเวอร์');

async function handleLeaderboardCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const config = serverConfigs[guildId] || {};
  const levels = config.levels || {};

  const sortedUsers = Object.entries(levels)
    .sort((a, b) => {
      if (b[1].level !== a[1].level) {
        return b[1].level - a[1].level;
      }
      return b[1].xp - a[1].xp;
    })
    .slice(0, 10);

  if (sortedUsers.length === 0) {
    return await interaction.reply({ content: '📊 ยังไม่มีข้อมูลการเก็บเลเวลในเซิร์ฟเวอร์นี้ครับ!', ephemeral: true });
  }

  let description = '';
  for (let i = 0; i < sortedUsers.length; i++) {
    const [userId, stat] = sortedUsers[i];
    let medal = `\`#${i + 1}\``;
    if (i === 0) medal = '🥇';
    else if (i === 1) medal = '🥈';
    else if (i === 2) medal = '🥉';

    description += `${medal} <@${userId}> ➔ Level **${stat.level}** (\`${stat.xp} XP\`)\n`;
  }

  const embed = new EmbedBuilder()
    .setTitle('🏆 LEADERBOARD • 10 อันดับสูงสุด')
    .setDescription(description)
    .setColor(config.levelConfig?.embedColor || COLORS.PRIMARY)
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

const setLevelCommand = new SlashCommandBuilder()
  .setName('set-level')
  .setDescription('⚙️ เปิดแผงควบคุมตั้งค่าเลเวลและเสียง')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

function getLevelDashboardContent(config) {
  if (!config.levelConfig) {
    config.levelConfig = {
      enabled: true, minXp: 15, maxXp: 25, cmdXp: 20, xpMultiplier: 100, channelId: null,
      levelUpMessage: 'ยินดีด้วยคุณ {user}! เลเวลอัปขึ้นเป็น **Level {level}** แล้ว!',
      roleRewardMessage: '<a:spinningcrown:1563350810652446901> ยินดีด้วยคุณ {user} ได้รับยศพิเศษ {role} เนื่องในโอกาสอัปถึง Level {level}!',
      cardTitle: '📊 𝙕𝙀𝙉 𝘽𝙊𝙏 • STATS CARD',
      cardDescription: 'การ์ดข้อมูลเลเวลของ **{user}**',
      embedColor: COLORS.PRIMARY,
      statsCardImageUrl: '',
      voiceXpEnabled: false, voiceXpAmount: 10,
      roleRewards: {}
    };
  }
  if (!config.levelConfig.roleRewards) config.levelConfig.roleRewards = {};

  const lc = config.levelConfig;
  const statusText = lc.enabled ? '✅ เปิดอยู่' : '❌ ปิดอยู่';
  const voiceStatus = lc.voiceXpEnabled ? `✅ เปิดอยู่ (${lc.voiceXpAmount} XP/นาที)` : '❌ ปิดอยู่';
  const channelName = lc.channelId ? `<#${lc.channelId}>` : 'ส่งในห้องที่พิมพ์';

  let rewardsList = Object.entries(lc.roleRewards)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .map(([lvl, data]) => {
      const rId = typeof data === 'object' ? data.roleId : data;
      return `Lv.${lvl} ➔ <@&${rId}>`;
    })
    .join(', ');
  if (!rewardsList) rewardsList = 'ยังไม่ได้ตั้งค่ายศรางวัล';

  const embed = new EmbedBuilder()
    .setTitle('⚙️ แผงควบคุมระบบเลเวล (Level Dashboard)')
    .setDescription('จัดการสถานะ เลือกห้องแจ้งเตือน ปรับเรต XP และตั้งค่าข้อความได้จากปุ่มด้านล่าง')
    .setColor(COLORS.DISCORD_BLURPLE)
    .addFields(
      { name: '📥 สถานะเลเวลแชท', value: statusText, inline: true },
      { name: '🎙️ ระบบ XP ห้องเสียง', value: voiceStatus, inline: true },
      { name: '📢 ห้องแจ้งเตือน', value: channelName, inline: true },
      { name: '👑 ยศรางวัลตามเลเวล', value: rewardsList, inline: false },
      { name: '📊 เรต XP (แชท / คำสั่ง)', value: `${lc.minXp}-${lc.maxXp} XP / ${lc.cmdXp} XP`, inline: true }
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('toggle_level').setLabel(lc.enabled ? 'ปิด/เปิด เลเวลแชท' : 'เปิดเลเวลแชท').setStyle(lc.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('toggle_voice_xp').setLabel(lc.voiceXpEnabled ? 'ปิด XP ห้องเสียง' : 'เปิด XP ห้องเสียง').setStyle(lc.voiceXpEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('edit_voice_amount').setLabel('ตั้งค่า XP ห้องเสียง').setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('edit_level_rate').setLabel('เรต XP').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('edit_level_card').setLabel('ตกแต่งการ์ด').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('edit_level_messages').setLabel('✉️ ตั้งค่าข้อความ').setStyle(ButtonStyle.Secondary)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('set_role_reward').setLabel('➕ ตั้งค่ายศรางวัลเลเวล').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('delete_role_reward').setLabel('🗑️ ลบยศรางวัลเลเวล').setStyle(ButtonStyle.Danger)
  );

  const channelRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder().setCustomId('select_level_channel').setPlaceholder('📂 เลือกห้องสำหรับส่งข้อความแจ้งเตือนเลเวลอัป').addChannelTypes(ChannelType.GuildText)
  );

  return { embeds: [embed], components: [row1, row2, row3, channelRow] };
}

async function handleSetLevelCommand(interaction, serverConfigs) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
  }
  const config = serverConfigs[interaction.guildId];
  await interaction.reply({ ...getLevelDashboardContent(config), ephemeral: true });
}

module.exports = {
  handleLeveling,
  handleCommandLeveling,
  levelCommand,
  handleLevelCommand,
  leaderboardCommand,
  handleLeaderboardCommand,
  setLevelCommand,
  handleSetLevelCommand,
  getLevelDashboardContent,
  startVoiceXpCron,
  pendingRoleRewardImages
};

// license.js
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { DEVELOPER_ID, COLORS } = require('./constants');

async function isServerPremium(guildId, serverConfigs) {
  const config = serverConfigs?.[guildId];
  if (!config || !config.premium || !config.premium.enabled) return false;

  if (config.premium.isLifetime) return true;
  if (config.premium.expiresAt && Date.now() < config.premium.expiresAt) return true;

  return false;
}

const grantPremiumCommand = new SlashCommandBuilder()
  .setName('grant-premium')
  .setDescription('💎 [PREMIUM] เปิดสิทธิ์พรีเมียมรายเซิร์ฟเวอร์ (สำหรับ Developer)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(option =>
    option.setName('guild_id')
      .setDescription('ระบุ Guild ID ของเซิร์ฟเวอร์ที่ต้องการเปิดสิทธิ์')
      .setRequired(true)
  )
  .addIntegerOption(option =>
    option.setName('months')
      .setDescription('จำนวนเดือนที่ต้องการให้ (ใส่ 999 สำหรับถาวร/Lifetime)')
      .setRequired(true)
  );

async function handleGrantPremiumCommand(interaction, serverConfigs, saveConfigs) {
  if (interaction.user.id !== DEVELOPER_ID && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะผู้พัฒนาบอทหรือผู้ดูแลระบบ (Administrator) เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
  }

  const targetGuildId = interaction.options.getString('guild_id').trim();
  const months = interaction.options.getInteger('months');

  if (!serverConfigs[targetGuildId]) {
    serverConfigs[targetGuildId] = {};
  }

  const now = Date.now();
  let expiresAt = now + (months * 30 * 24 * 60 * 60 * 1000);
  let isLifetime = false;

  if (months >= 999) {
    isLifetime = true;
    expiresAt = null;
  }

  serverConfigs[targetGuildId].premium = {
    enabled: true,
    isLifetime: isLifetime,
    expiresAt: expiresAt,
    grantedAt: now
  };

  await saveConfigs(serverConfigs);

  const embed = new EmbedBuilder()
    .setTitle('💎 PREMIUM LICENSE ACTIVATED')
    .setDescription(
      `เปิดสิทธิ์พรีเมียมสำเร็จเรียบร้อย!\n` +
      `🌐 **Guild ID:** \`${targetGuildId}\`\n` +
      `⏳ **ระยะเวลา:** ${isLifetime ? 'ตลอดชีพ (Lifetime)' : `${months} เดือน`}`
    )
    .setColor(COLORS.GREEN)
    .setTimestamp();

  return await interaction.reply({ embeds: [embed], ephemeral: true });
}

module.exports = {
  isServerPremium,
  grantPremiumCommand,
  handleGrantPremiumCommand
};

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');

const setupMediaGuardCommand = new SlashCommandBuilder()
  .setName('setup-media-guard')
  .setDescription('💎 [PREMIUM] เปิดใช้งานระบบบังคับส่งเฉพาะรูปภาพ/มีเดียในห้องนี้ (สำหรับ Admin)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addBooleanOption(option =>
    option.setName('status')
      .setDescription('เลือก เปิด หรือ ปิด ระบบ Media Guard ในห้องนี้')
      .setRequired(true)
  );

async function handleSetupMediaGuardCommand(interaction, serverConfigs, saveConfigs) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
  }

  const guildId = interaction.guildId;
  const channelId = interaction.channelId;
  const status = interaction.options.getBoolean('status');

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].mediaGuardChannels) {
    serverConfigs[guildId].mediaGuardChannels = [];
  }

  const channels = serverConfigs[guildId].mediaGuardChannels;
  const index = channels.indexOf(channelId);

  if (status && index === -1) {
    channels.push(channelId);
  } else if (!status && index !== -1) {
    channels.splice(index, 1);
  }

  await saveConfigs(serverConfigs);

  const embed = new EmbedBuilder()
    .setTitle('🛡️ MEDIA-ONLY CHANNEL GUARD')
    .setDescription(status 
      ? `✅ เปิดใช้งานระบบคุมห้องเรียบร้อย!\nห้องนี้จะ **อนุญาตให้ส่งเฉพาะรูปภาพ ไฟล์มีเดีย หรือลิงก์เท่านั้น** ข้อความตัวอักษรธรรมดาจะถูกลบอัตโนมัติ`
      : `❌ ปิดใช้งานระบบคุมห้องในห้องนี้แล้ว`)
    .setColor(status ? '#00FF00' : '#FF0000');

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

function handleMediaGuardMessage(message, serverConfigs) {
  if (!message.guild || message.author.bot) return false;

  const guildId = message.guild.id;
  const config = serverConfigs[guildId];
  if (!config || !config.mediaGuardChannels || !config.mediaGuardChannels.includes(message.channel.id)) {
    return false;
  }

  if (message.member && message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    return false;
  }

  const hasAttachment = message.attachments.size > 0;
  const hasLink = /https?:\/\/[^\s]+/gi.test(message.content);
  const hasEmbedImage = message.embeds.some(embed => embed.image || embed.thumbnail);

  if (!hasAttachment && !hasLink && !hasEmbedImage) {
    message.delete().catch(() => {});
    
    message.channel.send({ 
      content: `⚠️ <@${message.author.id}> ห้องนี้อนุญาตให้ส่ง **เฉพาะรูปภาพ ผลงาน หรือลิงก์มีเดียเท่านั้น** ครับ! (ข้อความตัวอักษรธรรมดาจะถูกลบ)` 
    }).then(msg => {
      setTimeout(() => msg.delete().catch(() => {}), 5000);
    }).catch(() => {});

    return true;
  }

  return false;
}

module.exports = {
  setupMediaGuardCommand,
  handleSetupMediaGuardCommand,
  handleMediaGuardMessage
};

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// 1. คำสั่งสำหรับให้แอดมินตั้งค่าห้องโชว์ผลงาน Artist
const setupShowcaseCommand = new SlashCommandBuilder()
  .setName('setup-showcase')
  .setDescription('💎 [PREMIUM] ตั้งค่าห้องโชว์ผลงาน Artist พร้อมระบบรีแอคชันอัตโนมัติ')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('เลือกห้องสำหรับให้สมาชิกส่งผลงานรูปภาพ')
      .setRequired(true)
  );

async function handleSetupShowcaseCommand(interaction, serverConfigs, saveConfigs) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
    return true;
  }

  const guildId = interaction.guildId;
  const channel = interaction.options.getChannel('channel');

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  serverConfigs[guildId].showcaseChannelId = channel.id;
  await saveConfigs(serverConfigs);

  const embed = new EmbedBuilder()
    .setTitle('🎨 ZEN BOT • ARTIST SHOWCASE SYSTEM')
    .setDescription(`✅ ตั้งค่าห้องโชว์ผลงานเรียบร้อยแล้วที่ห้อง <#${channel.id}>\n\n📌 เมื่อมีสมาชิกส่งรูปภาพหรือผลงานเข้ามา บอทจะช่วยกดรีแอคชันให้อัตโนมัติทันที!`)
    .setColor('#FF69B4');

  await interaction.reply({ embeds: [embed], ephemeral: true });
  return true;
}

// 2. ฟังก์ชันตรวจสอบข้อความในห้องโชว์ผลงาน
async function handleShowcaseMessage(message, serverConfigs) {
  if (!message.guild || message.author.bot) return false;

  const guildId = message.guild.id;
  const config = serverConfigs[guildId];
  if (!config || config.showcaseChannelId !== message.channel.id) return false;

  const hasAttachment = message.attachments.size > 0;
  const hasImageLink = /https?:\/\/.*\.(png|jpg|jpeg|gif|webp)/i.test(message.content);

  if (hasAttachment || hasImageLink) {
    try {
      await message.react('⭐');
      await message.react('❤️');
      await message.react('🔥');
    } catch (err) {
      console.error('Error handling showcase message:', err);
    }
  }

  return false;
}

module.exports = {
  setupShowcaseCommand,
  handleSetupShowcaseCommand,
  handleShowcaseMessage
};

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { ROLES, IMAGES, COLORS } = require('./constants');
const { isServerPremium } = require('./license');

const setupOrderTicketCommand = new SlashCommandBuilder()
  .setName('setup-order-ticket')
  .setDescription('💎 [PREMIUM] ส่งแผงร้านค้าแบบมีเมนูกดเลือกสินค้าและสร้างห้องออร์เดอร์ (สำหรับ Admin)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const ORDER_PRODUCTS = {
  product_bot_premium: { name: 'BOT PREMIUM (รายเดือน)', price: '฿399.00', roleId: null },
  product_artist_role: { name: 'ยศ Artist ถาวร', price: '฿69.00', roleId: ROLES.ARTIST_PERM },
  product_chilling_role: { name: 'ยศพิเศษ สายชิลล์ ถาวร', price: '฿19.00', roleId: ROLES.CHILLING },
  product_nightowl_role: { name: 'ยศพิเศษ คนนอนดึก ถาวร', price: '฿9.00', roleId: ROLES.NIGHTOWL }
};

function buildStorefrontPayload() {
  const embed = new EmbedBuilder()
    .setTitle('<a:emoji_103:1560417845903491112> 𝙕𝙀𝙉 𝘽𝙊𝙏 • PREMIUM STORE')
    .setDescription('ซื้อยศถาวร สะดวก ปลอดภัย และเป็นส่วนตัว \n\n')
    .setColor('#66FFFF')
    .setImage(IMAGES.DEFAULT_CINEMA);

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('select_product_order')
    .setPlaceholder(' เลือกสินค้าที่ต้องการสั่งซื้อ')
    .addOptions([
      { label: 'BOT PREMIUM (รายเดือน)', description: 'สต็อกไม่จำกัด • ฿399.00 / 1 เดือน • ยศ: Bot Premium', value: 'product_bot_premium', emoji: '💎' },
      { label: 'ยศ Artist ถาวร', description: 'สต็อกไม่จำกัด • ฿69.00 / ถาวร • สิทธิ์แต่งการ์ดส่วนตัว', value: 'product_artist_role', emoji: '🎨' },
      { label: 'ยศพิเศษ สายชิลล์ ถาวร', description: 'สต็อกไม่จำกัด • ฿19.00 / ถาวร • ยศโปรไฟล์สุดชิลล์', value: 'product_chilling_role', emoji: '☕' },
      { label: 'ยศพิเศษ คนนอนดึก ถาวร', description: 'สต็อกไม่จำกัด • ฿9.00 / ถาวร • ยศโปรไฟล์สายโต้รุ่ง', value: 'product_nightowl_role', emoji: '🌙' },
      { label: 'ล้างตัวเลือก', description: 'เคลียร์ค่าตัวเลือกให้กลับมาเป็นค่าเริ่มต้น', value: 'clear_selection', emoji: '❌' }
    ]);

  const row = new ActionRowBuilder().addComponents(selectMenu);
  return { embeds: [embed], components: [row] };
}

async function handleSetupOrderTicketCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
    return true;
  }

  await interaction.channel.send(buildStorefrontPayload());
  await interaction.reply({ content: '✅ ส่งแผงร้านค้าแบบเลือกสินค้าไปยังห้องนี้สำเร็จแล้ว!', ephemeral: true });
  return true;
}

async function sendOrderReceipt(channel, customerUser, adminUser, product, paymentMethod = 'PromptPay QR (Verified)') {
  const statusText = product.roleId
    ? `<a:verified:1563350708193984612> จัดส่งสำเร็จ (มอบยศแล้ว)`
    : `<a:verified:1563350708193984612> ชำระเงินสำเร็จ (ดำเนินการโดยแอดมิน)`;

  const receiptEmbed = new EmbedBuilder()
    .setTitle('<:RECEIPT:1564092694026916050> 𝙕𝙀𝙉 𝘽𝙊𝙏 • OFFICIAL ORDER RECEIPT')
    .setDescription('ใบเสร็จยืนยันการทำรายการสำเร็จ!')
    .setColor(COLORS.GREEN)
    .addFields(
      { name: '<:people:1564056325791424522> ผู้สั่งซื้อ', value: `<@${customerUser.id}>`, inline: true },
      { name: '<:shop:1564055854460829707> สินค้า', value: product.name, inline: true },
      { name: '<a:emoji_100:1560416789211516938> ยอดชำระ', value: `\`${product.price}\``, inline: true },
      { name: '<a:image0:1562554115257536552> ช่องทางชำระ', value: paymentMethod, inline: true },
      { name: '<:Admin:1564054387004022885> ผู้อนุมัติรายการ', value: `<@${adminUser.id}>`, inline: true },
      { name: '<a:emoji_101:1560416845322920067> สถานะรายการ', value: statusText, inline: false },
      { name: '<a:mastercard:1564023498433757336> วันที่ทำรายการ', value: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }), inline: false }
    )
    .setTimestamp()
    .setFooter({ text: 'ขอบคุณที่ใช้บริการครับ!', iconURL: customerUser.displayAvatarURL() });

  await channel.send({ embeds: [receiptEmbed] }).catch(() => {});

  try {
    await customerUser.send({ content: `🎉 **รายการสั่งซื้อของคุณได้รับการอนุมัติเรียบร้อยแล้ว!** นี่คือใบเสร็จรับเงินของคุณครับ:`, embeds: [receiptEmbed] });
  } catch (e) {}
}

async function handleOrderTicketSelect(interaction, serverConfigs) {
  if (interaction.customId !== 'select_product_order') return false;

  const guildId = interaction.guildId;
  if (!(await isServerPremium(guildId, serverConfigs))) {
    await interaction.reply({ content: '❌ ระบบร้านค้านี้ใช้งานได้เฉพาะเซิร์ฟเวอร์พรีเมียมเท่านั้นครับ!', ephemeral: true });
    return true;
  }

  const selectedValue = interaction.values[0];

  if (selectedValue === 'clear_selection') {
    await interaction.deferUpdate().catch(() => {});
    await interaction.editReply(buildStorefrontPayload()).catch(() => {});
    return true;
  }

  const product = ORDER_PRODUCTS[selectedValue];
  if (!product) return false;

  const guild = interaction.guild;
  const user = interaction.user;
  const member = interaction.member;

  if (product.roleId && member.roles.cache.has(product.roleId)) {
    await interaction.reply({ content: `❌ คุณมียศ **${product.name}** อยู่แล้วครับ! ไม่สามารถสั่งซื้อซ้ำได้`, ephemeral: true });
    return true;
  }

  await interaction.deferReply({ ephemeral: true }).catch(() => {});

  const loadingEmbed = new EmbedBuilder()
    .setTitle('⏳ กำลังเตรียมช่องทางส่วนตัวของคุณ...')
    .setDescription('ระบบกำลังสร้างห้องออร์เดอร์เฉพาะกิจ กรุณารอสักครู่ครับ')
    .setImage(IMAGES.ORDER_LOADING_GIF)
    .setColor(COLORS.PRIMARY);

  await interaction.editReply({ embeds: [loadingEmbed] });

  try {
    const cleanName = user.username.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '').slice(0, 20) || user.id.slice(-4);

    const ticketChannel = await guild.channels.create({
      name: `🛒-order-${cleanName}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ]
        },
        {
          id: interaction.client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels
          ]
        }
      ],
    });

    const ticketEmbed = new EmbedBuilder()
      .setTitle(` สินค้า : ${product.name} <:delivery:1564092608563781743>`)
      .setDescription(
        `• **ผู้สั่งซื้อ:** <@${user.id}>\n` +
        `• **สินค้า:** ${product.name}\n` +
        `• **ยอดที่ต้องชำระ:** \`${product.price}\`\n\n` +
        `──────────────────────\n` +
        `**ขั้นตอนการชำระสินค้า** <a:emoji_101:1560416845322920067>\n` +
        `1. กดปุ่ม **PromptPay QR** ด้านล่างเพื่อสแกนโอน\n` +
        `2. ส่งรูปสลิปโอนลงในห้องนี้ได้เลยครับ\n` +
        `3. รอแอดมินกดปุ่มอนุมัติเพื่อสินค้าและใบเสร็จอัตโนมัติครับ!`
      )
      .setImage(IMAGES.NEW_ORDER_GIF)
      .setColor(COLORS.GOLD)
      .setFooter({ text: 'ช่องทางชำระที่ปลอดภัย' });

    const payRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pay_promptpay_${selectedValue}_${user.id}`)
        .setLabel('PromptPay QR')
        .setEmoji('1564023221836058726')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`approve_order_${selectedValue}_${user.id}`)
        .setLabel('✅ แอดมินยืนยันสลิป & มอบยศ')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('close_order_ticket')
        .setLabel('🔒 ปิดออร์เดอร์')
        .setStyle(ButtonStyle.Danger)
    );

    await ticketChannel.send({ content: `ออร์เดอร์ใหม่จาก <@${user.id}> <a:newstext:1564121222034358443>`, embeds: [ticketEmbed], components: [payRow] });
    await interaction.editReply({ content: `✅ สร้างห้องออร์เดอร์ส่วนตัวให้คุณสำเร็จแล้ว: <#${ticketChannel.id}>`, embeds: [] });
  } catch (err) {
    console.error('Error creating order ticket channel:', err);
    await interaction.editReply({ content: '❌ เกิดข้อผิดพลาดในการสร้างห้องออร์เดอร์ กรุณาติดต่อแอดมินครับ', embeds: [] });
  }

  return true;
}

async function handleOrderPaymentButton(interaction) {
  const customId = interaction.customId;

  if (customId.startsWith('pay_promptpay_')) {
    await interaction.deferUpdate().catch(() => {});

    const parts = customId.replace('pay_promptpay_', '').split('_');
    const customerId = parts.pop();
    const selectedValue = parts.join('_');
    const product = ORDER_PRODUCTS[selectedValue];
    if (!product) return false;

    const embed = new EmbedBuilder()
      .setTitle('PromptPay QR <:shop:1564114304339542036>')
      .setDescription(
        `• **ผู้สั่งซื้อ:** <@${customerId}>\n` +
        `• **สินค้า:** ${product.name}\n` +
        `• **ยอดชำระ:** \`${product.price}\`\n\n` +
        `──────────────────────\n` +
        `📌 **สแกน QR Code ด้านล่าง:**\n` +
        `*ชำระเรียบร้อยแล้ว ส่งรูปสลิปหลักฐานในห้องนี้เพื่อให้แอดมินกดปุ่มยืนยันและรับยศอัตโนมัติได้เลยครับ!*`
      )
      .setImage(IMAGES.PROMPTPAY_QR)
      .setColor(COLORS.GREEN)
      .setFooter({ text: 'กรุณาส่งสลิปหลังโอนเงินเสร็จสิ้น' });

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`approve_order_${selectedValue}_${customerId}`)
        .setLabel('✅ แอดมินยืนยันสลิป & มอบยศ')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('close_order_ticket')
        .setLabel('🔒 ปิดออร์เดอร์ / ลบห้อง')
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.editReply({ embeds: [embed], components: [actionRow] });
    return true;
  }

  if (customId.startsWith('approve_order_')) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ ปุ่มนี้สำหรับ **Administrator** กดยืนยันสลิปเท่านั้นครับ! ลูกค้ากรุณาส่งรูปสลิปในแชทแล้วรอแอดมินสักครู่นะครับ', ephemeral: true });
      return true;
    }

    await interaction.deferUpdate().catch(() => {});

    const parts = customId.replace('approve_order_', '').split('_');
    const customerId = parts.pop();
    const selectedValue = parts.join('_');
    const product = ORDER_PRODUCTS[selectedValue];
    if (!product) return false;

    const guild = interaction.guild;
    const customerMember = await guild.members.fetch(customerId).catch(() => null);

    if (!customerMember) {
      await interaction.followUp({ content: '❌ ไม่พบข้อมูลสมาชิกผู้สั่งซื้อในเซิร์ฟเวอร์ (อาจออกจากเซิร์ฟเวอร์ไปแล้ว)', ephemeral: true });
      return true;
    }

    if (product.roleId) {
      try {
        await customerMember.roles.add(product.roleId);
        if (product.roleId === ROLES.ARTIST_PERM && customerMember.roles.cache.has(ROLES.ARTIST_TEMP)) {
          await customerMember.roles.remove(ROLES.ARTIST_TEMP).catch(() => {});
        }
      } catch (err) {
        console.error('Error granting role on order approval:', err);
        await interaction.followUp({ content: '❌ เกิดข้อผิดพลาดในการมอบยศ! กรุณาตรวจสอบว่ายศของบอทอยู่สูงกว่ายศสินค้าหรือไม่', ephemeral: true });
        return true;
      }
    }

    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('approved_done')
        .setLabel('✅ อนุมัติและส่งมอบสินค้าเรียบร้อยแล้ว')
        .setStyle(ButtonStyle.Success)
        .setDisabled(true)
    );
    await interaction.editReply({ components: [disabledRow] });

    await sendOrderReceipt(interaction.channel, customerMember.user, interaction.user, product);

    await interaction.channel.send({ content: `🎉 ขอบคุณที่ใช้บริการครับคุณ <@${customerId}>! ห้องออร์เดอร์นี้จะถูกปิดอัตโนมัติใน **10 วินาที**...` }).catch(() => {});

    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 10000);

    return true;
  }

  return false;
}

async function handleCloseTicketButton(interaction) {
  if (interaction.customId !== 'close_order_ticket') return false;

  await interaction.reply({ content: '🔒 กำลังปิดห้องออร์เดอร์ใน 5 วินาที...' });
  setTimeout(() => {
    interaction.channel.delete().catch(() => {});
  }, 5000);

  return true;
}

module.exports = {
  setupOrderTicketCommand,
  handleSetupOrderTicketCommand,
  handleOrderTicketSelect,
  handleOrderPaymentButton,
  handleCloseTicketButton,
  sendOrderReceipt
};

{
  "name": "my-discord-bot",
  "version": "1.0.0",
  "description": "Discord Bot on Render",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "@napi-rs/canvas": "^0.1.62",
    "@upstash/redis": "^1.31.0",
    "axios": "^1.6.8",
    "discord.js": "^14.14.1",
    "node-cron": "^3.0.3"
  }
}

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { IMAGES, COLORS } = require('./constants');
const { isServerPremium } = require('./license');

const setupQuestCommand = new SlashCommandBuilder()
  .setName('setup-quest')
  .setDescription('💎 [PREMIUM] ส่งแผงปุ่มกดรับเควสต์ประจำวันถาวรไปยังห้องนี้ (สำหรับ Admin)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function handleSetupQuestCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
    return true;
  }

  const embed = new EmbedBuilder()
    .setTitle('<a:emoji_142:1564170617240948767> 𝙕𝙀𝙉 𝘽𝙊𝙏 • DAILY QUEST')
    .setDescription('ลุ้นรับ **`coin`** ฟรีประจำเซิร์ฟเวอร์! (`สูงสุดถึง 100 coins`)')
    .setColor(COLORS.PRIMARY)
    .setImage(IMAGES.QUEST_BANNER);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('claim_daily_orb')
      .setLabel('Daily')
      .setEmoji('<a:emoji_142:1564170617240948767>')
      .setStyle(ButtonStyle.Success)
  );

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ ส่งแผงป้ายเควสต์ประจำวันถาวรไปยังห้องนี้สำเร็จแล้ว!', ephemeral: true });
  return true;
}

async function handleQuestButton(interaction, serverConfigs, saveConfigs) {
  if (interaction.customId !== 'claim_daily_orb') return false;

  const guildId = interaction.guildId;
  if (!(await isServerPremium(guildId, serverConfigs))) {
    await interaction.reply({ content: '❌ ระบบเควสต์ประจำวันใช้งานได้เฉพาะเซิร์ฟเวอร์พรีเมียมเท่านั้นครับ!', ephemeral: true });
    return true;
  }

  await interaction.deferReply({ ephemeral: true }).catch(() => {});

  const userId = interaction.user.id;

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].levels) serverConfigs[guildId].levels = {};
  if (!serverConfigs[guildId].levels[userId]) {
    serverConfigs[guildId].levels[userId] = {
      xp: 0, level: 1, orbs: 0, lastDaily: 0,
      boostUntil: 0, artistUntil: 0, cinemaPermUntil: 0, cinemaTempUntil: 0,
      customTheme: '', customWalletTheme: ''
    };
  }

  const userStat = serverConfigs[guildId].levels[userId];
  const now = Date.now();
  const cooldownTime = 19 * 60 * 60 * 1000;

  if (userStat.lastDaily && (now - userStat.lastDaily < cooldownTime)) {
    const remainingMs = cooldownTime - (now - userStat.lastDaily);
    const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
    const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    await interaction.editReply({ content: `⏳ คุณรับไปแล้ว!\n กลับมาอีกครั้งใน **${remainingHours} h ${remainingMinutes} min.**` });
    return true;
  }

  const isLuckyHalf = Math.random() < 0.5;
  const rewardCoins = isLuckyHalf
    ? Math.floor(Math.random() * (100 - 50 + 1)) + 50
    : Math.floor(Math.random() * 21);

  userStat.orbs = (userStat.orbs || 0) + rewardCoins;
  userStat.lastDaily = now;
  await saveConfigs(serverConfigs);

  if (rewardCoins === 0) {
    await interaction.editReply({ content: '<a:kitty:1563350578375950496> น่าเสียดาย! พรุ่งนี้เอาใหม่นะ!' });
  } else {
    await interaction.editReply({ 
      content: `<a:emoji_142:1564170617240948767> **ผลการสุ่มกาชาปอง:** คุณได้รับ **+${rewardCoins} coins** 🎉\n\`Wallet : ${userStat.orbs.toLocaleString()} coins\`` 
    });
  }

  return true;
}

module.exports = {
  setupQuestCommand,
  handleSetupQuestCommand,
  handleQuestButton
};

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');

function getSecurityDashboardContent(config) {
  const sec = config.security;
  const status = sec.enabled ? '✅ เปิดใช้งาน' : '❌ ปิดใช้งาน';
  const linkStatus = sec.antiLink ? '✅ เปิด' : '❌ ปิด';
  const spamStatus = sec.antiSpam ? '✅ เปิด' : '❌ ปิด';
  const beastStatus = sec.antiMrBeast ? '✅ เปิด' : '❌ ปิด';

  const timeoutSecDisplay = sec.timeoutSeconds >= 1000 ? Math.floor(sec.timeoutSeconds / 1000) : (sec.timeoutSeconds || 60);

  const formatActions = (act) => {
    if (!act) return 'Timeout';
    const list = [];
    if (act.timeout) list.push('Timeout');
    if (act.kick) list.push('Kick');
    if (act.ban) list.push('Ban');
    return list.length > 0 ? list.join(' + ') : 'ลบข้อความอย่างเดียว';
  };

  const embed = new EmbedBuilder()
    .setTitle('🛡️ แผงควบคุมระบบป้องกันความปลอดภัย (Security Dashboard)')
    .setDescription('จัดการระบบป้องกันลิงก์ปลอม สแปม และบอทอันตรายได้จากปุ่มด้านล่าง')
    .setColor('#FF0000')
    .addFields(
      { name: '📥 สถานะระบบหลัก', value: status, inline: true },
      { name: '🔗 Anti-Link', value: `${linkStatus} (${formatActions(sec.actions?.invite)})`, inline: true },
      { name: '⚡ Anti-Spam', value: `${spamStatus} (${formatActions(sec.actions?.spam)})`, inline: true },
      { name: '🤖 Anti-MrBeast', value: beastStatus, inline: true },
      { name: '⚙️ ตั้งค่าสแปม', value: `${sec.spamCount} ข้อความ / ${sec.spamSeconds} วินาที (ระงับ ${timeoutSecDisplay} วินาที)`, inline: false }
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sec_toggle_main').setLabel(sec.enabled ? 'ปิดระบบทั้งหมด' : 'เปิดระบบทั้งหมด').setStyle(sec.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('sec_toggle_link').setLabel('สลับ Anti-Link').setStyle(sec.antiLink ? ButtonStyle.Danger : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sec_toggle_spam').setLabel('สลับ Anti-Spam').setStyle(sec.antiSpam ? ButtonStyle.Danger : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sec_toggle_mrbeast').setLabel('สลับ Anti-MrBeast').setStyle(sec.antiMrBeast ? ButtonStyle.Danger : ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sec_config_time').setLabel('⚙️ ตั้งค่าเกณฑ์สแปมและเวลา').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('sec_reset').setLabel('🔄 รีเซ็ตค่าเริ่มต้น').setStyle(ButtonStyle.Secondary)
  );

  const inviteActionMenu = new StringSelectMenuBuilder()
    .setCustomId('act_invite_select')
    .setPlaceholder('🔗 เลือกบทลงโทษ Anti-Link (เลือกได้หลายข้อ)')
    .setMinValues(0)
    .setMaxValues(3)
    .addOptions([
      { label: 'ระงับการพิมพ์ (Timeout)', value: 'timeout', emoji: '⏳' },
      { label: 'เตะออกจากเซิร์ฟเวอร์ (Kick)', value: 'kick', emoji: '👢' },
      { label: 'แบนถาวร (Ban)', value: 'ban', emoji: '🔨' }
    ]);

  const spamActionMenu = new StringSelectMenuBuilder()
    .setCustomId('act_spam_select')
    .setPlaceholder('⚡ เลือกบทลงโทษ Anti-Spam (เลือกได้หลายข้อ)')
    .setMinValues(0)
    .setMaxValues(3)
    .addOptions([
      { label: 'ระงับการพิมพ์ (Timeout)', value: 'timeout', emoji: '⏳' },
      { label: 'เตะออกจากเซิร์ฟเวอร์ (Kick)', value: 'kick', emoji: '👢' },
      { label: 'แบนถาวร (Ban)', value: 'ban', emoji: '🔨' }
    ]);

  const channelMenu = new ChannelSelectMenuBuilder()
    .setCustomId('sec_select_ignored')
    .setPlaceholder('📂 เลือกห้องที่ไม่ต้องการให้ระบบความปลอดภัยทำงาน (ยกเว้น)')
    .setMinValues(0)
    .setMaxValues(5);

  return {
    embeds: [embed],
    components: [
      row1,
      row2,
      new ActionRowBuilder().addComponents(inviteActionMenu),
      new ActionRowBuilder().addComponents(spamActionMenu),
      new ActionRowBuilder().addComponents(channelMenu)
    ]
  };
}

async function applyPunishment(member, actionConfig, timeoutMs, reason) {
  if (!member) return;
  try {
    if (actionConfig?.ban && member.bannable) {
      await member.ban({ reason });
    } else if (actionConfig?.kick && member.kickable) {
      await member.kick(reason);
    } else if (actionConfig?.timeout && member.moderatable) {
      await member.timeout(timeoutMs, reason);
    }
  } catch (err) {
    console.error(`Error applying security punishment (${reason}):`, err);
  }
}

async function handleSecurityMessage(message, config, spamTracker) {
  if (!message.guild || message.author.bot) return false;
  if (!config || !config.security || !config.security.enabled) return false;

  const sec = config.security;
  if (sec.ignoredChannels && sec.ignoredChannels.includes(message.channel.id)) return false;
  if (message.member && message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return false;

  const content = message.content;
  const rawTimeout = sec.timeoutSeconds || 60;
  const timeoutMs = rawTimeout >= 1000 ? rawTimeout : rawTimeout * 1000;

  // 1. ตรวจสอบ Anti-Link
  if (sec.antiLink) {
    const inviteRegex = /(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9]+/i;
    const urlRegex = /https?:\/\/[^\s]+/i;
    if (inviteRegex.test(content) || urlRegex.test(content)) {
      await message.delete().catch(() => {});
      await applyPunishment(message.member, sec.actions?.invite, timeoutMs, 'Anti-Link Protection');
      message.channel.send({ content: `⚠️ <@${message.author.id}> ห้ามส่งลิงก์ในห้องนี้ครับ!` }).then(msg => {
        setTimeout(() => msg.delete().catch(() => {}), 4000);
      }).catch(() => {});
      return true;
    }
  }

  // 2. ตรวจสอบ Anti-MrBeast
  if (sec.antiMrBeast) {
    const beastKeywords = ['mrbeast', 'giveaway free nitro', 'claim free nitro', 'steam gift card free'];
    const lowerContent = content.toLowerCase();
    if (beastKeywords.some(keyword => lowerContent.includes(keyword))) {
      await message.delete().catch(() => {});
      await applyPunishment(message.member, sec.actions?.mrbeast || { timeout: true }, timeoutMs, 'Anti-MrBeast Auto-Punish');
      await message.channel.send({ content: `🚨 ตรวจพบบอทสแปมหลอกลวง (<@${message.author.id}>) ทำการลบข้อความและลงโทษเรียบร้อย!` }).catch(() => {});
      return true;
    }
  }

  // 3. ตรวจสอบ Anti-Spam
  if (sec.antiSpam) {
    const userId = message.author.id;
    const now = Date.now();
    if (!spamTracker.has(userId)) {
      spamTracker.set(userId, []);
    }
    const timestamps = spamTracker.get(userId);
    timestamps.push(now);

    const windowMs = (sec.spamSeconds || 6) * 1000;
    const recentMessages = timestamps.filter(time => now - time < windowMs);
    spamTracker.set(userId, recentMessages);

    if (recentMessages.length >= (sec.spamCount || 3)) {
      await message.delete().catch(() => {});
      spamTracker.set(userId, []);
      await applyPunishment(message.member, sec.actions?.spam || { timeout: true }, timeoutMs, 'Anti-Spam Auto-Punish');
      message.channel.send({ content: `⚠️ <@${userId}> คุณพิมพ์ข้อความเร็วเกินไป (สแปม) จึงถูกลงโทษตามกฎของเซิร์ฟเวอร์!` }).then(msg => {
        setTimeout(() => msg.delete().catch(() => {}), 5000);
      }).catch(() => {});
      return true;
    }
  }

  return false;
}

module.exports = {
  getSecurityDashboardContent,
  handleSecurityMessage
};

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { generateWalletCard } = require('./canvas_card');
const { isServerPremium } = require('./license');
const { ROLES, IMAGES, COLORS } = require('./constants');

const userCooldowns = new Map();

// โครงสร้างข้อมูลรายการไอเทม
const IN_GAME_ITEMS = [
  {
    id: 'gacha_box',
    name: 'กาชาปอง',
    emoji: '<a:emoji_142:1564170617240948767>',
    price: 15,
    type: 'gacha',
    description: 'สูงสุด 150 coins'
  },
  {
    id: 'xp_boost',
    name: 'XP Boost ( 1 hr. )',
    emoji: { name: 'xp', id: '1564107013456269433' },
    price: 30,
    type: 'buff',
    roleId: ROLES.XP_BOOSTER,
    description: 'x2'
  },
  {
    id: 'role_artist_temp',
    name: 'Artist ( 3 days)',
    emoji: '<:emoji_143:1564202161309483048>',
    price: 75,
    type: 'role_temp',
    roleId: ROLES.ARTIST_TEMP,
    description: 'รับยศ Artist'
  }
];

const setupShopCommand = new SlashCommandBuilder()
  .setName('setup-in-game-shop')
  .setDescription('💎 [PREMIUM] ส่งแผงป้ายหน้าร้านค้าถาวรไปยังห้องนี้ (สำหรับ Admin)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const boostStatusCommand = new SlashCommandBuilder()
  .setName('boost-status')
  .setDescription('💎 [PREMIUM] เช็กสถานะ XP x2');

const coinsCommand = new SlashCommandBuilder()
  .setName('coins')
  .setDescription('💎 [PREMIUM] เช็กยอด coins');

const addCoinsCommand = new SlashCommandBuilder()
  .setName('add-coins')
  .setDescription('💎 [PREMIUM] เติม coins ให้กับสมาชิก (สำหรับ Admin)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption(option => option.setName('user').setDescription('เลือกสมาชิกที่ต้องการเติมเหรียญ').setRequired(true))
  .addIntegerOption(option => option.setName('amount').setDescription('จำนวน coins ที่ต้องการเติม').setRequired(true));

async function handleCoinsCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const config = serverConfigs[guildId] || {};
  const userStat = config.levels?.[userId] || { xp: 0, level: 1, orbs: 0, customWalletTheme: '' };
  const hasPremium = await isServerPremium(guildId, serverConfigs);

  if (hasPremium) {
    await interaction.deferReply({ ephemeral: true });
    const attachment = await generateWalletCard(interaction.user, userStat);
    return await interaction.editReply({ files: [attachment] });
  }

  const userCoins = userStat.orbs || 0;
  const embed = new EmbedBuilder()
    .setTitle('💰 WALLET • ยอดเหรียญของคุณ')
    .setDescription(`ยอด coins คงเหลือในกระเป๋าของ <@${userId}>:\n**${userCoins.toLocaleString()} coins**`)
    .setColor(COLORS.GOLD)
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleAddCoinsCommand(interaction, serverConfigs, saveConfigs) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น!', ephemeral: true });
    return true;
  }

  const targetUser = interaction.options.getUser('user');
  const amount = interaction.options.getInteger('amount');
  const guildId = interaction.guildId;
  const userId = targetUser.id;

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].levels) serverConfigs[guildId].levels = {};
  if (!serverConfigs[guildId].levels[userId]) {
    serverConfigs[guildId].levels[userId] = {
      xp: 0, level: 1, orbs: 0, lastDaily: 0,
      boostUntil: 0, artistUntil: 0, cinemaPermUntil: 0, cinemaTempUntil: 0,
      customTheme: '', customWalletTheme: ''
    };
  }

  const userStat = serverConfigs[guildId].levels[userId];
  userStat.orbs = Math.max(0, (userStat.orbs || 0) + amount);
  await saveConfigs(serverConfigs);

  const actionText = amount >= 0 ? `เติม coins จำนวน **+${amount.toLocaleString()} coins**` : `หัก coins จำนวน **${amount.toLocaleString()} coins**`;
  await interaction.reply({ content: `✅ ${actionText} ให้กับคุณ <@${userId}> สำเร็จแล้ว! ( ยอดคงเหลือ: ${userStat.orbs.toLocaleString()} coins )`, ephemeral: true });
  return true;
}

async function handleSetupShopCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
    return true;
  }

  const embed = new EmbedBuilder()
    .setTitle('<a:emoji_103:1560417845903491112> 𝙕𝙀𝙉 𝙎𝙃𝙊𝙋')
    .setDescription(
      'ร้านค้าไอเทม `xp boost` และ `ยศพิเศษประจำเซิร์ฟเวอร์`'
    )
    .setImage(IMAGES.SHOP_STOREFRONT)
    .setColor(COLORS.GOLD);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('open_in_game_shop_panel')
      .setLabel('เปิดแผงร้านค้า')
      .setEmoji('1560417845903491112')
      .setStyle(ButtonStyle.Success)
  );

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ ส่งแผงป้ายหน้าร้านค้าในเกมไปยังห้องนี้สำเร็จแล้ว!', ephemeral: true });
  return true;
}

async function handleBoostStatusCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const config = serverConfigs[guildId] || {};
  const userStat = config.levels?.[userId];
  const now = Date.now();

  if (!userStat || !userStat.boostUntil || userStat.boostUntil <= now) {
    await interaction.reply({ content: '❌ คุณยังไม่ได้เปิดใช้งาน XP x2 หรือบัฟหมดอายุไปแล้วครับ!', ephemeral: true });
    return true;
  }

  const remainingMs = userStat.boostUntil - now;
  const remainingMins = Math.ceil(remainingMs / (1000 * 60));

  const embed = new EmbedBuilder()
    .setTitle('<:xp_active:1564107060021432370> XP BOOSTER STATUS')
    .setDescription(`สถานะ XP x2:\n⏳ คงเหลือเวลาอีกประมาณ **${remainingMins} นาที**`)
    .setColor(COLORS.GREEN);

  await interaction.reply({ embeds: [embed], ephemeral: true });
  return true;
}

async function handleInGameShopPanel(interaction, serverConfigs) {
  await interaction.deferReply({ ephemeral: true }).catch(() => {});

  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const config = serverConfigs[guildId] || {};
  const userStat = config.levels?.[userId];
  const userCoins = userStat ? (userStat.orbs || 0) : 0;

  const itemsText = IN_GAME_ITEMS.map(item => {
    const emojiDisplay = typeof item.emoji === 'object' ? `<:${item.emoji.name}:${item.emoji.id}>` : item.emoji;
    return `${emojiDisplay} **${item.name}** • \`${item.price} coins\`\n└ ${item.description}`;
  }).join('\n\n');

  const embed = new EmbedBuilder()
    .setTitle('<a:emoji_103:1560417845903491112> 𝙕𝙀𝙉 𝙎𝙃𝙊𝙋')
    .setDescription(
      `${itemsText}\n\n` +
      `<a:emoji_100:1560416789211516938> **Wallet:** \`${userCoins.toLocaleString()} coins\``
    )
    .setColor('#66FFFF');

  const row = new ActionRowBuilder();
  IN_GAME_ITEMS.forEach(item => {
    const button = new ButtonBuilder()
      .setCustomId(`buy_item_${item.id}`)
      .setLabel(item.name.split(' (')[0])
      .setStyle(ButtonStyle.Primary);

    if (item.emoji) {
      button.setEmoji(item.emoji);
    }

    row.addComponents(button);
  });

  await interaction.editReply({ embeds: [embed], components: [row] });
  return true;
}

async function handleShopButton(interaction, serverConfigs, saveConfigs) {
  const customId = interaction.customId;
  if (customId !== 'open_in_game_shop_panel' && !customId.startsWith('buy_item_')) return false;

  const guildId = interaction.guildId;
  if (!(await isServerPremium(guildId, serverConfigs))) {
    await interaction.reply({ content: '❌ ระบบร้านค้านี้ใช้งานได้เฉพาะเซิร์ฟเวอร์พรีเมียมเท่านั้น!', ephemeral: true });
    return true;
  }

  if (customId === 'open_in_game_shop_panel') {
    return await handleInGameShopPanel(interaction, serverConfigs);
  }

  await interaction.deferReply({ ephemeral: true }).catch(() => {});

  const userId = interaction.user.id;
  const now = Date.now();

  if (userCooldowns.has(userId)) {
    const expirationTime = userCooldowns.get(userId) + 2000;
    if (now < expirationTime) {
      await interaction.editReply({ content: '⏳ ใจเย็นๆ ครับ! กรุณารอสักครู่ก่อนกดทำรายการถัดไป...' });
      return true;
    }
  }
  userCooldowns.set(userId, now);

  const itemId = customId.replace('buy_item_', '');
  const item = IN_GAME_ITEMS.find(i => i.id === itemId);
  if (!item) return true;

  if (item.id === 'role_artist_temp') {
    try {
      const member = await interaction.guild.members.fetch(userId);
      if (member.roles.cache.has(ROLES.ARTIST_PERM)) {
        await interaction.editReply({ content: '❌ คุณมียศ **Artist ถาวร** อยู่แล้วครับ!' });
        return true;
      }
    } catch (e) {}
  }

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].levels) serverConfigs[guildId].levels = {};
  if (!serverConfigs[guildId].levels[userId]) {
    serverConfigs[guildId].levels[userId] = {
      xp: 0, level: 1, orbs: 0, lastDaily: 0,
      boostUntil: 0, artistUntil: 0, cinemaPermUntil: 0, cinemaTempUntil: 0,
      customTheme: '', customWalletTheme: ''
    };
  }

  const userStat = serverConfigs[guildId].levels[userId];
  const userCoins = userStat.orbs || 0;

  if (item.type === 'role_temp' && userStat.artistUntil && userStat.artistUntil > now) {
    const remainingDays = Math.ceil((userStat.artistUntil - now) / (1000 * 60 * 60 * 24));
    await interaction.editReply({ content: `⚠️ คุณยังมีสิทธิ์ Artist | 3d ใช้งานอยู่\n (เหลือเวลาอีกประมาณ ${remainingDays} วัน) ไม่สามารถซื้อซ้ำได้ครับ!` });
    return true;
  }

  if (userCoins < item.price) {
    await interaction.editReply({ content: `❌ coins ของคุณมีไม่พอ!\n ( คุณมี ${userCoins} coins สินค้าราคา ${item.price} coins )` });
    return true;
  }

  // ป้องกันเคสที่ userStat.orbs เป็น undefined แล้วกลายเป็น NaN
  userStat.orbs = (userStat.orbs || 0) - item.price;

  if (item.type === 'gacha') {
    const outcomes = [
      { reward: 0, text: '<a:cuteghost:1563345975597080686> เกลือ!' },
      { reward: 0, text: '0 coins ลองใหม่อีกครั้งนะ! <a:kitty:1563350578375950496>' },
      { reward: 5, text: 'เศษเหรียญปลอบใจ! รับไป 5 coins <a:emoji_145:1564216100915515432>' },
      { reward: 20, text: 'พอมีโชค! รับไป 20 coins <a:emoji_144:1564216078530514995>' },
      { reward: 150, text: 'แจ็กพอตแตกกระจาย! รับไปเต็มๆ 150 coins <a:emoji_101:1560416845322920067>' }
    ];
    const roll = outcomes[Math.floor(Math.random() * outcomes.length)];
    userStat.orbs += roll.reward;
    await saveConfigs(serverConfigs);

    await interaction.editReply({ 
      content: `<a:emoji_142:1564170617240948767> **กาชาปอง**\n${roll.text}\n\`Wallet : ${userStat.orbs.toLocaleString()} coins\`` 
    });
    return true;
  }

    if (item.type === 'buff') {
    const oneHour = 60 * 60 * 1000;
    userStat.boostUntil = (userStat.boostUntil && userStat.boostUntil > now ? userStat.boostUntil : now) + oneHour;
    await saveConfigs(serverConfigs);

    try {
      const member = await interaction.guild.members.fetch(userId);
      const role = await interaction.guild.roles.fetch(item.roleId);
      if (role) await member.roles.add(role);
    } catch (err) {}

    const remainingMs = userStat.boostUntil - now;
    const remainingMins = Math.ceil(remainingMs / (1000 * 60));

    await interaction.editReply({ 
      content: `<:xp_active:1564107060021432370> เปิดใช้งาน XP x2 สำเร็จ! ( ⏱️ **${remainingMins}** นาที )\n\`Wallet : ${userStat.orbs.toLocaleString()} coins\`` 
    });
    return true;
  }

  if (item.type === 'role_temp') {
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    userStat.artistUntil = (userStat.artistUntil && userStat.artistUntil > now ? userStat.artistUntil : now) + threeDays;
    await saveConfigs(serverConfigs);

    try {
      const member = await interaction.guild.members.fetch(userId);
      const role = await interaction.guild.roles.fetch(item.roleId);
      if (role) await member.roles.add(role);
    } catch (err) {}

    await interaction.editReply({ 
      content: `🎉 เช่าสำเร็จ! คุณได้รับยศ Artist และสิทธิ์แต่งการ์ดส่วนตัวเป็นเวลา 3 วันเต็ม!\n\`Wallet : ${userStat.orbs.toLocaleString()} coins\`` 
    });
    return true;
  }

  return true;
}

module.exports = {
  setupShopCommand,
  handleSetupShopCommand,
  boostStatusCommand,
  handleBoostStatusCommand,
  coinsCommand,
  addCoinsCommand,
  handleCoinsCommand,
  handleAddCoinsCommand,
  handleShopButton,
  SHOP_ITEMS: IN_GAME_ITEMS
};

// index.js
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const http = require('http');
const cron = require('node-cron');
const { Redis } = require('@upstash/redis');

const { IMAGES, COLORS } = require('./constants');
const { getSecurityDashboardContent, handleSecurityMessage } = require('./security');
const {
  handleLeveling,
  handleCommandLeveling,
  levelCommand,
  handleLevelCommand,
  leaderboardCommand,
  handleLeaderboardCommand,
  setLevelCommand,
  handleSetLevelCommand,
  getLevelDashboardContent,
  startVoiceXpCron,
  pendingRoleRewardImages
} = require('./level');
const { setupQuestCommand, handleSetupQuestCommand, handleQuestButton } = require('./quest');
const {
  setupShopCommand,
  handleSetupShopCommand,
  boostStatusCommand,
  handleBoostStatusCommand,
  coinsCommand,
  addCoinsCommand,
  handleCoinsCommand,
  handleAddCoinsCommand,
  handleShopButton
} = require('./shop');
const { setupArtistCommand, handleSetupArtistCommand, handleArtistButton, handleArtistModalSubmit } = require('./artist_card');
const { setupMediaGuardCommand, handleSetupMediaGuardCommand, handleMediaGuardMessage } = require('./media_guard');
const { setupOrderTicketCommand, handleSetupOrderTicketCommand, handleOrderTicketSelect, handleOrderPaymentButton, handleCloseTicketButton } = require('./order_ticket');
const { isServerPremium, grantPremiumCommand, handleGrantPremiumCommand } = require('./license');
const { generateWelcomeCard } = require('./canvas_card');
const {
  setupCinemaCommand,
  cinemaBroadcastCommand,
  handleSetupCinemaCommand,
  handleCinemaBroadcastCommand,
  handleCinemaButton,
  handleCinemaSelect,
  handleCinemaModal
} = require('./cinema');
const {
  autoCinemaCommand,
  handleAutoCinemaCommand,
  handleAutoCinemaButton,
  handleAutoCinemaSelect,
  handleAutoCinemaModal,
  loadAllAutoCinemaCrons
} = require('./auto_cinema');
const {
  setupShowcaseCommand,
  handleSetupShowcaseCommand,
  handleShowcaseMessage
} = require('./media_showcase');

// 🐾 นำเข้าระบบ Zen Pet จาก companion.js (รวมถึง startPetHatchCron)
const {
  rollRandomPet,
  petShopCommand,
  handlePetShopCommand,
  setPetChannelCommand,
  setPetRoleCommand,
  handleSetPetRoleCommand,
  petCommand,
  handlePetCommand,
  coinsCommand: petCoinsCommand,
  handleCoinsCommand: handlePetCoinsCommand,
  handleCompanionButton,
  petBattleCommand,
  handlePetBattleCommand,
  handleBattleButtons,
  petLeaderboardCommand,
  handlePetLeaderboardCommand,
  startPetHatchCron
} = require('./companion');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// 🌐 HTTP Server รองรับทั้ง Health Check และ GitHub Webhook
const httpServer = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/github-webhook') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        
        if (data.commits && data.repository) {
          const repoName = data.repository.name;
          const commits = data.commits;
          
          let changelogText = commits.map(c => `+ ${c.message}`).join('\n');

          const embed = new EmbedBuilder()
            .setColor(COLORS.PRIMARY || '#2b2d31')
            .setImage('https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExbzJudGQ0bWtubTFsOG5mMWk5ZXdydXhwMjJnejZxOHVjeWtrdGlrYiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/O7BtZQ0ceoVz4pDdC7/giphy.gif')
            .addFields(
              { name: '🟢 Announcement Bot', value: `**Version:**\n\`${repoName}\``, inline: false },
              { name: 'Changelog:', value: `\`\`\`diff\n${changelogText}\n\`\`\``, inline: false },
              { name: 'Released:', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            );

          for (const [guildId, config] of Object.entries(serverConfigs)) {
            if (config.devLogChannelId) {
              try {
                const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
                if (guild) {
                  const channel = await guild.channels.fetch(config.devLogChannelId).catch(() => null);
                  if (channel && channel.isTextBased()) {
                    await channel.send({ content: '<@&1560731553766707241>', embeds: [embed] });
                  }
                }
              } catch (err) {
                console.error('Error sending github log:', err);
              }
            }
          }
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success' }));
      } catch (e) {
        console.error('Webhook parse error:', e);
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad Request');
      }
    });
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running!\n');
  }
});
httpServer.listen(process.env.PORT || 3000);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

let serverConfigs = {};
let saveTimeout = null;

async function loadConfigs() {
  try {
    const data = await redis.get('server_configs');
    if (data) {
      return typeof data === 'string' ? JSON.parse(data) : data;
    }
  } catch (e) {
    console.error('Error loading config from Redis:', e);
  }
  return {};
}

async function saveConfigs(configs) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      await redis.set('server_configs', JSON.stringify(configs));
    } catch (e) {
      console.error('Error saving config to Redis:', e);
    }
  }, 1500);
}

function ensureGuildConfig(guildId) {
  if (!serverConfigs[guildId]) {
    serverConfigs[guildId] = {};
  }
  const config = serverConfigs[guildId];

  if (config.welcomeEnabled === undefined) config.welcomeEnabled = false;
  if (config.channelId === undefined) config.channelId = null;
  if (config.autoroleEnabled === undefined) config.autoroleEnabled = false;
  if (config.autoroleId === undefined) config.autoroleId = null;
  if (config.devLogChannelId === undefined) config.devLogChannelId = null;

  if (!config.security) {
    config.security = {
      enabled: false, antiLink: true, antiSpam: true, antiMrBeast: true,
      spamCount: 3, spamSeconds: 6, timeoutSeconds: 60,
      actions: {
        invite: { timeout: true, kick: false, ban: false },
        spam: { timeout: true, kick: false, ban: false },
        mrbeast: { timeout: true, kick: false, ban: false }
      },
      ignoredChannels: []
    };
  }
  if (!config.levels) config.levels = {};
  if (!config.levelConfig) {
    config.levelConfig = {
      enabled: true, minXp: 15, maxXp: 25, cmdXp: 20, xpMultiplier: 100, channelId: null,
      levelUpMessage: 'ยินดีด้วยคุณ {user}! เลเวลอัปขึ้นเป็น **Level {level}** แล้ว!',
      roleRewardMessage: '👑 ยินดีด้วยคุณ {user} ได้รับยศพิเศษ {role} เนื่องในโอกาสอัปถึง Level {level}!',
      cardTitle: '📊 𝙕𝙀𝙉 𝘽𝙊𝙏 • STATS CARD',
      cardDescription: 'การ์ดข้อมูลเลเวลของ **{user}**',
      embedColor: COLORS.PRIMARY,
      statsCardImageUrl: '',
      voiceXpEnabled: false, voiceXpAmount: 10, roleRewards: {}
    };
  }
  if (!config.levelConfig.roleRewardMessage) {
    config.levelConfig.roleRewardMessage = '👑 ยินดีด้วยคุณ {user} ได้รับยศพิเศษ {role} เนื่องในโอกาสอัปถึง Level {level}!';
  }
  if (!config.levelConfig.roleRewards) config.levelConfig.roleRewards = {};
  if (!config.embed) {
    config.embed = { description: '**𑣲⋆ 𝙉𝙀𝙒 𝙈𝙚𝙢𝙗𝙚𝙧!** ✨\n🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}** ครับ!' };
  }
  if (!config.autoClear) {
    config.autoClear = { enabled: false, time: '06:00', channelId: null };
  }
  if (!config.mediaGuardChannels) config.mediaGuardChannels = [];
  if (config.showcaseChannelId === undefined) config.showcaseChannelId = null;

  return config;
}

let activeCronJobs = {};
const spamTracker = new Map();

client.once('ready', async () => {
  serverConfigs = await loadConfigs();
  console.log(`Bot Online แล้วจ้า: ${client.user.tag}`);

  startVoiceXpCron(client, serverConfigs, saveConfigs);
  startPetHatchCron(client, serverConfigs, saveConfigs); // 👈 เปิดใช้งานระบบเช็กและฟักไข่อัตโนมัติทุก 10 วินาที
  loadAllAutoCinemaCrons(client, serverConfigs);

  const commands = [
    new SlashCommandBuilder().setName('ping').setDescription('เช็กความเร็วและสถานะของบอท'),
    new SlashCommandBuilder().setName('set-welcome').setDescription('เปิดแผงควบคุมระบบต้อนรับ (Welcome Dashboard)').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('set-autorole').setDescription('ตั้งค่าระบบแจกยศอัตโนมัติสำหรับสมาชิกใหม่').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('set-security').setDescription('เปิดแผงควบคุมระบบป้องกันความปลอดภัยขั้นสูง').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder().setName('bot-info').setDescription('✨ แสดงข้อมูลและหน้าพรีเซนต์แนะนำตัวของ Zen Bot'),
    new SlashCommandBuilder()
      .setName('set-dev-log')
      .setDescription('🛠️ ตั้งค่าห้องสำหรับรับแจ้งเตือน Live GitHub Dev Stream')
      .addChannelOption(option => option.setName('channel').setDescription('เลือกห้องรับแจ้งเตือนโค้ดอัปเดต').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    levelCommand,
    leaderboardCommand,
    setupQuestCommand,
    setupShopCommand,
    setupOrderTicketCommand,
    coinsCommand,
    addCoinsCommand,
    grantPremiumCommand,
    boostStatusCommand,
    setupArtistCommand,
    setupMediaGuardCommand,
    setupShowcaseCommand,
    setLevelCommand,
    setupCinemaCommand,
    cinemaBroadcastCommand,
    autoCinemaCommand,
    petShopCommand,
    petCommand,
    petBattleCommand,
    petLeaderboardCommand,
    setPetChannelCommand,
    setPetRoleCommand,
    new SlashCommandBuilder().setName('clear').setDescription('ลบข้อความในแชทจำนวน 1-100 ข้อความ')
      .addIntegerOption(option => option.setName('amount').setDescription('จำนวนข้อความที่ต้องการลบ (1-100)').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    new SlashCommandBuilder().setName('set-autoclear').setDescription('💎 [PREMIUM] ตั้งเวลาระบบลบข้อความอัตโนมัติ')
      .addStringOption(option => option.setName('time').setDescription('ระบุเวลาในรูปแบบ HH:MM เช่น 06:00').setRequired(true))
      .addChannelOption(option => option.setName('channel').setDescription('เลือกห้องที่ต้องการให้ลบข้อความอัตโนมัติ').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  ].map(command => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('ลงทะเบียนคำสั่งทั้งหมดสำเร็จเรียบร้อย!');
  } catch (error) {
    console.error(error);
  }

  for (const guildId in serverConfigs) {
    const config = serverConfigs[guildId];
    if (config?.autoClear?.enabled && config.autoClear.time && config.autoClear.channelId) {
      setupCronJob(guildId, config.autoClear.time, config.autoClear.channelId);
    }
  }
});

function setupCronJob(guildId, timeStr, channelId) {
  if (activeCronJobs[guildId]) {
    activeCronJobs[guildId].stop();
    delete activeCronJobs[guildId];
  }

  const [hour, minute] = (timeStr || '').split(':');
  if (!hour || !minute) return;

  const cronExpression = `${minute} ${hour} * * *`;

  activeCronJobs[guildId] = cron.schedule(cronExpression, async () => {
    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return;
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (channel && channel.isTextBased()) {
        const fetched = await channel.messages.fetch({ limit: 100 });
        await channel.bulkDelete(fetched, true);
        console.log(`✅ ลบข้อความอัตโนมัติเวลา ${timeStr} สำเร็จในห้อง #${channel.name}`);
      }
    } catch (err) {
      console.error(`❌ เกิดข้อผิดพลาดในการลบข้อความอัตโนมัติ (Guild: ${guildId}):`, err);
    }
  }, { timezone: "Asia/Bangkok" });
}

client.on('messageCreate', async message => {
  const guildId = message.guild?.id;
  if (!guildId || message.author.bot) return;

  const config = ensureGuildConfig(guildId);

  const hasPremium = await isServerPremium(guildId, serverConfigs);
  if (hasPremium) {
    const isMediaBlocked = handleMediaGuardMessage(message, serverConfigs);
    if (isMediaBlocked) return;
  }

  const isBlocked = await handleSecurityMessage(message, config, spamTracker);
  if (isBlocked) return;

  const isShowcaseHandled = await handleShowcaseMessage(message, serverConfigs);
  if (isShowcaseHandled) return;

  handleLeveling(message, serverConfigs, saveConfigs, client);
});

client.on('guildMemberAdd', async member => {
  if (member.user.bot) return;

  const guildId = member.guild.id;
  const config = ensureGuildConfig(guildId);

  if (config.autoroleEnabled && config.autoroleId) {
    try {
      const role = await member.guild.roles.fetch(config.autoroleId);
      if (role) {
        await member.roles.add(role);
      }
    } catch (err) {
      console.error('Autorole error:', err);
    }
  }

  if (!config.welcomeEnabled || !config.channelId) return;

  try {
    const channel = await member.guild.channels.fetch(config.channelId);
    if (!channel) return;

    const attachment = await generateWelcomeCard(member);
    const defaultDesc = '**𑣲⋆ 𝙉𝙀𝙒 𝙈𝙚𝙢𝙗𝙚𝙧!** ✨\n🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}** ครับ!';
    const finalDesc = (config.embed?.description || defaultDesc)
      .replace('{user}', `${member}`)
      .replace('{server}', member.guild.name);

    await channel.send({ content: finalDesc, files: [attachment] });
  } catch (err) {
    console.error('Send welcome error:', err);
  }
});

client.on('interactionCreate', async interaction => {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const config = ensureGuildConfig(guildId);

  const petBtnHandled = await handleCompanionButton(interaction, serverConfigs, saveConfigs);
  if (petBtnHandled) return;

  const battleHandled = await handleBattleButtons(interaction, serverConfigs, saveConfigs);
  if (battleHandled) return;

  const premiumCommands = [
    'setup-quest', 'setup-in-game-shop', 'coins', 'setup-order-ticket',
    'add-coins', 'setup-media-guard', 'setup-showcase', 'set-autoclear',
    'setup-artist-card', 'boost-status', 'cinema-setup', 'cinema-broadcast',
    'auto-cinema'
  ];

  if (interaction.isChatInputCommand() && premiumCommands.includes(interaction.commandName)) {
    const hasPremium = await isServerPremium(guildId, serverConfigs);
    if (!hasPremium) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('💎 สนใจติดต่อซื้อระบบพรีเมียม')
          .setStyle(ButtonStyle.Link)
          .setURL('https://discord.gg/your-invite-link')
      );

      return await interaction.reply({
        content: '❌ คำสั่งนี้ใช้ได้เฉพาะเซิร์ฟเวอร์พรีเมียมเท่านั้น',
        components: [row],
        ephemeral: true
      });
    }
  }

  if (interaction.isChatInputCommand()) {
    handleCommandLeveling(interaction, serverConfigs, saveConfigs, client);

    const cmd = interaction.commandName;

    if (cmd === 'pet-shop') return await handlePetShopCommand(interaction);
    if (cmd === 'pet') return await handlePetCommand(interaction, serverConfigs, saveConfigs, client);
    if (cmd === 'pet-battle') return await handlePetBattleCommand(interaction, serverConfigs, client);
    if (cmd === 'pet-leaderboard') return await handlePetLeaderboardCommand(interaction, serverConfigs);
    if (cmd === 'set-pet-channel') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
      }
      const channel = interaction.options.getChannel('channel');
      config.petChannelId = channel.id;
      await saveConfigs(serverConfigs);
      return await interaction.reply({ content: `✅ ตั้งค่าห้องแจ้งเตือนสัตว์เลี้ยงเรียบร้อยที่: ${channel}`, ephemeral: true });
    }
    if (cmd === 'set-pet-role') return await handleSetPetRoleCommand(interaction, serverConfigs, saveConfigs);
    if (cmd === 'set-dev-log') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
      }
      const channel = interaction.options.getChannel('channel');
      config.devLogChannelId = channel.id;
      await saveConfigs(serverConfigs);
      return await interaction.reply({ content: `✅ ตั้งค่าห้องรับแจ้งเตือน GitHub Dev Stream เรียบร้อยที่: ${channel}`, ephemeral: true });
    }

    const adminCommands = [
      'setup-quest', 'setup-in-game-shop', 'setup-order-ticket', 'add-coins',
      'grant-premium', 'setup-artist-card', 'setup-media-guard', 'setup-showcase',
      'cinema-setup', 'cinema-broadcast', 'auto-cinema', 'set-level', 'set-security',
      'set-autoclear', 'set-welcome', 'set-autorole', 'set-role-reward', 'set-dev-log',
      'pet-shop', 'set-pet-channel', 'set-pet-role'
    ];

    if (adminCommands.includes(cmd)) {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return await interaction.reply({ content: '❌ เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้นถึงจะใช้คำสั่งนี้ได้!', ephemeral: true });
      }
    }

    if (cmd === 'ping') {
      return await interaction.reply({ content: 'Pong! 🏓 บอททำงานระบบ Slash Command ปกติบน Render ครับ 🚀', ephemeral: true });
    }
    if (cmd === 'bot-info') {
      const embed = new EmbedBuilder()
        .setTitle('🤖 𝙕𝙀𝙉 𝘽𝙊𝙏 • OFFICIAL PRESENTATION')
        .setDescription(
          '**ระบบจัดการและปกป้องเซิร์ฟเวอร์แบบครบวงจร** ✨\n\n' +
          '🚀 **ฟีเจอร์เด่นภายในบอท:**\n' +
          '> 🛡️ **Advanced Security:** ระบบป้องกันลิงก์สแปม และบอทหลอกลวงพร้อมบทลงโทษอัตโนมัติ\n' +
          '> 📊 **Leveling & Voice XP:** ระบบเก็บเลเวลทั้งแชทและห้องเสียง พร้อมการ์ดโปรไฟล์ Canvas สุดพรีเมียม\n' +
          '> 🎬 **Zen Cinema:** ระบบจัดการรอบฉายหนังอัตโนมัติ (Coming Soon & Now Showing) พร้อมระบบขายตั๋วหักเหรียญ\n' +
          '> 🛒 **Automated Store:** ระบบร้านค้าสกิน/ยศ และระบบห้องออร์เดอร์พร้อมใบเสร็จอัตโนมัติ\n' +
          '> 🎨 **Artist Showcase:** ระบบห้องโชว์ผลงานพร้อมรีแอคชันอัตโนมัติ\n' +
          '> 🎁 **Daily Quest:** เควสต์สุ่มแจก Zen Coins ฟรีทุก 19 ชั่วโมง (แบบ 50/50)\n' +
          '> 🐾 **Zen Pet System:** ระบบเลี้ยงสัตว์ ฟักไข่ และลานประลองชิง Orbs สุดมันส์!\n' +
          '> 🛠️ **Dev Stream:** ระบบสตรีมโค้ดและรายงาน Commit สดจาก GitHub เข้าห้องดิสคอร์ด\n\n' +
          '💎 สนใจใช้งานระบบพรีเมียมติดต่อผู้พัฒนาบอทได้เลยครับ!'
        )
        .setColor(COLORS.PRIMARY)
        .setImage(IMAGES.BOT_PRESENTATION)
        .setTimestamp()
        .setFooter({ text: 'Powered by Zen Bot Technology' });

      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }
    if (cmd === 'level') return await handleLevelCommand(interaction, serverConfigs);
    if (cmd === 'leaderboard') return await handleLeaderboardCommand(interaction, serverConfigs);
    if (cmd === 'setup-quest') return await handleSetupQuestCommand(interaction);
    if (cmd === 'setup-in-game-shop') return await handleSetupShopCommand(interaction);
    if (cmd === 'setup-order-ticket') return await handleSetupOrderTicketCommand(interaction);
    if (cmd === 'coins') return await handleCoinsCommand(interaction, serverConfigs);
    if (cmd === 'grant-premium') return await handleGrantPremiumCommand(interaction, serverConfigs, saveConfigs);
    if (cmd === 'add-coins') return await handleAddCoinsCommand(interaction, serverConfigs, saveConfigs);
    if (cmd === 'boost-status') return await handleBoostStatusCommand(interaction, serverConfigs);
    if (cmd === 'setup-artist-card') return await handleSetupArtistCommand(interaction);
    if (cmd === 'setup-media-guard') return await handleSetupMediaGuardCommand(interaction, serverConfigs, saveConfigs);
    if (cmd === 'setup-showcase') return await handleSetupShowcaseCommand(interaction, serverConfigs, saveConfigs);
    if (cmd === 'cinema-setup') return await handleSetupCinemaCommand(interaction);
    if (cmd === 'cinema-broadcast') return await handleSetupCinemaBroadcastCommand(interaction, serverConfigs);
    if (cmd === 'auto-cinema') return await handleAutoCinemaCommand(interaction, serverConfigs);
    if (cmd === 'set-level') return await handleSetLevelCommand(interaction, serverConfigs);
    if (cmd === 'set-security') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
      return await interaction.reply({ ...getSecurityDashboardContent(config), ephemeral: true });
    }
    if (cmd === 'clear') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) return await interaction.reply({ content: '❌ คุณไม่มีสิทธิ์จัดการข้อความ', ephemeral: true });
      const amount = interaction.options.getInteger('amount');
      if (amount < 1 || amount > 100) return await interaction.reply({ content: '⚠️ กรุณาระบุจำนวน 1-100', ephemeral: true });
      await interaction.deferReply({ ephemeral: true });
      try {
        const messages = await interaction.channel.messages.fetch({ limit: amount });
        await interaction.channel.bulkDelete(messages, true);
        await interaction.editReply({ content: `🧹 ลบข้อความจำนวน **${amount}** เรียบร้อย!` });
      } catch (err) {
        await interaction.editReply({ content: '❌ เกิดข้อผิดพลาด ไม่สามารถลบข้อความเก่าเกิน 14 วันได้!' });
      }
      return;
    }
    if (cmd === 'set-autoclear') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return await interaction.reply({ content: '❌ ต้องเป็น Administrator', ephemeral: true });
      const timeInput = interaction.options.getString('time');
      const channelInput = interaction.options.getChannel('channel');
      if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeInput)) return await interaction.reply({ content: '❌ รูปแบบเวลาไม่ถูกต้อง (HH:MM)', ephemeral: true });
      config.autoClear = { enabled: true, time: timeInput, channelId: channelInput.id };
      await saveConfigs(serverConfigs);
      setupCronJob(guildId, timeInput, channelInput.id);
      return await interaction.reply({ content: `✅ ตั้งค่า Auto-Clear สำเร็จ (${timeInput})`, ephemeral: true });
    }
    if (cmd === 'set-welcome') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return await interaction.reply({ content: '❌ เฉพาะ Administrator', ephemeral: true });
      return await sendDashboard(interaction);
    }
    if (cmd === 'set-autorole') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return await interaction.reply({ content: '❌ เฉพาะ Administrator', ephemeral: true });
      return await sendAutoroleDashboard(interaction);
    }
  }

  if (interaction.isButton()) {
    const id = interaction.customId;

    const adminActionIds = [
      'toggle_welcome', 'toggle_autorole', 'toggle_level', 'toggle_voice_xp',
      'edit_voice_amount', 'edit_level_rate', 'edit_level_card', 'edit_level_messages',
      'set_role_reward', 'delete_role_reward', 'edit_welcome_msg', 'test_welcome',
      'sec_toggle_main', 'sec_toggle_link', 'sec_toggle_spam', 'sec_toggle_mrbeast',
      'sec_config_time', 'sec_reset'
    ];

    if (adminActionIds.includes(id) || id.startsWith('sec_')) {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return await interaction.reply({ content: '❌ เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้นถึงจะกดใช้งานปุ่มตั้งค่านี้ได้!', ephemeral: true });
      }
    }

    if (await handleCinemaButton(interaction, serverConfigs, saveConfigs)) return;
    if (await handleAutoCinemaButton(interaction, serverConfigs, saveConfigs, client)) return;
    if (await handleOrderPaymentButton(interaction)) return;
    if (await handleCloseTicketButton(interaction)) return;
    if (await handleQuestButton(interaction, serverConfigs, saveConfigs)) return;
    if (await handleShopButton(interaction, serverConfigs, saveConfigs)) return;
    if (await handleArtistButton(interaction, serverConfigs)) return;

    const modalButtons = [
      'edit_voice_amount', 'edit_level_rate', 'edit_level_card',
      'edit_level_messages', 'set_role_reward', 'delete_role_reward',
      'sec_config_time', 'edit_welcome_msg', 'test_welcome'
    ];

    if (!modalButtons.includes(id)) {
      await interaction.deferUpdate().catch(() => {});
    }

    if (id === 'toggle_welcome') {
      config.welcomeEnabled = !config.welcomeEnabled;
      await saveConfigs(serverConfigs);
      return await interaction.editReply(getDashboardContent(config));
    }
    if (id === 'toggle_autorole') {
      config.autoroleEnabled = !config.autoroleEnabled;
      await saveConfigs(serverConfigs);
      return await interaction.editReply(getAutoroleDashboardContent(config));
    }
    if (id === 'toggle_level') {
      config.levelConfig.enabled = !config.levelConfig.enabled;
      await saveConfigs(serverConfigs);
      return await interaction.editReply(getLevelDashboardContent(config));
    }
    if (id === 'toggle_voice_xp') {
      config.levelConfig.voiceXpEnabled = !config.levelConfig.voiceXpEnabled;
      await saveConfigs(serverConfigs);
      return await interaction.editReply(getLevelDashboardContent(config));
    }
    if (id === 'edit_voice_amount') {
      const modal = new ModalBuilder().setCustomId('voiceAmountModal').setTitle('ตั้งค่า XP ห้องเสียง');
      const amountInput = new TextInputBuilder().setCustomId('voiceXp').setLabel('XP ต่อ 1 นาที').setStyle(TextInputStyle.Short).setValue(config.levelConfig.voiceXpAmount?.toString() || '10').setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
      return await interaction.showModal(modal);
    }
    if (id === 'edit_level_rate') {
      const modal = new ModalBuilder().setCustomId('levelRateModal').setTitle('ตั้งค่าเรต XP');
      const minInput = new TextInputBuilder().setCustomId('minXp').setLabel('XP ต่ำสุด').setStyle(TextInputStyle.Short).setValue(config.levelConfig.minXp.toString()).setRequired(true);
      const maxInput = new TextInputBuilder().setCustomId('maxXp').setLabel('XP สูงสุด').setStyle(TextInputStyle.Short).setValue(config.levelConfig.maxXp.toString()).setRequired(true);
      const cmdInput = new TextInputBuilder().setCustomId('cmdXp').setLabel('XP จากคำสั่ง /').setStyle(TextInputStyle.Short).setValue(config.levelConfig.cmdXp?.toString() || '20').setRequired(true);
      const multInput = new TextInputBuilder().setCustomId('multiplier').setLabel('ตัวคูณเลเวลอัป').setStyle(TextInputStyle.Short).setValue(config.levelConfig.xpMultiplier.toString()).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(minInput), new ActionRowBuilder().addComponents(maxInput), new ActionRowBuilder().addComponents(cmdInput), new ActionRowBuilder().addComponents(multInput));
      return await interaction.showModal(modal);
    }
    if (id === 'edit_level_card') {
      const modal = new ModalBuilder().setCustomId('levelCardModal').setTitle('ตกแต่งการ์ด Level');
      const titleInput = new TextInputBuilder().setCustomId('cardTitle').setLabel('Title').setStyle(TextInputStyle.Short).setValue(config.levelConfig.cardTitle || '').setRequired(true);
      const descInput = new TextInputBuilder().setCustomId('cardDesc').setLabel('Description').setStyle(TextInputStyle.Paragraph).setValue(config.levelConfig.cardDescription || '').setRequired(true);
      const colorInput = new TextInputBuilder().setCustomId('embedColor').setLabel('Hex Color').setStyle(TextInputStyle.Short).setValue(config.levelConfig.embedColor || COLORS.PRIMARY).setRequired(true);
      const imageInput = new TextInputBuilder().setCustomId('statsCardImg').setLabel('Image URL').setStyle(TextInputStyle.Short).setValue(config.levelConfig.statsCardImageUrl || '').setRequired(false);
      modal.addComponents(new ActionRowBuilder().addComponents(titleInput), new ActionRowBuilder().addComponents(descInput), new ActionRowBuilder().addComponents(colorInput), new ActionRowBuilder().addComponents(imageInput));
      return await interaction.showModal(modal);
    }
    if (id === 'edit_level_messages') {
      const modal = new ModalBuilder().setCustomId('levelMessagesModal').setTitle('ตั้งค่าข้อความเลเวลอัปและแจกยศ');
      const msgInput = new TextInputBuilder().setCustomId('levelMsg').setLabel('ข้อความเลเวลอัป ({user}, {level})').setStyle(TextInputStyle.Paragraph).setValue(config.levelConfig.levelUpMessage || '').setRequired(true);
      const rewardMsgInput = new TextInputBuilder().setCustomId('roleRewardMsg').setLabel('ข้อความแจกยศ ({user}, {role}, {level})').setStyle(TextInputStyle.Paragraph).setValue(config.levelConfig.roleRewardMessage || '').setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(msgInput), new ActionRowBuilder().addComponents(rewardMsgInput));
      return await interaction.showModal(modal);
    }
    if (id === 'set_role_reward') {
      const modal = new ModalBuilder().setCustomId('roleRewardModal').setTitle('ตั้งค่ายศรางวัลตามเลเวล');
      const levelInput = new TextInputBuilder().setCustomId('targetLevel').setLabel('ระบุเลเวล (เช่น 5)').setStyle(TextInputStyle.Short).setRequired(true);
      const imageInput = new TextInputBuilder().setCustomId('rewardImage').setLabel('Image URL (คั่นด้วยคอมมา , เพื่อสุ่มหลายรูป)').setStyle(TextInputStyle.Short).setRequired(false);
      modal.addComponents(new ActionRowBuilder().addComponents(levelInput), new ActionRowBuilder().addComponents(imageInput));
      return await interaction.showModal(modal);
    }
    if (id === 'delete_role_reward') {
      const modal = new ModalBuilder().setCustomId('deleteRoleRewardModal').setTitle('ลบยศรางวัลตามเลเวล');
      const levelInput = new TextInputBuilder().setCustomId('targetLevel').setLabel('ระบุเลเวลที่ต้องการลบยศรางวัล (เช่น 5)').setStyle(TextInputStyle.Short).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(levelInput));
      return await interaction.showModal(modal);
    }
    if (id === 'edit_welcome_msg') {
      const modal = new ModalBuilder().setCustomId('editWelcomeMsgModal').setTitle('แก้ไขข้อความต้อนรับ');
      const descInput = new TextInputBuilder()
        .setCustomId('welcomeDesc')
        .setLabel('ข้อความต้อนรับ (ใช้ {user} และ {server} ได้)')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(config.embed?.description || '**𑣲⋆ 𝙉𝙀𝙒 𝙈𝙚𝙢𝙗𝙚𝙧!** ✨\n🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}** ครับ!')
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(descInput));
      return await interaction.showModal(modal);
    }
    if (id === 'test_welcome') {
      if (!config.channelId) {
        return await interaction.reply({ content: '❌ กรุณาเลือกช่องสำหรับส่งข้อความต้อนรับก่อนกดทดสอบครับ!', ephemeral: true });
      }
      await interaction.reply({ content: `🔄 กำลังส่งการ์ดต้อนรับทดสอบ...`, ephemeral: true });
      try {
        const channel = await interaction.guild.channels.fetch(config.channelId);
        if (channel) {
          const attachment = await generateWelcomeCard(interaction.member);
          const defaultDesc = '**𑣲⋆ 𝙉𝙀𝙒 𝙈𝙚𝙢𝙗𝙚𝙧!** ✨\n🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}** ครับ!';
          const finalDesc = (config.embed?.description || defaultDesc)
            .replace('{user}', `${interaction.user}`)
            .replace('{server}', interaction.guild.name);
          await channel.send({ content: finalDesc, files: [attachment] });
        }
      } catch (err) {
        console.error('Test welcome error:', err);
      }
      return;
    }

    if (id === 'sec_toggle_main') config.security.enabled = !config.security.enabled;
    else if (id === 'sec_toggle_link') config.security.antiLink = !config.security.antiLink;
    else if (id === 'sec_toggle_spam') config.security.antiSpam = !config.security.antiSpam;
    else if (id === 'sec_toggle_mrbeast') config.security.antiMrBeast = !config.security.antiMrBeast;
    else if (id === 'sec_config_time') {
      const modal = new ModalBuilder().setCustomId('secTimeModal').setTitle('ตั้งค่าเวลาสแปม');
      const countInput = new TextInputBuilder().setCustomId('spamCount').setLabel('จำนวนข้อความ').setStyle(TextInputStyle.Short).setValue(config.security.spamCount.toString()).setRequired(true);
      const secInput = new TextInputBuilder().setCustomId('spamSec').setLabel('ภายในกี่วินาที').setStyle(TextInputStyle.Short).setValue(config.security.spamSeconds.toString()).setRequired(true);
      const timeoutInput = new TextInputBuilder().setCustomId('timeoutSec').setLabel('ระงับกี่วินาที (เช่น 60)').setStyle(TextInputStyle.Short).setValue(config.security.timeoutSeconds.toString()).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(countInput), new ActionRowBuilder().addComponents(secInput), new ActionRowBuilder().addComponents(timeoutInput));
      return await interaction.showModal(modal);
    } else if (id === 'sec_reset') {
      config.security = {
        enabled: false, antiLink: true, antiSpam: true, antiMrBeast: true, spamCount: 3, spamSeconds: 6, timeoutSeconds: 60,
        actions: { invite: { timeout: true, kick: false, ban: false }, spam: { timeout: true, kick: false, ban: false }, mrbeast: { timeout: true, kick: false, ban: false } },
        ignoredChannels: []
      };
    }

    await saveConfigs(serverConfigs);
    if (id.startsWith('sec_')) return await interaction.editReply(getSecurityDashboardContent(config));
  }

  if (interaction.isStringSelectMenu()) {
    if (await handleOrderTicketSelect(interaction, serverConfigs)) return;

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({ content: '❌ เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้น', ephemeral: true });
    }

    await interaction.deferUpdate().catch(() => {});
    if (interaction.customId === 'act_invite_select') {
      const vals = interaction.values;
      config.security.actions.invite.timeout = vals.includes('timeout');
      config.security.actions.invite.kick = vals.includes('kick');
      config.security.actions.invite.ban = vals.includes('ban');
      await saveConfigs(serverConfigs);
      return await interaction.editReply(getSecurityDashboardContent(config));
    }
    if (interaction.customId === 'act_spam_select') {
      const vals = interaction.values;
      config.security.actions.spam.timeout = vals.includes('timeout');
      config.security.actions.spam.kick = vals.includes('kick');
      config.security.actions.spam.ban = vals.includes('ban');
      await saveConfigs(serverConfigs);
      return await interaction.editReply(getSecurityDashboardContent(config));
    }
  }

  if (interaction.isChannelSelectMenu()) {
    if (await handleCinemaSelect(interaction, serverConfigs, saveConfigs)) return;
    if (await handleAutoCinemaSelect(interaction, serverConfigs, saveConfigs, client)) return;

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({ content: '❌ เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้น', ephemeral: true });
    }

    await interaction.deferUpdate().catch(() => {});
    if (interaction.customId === 'select_channel') {
      config.channelId = interaction.values[0];
      await saveConfigs(serverConfigs);
      return await interaction.editReply(getDashboardContent(config));
    }
    if (interaction.customId === 'select_level_channel') {
      config.levelConfig.channelId = interaction.values[0];
      await saveConfigs(serverConfigs);
      return await interaction.editReply(getLevelDashboardContent(config));
    }
    if (interaction.customId === 'sec_select_ignored') {
      config.security.ignoredChannels = interaction.values;
      await saveConfigs(serverConfigs);
      return await interaction.editReply(getSecurityDashboardContent(config));
    }
  }

  if (interaction.isRoleSelectMenu()) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({ content: '❌ เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้น', ephemeral: true });
    }

    await interaction.deferUpdate().catch(() => {});
    if (interaction.customId === 'select_autorole') {
      config.autoroleId = interaction.values[0];
      config.autoroleEnabled = true;
      await saveConfigs(serverConfigs);
      return await interaction.editReply(getAutoroleDashboardContent(config));
    }
    if (interaction.customId.startsWith('select_reward_role_')) {
      const levelNum = interaction.customId.replace('select_reward_role_', '');
      const selectedRoleId = interaction.values[0];
      const imageUrl = pendingRoleRewardImages.get(`${interaction.user.id}_${levelNum}`) || '';

      if (!config.levelConfig.roleRewards) config.levelConfig.roleRewards = {};

      for (const [lvl, data] of Object.entries(config.levelConfig.roleRewards)) {
        const rId = typeof data === 'object' ? data.roleId : data;
        if (rId === selectedRoleId) {
          delete config.levelConfig.roleRewards[lvl];
        }
      }

      config.levelConfig.roleRewards[levelNum] = { roleId: selectedRoleId, imageUrl: imageUrl };
      await saveConfigs(serverConfigs);
      pendingRoleRewardImages.delete(`${interaction.user.id}_${levelNum}`);

      return await interaction.editReply({
        content: `✅ ตั้งค่ายศรางวัลสำเร็จ! ยศ <@&${selectedRoleId}> ถูกย้ายมาอยู่ที่ Level ${levelNum} เรียบร้อยแล้ว`,
        ...getLevelDashboardContent(config)
      });
    }
  }

  if (interaction.isModalSubmit()) {
    if (await handleCinemaModal(interaction, serverConfigs, saveConfigs)) return;
    if (await handleAutoCinemaModal(interaction, serverConfigs, saveConfigs, client)) return;
    if (await handleArtistModalSubmit(interaction, serverConfigs, saveConfigs)) return;

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({ content: '❌ เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้น', ephemeral: true });
    }

    if (interaction.customId === 'editWelcomeMsgModal') {
      if (!config.embed) config.embed = {};
      config.embed.description = interaction.fields.getTextInputValue('welcomeDesc');
      await saveConfigs(serverConfigs);
      return await interaction.reply({ content: '✅ บันทึกข้อความต้อนรับเรียบร้อยแล้ว!', ephemeral: true });
    }
    if (interaction.customId === 'secTimeModal') {
      config.security.spamCount = Math.max(1, parseInt(interaction.fields.getTextInputValue('spamCount')) || 3);
      config.security.spamSeconds = Math.max(1, parseInt(interaction.fields.getTextInputValue('spamSec')) || 6);
      config.security.timeoutSeconds = Math.max(1, parseInt(interaction.fields.getTextInputValue('timeoutSec')) || 60);
      await saveConfigs(serverConfigs);
      return await interaction.reply({ content: '✅ บันทึกค่าเวลาความปลอดภัยเรียบร้อยแล้ว!', ephemeral: true });
    }
    if (interaction.customId === 'voiceAmountModal') {
      config.levelConfig.voiceXpAmount = Math.max(1, parseInt(interaction.fields.getTextInputValue('voiceXp')) || 10);
      await saveConfigs(serverConfigs);
      return await interaction.reply({ content: '✅ บันทึกจำนวน XP ห้องเสียงเรียบร้อยแล้ว!', ephemeral: true });
    }
    if (interaction.customId === 'levelRateModal') {
      let minVal = Math.max(1, parseInt(interaction.fields.getTextInputValue('minXp')) || 15);
      let maxVal = Math.max(1, parseInt(interaction.fields.getTextInputValue('maxXp')) || 25);
      if (minVal > maxVal) [minVal, maxVal] = [maxVal, minVal];

      const cmdVal = Math.max(0, parseInt(interaction.fields.getTextInputValue('cmdXp')) || 20);
      const multVal = Math.max(10, parseInt(interaction.fields.getTextInputValue('multiplier')) || 100);

      config.levelConfig.minXp = minVal;
      config.levelConfig.maxXp = maxVal;
      config.levelConfig.cmdXp = cmdVal;
      config.levelConfig.xpMultiplier = multVal;
      await saveConfigs(serverConfigs);
      return await interaction.reply({ content: '✅ บันทึกเรต XP เรียบร้อยแล้ว!', ephemeral: true });
    }
    if (interaction.customId === 'levelCardModal') {
      config.levelConfig.cardTitle = interaction.fields.getTextInputValue('cardTitle');
      config.levelConfig.cardDescription = interaction.fields.getTextInputValue('cardDesc');
      let colorVal = interaction.fields.getTextInputValue('embedColor').trim();
      if (!colorVal.startsWith('#')) colorVal = '#' + colorVal;
      config.levelConfig.embedColor = colorVal;
      config.levelConfig.statsCardImageUrl = interaction.fields.getTextInputValue('statsCardImg');
      await saveConfigs(serverConfigs);
      return await interaction.reply({ content: '✅ บันทึกการ์ด Level เรียบร้อยแล้ว!', ephemeral: true });
    }
    if (interaction.customId === 'levelMessagesModal') {
      config.levelConfig.levelUpMessage = interaction.fields.getTextInputValue('levelMsg');
      config.levelConfig.roleRewardMessage = interaction.fields.getTextInputValue('roleRewardMsg');
      await saveConfigs(serverConfigs);
      return await interaction.reply({ content: '✅ บันทึกข้อความเรียบร้อยแล้ว!', ephemeral: true });
    }
    if (interaction.customId === 'roleRewardModal') {
      const targetLevel = interaction.fields.getTextInputValue('targetLevel').trim();
      const rewardImage = interaction.fields.getTextInputValue('rewardImage') || '';
      if (isNaN(targetLevel) || parseInt(targetLevel) < 1) {
        return await interaction.reply({ content: '❌ กรุณากรอกเป็นตัวเลขเลเวลที่ถูกต้อง (ตั้งแต่ 1 ขึ้นไป)!', ephemeral: true });
      }
      pendingRoleRewardImages.set(`${interaction.user.id}_${targetLevel}`, rewardImage);
      const roleSelectMenu = new RoleSelectMenuBuilder().setCustomId(`select_reward_role_${targetLevel}`).setPlaceholder(`👑 เลือกยศ Level ${targetLevel}`);
      const row = new ActionRowBuilder().addComponents(roleSelectMenu);
      return await interaction.reply({ content: `📌 กรุณาเลือกยศสำหรับ Level ${targetLevel}:`, components: [row], ephemeral: true });
    }
    if (interaction.customId === 'deleteRoleRewardModal') {
      const targetLevel = interaction.fields.getTextInputValue('targetLevel').trim();
      if (!config.levelConfig.roleRewards || !config.levelConfig.roleRewards[targetLevel]) {
        return await interaction.reply({ content: `❌ ไม่พบข้อมูลยศรางวัลสำหรับ Level ${targetLevel} ครับ!`, ephemeral: true });
      }
      delete config.levelConfig.roleRewards[targetLevel];
      await saveConfigs(serverConfigs);
      return await interaction.reply({ content: `✅ ลบยศรางวัลของ **Level ${targetLevel}** เรียบร้อยแล้ว!`, ephemeral: true });
    }
  }
});

function getDashboardContent(config) {
  const channelName = config.channelId ? `<#${config.channelId}>` : 'ยังไม่ได้เลือกช่อง';
  const statusText = config.welcomeEnabled ? '✅ เปิดอยู่' : '❌ ปิดอยู่';
  const msgPreview = config.embed?.description || '**𑣲⋆ 𝙉𝙀𝙒 𝙈𝙚𝙢𝙗𝙚𝙧!** ✨\n🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}** ครับ!';

  const embed = new EmbedBuilder()
    .setTitle('⚙️ ตั้งค่าระบบต้อนรับ (Welcome Canvas)')
    .setDescription('ระบบจะส่งข้อความต้อนรับพร้อมรูปการ์ด Canvas อัตโนมัติเมื่อมีสมาชิกใหม่เข้าเซิร์ฟเวอร์')
    .setColor(COLORS.DISCORD_BLURPLE)
    .addFields(
      { name: '📥 สถานะ', value: statusText, inline: true },
      { name: '📢 ห้องต้อนรับ', value: channelName, inline: true },
      { name: '💬 ข้อความต้อนรับ', value: msgPreview, inline: false }
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('toggle_welcome').setLabel(config.welcomeEnabled ? 'ปิดระบบ' : 'เปิดระบบ').setStyle(config.welcomeEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('edit_welcome_msg').setLabel('✏️ แก้ไขข้อความต้อนรับ').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('test_welcome').setLabel('🚀 ทดสอบส่งการ์ด').setStyle(ButtonStyle.Secondary)
  );
  const channelRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder().setCustomId('select_channel').setPlaceholder('📂 เลือกห้องต้อนรับ').addChannelTypes(ChannelType.GuildText)
  );
  return { embeds: [embed], components: [row1, channelRow] }
}

function getAutoroleDashboardContent(config) {
  const roleName = config.autoroleId ? `<@&${config.autoroleId}>` : 'ยังไม่ได้เลือกยศ';
  const statusText = config.autoroleEnabled ? '✅ เปิดอยู่' : '❌ ปิดอยู่';
  const embed = new EmbedBuilder()
    .setTitle('🛡️ ตั้งค่าระบบ Autorole')
    .setDescription('เมื่อเลือกยศด้านล่าง ระบบจะเปิดใช้งานการแจกยศอัตโนมัติให้ทันที (หรือกดปุ่มเพื่อปิดชั่วคราว)')
    .setColor(COLORS.DISCORD_BLURPLE)
    .addFields(
      { name: '📥 สถานะ', value: statusText, inline: true },
      { name: '👑 ยศที่จะได้รับ', value: roleName, inline: true }
    );
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('toggle_autorole').setLabel(config.autoroleEnabled ? '🔴 ปิดระบบชั่วคราว' : '🟢 เปิดระบบ').setStyle(config.autoroleEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
  );
  const roleRow = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder().setCustomId('select_autorole').setPlaceholder('👑 เลือกยศแจกสมาชิกใหม่ (เลือกแล้วเปิดระบบทันที)')
  );
  return { embeds: [embed], components: [row1, roleRow] };
}

async function sendDashboard(target) {
  const channel = target.channel || target;
  const config = ensureGuildConfig(target.guildId);
  const payload = getDashboardContent(config);
  if (target.reply) {
    await target.reply({ ...payload, ephemeral: true });
  } else {
    await channel.send(payload);
  }
}

async function sendAutoroleDashboard(target) {
  const channel = target.channel || target;
  const config = ensureGuildConfig(target.guildId);
  const payload = getAutoroleDashboardContent(config);
  if (target.reply) {
    await target.reply({ ...payload, ephemeral: true });
  } else {
    await channel.send(payload);
  }
}

client.login(process.env.DISCORD_TOKEN);


เป็นเพราะไร ทำไมบอทไม่ตอบสนอง
