const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder, RoleSelectMenuBuilder } = require('discord.js');
const cron = require('node-cron');

// เก็บสถานะ Cron jobs สำหรับ Auto-Cinema ของแต่ละกิลด์
let activeAutoCinemaCrons = {};

// 1. /auto-cinema (ระบบตั้งเวลาประกาศอัตโนมัติ พร้อมแผงควบคุม)
const autoCinemaCommand = new SlashCommandBuilder()
  .setName('auto-cinema')
  .setDescription('⏰ [CINEMA] แผงควบคุมระบบประกาศรอบฉายภาพยนตร์อัตโนมัติ (สำหรับ Admin)');

async function handleAutoCinemaCommand(interaction, serverConfigs, saveConfigs, client) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
  }

  const guildId = interaction.guildId;
  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].autoCinema) {
    serverConfigs[guildId].autoCinema = {
      enabled: false,
      time: '20:00',
      channelId: null,
      roleId: '1551006184272560148',
      title: 'ภาพยนตร์รอบพิเศษ',
      imageUrl: 'https://cdn.discordapp.com/attachments/1559878908348997774/1560429202589876295/1792105154505.jpg'
    };
  }

  return await interaction.reply({ ...getAutoCinemaDashboard(serverConfigs[guildId].autoCinema), ephemeral: true });
}

function getAutoCinemaDashboard(config) {
  const statusText = config.enabled ? '✅ เปิดใช้งานอยู่' : '❌ ปิดใช้งานอยู่';
  const channelText = config.channelId ? `<#${config.channelId}>` : 'ยังไม่ได้เลือกห้อง';
  const roleText = `<@&${config.roleId || '1551006184272560148'}>`;

  const embed = new EmbedBuilder()
    .setTitle('⏰ 𝙕𝙀𝙉 𝘾𝙄𝙉𝙀𝙈𝘼𝙎 • AUTO-CINEMA CONTROL PANEL')
    .setDescription('แผงควบคุมระบบประกาศรอบฉายอัตโนมัติ คุณสามารถตั้งค่าเวลา รูปภาพ และเปิด-ปิดระบบได้ที่นี่ครับ')
    .setColor('#E50914')
    .addFields(
      { name: '📥 สถานะระบบ', value: statusText, inline: true },
      { name: '⏰ เวลาส่ง (HH:MM)', value: `\`${config.time || '20:00'}\``, inline: true },
      { name: '📢 ห้องส่งประกาศ', value: channelText, inline: true },
      { name: '👥 ยศที่แท็ก', value: roleText, inline: true },
      { name: '🎬 ชื่อเรื่องปัจจุบัน', value: `\`${config.title || 'ภาพยนตร์รอบพิเศษ'}\``, inline: false }
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('autocinema_toggle')
      .setLabel(config.enabled ? '🔴 ปิดระบบอัตโนมัติ' : '🟢 เปิดระบบอัตโนมัติ')
      .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('autocinema_edit_info')
      .setLabel('✏️ ตั้งค่าข้อมูล (เวลา/ชื่อเรื่อง/รูป)')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('autocinema_edit_role')
      .setLabel('👑 เปลี่ยนยศที่แท็ก')
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


// 2. /cinema-broadcast (ประกาศ COMING SOON แบบกดส่งเอง)
const cinemaBroadcastCommand = new SlashCommandBuilder()
  .setName('cinema-broadcast')
  .setDescription('🎥 [CINEMA] ประกาศ COMING SOON รอบฉายภาพยนตร์ (สำหรับ Admin)')
  .addStringOption(option =>
    option.setName('title')
      .setDescription('ชื่อภาพยนตร์')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('date')
      .setDescription('วันที่ฉาย เช่น 25/10/2026 หรือ วันเสาร์นี้')
      .setRequired(true)
  )
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('เลือกห้องสำหรับส่งประกาศ')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('image')
      .setDescription('ลิงก์รูปภาพโปสเตอร์หนัง')
      .setRequired(false)
  );

async function handleCinemaBroadcastCommand(interaction, serverConfigs) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
  }

  const title = interaction.options.getString('title');
  const dateStr = interaction.options.getString('date');
  const channel = interaction.options.getChannel('channel');
  const customImage = interaction.options.getString('image');

  const defaultImage = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560429202589876295/1792105154505.jpg';
  const imageUrl = (customImage && customImage.trim() !== '') ? customImage.trim() : defaultImage;
  const roleId = '1551183125076508713'; // ยศสำหรับ COMING SOON / ประกาศทั่วไปตามสเปค

  const embed = new EmbedBuilder()
    .setTitle('🍿 𝙕𝙀𝙉 𝘾𝙄𝙉𝙀𝙈𝘼𝙎 • COMING SOON')
    .setDescription(
      `🎬 **ชื่อเรื่อง:** ${title}\n` +
      `📅 **กำหนดฉาย:** ${dateStr}`
    )
    .setColor('#E50914')
    .setImage(imageUrl);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('cinema_temp_ticket')
      .setLabel('🎟️ รับตั๋วเข้าชม')
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({ 
    content: `<@&${roleId}>`, 
    embeds: [embed], 
    components: [row] 
  });

  await interaction.reply({ content: `✅ ส่งประกาศ COMING SOON ไปยังห้อง <#${channel.id}> เรียบร้อยแล้วครับ!`, ephemeral: true });
}


