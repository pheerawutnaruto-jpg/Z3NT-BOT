const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder } = require('discord.js');
const cron = require('node-cron');

const autoCinemaCommand = new SlashCommandBuilder()
  .setName('auto-cinema')
  .setDescription('⏰ [CINEMA] แผงควบคุมตั้งเวลารอบฉายอัตโนมัติ (สำหรับ Admin)');

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
      channelId: null,
      roleId: '1551183125076508713',
      title: 'ภาพยนตร์รอบพิเศษประจำวัน',
      imageUrl: 'https://cdn.discordapp.com/attachments/1559878908348997774/1560429202589876295/1792105154505.jpg'
    };
  }

  return await interaction.reply({ ...getAutoCinemaDashboard(serverConfigs[guildId].autoCinema), ephemeral: true });
}

function getAutoCinemaDashboard(config) {
  const channelText = config.channelId ? `<#${config.channelId}>` : 'ยังไม่ได้เลือกห้อง';
  const roleText = `<@&${config.roleId || '1551183125076508713'}>`;
  const statusText = config.enabled ? '✅ เปิดใช้งานอยู่' : '❌ ปิดใช้งานอยู่';

  const embed = new EmbedBuilder()
    .setTitle('⏰ 𝙕𝙀𝙉 𝘾𝙄𝙉𝙀𝙈𝘼S • AUTO SCHEDULE CONTROL PANEL')
    .setDescription('แผงควบคุมตั้งเวลารอบฉายภาพยนตร์อัตโนมัติประจำวัน สามารถตั้งเวลา ชื่อเรื่อง รูปภาพ และทดลองส่งได้ที่นี่ครับ')
    .setColor('#E50914')
    .addFields(
      { name: '📥 สถานะระบบ', value: statusText, inline: true },
      { name: '⏰ เวลาส่ง (HH:MM)', value: `\`${config.timeStr || '20:00'}\``, inline: true },
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
      .setCustomId('autocinema_test_send')
      .setLabel('🚀 ทดลองส่งข้อความทันที')
      .setStyle(ButtonStyle.Secondary)
  );

  const channelRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('autocinema_select_channel')
      .setPlaceholder('📂 เลือกห้องสำหรับส่งประกาศอัตโนมัติ')
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

  const [hour, minute] = timeStr.split(':');
  if (!hour || !minute) return;

  const cronExpression = `${minute} ${hour} * * *`;

  activeAutoCinemaCrons[guildId] = cron.schedule(cronExpression, async () => {
    try {
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return;
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) return;

      const config = serverConfigs[guildId]?.autoCinema;
      if (!config || !config.enabled) return;

      const defaultImage = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560429202589876295/1792105154505.jpg';
      const imageUrl = (config.imageUrl && config.imageUrl.trim() !== '') ? config.imageUrl.trim() : defaultImage;

      const embed = new EmbedBuilder()
        .setTitle('🍿 𝙕𝙀𝙉 𝘾𝙄𝙉𝙀𝙈𝘼S • DAILY SHOWTIME')
        .setDescription(
          `🎬 **ภาพยนตร์ประจำวัน:** ${config.title}\n` +
          `⏰ **เวลาฉาย:** ${config.timeStr} น.`
        )
        .setColor('#E50914')
        .setImage(imageUrl);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('cinema_perm_ticket')
          .setLabel('🎟️ จองตั๋วเข้าชม')
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({ 
        content: `<@&${config.roleId || '1551183125076508713'}> 📢 ถึงเวลารอบฉายประจำวันแล้วครับ! เชิญเข้าโรงภาพยนตร์ได้เลย!`, 
        embeds: [embed], 
        components: [row] 
      });
      console.log(`✅ ส่ง Auto-Cinema สำเร็จสำหรับ Guild ${guildId} เวลา ${timeStr}`);
    } catch (err) {
      console.error(`❌ Error auto cinema cron for guild ${guildId}:`, err);
    }
  }, { timezone: "Asia/Bangkok" });
}

function loadAllAutoCinemaCrons(client, serverConfigs) {
  for (const guildId in serverConfigs) {
    const config = serverConfigs[guildId];
    if (config && config.autoCinema && config.autoCinema.enabled && config.autoCinema.timeStr && config.autoCinema.channelId) {
      setupAutoCinemaCron(guildId, config.autoCinema.timeStr, config.autoCinema.channelId, client, serverConfigs);
    }
  }
}

