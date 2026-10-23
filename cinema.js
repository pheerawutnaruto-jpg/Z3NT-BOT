// cinema.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder } = require('discord.js');
const { ROLES, IMAGES, COLORS } = require('./constants');
const { isServerPremium } = require('./license');

const setupCinemaCommand = new SlashCommandBuilder()
  .setName('cinema-setup')
  .setDescription('🎬 [CINEMA] ส่งแผงป้าย Box Office จุดจำหน่ายตั๋ว (สำหรับ Admin)')
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
  .setDescription('🎥 [CINEMA] แผงควบคุมและส่งประกาศ COMING SOON (สำหรับ Admin)');

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
