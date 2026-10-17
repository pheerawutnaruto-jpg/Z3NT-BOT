const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder } = require('discord.js');
const cron = require('node-cron');

// 1. /cinema-setup (Box Office ถาวร รองรับระบบเหรียญ)
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
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
  }

  const channel = interaction.options.getChannel('channel');
  const customImage = interaction.options.getString('image');
  const defaultImage = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560429202589876295/1792105154505.jpg';
  const imageUrl = (customImage && customImage.trim() !== '') ? customImage.trim() : defaultImage;
  const permRoleId = '1560731553766707241';
  const tempRoleId = '1551006184272560148';

  const embed = new EmbedBuilder()
    .setTitle('🎟️ 𝙕𝙀𝙉 𝘾𝙄𝙉𝙀𝙈𝘼 • 𝘽𝙊𝚇 𝙊𝙁𝙁𝙄𝘾𝙀')
    .setDescription(
      '✨ **บริการจำหน่ายตั๋วรับชมภาพยนตร์** ✨\n\n' +
      `> <@&${permRoleId}> (15c / 20 day)\n` +
      `> <@&${tempRoleId}> (1c / 1 day)\n\n` +
      '📌 *กรุณาตรวจสอบเหรียญในกระเป๋าของคุณก่อนกดซื้อตั๋ว*'
    )
    .setColor('#FF0000')
    .setImage(imageUrl);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('cinema_perm_ticket')
      .setLabel('🎫 ซื้อตั๋ว')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('cinema_temp_ticket')
      .setLabel('🎟️ ซื้อตั๋ว')
      .setStyle(ButtonStyle.Success)
  );

  await channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: `✅ ส่งแผงป้าย Box Office ไปยังห้อง <#${channel.id}> เรียบร้อยแล้วครับ!`, ephemeral: true });
}

// 2. /cinema-broadcast (ระบบประกาศ COMING SOON พร้อมตั้งเวลาอัตโนมัติ)
const cinemaBroadcastCommand = new SlashCommandBuilder()
  .setName('cinema-broadcast')
  .setDescription('🎥 [CINEMA] แผงควบคุมและส่งประกาศ COMING SOON (สำหรับ Admin)');

async function handleCinemaBroadcastCommand(interaction, serverConfigs) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
  }

  const guildId = interaction.guildId;
  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].cinemaBroadcast) {
    serverConfigs[guildId].cinemaBroadcast = {
      enabled: false,
      timeStr: '20:00',
      title: 'ภาพยนตร์ฟอร์มยักษ์เรื่องใหม่',
      dateStr: '17/10/2026',
      channelId: null,
      roleId: '1551183125076508713',
      imageUrl: 'https://cdn.discordapp.com/attachments/1559878908348997774/1560429202589876295/1792105154505.jpg'
    };
  }

  return await interaction.reply({ ...getCinemaBroadcastDashboard(serverConfigs[guildId].cinemaBroadcast), ephemeral: true });
}