async function handleAutoCinemaButton(interaction, serverConfigs, saveConfigs, client) {
  const id = interaction.customId;
  const guildId = interaction.guildId;
  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].autoCinema) {
    serverConfigs[guildId].autoCinema = {
      enabled: false, timeStr: '20:00', channelId: null, roleId: '1551183125076508713',
      title: 'ภาพยนตร์รอบพิเศษประจำวัน', imageUrl: 'https://cdn.discordapp.com/attachments/1559878908348997774/1560429202589876295/1792105154505.jpg'
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

    return await interaction.update(getAutoCinemaDashboard(config));
  }

  if (id === 'autocinema_edit_info') {
    const modal = new ModalBuilder().setCustomId('autoCinemaInfoModal').setTitle('ตั้งค่ารอบฉายอัตโนมัติ');
    const timeInput = new TextInputBuilder().setCustomId('timeInput').setLabel('เวลาส่ง (รูปแบบ HH:MM เช่น 20:00)').setStyle(TextInputStyle.Short).setValue(config.timeStr || '').setRequired(true);
    const titleInput = new TextInputBuilder().setCustomId('titleInput').setLabel('ชื่อภาพยนตร์').setStyle(TextInputStyle.Short).setValue(config.title || '').setRequired(true);
    const imageInput = new TextInputBuilder().setCustomId('imageInput').setLabel('ลิงก์รูปภาพโปสเตอร์ (Image URL)').setStyle(TextInputStyle.Short).setValue(config.imageUrl || '').setRequired(false);

    modal.addComponents(new ActionRowBuilder().addComponents(timeInput), new ActionRowBuilder().addComponents(titleInput), new ActionRowBuilder().addComponents(imageInput));
    return await interaction.showModal(modal);
  }

  if (id === 'autocinema_test_send') {
    if (!config.channelId) {
      return await interaction.reply({ content: '❌ กรุณาเลือกห้องส่งประกาศจากเมนูด้านล่างแผงควบคุมก่อนทดลองส่งครับ!', ephemeral: true });
    }

    try {
      const channel = await interaction.guild.channels.fetch(config.channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) {
        return await interaction.reply({ content: '❌ ไม่พบห้องที่เลือก กรุณาเลือกห้องใหม่อีกครั้งครับ', ephemeral: true });
      }

      const defaultImage = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560429202589876295/1792105154505.jpg';
      const imageUrl = (config.imageUrl && config.imageUrl.trim() !== '') ? config.imageUrl.trim() : defaultImage;

      const embed = new EmbedBuilder()
        .setTitle('🍿 𝙕𝙀𝙉 𝘾𝙄𝙉𝙀𝙈𝘼S • DAILY SHOWTIME (TEST)')
        .setDescription(
          `🎬 **ภาพยนตร์ประจำวัน:** ${config.title}\n` +
          `⏰ **เวลาฉาย:** ${config.timeStr} น.`
        )
        .setColor('#E50914')
        .setImage(imageUrl);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('cinema_perm_ticket')
          .setLabel('🎟️ จองตั๋วเข้าชม')
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({ 
        content: `<@&${config.roleId || '1551183125076508713'}> 📢 (ทดสอบระบบ) ประกาศรอบฉายภาพยนตร์มาแล้วครับ!`, 
        embeds: [embed], 
        components: [row] 
      });

      return await interaction.reply({ content: `✅ ส่งข้อความทดสอบไปยังห้อง <#${config.channelId}> เรียบร้อยแล้ว!`, ephemeral: true });
    } catch (err) {
      console.error('Error testing auto cinema:', err);
      return await interaction.reply({ content: '❌ เกิดข้อผิดพลาดในการส่งข้อความทดสอบ กรุณาตรวจสอบสิทธิ์ของบอทครับ', ephemeral: true });
    }
  }

  return false;
}

async function handleAutoCinemaSelect(interaction, serverConfigs, saveConfigs, client) {
  const guildId = interaction.guildId;
  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};

  if (interaction.customId === 'autocinema_select_channel') {
    const channelId = interaction.values[0];
    if (!serverConfigs[guildId].autoCinema) {
      serverConfigs[guildId].autoCinema = {
        enabled: false, timeStr: '20:00', roleId: '1551183125076508713',
        title: 'ภาพยนตร์รอบพิเศษประจำวัน', imageUrl: 'https://cdn.discordapp.com/attachments/1559878908348997774/1560429202589876295/1792105154505.jpg'
      };
    }
    serverConfigs[guildId].autoCinema.channelId = channelId;
    await saveConfigs(serverConfigs);

    if (serverConfigs[guildId].autoCinema.enabled && serverConfigs[guildId].autoCinema.timeStr) {
      setupAutoCinemaCron(guildId, serverConfigs[guildId].autoCinema.timeStr, channelId, client, serverConfigs);
    }

    await interaction.update(getAutoCinemaDashboard(serverConfigs[guildId].autoCinema));
    return true;
  }

  return false;
}

async function handleAutoCinemaModal(interaction, serverConfigs, saveConfigs, client) {
  const guildId = interaction.guildId;
  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};

  if (interaction.customId === 'autoCinemaInfoModal') {
    if (!serverConfigs[guildId].autoCinema) serverConfigs[guildId].autoCinema = {};
    const config = serverConfigs[guildId].autoCinema;
    
    const timeVal = interaction.fields.getTextInputValue('timeInput').trim();
    if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeVal)) {
      config.timeStr = timeVal;
    }
    config.title = interaction.fields.getTextInputValue('titleInput').trim();
    const imgVal = interaction.fields.getTextInputValue('imageInput').trim();
    if (imgVal) config.imageUrl = imgVal;

    await saveConfigs(serverConfigs);

    if (config.enabled && config.channelId && config.timeStr) {
      setupAutoCinemaCron(guildId, config.timeStr, config.channelId, client, serverConfigs);
    }

    return await interaction.reply({ content: '✅ บันทึกการตั้งค่า Auto-Cinema เรียบร้อยแล้ว!', ephemeral: true });
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