// 3. /cinema-setup (Box Office ถาวร ส่งครั้งเดียว)
const setupCinemaCommand = new SlashCommandBuilder()
  .setName('cinema-setup')
  .setDescription('🎬 [CINEMA] ส่งแผงป้าย Box Office จุดจำหน่ายตั๋วถาวร (สำหรับ Admin)')
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

  const embed = new EmbedBuilder()
    .setTitle('Zen cinema • box office')
    .setDescription(
      'บริการจำหน่ายตั๋วรับชมภาพยนตร์\n\n' +
      `> <@&${permRoleId}>\n` +
      '> รับแจ้งเตือนล่วงหน้า'
    )
    .setColor('#E50914')
    .setImage(imageUrl);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('cinema_perm_ticket')
      .setLabel('🎟️ รับตั๋วเข้าชม')
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: `✅ ส่งแผงป้าย Box Office ไปยังห้อง <#${channel.id}> เรียบร้อยแล้วครับ!`, ephemeral: true });
}


// 🔘 จัดการปุ่มกดรับตั๋วและแผงควบคุม Auto-Cinema
async function handleCinemaButton(interaction, serverConfigs, saveConfigs) {
  const id = interaction.customId;

  // 1. ปุ่มรับตั๋วถาวรจาก Box Office (ยศ 1560731553766707241 ถาวร)
  if (id === 'cinema_perm_ticket') {
    const permRoleId = '1560731553766707241';
    const member = interaction.member;

    if (member.roles.cache.has(permRoleId)) {
      return await interaction.reply({ content: `🎟️ คุณมีตั๋วและได้รับยศ <@&${permRoleId}> เรียบร้อยแล้วครับ!`, ephemeral: true });
    }

    try {
      await member.roles.add(permRoleId);
      return await interaction.reply({ content: `🎉 **จองตั๋วสำเร็จ!** ระบบได้มอบยศถาวร <@&${permRoleId}> ให้คุณเรียบร้อยแล้ว เตรียมรับแจ้งเตือนรอบฉายได้เลยครับ!`, ephemeral: true });
    } catch (err) {
      console.error('Error assigning permanent cinema role:', err);
      return await interaction.reply({ content: '❌ เกิดข้อผิดพลาดในการมอบยศ กรุณาติดต่อแอดมินเซิร์ฟเวอร์ครับ', ephemeral: true });
    }
  }

  // 2. ปุ่มรับตั๋วชั่วคราวจาก COMING SOON (ยศ 1551183125076508713 ออกใน 2 ชั่วโมง)
  if (id === 'cinema_temp_ticket') {
    const tempRoleId = '1551183125076508713';
    const member = interaction.member;

    if (member.roles.cache.has(tempRoleId)) {
      return await interaction.reply({ content: `🎟️ คุณมีตั๋วชั่วคราว <@&${tempRoleId}> สำหรับรอบนี้อยู่แล้วครับ!`, ephemeral: true });
    }

    try {
      await member.roles.add(tempRoleId);
      
      // ตั้งเวลาถอดรหัสยศออกใน 2 ชั่วโมง (7200000 มิลลิวินาที)
      setTimeout(async () => {
        try {
          const guild = interaction.guild;
          if (guild) {
            const fetchedMember = await guild.members.fetch(member.id).catch(() => null);
            if (fetchedMember && fetchedMember.roles.cache.has(tempRoleId)) {
              await fetchedMember.roles.remove(tempRoleId);
            }
          }
        } catch (e) {
          console.error('Error removing temporary cinema role:', e);
        }
      }, 2 * 60 * 60 * 1000);

      return await interaction.reply({ content: `🎉 **จองตั๋วสำเร็จ!** ระบบมอบยศชั่วคราว <@&${tempRoleId}> ให้คุณแล้ว (ยศจะหมดอายุและถอดออกอัตโนมัติใน 2 ชั่วโมงครับ)`, ephemeral: true });
    } catch (err) {
      console.error('Error assigning temporary cinema role:', err);
      return await interaction.reply({ content: '❌ เกิดข้อผิดพลาดในการมอบยศ กรุณาติดต่อแอดมินเซิร์ฟเวอร์ครับ', ephemeral: true });
    }
  }

  // 3. แผงควบคุม Auto-Cinema ปุ่มสลับเปิด-ปิดระบบ
  if (id === 'autocinema_toggle') {
    const guildId = interaction.guildId;
    const config = serverConfigs[guildId].autoCinema;
    config.enabled = !config.enabled;
    await saveConfigs(serverConfigs);

    if (config.enabled) {
      setupAutoCinemaCron(guildId, config, interaction.client, serverConfigs);
    } else {
      stopAutoCinemaCron(guildId);
    }

    return await interaction.update(getAutoCinemaDashboard(config));
  }

  // 4. ปุ่มเปิด Modal ตั้งค่าข้อมูล Auto-Cinema
  if (id === 'autocinema_edit_info') {
    const config = serverConfigs[interaction.guildId].autoCinema;
    const modal = new ModalBuilder().setCustomId('autoCinemaInfoModal').setTitle('ตั้งค่า Auto-Cinema');
    
    const timeInput = new TextInputBuilder().setCustomId('timeInput').setLabel('เวลาส่ง (รูปแบบ HH:MM เช่น 20:00)').setStyle(TextInputStyle.Short).setValue(config.time || '20:00').setRequired(true);
    const titleInput = new TextInputBuilder().setCustomId('titleInput').setLabel('ชื่อภาพยนตร์ / หัวข้อเรื่อง').setStyle(TextInputStyle.Short).setValue(config.title || '').setRequired(true);
    const imageInput = new TextInputBuilder().setCustomId('imageInput').setLabel('ลิงก์รูปภาพ (Image URL)').setStyle(TextInputStyle.Short).setValue(config.imageUrl || '').setRequired(false);

    modal.addComponents(new ActionRowBuilder().addComponents(timeInput), new ActionRowBuilder().addComponents(titleInput), new ActionRowBuilder().addComponents(imageInput));
    return await interaction.showModal(modal);
  }

  // 5. ปุ่มเปิด Modal เปลี่ยนยศที่แท็กใน Auto-Cinema
  if (id === 'autocinema_edit_role') {
    const config = serverConfigs[interaction.guildId].autoCinema;
    const modal = new ModalBuilder().setCustomId('autoCinemaRoleModal').setTitle('เปลี่ยนยศที่แท็ก Auto-Cinema');
    const roleInput = new TextInputBuilder().setCustomId('roleIdInput').setLabel('ระบุ Role ID ที่ต้องการแท็ก').setStyle(TextInputStyle.Short).setValue(config.roleId || '1551006184272560148').setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(roleInput));
    return await interaction.showModal(modal);
  }

  return false;
}

