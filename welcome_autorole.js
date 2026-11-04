const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { COLORS } = require('./constants');
const { generateWelcomeCard } = require('./canvas_card');

// ฟังก์ชันเช็ก Config พื้นฐาน
function ensureWelcomeConfig(serverConfigs, guildId) {
  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  const config = serverConfigs[guildId];
  if (config.welcomeEnabled === undefined) config.welcomeEnabled = false;
  if (config.channelId === undefined) config.channelId = null;
  if (config.autoroleEnabled === undefined) config.autoroleEnabled = false;
  if (config.autoroleId === undefined) config.autoroleId = null;
  if (!config.embed) {
    config.embed = { description: '**𑣲⋆ 𝙉𝙀𝙒 𝙈𝙚𝙢𝙗𝙚𝙧!** ✨\n🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}**' };
  }
  return config;
}

// ⚙️ คำสั่งตั้งค่าระบบต้อนรับ
const setWelcomeCommand = new SlashCommandBuilder()
  .setName('set-welcome')
  .setDescription('เปิดแผงควบคุมระบบต้อนรับ (Welcome Dashboard)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

// ⚙️ คำสั่งตั้งค่า Autorole
const setAutoroleCommand = new SlashCommandBuilder()
  .setName('set-autorole')
  .setDescription('ตั้งค่าระบบแจกยศอัตโนมัติสำหรับสมาชิกใหม่')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

function getDashboardContent(config) {
  const channelName = config.channelId ? `<#${config.channelId}>` : 'ยังไม่ได้เลือกช่อง';
  const statusText = config.welcomeEnabled ? '✅ เปิดอยู่' : '❌ ปิดอยู่';
  const msgPreview = config.embed?.description || '**𑣲⋆ 𝙉𝙀𝙒 𝙈𝙚𝙢𝙗𝙚𝙧!** ✨\n🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}**';

  const embed = new EmbedBuilder()
    .setTitle('⚙️ ตั้งค่าระบบต้อนรับ (Welcome Canvas)')
    .setDescription('ระบบจะส่งข้อความต้อนรับพร้อมรูปการ์ด Canvas อัตโนมัติเมื่อมีสมาชิกใหม่เข้ามาในเซิร์ฟเวอร์')
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
  return { embeds: [embed], components: [row1, channelRow] };
}

function getAutoroleDashboardContent(config) {
  const roleName = config.autoroleId ? `<@&${config.autoroleId}>` : 'ยังไม่ได้เลือกยศ';
  const statusText = config.autoroleEnabled ? '✅ เปิดอยู่' : '❌ ปิดอยู่';
  const embed = new EmbedBuilder()
    .setTitle('🛡️ ตั้งค่าระบบ Autorole')
    .setDescription('เมื่อเลือกยศด้านล่าง ระบบจะเปิดใช้งานการแจกยศอัตโนมัติให้สมาชิกใหม่ทันที')
    .setColor(COLORS.DISCORD_BLURPLE)
    .addFields(
      { name: '📥 สถานะ', value: statusText, inline: true },
      { name: '👑 ยศที่จะได้รับ', value: roleName, inline: true }
    );
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('toggle_autorole').setLabel(config.autoroleEnabled ? '🔴 ปิดระบบชั่วคราว' : '🟢 เปิดระบบ').setStyle(config.autoroleEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
  );
  const roleRow = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder().setCustomId('select_autorole').setPlaceholder('👑 เลือกยศแจกสมาชิกใหม่')
  );
  return { embeds: [embed], components: [roleRow] };
}

async function handleWelcomeAutoroleCommands(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const config = ensureWelcomeConfig(serverConfigs, guildId);

  if (interaction.commandName === 'set-welcome') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
    }
    const payload = getDashboardContent(config);
    return await interaction.reply({ ...payload, ephemeral: true });
  }

  if (interaction.commandName === 'set-autorole') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
    }
    const payload = getAutoroleDashboardContent(config);
    return await interaction.reply({ ...payload, ephemeral: true });
  }
}