function getCinemaBroadcastDashboard(config) {
  const channelText = config.channelId ? `<#${config.channelId}>` : 'ยังไม่ได้เลือกห้อง';
  const roleText = `<@&${config.roleId || '1551183125076508713'}>`;
  const statusText = config.enabled ? '✅ เปิดใช้งานอยู่' : '❌ ปิดใช้งานอยู่';

  const embed = new EmbedBuilder()
    .setTitle('🍿 𝙕𝙀𝙉 𝘾𝙄𝙉𝙀𝙈𝘼 • COMING SOON CONTROL PANEL')
    .setDescription('แผงควบคุมประกาศ COMING SOON สามารถตั้งค่าข้อมูล ตั้งเวลาส่งอัตโนมัติ และกดส่งประกาศได้ที่นี่ครับ')
    .setColor('#FFD700')
    .addFields(
      { name: '📥 สถานะระบบ', value: statusText, inline: true },
      { name: '⏰ เวลาส่งอัตโนมัติ (Cron HH:MM)', value: `\`${config.timeStr || '20:00'}\``, inline: true },
      { name: '🎬 ชื่อเรื่อง', value: `\`${config.title || 'ภาพยนตร์ฟอร์มยักษ์เรื่องใหม่'}\``, inline: false },
      { name: '📅 วันที่ฉาย (d/m/y)', value: `\`${config.dateStr || '17/10/2026'}\``, inline: true },
      { name: '📢 ห้องที่จะส่ง', value: channelText, inline: true },
      { name: '👥 ยศที่แท็ก', value: roleText, inline: true }
    );

  const toggleBtn = new ButtonBuilder()
    .setCustomId('cinemabc_toggle')
    .setLabel(config.enabled ? '🔴 ปิดระบบอัตโนมัติ' : '🟢 เปิดระบบอัตโนมัติ')
    .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success);

  const row1 = new ActionRowBuilder().addComponents(
    toggleBtn,
    new ButtonBuilder()
      .setCustomId('cinemabc_edit_info')
      .setLabel('✏️ ตั้งค่าข้อมูล (เวลา/ชื่อ/วันที่/รูป)')
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

let activeCinemaBroadcastCrons = {};

function setupCinemaBroadcastCron(guildId, timeStr, channelId, client, serverConfigs) {
  if (activeCinemaBroadcastCrons[guildId]) {
    activeCinemaBroadcastCrons[guildId].stop();
    delete activeCinemaBroadcastCrons[guildId];
  }

  const [hour, minute] = timeStr.split(':');
  if (!hour || !minute) return;

  const cronExpression = `${minute} ${hour} * * *`;

  activeCinemaBroadcastCrons[guildId] = cron.schedule(cronExpression, async () => {
    try {
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return;
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) return;

      const config = serverConfigs[guildId]?.cinemaBroadcast;
      if (!config || !config.enabled) return;

      const defaultImage = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560429202589876295/1792105154505.jpg';
      const imageUrl = (config.imageUrl && config.imageUrl.trim() !== '') ? config.imageUrl.trim() : defaultImage;

      const embed = new EmbedBuilder()
        .setTitle('🍿 𝙕𝙀𝙉 𝘾𝙄𝙉𝙀𝙈𝘼 • COMING SOON')
        .setDescription(
          `🎬 **ชื่อเรื่อง:** ${config.title}\n` +
          `📅 **วันที่ฉาย:** ${config.dateStr}`
        )
        .setColor('#FFD700')
        .setImage(imageUrl);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('cinema_temp_ticket')
          .setLabel('🎟️ ซื้อตั๋ว')
          .setStyle(ButtonStyle.Success)
      );

      const sentMsg = await channel.send({ 
        content: `<@&${config.roleId || '1551183125076508713'}>`, 
        embeds: [embed], 
        components: [row] 
      });

      setTimeout(async () => {
        try {
          if (sentMsg && !sentMsg.deleted) {
            await sentMsg.delete().catch(() => {});
          }
        } catch (e) {
          console.error('Error deleting broadcast message after 20 mins:', e);
        }
      }, 20 * 60 * 1000);

      console.log(`✅ ส่ง Cinema Broadcast สำเร็จสำหรับ Guild ${guildId} เวลา ${timeStr}`);
    } catch (err) {
      console.error(`❌ Error cinema broadcast cron for guild ${guildId}:`, err);
    }
  }, { timezone: "Asia/Bangkok" });
}

function loadAllCinemaBroadcastCrons(client, serverConfigs) {
  for (const guildId in serverConfigs) {
    const config = serverConfigs[guildId];
    if (config && config.cinemaBroadcast && config.cinemaBroadcast.enabled && config.cinemaBroadcast.timeStr && config.cinemaBroadcast.channelId) {
      setupCinemaBroadcastCron(guildId, config.cinemaBroadcast.timeStr, config.cinemaBroadcast.channelId, client, serverConfigs);
    }
  }
}