// 📂 จัดการ Channel Select Menu สำหรับ Auto-Cinema
async function handleAutoCinemaSelect(interaction, serverConfigs, saveConfigs, client) {
  if (interaction.customId !== 'autocinema_select_channel') return false;

  const guildId = interaction.guildId;
  const channelId = interaction.values[0];
  const config = serverConfigs[guildId].autoCinema;
  
  config.channelId = channelId;
  await saveConfigs(serverConfigs);

  if (config.enabled) {
    setupAutoCinemaCron(guildId, config, client, serverConfigs);
  }

  await interaction.update(getAutoCinemaDashboard(config));
  return true;
}

// 📝 จัดการ Modal Submit ของ Auto-Cinema
async function handleAutoCinemaModal(interaction, serverConfigs, saveConfigs, client) {
  const guildId = interaction.guildId;
  if (!serverConfigs[guildId] || !serverConfigs[guildId].autoCinema) return false;
  const config = serverConfigs[guildId].autoCinema;

  if (interaction.customId === 'autoCinemaInfoModal') {
    const timeVal = interaction.fields.getTextInputValue('timeInput').trim();
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeVal)) {
      return await interaction.reply({ content: '❌ รูปแบบเวลาไม่ถูกต้อง กรุณาใช้รูปแบบ HH:MM เช่น 20:00', ephemeral: true });
    }

    config.time = timeVal;
    config.title = interaction.fields.getTextInputValue('titleInput').trim();
    const imgVal = interaction.fields.getTextInputValue('imageInput').trim();
    if (imgVal) config.imageUrl = imgVal;

    await saveConfigs(serverConfigs);

    if (config.enabled) {
      setupAutoCinemaCron(guildId, config, client, serverConfigs);
    }

    return await interaction.reply({ content: '✅ บันทึกการตั้งค่า Auto-Cinema เรียบร้อยแล้ว!', ephemeral: true });
  }

  if (interaction.customId === 'autoCinemaRoleModal') {
    config.roleId = interaction.fields.getTextInputValue('roleIdInput').trim();
    await saveConfigs(serverConfigs);
    return await interaction.reply({ content: `✅ เปลี่ยนยศที่แท็กเป็น <@&${config.roleId}> เรียบร้อยแล้ว!`, ephemeral: true });
  }

  return false;
}