async function handleWelcomeAutoroleInteraction(interaction, serverConfigs, saveConfigs) {
  const guildId = interaction.guildId;
  if (!guildId) return false;
  const config = ensureWelcomeConfig(serverConfigs, guildId);

  // จัดการปุ่ม
  if (interaction.isButton()) {
    const id = interaction.customId;
    if (['toggle_welcome', 'toggle_autorole', 'edit_welcome_msg', 'test_welcome'].includes(id)) {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return await interaction.reply({ content: '❌ เฉพาะผู้ดูแลระบบเท่านั้น', ephemeral: true });
      }

      if (id === 'toggle_welcome') {
        config.welcomeEnabled = !config.welcomeEnabled;
        await saveConfigs(serverConfigs);
        await interaction.update(getDashboardContent(config));
        return true;
      }
      if (id === 'toggle_autorole') {
        config.autoroleEnabled = !config.autoroleEnabled;
        await saveConfigs(serverConfigs);
        await interaction.update(getAutoroleDashboardContent(config));
        return true;
      }
      if (id === 'edit_welcome_msg') {
        const modal = new ModalBuilder().setCustomId('editWelcomeMsgModal').setTitle('แก้ไขข้อความต้อนรับ');
        const descInput = new TextInputBuilder().setCustomId('welcomeDesc').setLabel('ข้อความต้อนรับ ({user}, {server})').setStyle(TextInputStyle.Paragraph).setValue(config.embed?.description || '').setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(descInput));
        await interaction.showModal(modal);
        return true;
      }
      if (id === 'test_welcome') {
        if (!config.channelId) {
          return await interaction.reply({ content: '❌ กรุณาเลือกช่องสำหรับส่งข้อความต้อนรับก่อนกดทดสอบ', ephemeral: true });
        }
        await interaction.reply({ content: '🔄 กำลังส่งการ์ดต้อนรับทดสอบ...', ephemeral: true });
        try {
          const channel = await interaction.guild.channels.fetch(config.channelId);
          if (channel) {
            const attachment = await generateWelcomeCard(interaction.member);
            const defaultDesc = '**𑣲⋆ 𝙉𝙀𝙒 𝙈𝙚𝙢𝙗𝙚𝙧!** ✨\n🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}**';
            const finalDesc = (config.embed?.description || defaultDesc).replace('{user}', `${interaction.user}`).replace('{server}', interaction.guild.name);
            await channel.send({ content: finalDesc, files: [attachment] });
          }
        } catch (err) {
          console.error('Test welcome error', err);
        }
        return true;
      }
    }
  }

  // จัดการ Channel Select Menu (เลือกห้องต้อนรับ)
  if (interaction.isChannelSelectMenu() && interaction.customId === 'select_channel') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    await interaction.deferUpdate().catch(() => {});
    config.channelId = interaction.values[0];
    await saveConfigs(serverConfigs);
    await interaction.editReply(getDashboardContent(config));
    return true;
  }

  // จัดการ Role Select Menu (เลือกยศ Autorole)
  if (interaction.isRoleSelectMenu() && interaction.customId === 'select_autorole') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    await interaction.deferUpdate().catch(() => {});
    config.autoroleId = interaction.values[0];
    config.autoroleEnabled = true;
    await saveConfigs(serverConfigs);
    await interaction.editReply(getAutoroleDashboardContent(config));
    return true;
  }

  // จัดการ Modal Submit (บันทึกข้อความต้อนรับ)
  if (interaction.isModalSubmit() && interaction.customId === 'editWelcomeMsgModal') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    if (!config.embed) config.embed = {};
    config.embed.description = interaction.fields.getTextInputValue('welcomeDesc');
    await saveConfigs(serverConfigs);
    await interaction.reply({ content: '✅ บันทึกข้อความต้อนรับเรียบร้อยแล้ว!', ephemeral: true });
    return true;
  }

  return false;
}

// Event ตอนสมาชิกใหม่เข้าเซิร์ฟเวอร์
async function handleGuildMemberAdd(member, serverConfigs) {
  if (member.user.bot) return;
  const guildId = member.guild.id;
  const config = ensureWelcomeConfig(serverConfigs, guildId);

  // จัดการ Autorole
  if (config.autoroleEnabled && config.autoroleId) {
    try {
      const role = await member.guild.roles.fetch(config.autoroleId);
      if (role) await member.roles.add(role);
    } catch (err) {
      console.error('Autorole error', err);
    }
  }

  // จัดการ Welcome Card
  if (!config.welcomeEnabled || !config.channelId) return;
  try {
    const channel = await member.guild.channels.fetch(config.channelId);
    if (!channel) return;

    const attachment = await generateWelcomeCard(member);
    const defaultDesc = '**𑣲⋆ 𝙉𝙀𝙒 𝙈𝙚𝙢𝙗𝙚𝙧!** ✨\n🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}**';
    const finalDesc = (config.embed?.description || defaultDesc)
      .replace('{user}', `${member}`)
      .replace('{server}', member.guild.name);

    await channel.send({ content: finalDesc, files: [attachment] });
  } catch (err) {
    console.error('Send welcome error', err);
  }
}

module.exports = {
  setWelcomeCommand,
  setAutoroleCommand,
  handleWelcomeAutoroleCommands,
  handleWelcomeAutoroleInteraction,
  handleGuildMemberAdd
};