// ตัวจัดการปุ่มและการทำงานของ Manual & Box Office Cinema (พร้อมระบบหัก Zen Coins)
async function handleCinemaButton(interaction, serverConfigs, saveConfigs, client) {
  const id = interaction.customId;
  const guildId = interaction.guildId;
  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].economy) serverConfigs[guildId].economy = {};

  if (id === 'cinema_perm_ticket') {
    const roleId = '1560731553766707241';
    const member = interaction.member;
    const userId = member.id;
    const cost = 15;

    if (member.roles.cache.has(roleId)) {
      return await interaction.reply({ content: `❤️ คุณมีตั๋วอยู่แล้ว ขอให้สนุกกับการรับชมนะครับ!`, ephemeral: true });
    }

    if (!serverConfigs[guildId].economy[userId]) serverConfigs[guildId].economy[userId] = { coins: 0 };
    const userCoins = serverConfigs[guildId].economy[userId].coins || 0;

    if (userCoins < cost) {
      return await interaction.reply({ content: `❌ เหรียญ Zen Coins ของคุณไม่เพียงพอ! ต้องการ ${cost} C แต่คุณมี ${userCoins} C`, ephemeral: true });
    }

    try {
      serverConfigs[guildId].economy[userId].coins -= cost;
      await saveConfigs(serverConfigs);

      await member.roles.add(roleId);
      
      setTimeout(async () => {
        try {
          const guild = await client.guilds.fetch(member.guild.id).catch(() => null);
          if (guild) {
            const fetchedMember = await guild.members.fetch(member.id).catch(() => null);
            if (fetchedMember && fetchedMember.roles.cache.has(roleId)) {
              await fetchedMember.roles.remove(roleId);
            }
          }
        } catch (e) {
          console.error('Error removing 20-day permanent cinema role:', e);
        }
      }, 20 * 24 * 60 * 60 * 1000);

      return await interaction.reply({ content: `🎉 **ซื้อตั๋วสำเร็จ!** ระบบได้หัก ${cost} C และมอบยศ <@&${roleId}> ให้คุณเรียบร้อยแล้ว (ยศนี้จะถอดออกเองใน 20 วัน)`, ephemeral: true });
    } catch (err) {
      console.error('Error assigning permanent cinema role:', err);
      return await interaction.reply({ content: '❌ เกิดข้อผิดพลาดในการมอบยศ กรุณาตรวจสอบสิทธิ์ของบอทครับ', ephemeral: true });
    }
  }

  if (id === 'cinema_temp_ticket') {
    const roleId = '1551006184272560148';
    const member = interaction.member;
    const userId = member.id;
    const cost = 1;

    if (member.roles.cache.has(roleId)) {
      return await interaction.reply({ content: `❤️ คุณมีตั๋วอยู่แล้ว ขอให้สนุกกับการรับชมนะครับ!`, ephemeral: true });
    }

    if (!serverConfigs[guildId].economy[userId]) serverConfigs[guildId].economy[userId] = { coins: 0 };
    const userCoins = serverConfigs[guildId].economy[userId].coins || 0;

    if (userCoins < cost) {
      return await interaction.reply({ content: `❌ เหรียญ Zen Coins ของคุณไม่เพียงพอ! ต้องการ ${cost} C แต่คุณมี ${userCoins} C`, ephemeral: true });
    }

    try {
      serverConfigs[guildId].economy[userId].coins -= cost;
      await saveConfigs(serverConfigs);

      await member.roles.add(roleId);
      
      setTimeout(async () => {
        try {
          const guild = await client.guilds.fetch(member.guild.id).catch(() => null);
          if (guild) {
            const fetchedMember = await guild.members.fetch(member.id).catch(() => null);
            if (fetchedMember && fetchedMember.roles.cache.has(roleId)) {
              await fetchedMember.roles.remove(roleId);
            }
          }
        } catch (e) {
          console.error('Error removing temporary cinema role:', e);
        }
      }, 1 * 24 * 60 * 60 * 1000);

      return await interaction.reply({ content: `🎉 **ซื้อตั๋วสำเร็จ!** ระบบได้หัก ${cost} C และมอบยศให้คุณเรียบร้อยแล้ว (ยศนี้จะถอดออกเองใน 1 วัน)`, ephemeral: true });
    } catch (err) {
      console.error('Error assigning temp cinema role:', err);
      return await interaction.reply({ content: '❌ เกิดข้อผิดพลาดในการมอบยศ กรุณาตรวจสอบสิทธิ์ของบอทครับ', ephemeral: true });
    }
  }

  if (id === 'cinemabc_toggle') {
    const config = serverConfigs[guildId].cinemaBroadcast;
    config.enabled = !config.enabled;
    await saveConfigs(serverConfigs);

    if (config.enabled && config.channelId && config.timeStr) {
      setupCinemaBroadcastCron(guildId, config.timeStr, config.channelId, client, serverConfigs);
    } else if (!config.enabled && activeCinemaBroadcastCrons[guildId]) {
      activeCinemaBroadcastCrons[guildId].stop();
      delete activeCinemaBroadcastCrons[guildId];
    }

    return await interaction.update(getCinemaBroadcastDashboard(config));
  }

  if (id === 'cinemabc_edit_info') {
    const config = serverConfigs[interaction.guildId].cinemaBroadcast;
    const modal = new ModalBuilder().setCustomId('cinemaBcInfoModal').setTitle('ตั้งค่าประกาศ COMING SOON');
    
    const timeInput = new TextInputBuilder().setCustomId('timeInput').setLabel('เวลาส่งอัตโนมัติ (HH:MM เช่น 20:00)').setStyle(TextInputStyle.Short).setValue(config.timeStr || '').setRequired(true);
    const titleInput = new TextInputBuilder().setCustomId('titleInput').setLabel('ชื่อภาพยนตร์').setStyle(TextInputStyle.Short).setValue(config.title || '').setRequired(true);
    const dateInput = new TextInputBuilder().setCustomId('dateInput').setLabel('วันที่ฉาย (d/m/y)').setStyle(TextInputStyle.Short).setValue(config.dateStr || '').setRequired(true);
    const imageInput = new TextInputBuilder().setCustomId('imageInput').setLabel('ลิงก์รูปภาพโปสเตอร์ (Image URL)').setStyle(TextInputStyle.Short).setValue(config.imageUrl || '').setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(timeInput),
      new ActionRowBuilder().addComponents(titleInput), 
      new ActionRowBuilder().addComponents(dateInput), 
      new ActionRowBuilder().addComponents(imageInput)
    );
    return await interaction.showModal(modal);
  }

  if (id === 'cinemabc_edit_role') {
    const config = serverConfigs[interaction.guildId].cinemaBroadcast;
    const modal = new ModalBuilder().setCustomId('cinemaBcRoleModal').setTitle('เปลี่ยนยศประกาศ COMING SOON');
    const roleInput = new TextInputBuilder().setCustomId('roleIdInput').setLabel('ระบุ Role ID ที่ต้องการแท็ก').setStyle(TextInputStyle.Short).setValue(config.roleId || '1551183125076508713').setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(roleInput));
    return await interaction.showModal(modal);
  }

  if (id === 'cinemabc_test_send') {
    const guildId = interaction.guildId;
    const config = serverConfigs[guildId].cinemaBroadcast;
    if (!config || !config.channelId) {
      return await interaction.reply({ content: '❌ กรุณาเลือกห้องส่งประกาศ COMING SOON จากเมนูด้านล่างแผงควบคุมก่อนกดส่งครับ!', ephemeral: true });
    }

    try {
      const channel = await interaction.guild.channels.fetch(config.channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) {
        return await interaction.reply({ content: '❌ ไม่พบห้องที่เลือก กรุณาเลือกห้องใหม่อีกครั้งครับ', ephemeral: true });
      }

      const defaultImage = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560429202589876295/1792105154505.jpg';
      const imageUrl = (config.imageUrl && config.imageUrl.trim() !== '') ? config.imageUrl.trim() : defaultImage;

      const embed = new EmbedBuilder()
        .setTitle('🍿 𝙕𝙀𝙉 𝘾𝙄𝙉𝙀𝙈𝘼 • COMING SOON')
        .setDescription(
          `🎬 **ชื่อเรื่อง:** ${config.title}\n` +
          `📅 **วันที่ฉาย:** ${config.dateStr}`
        )
        .setColor('#FFD700')
        .setImage(imageUrl);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('cinema_temp_ticket')
          .setLabel('🎟️ ซื้อตั๋ว')
          .setStyle(ButtonStyle.Success)
      );

      const sentMsg = await channel.send({ 
        content: `<@&${config.roleId || '1551183125076508713'}>`, 
        embeds: [embed], 
        components: [row] 
      });

      setTimeout(async () => {
        try {
          if (sentMsg && !sentMsg.deleted) {
            await sentMsg.delete().catch(() => {});
          }
        } catch (e) {
          console.error('Error deleting broadcast message after 20 mins:', e);
        }
      }, 20 * 60 * 1000);

      return await interaction.reply({ content: `✅ ส่งประกาศไปยังห้อง <#${config.channelId}> เรียบร้อยแล้ว! (ข้อความจะหายไปเองใน 20 นาที)`, ephemeral: true });
    } catch (err) {
      console.error('Error sending cinema broadcast:', err);
      return await interaction.reply({ content: '❌ เกิดข้อผิดพลาดในการส่งประกาศ กรุณาตรวจสอบสิทธิ์ของบอทครับ', ephemeral: true });
    }
  }

  return false;
}