// ⏰ ตั้งค่า Cron Job สำหรับ Auto-Cinema
function setupAutoCinemaCron(guildId, config, client, serverConfigs) {
  stopAutoCinemaCron(guildId);

  if (!config.time || !config.channelId) return;
  const [hour, minute] = config.time.split(':');
  const cronExpression = `${minute} ${hour} * * *`;

  activeAutoCinemaCrons[guildId] = cron.schedule(cronExpression, async () => {
    try {
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return;
      const channel = await guild.channels.fetch(config.channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) return;

      const embed = new EmbedBuilder()
        .setTitle('🍿 𝙕𝙀𝙉 𝘾𝙄𝙉𝙀𝙈𝘼𝙎 • NOW SHOWING')
        .setDescription(
          `🎬 **ชื่อเรื่อง:** ${config.title || 'ภาพยนตร์รอบพิเศษ'}\n` +
          `⏰ **เวลาฉาย:** วันนี้เวลา ${config.time} น.`
        )
        .setColor('#E50914')
        .setImage(config.imageUrl || 'https://cdn.discordapp.com/attachments/1559878908348997774/1560429202589876295/1792105154505.jpg');

      await channel.send({
        content: `<@&${config.roleId || '1551006184272560148'}>`,
        embeds: [embed]
      });
      console.log(`✅ ส่ง Auto-Cinema รอบเวลา ${config.time} สำเร็จในกิลด์ ${guildId}`);
    } catch (err) {
      console.error(`❌ Error in Auto-Cinema Cron for guild ${guildId}:`, err);
    }
  }, { timezone: "Asia/Bangkok" });

  console.log(`⏰ เปิดใช้งาน Auto-Cinema Cron สำหรับกิลด์ ${guildId} เวลา ${config.time}`);
}

function stopAutoCinemaCron(guildId) {
  if (activeAutoCinemaCrons[guildId]) {
    activeAutoCinemaCrons[guildId].stop();
    delete activeAutoCinemaCrons[guildId];
  }
}

function loadAllAutoCinemaCrons(client, serverConfigs) {
  for (const guildId in serverConfigs) {
    const config = serverConfigs[guildId];
    if (config && config.autoCinema && config.autoCinema.enabled) {
      setupAutoCinemaCron(guildId, config.autoCinema, client, serverConfigs);
    }
  }
}

module.exports = {
  autoCinemaCommand,
  cinemaBroadcastCommand,
  setupCinemaCommand,
  handleAutoCinemaCommand,
  handleCinemaBroadcastCommand,
  handleSetupCinemaCommand,
  handleCinemaButton,
  handleAutoCinemaSelect,
  handleAutoCinemaModal,
  loadAllAutoCinemaCrons
};