async function handleCinemaSelect(interaction, serverConfigs, saveConfigs, client) {
  const guildId = interaction.guildId;
  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};

  if (interaction.customId === 'cinemabc_select_channel') {
    const channelId = interaction.values[0];
    if (!serverConfigs[guildId].cinemaBroadcast) {
      serverConfigs[guildId].cinemaBroadcast = {
        enabled: false,
        timeStr: '20:00',
        title: 'ภาพยนตร์ฟอร์มยักษ์เรื่องใหม่',
        dateStr: '17/10/2026',
        roleId: '1551183125076508713',
        imageUrl: 'https://cdn.discordapp.com/attachments/1559878908348997774/1560429202589876295/1792105154505.jpg'
      };
    }
    serverConfigs[guildId].cinemaBroadcast.channelId = channelId;
    await saveConfigs(serverConfigs);

    if (serverConfigs[guildId].cinemaBroadcast.enabled && serverConfigs[guildId].cinemaBroadcast.timeStr) {
      setupCinemaBroadcastCron(guildId, serverConfigs[guildId].cinemaBroadcast.timeStr, channelId, client, serverConfigs);
    }

    await interaction.update(getCinemaBroadcastDashboard(serverConfigs[guildId].cinemaBroadcast));
    return true;
  }

  return false;
}

async function handleCinemaModal(interaction, serverConfigs, saveConfigs, client) {
  const guildId = interaction.guildId;
  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};

  if (interaction.customId === 'cinemaBcInfoModal') {
    if (!serverConfigs[guildId].cinemaBroadcast) serverConfigs[guildId].cinemaBroadcast = {};
    const config = serverConfigs[guildId].cinemaBroadcast;
    
    const timeVal = interaction.fields.getTextInputValue('timeInput').trim();
    if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeVal)) {
      config.timeStr = timeVal;
    }
    config.title = interaction.fields.getTextInputValue('titleInput').trim();
    config.dateStr = interaction.fields.getTextInputValue('dateInput').trim();
    const imgVal = interaction.fields.getTextInputValue('imageInput').trim();
    if (imgVal) config.imageUrl = imgVal;

    await saveConfigs(serverConfigs);

    if (config.enabled && config.channelId && config.timeStr) {
      setupCinemaBroadcastCron(guildId, config.timeStr, config.channelId, client, serverConfigs);
    }

    return await interaction.reply({ content: '✅ บันทึกข้อมูลประกาศ COMING SOON เรียบร้อยแล้ว!', ephemeral: true });
  }

  if (interaction.customId === 'cinemaBcRoleModal') {
    if (!serverConfigs[guildId].cinemaBroadcast) serverConfigs[guildId].cinemaBroadcast = {};
    const config = serverConfigs[guildId].cinemaBroadcast;
    
    config.roleId = interaction.fields.getTextInputValue('roleIdInput').trim();
    await saveConfigs(serverConfigs);
    return await interaction.reply({ content: `✅ เปลี่ยนยศประกาศ COMING SOON เป็น <@&${config.roleId}> เรียบร้อยแล้ว!`, ephemeral: true });
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
  handleCinemaModal,
  loadAllCinemaBroadcastCrons
};
