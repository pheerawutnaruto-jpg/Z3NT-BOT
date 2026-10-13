const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

async function registerCommands(interaction, serverConfigs, saveConfigs, setupCronJob) {
  const guildId = interaction.guildId;
  if (!guildId) return;

  if (!serverConfigs[guildId]) {
    serverConfigs[guildId] = {
      welcomeEnabled: false, channelId: null, autoroleEnabled: false, autoroleId: null,
      security: {
        enabled: false, antiLink: true, antiSpam: true, antiMrBeast: true,
        spamCount: 3, spamSeconds: 6, timeoutSeconds: 3000,
        actions: {
          invite: { timeout: true, kick: true, ban: false },
          spam: { timeout: true, kick: true, ban: false },
          mrbeast: { timeout: true, kick: true, ban: false }
        },
        ignoredChannels: []
      },
      embed: {
        title: '',
        description: '**𑣲⋆ 𝙉𝙀𝙒 𝙈𝙚𝙢𝙗𝙚𝙧!** ✨\n🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}** ครับ!',
        color: '#66FFFF',
        image: '',
        footerText: '',
        footerIcon: '',
        timestamp: 'no'
      },
      autoClear: { enabled: false, time: '06:00', channelId: null }
    };
  }
  const config = serverConfigs[guildId];
  if (!config.security) {
    config.security = {
      enabled: false, antiLink: true, antiSpam: true, antiMrBeast: true,
      spamCount: 3, spamSeconds: 6, timeoutSeconds: 3000,
      actions: { invite: { timeout: true, kick: true, ban: false }, spam: { timeout: true, kick: true, ban: false }, mrbeast: { timeout: true, kick: true, ban: false } },
      ignoredChannels: []
    };
  }
  if (!config.embed) {
    config.embed = { title: '', description: '**𑣲⋆ 𝙉𝙀𝙒 𝙈𝙚𝙢𝙗𝙚𝙧!** ✨\n🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}** ครับ!', color: '#66FFFF', image: '', footerText: '', footerIcon: '', timestamp: 'no' };
  }

  // 1. คำสั่ง Slash Commands
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'ping') return await interaction.reply({ content: 'Pong! 🏓 บอททำงานปกติ', ephemeral: true });
    
    if (interaction.commandName === 'clear') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return await interaction.reply({ content: '❌ คุณไม่มีสิทธิ์จัดการข้อความครับ', ephemeral: true });
      }
      const amount = interaction.options.getInteger('amount');
      await interaction.deferReply({ ephemeral: true });
      try {
        const messages = await interaction.channel.messages.fetch({ limit: amount });
        await interaction.channel.bulkDelete(messages, true);
        await interaction.editReply({ content: `🧹 ลบข้อความจำนวน **${amount}** ข้อความเรียบร้อยแล้ว!` });
      } catch (err) {
        await interaction.editReply({ content: '❌ เกิดข้อผิดพลาด ไม่สามารถลบข้อความเก่าเกิน 14 วันได้ครับ' });
      }
      return;
    }

    if (interaction.commandName === 'set-autoclear') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return await interaction.reply({ content: '❌ คุณต้องเป็น Administrator ถึงจะใช้งานได้ครับ', ephemeral: true });
      }
      const timeInput = interaction.options.getString('time');
      const channelInput = interaction.options.getChannel('channel');
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(timeInput)) {
        return await interaction.reply({ content: '❌ รูปแบบเวลาไม่ถูกต้อง กรุณาใส่ในรูปแบบ **HH:MM**', ephemeral: true });
      }
      if (!config.autoClear) config.autoClear = {};
      config.autoClear.enabled = true;
      config.autoClear.time = timeInput;
      config.autoClear.channelId = channelInput.id;
      saveConfigs(serverConfigs);
      setupCronJob(guildId, timeInput, channelInput.id);
      return await interaction.reply({ content: `✅ ตั้งค่าระบบ Auto-Clear สำเร็จเวลา **${timeInput} น.** ในช่อง <#${channelInput.id}>`, ephemeral: true });
    }

    if (interaction.commandName === 'set-welcom') {
      if (!interaction.member.permissions.has('Administrator')) return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
      return await sendDashboard(interaction);
    }
    if (interaction.commandName === 'set-autorole') {
      if (!interaction.member.permissions.has('Administrator')) return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
      return await sendAutoroleDashboard(interaction);
    }
    if (interaction.commandName === 'set-security') {
      if (!interaction.member.permissions.has('Administrator')) return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
      return await sendSecurityDashboard(interaction);
    }
  }

  // 2. ปุ่มกดต่างๆ (Buttons)
  if (interaction.isButton()) {
    const id = interaction.customId;

    if (id === 'toggle_welcome') {
      config.welcomeEnabled = !config.welcomeEnabled;
      saveConfigs(serverConfigs);
      return await updateDashboard(interaction);
    }
    if (id === 'toggle_autorole') {
      config.autoroleEnabled = !config.autoroleEnabled;
      saveConfigs(serverConfigs);
      return await updateAutoroleDashboard(interaction);
    }
    if (id === 'test_welcome') {
      if (!config.channelId) return await interaction.reply({ content: '❌ กรุณาเลือกช่องก่อนกดทดสอบครับ!', ephemeral: true });
      await interaction.reply({ content: `🔄 กำลังส่งข้อความทดสอบไปที่ห้อง <#${config.channelId}>...`, ephemeral: true });
      try {
        const channel = await interaction.guild.channels.fetch(config.channelId);
        if (channel) {
          const embedConfig = config.embed;
          const finalTitle = embedConfig.title ? embedConfig.title.replace('{user}', interaction.user.username).replace('{server}', interaction.guild.name) : null;
          const finalDesc = embedConfig.description.replace('{user}', `${interaction.user}`).replace('{server}', interaction.guild.name);
          const embed = new EmbedBuilder().setDescription(finalDesc).setColor(embedConfig.color || '#66FFFF');
          if (finalTitle) embed.setTitle(finalTitle);
          if (embedConfig.image) embed.setImage(embedConfig.image);
          if (embedConfig.footerText) embed.setFooter({ text: embedConfig.footerText.replace('{server_membercount}', interaction.guild.memberCount.toString()) });
          if (embedConfig.timestamp === 'yes') embed.setTimestamp();
          await channel.send({ embeds: [embed] });
        }
      } catch (err) { console.error(err); }
      return;
    }
    if (id === 'edit_embed') {
      const modal = new ModalBuilder().setCustomId('editEmbedModal').setTitle('Editing: welcome embed');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embedTitle').setLabel('Title').setStyle(TextInputStyle.Short).setValue(config.embed.title || '').setRequired(false)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embedDesc').setLabel('Description').setStyle(TextInputStyle.Paragraph).setValue(config.embed.description || '').setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embedColor').setLabel('Hex Color').setStyle(TextInputStyle.Short).setValue(config.embed.color || '#66FFFF').setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embedImage').setLabel('Image URL').setStyle(TextInputStyle.Short).setValue(config.embed.image || '').setRequired(false)),
      );
      return await interaction.showModal(modal);
    }
    if (id === 'edit_footer') {
      const modal = new ModalBuilder().setCustomId('editFooterModal').setTitle('Editing: welcome footer');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embedFooterText').setLabel('Footer Text').setStyle(TextInputStyle.Short).setValue(config.embed.footerText || '').setRequired(false)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embedFooterIcon').setLabel('Footer Image').setStyle(TextInputStyle.Short).setValue(config.embed.footerIcon || '').setRequired(false)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embedTimestamp').setLabel('Timestamp? (yes/no)').setStyle(TextInputStyle.Short).setValue(config.embed.timestamp || 'no').setRequired(false)),
      );
      return await interaction.showModal(modal);
    }

    if (id === 'sec_toggle_main') config.security.enabled = !config.security.enabled;
    else if (id === 'sec_toggle_link') config.security.antiLink = !config.security.antiLink;
    else if (id === 'sec_toggle_spam') config.security.antiSpam = !config.security.antiSpam;
    else if (id === 'sec_toggle_mrbeast') config.security.antiMrBeast = !config.security.antiMrBeast;
    else if (id === 'sec_config_time') {
      const modal = new ModalBuilder().setCustomId('secTimeModal').setTitle('ตั้งค่าเวลาและเกณฑ์สแปม');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('spamCount').setLabel('จำนวนข้อความ').setStyle(TextInputStyle.Short).setValue(config.security.spamCount.toString()).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('spamSec').setLabel('ภายในกี่วินาที').setStyle(TextInputStyle.Short).setValue(config.security.spamSeconds.toString()).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('timeoutSec').setLabel('ระงับผู้ใช้กี่วินาที').setStyle(TextInputStyle.Short).setValue(config.security.timeoutSeconds.toString()).setRequired(true)),
      );
      return await interaction.showModal(modal);
    } else if (id === 'sec_reset') {
      config.security = {
        enabled: false, antiLink: true, antiSpam: true, antiMrBeast: true,
        spamCount: 3, spamSeconds: 6, timeoutSeconds: 3000,
        actions: { invite: { timeout: true, kick: true, ban: false }, spam: { timeout: true, kick: true, ban: false }, mrbeast: { timeout: true, kick: true, ban: false } },
        ignoredChannels: []
      };
    }

    saveConfigs(serverConfigs);
    return await updateSecurityDashboard(interaction);
  }

  // 3. Select Menus
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'act_invite_select') {
      const vals = interaction.values;
      config.security.actions.invite.timeout = vals.includes('timeout');
      config.security.actions.invite.kick = vals.includes('kick');
      config.security.actions.invite.ban = vals.includes('ban');
      saveConfigs(serverConfigs);
      return await updateSecurityDashboard(interaction);
    }
    if (interaction.customId === 'act_spam_select') {
      const vals = interaction.values;
      config.security.actions.spam.timeout = vals.includes('timeout');
      config.security.actions.spam.kick = vals.includes('kick');
      config.security.actions.spam.ban = vals.includes('ban');
      saveConfigs(serverConfigs);
      return await updateSecurityDashboard(interaction);
    }
  }

  if (interaction.isChannelSelectMenu()) {
    if (interaction.customId === 'select_channel') {
      await interaction.deferUpdate();
      config.channelId = interaction.values[0];
      saveConfigs(serverConfigs);
      return await interaction.editReply(getDashboardContent(config));
    }
    if (interaction.customId === 'sec_select_ignored') {
      await interaction.deferUpdate();
      config.security.ignoredChannels = interaction.values;
      saveConfigs(serverConfigs);
      return await interaction.editReply(getSecurityDashboardContent(config));
    }
  }

  if (interaction.isRoleSelectMenu() && interaction.customId === 'select_autorole') {
    await interaction.deferUpdate();
    config.autoroleId = interaction.values[0];
    saveConfigs(serverConfigs);
    return await interaction.editReply(getAutoroleDashboardContent(config));
  }

  // 4. Modals Submit
  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'editEmbedModal') {
      config.embed.title = interaction.fields.getTextInputValue('embedTitle');
      config.embed.description = interaction.fields.getTextInputValue('embedDesc');
      let colorVal = interaction.fields.getTextInputValue('embedColor').trim();
      if (!colorVal.startsWith('#')) colorVal = '#' + colorVal;
      config.embed.color = colorVal;
      config.embed.image = interaction.fields.getTextInputValue('embedImage');
      saveConfigs(serverConfigs);
      return await interaction.reply({ content: '✅ บันทึกรูปแบบ Embed เรียบร้อยแล้ว!', ephemeral: true });
    }
    if (interaction.customId === 'editFooterModal') {
      config.embed.footerText = interaction.fields.getTextInputValue('embedFooterText');
      config.embed.footerIcon = interaction.fields.getTextInputValue('embedFooterIcon');
      config.embed.timestamp = interaction.fields.getTextInputValue('embedTimestamp');
      saveConfigs(serverConfigs);
      return await interaction.reply({ content: '✅ บันทึกรูปแบบ Footer เรียบร้อยแล้ว!', ephemeral: true });
    }
    if (interaction.customId === 'secTimeModal') {
      const c = parseInt(interaction.fields.getTextInputValue('spamCount'));
      const s = parseInt(interaction.fields.getTextInputValue('spamSec'));
      const t = parseInt(interaction.fields.getTextInputValue('timeoutSec'));
      if (!isNaN(c)) config.security.spamCount = c;
      if (!isNaN(s)) config.security.spamSeconds = s;
      if (!isNaN(t)) config.security.timeoutSeconds = t;
      saveConfigs(serverConfigs);
      return await interaction.reply({ content: '✅ บันทึกค่าเวลาเรียบร้อยแล้ว!', ephemeral: true });
    }
  }
}

// UI Content Builders
function getDashboardContent(config) {
  const channelName = config.channelId ? `<#${config.channelId}>` : 'ยังไม่ได้เลือกช่อง';
  const statusText = config.welcomeEnabled ? '✅ เปิดอยู่' : '❌ ปิดอยู่';
  const embed = new EmbedBuilder().setTitle('⚙️ ตั้งค่าระบบ Welcome').setDescription('เลือกช่อง เปิด/ปิดระบบ และตั้งค่ารูป Embed ได้จากปุ่มด้านล่าง').setColor('#5865F2').addFields({ name: '📥 Welcome Status', value: statusText, inline: true }, { name: '📢 ห้องต้อนรับ', value: channelName, inline: true });
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('toggle_welcome').setLabel(config.welcomeEnabled ? 'ปิด Welcome' : 'เปิด Welcome').setStyle(config.welcomeEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('edit_embed').setLabel('ตั้งค่ารูป Embed').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('edit_footer').setLabel('ตั้งค่า Footer').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('test_welcome').setLabel('ทดสอบ Welcome').setStyle(ButtonStyle.Secondary)
  );
  const channelRow = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('select_channel').setPlaceholder('📂 เลือกช่องสำหรับส่งข้อความต้อนรับ').addChannelTypes(ChannelType.GuildText));
  return { embeds: [embed], components: [row1, channelRow] };
}

function getAutoroleDashboardContent(config) {
  const roleName = config.autoroleId ? `<@&${config.autoroleId}>` : 'ยังไม่ได้เลือกยศ';
  const statusText = config.autoroleEnabled ? '✅ เปิดอยู่' : '❌ ปิดอยู่';
  const embed = new EmbedBuilder().setTitle('🛡️ ตั้งค่าระบบ Autorole').setDescription('เลือกยศที่ต้องการแจกให้สมาชิกใหม่').setColor('#5865F2').addFields({ name: '📥 Status', value: statusText, inline: true }, { name: '👑 ยศ', value: roleName, inline: true });
  const row1 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('toggle_autorole').setLabel(config.autoroleEnabled ? 'ปิด Autorole' : 'เปิด Autorole').setStyle(config.autoroleEnabled ? ButtonStyle.Danger : ButtonStyle.Success));
  const roleRow = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('select_autorole').setPlaceholder('👑 เลือกยศสำหรับแจกสมาชิกใหม่'));
  return { embeds: [embed], components: [row1, roleRow] };
}

function getSecurityDashboardContent(config) {
  const sec = config.security;
  let ignoredTags = 'ไม่มีห้องยกเว้น (ดูแลทุกห้อง)';
  if (sec.ignoredChannels && sec.ignoredChannels.length > 0) ignoredTags = sec.ignoredChannels.map(id => `<#${id}>`).join(', ');

  const act = sec.actions;
  const formatAct = (a) => `[${a.timeout ? '✓' : '✗'} Timeout] [${a.kick ? '✓' : '✗'} Kick] [${a.ban ? '✓' : '✗'} Ban]`;

  const embed = new EmbedBuilder()
    .setTitle('⚙️ ตั้งค่าระบบกันสแปมและความปลอดภัย')
    .setDescription('จัดการระบบป้องกันภัยคุกคามและกำหนดบทลงโทษ')
    .setColor('#66FFFF')
    .addFields(
      { name: 'สถานะ', value: sec.enabled ? 'เปิด' : 'ปิด', inline: true },
      { name: 'ลบลิงก์เชิญ', value: sec.antiLink ? 'เปิด' : 'ปิด', inline: true },
      { name: 'ลบข้อความสแปม', value: sec.antiSpam ? 'เปิด' : 'ปิด', inline: true },
      { name: 'ลบสแปม MrBeast', value: sec.antiMrBeast ? 'เปิด' : 'ปิด', inline: true },
      { name: 'สแปม', value: `${sec.spamCount} ข้อความ / ${sec.spamSeconds} วินาที`, inline: true },
      { name: 'ระงับผู้ใช้', value: `${sec.timeoutSeconds} วินาที`, inline: true },
      { name: 'Invite Actions', value: formatAct(act.invite), inline: false },
      { name: 'Spam Actions', value: formatAct(act.spam), inline: false },
      { name: 'ห้องยกเว้น', value: ignoredTags, inline: false }
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sec_toggle_main').setLabel(sec.enabled ? 'เปิดระบบ' : 'ปิดระบบ').setStyle(sec.enabled ? ButtonStyle.Success : ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('sec_toggle_link').setLabel(`ลิงก์: ${sec.antiLink ? 'เปิด' : 'ปิด'}`).setStyle(sec.antiLink ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sec_toggle_spam').setLabel(`สแปม: ${sec.antiSpam ? 'เปิด' : 'ปิด'}`).setStyle(sec.antiSpam ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sec_toggle_mrbeast').setLabel(`MrBeast: ${sec.antiMrBeast ? 'เปิด' : 'ปิด'}`).setStyle(sec.antiMrBeast ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sec_config_time').setLabel('ตั้งเวลา').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('sec_reset').setLabel('รีเซ็ตทั้งหมด').setStyle(ButtonStyle.Danger)
  );

  const rowInviteSelect = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId('act_invite_select').setPlaceholder('⚙️ Action สำหรับ Invite Link').setMinValues(0).setMaxValues(3)
      .addOptions([{ label: 'Timeout', value: 'timeout' }, { label: 'Kick', value: 'kick' }, { label: 'Ban', value: 'ban' }])
  );

  const rowSpamSelect = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId('act_spam_select').setPlaceholder('⚙️ Action สำหรับ Spam').setMinValues(0).setMaxValues(3)
      .addOptions([{ label: 'Timeout', value: 'timeout' }, { label: 'Kick', value: 'kick' }, { label: 'Ban', value: 'ban' }])
  );

  const rowChannel = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder().setCustomId('sec_select_ignored').setPlaceholder('📂 เลือกห้องยกเว้น (ไม่ต้องดูแล)').setMinValues(0).setMaxValues(5).addChannelTypes(ChannelType.GuildText)
  );

  return { embeds: [embed], components: [row1, row2, rowInviteSelect, rowSpamSelect, rowChannel] };
}

async function sendDashboard(interaction) {
  await interaction.reply({ ...getDashboardContent(serverConfigs[interaction.guildId]), ephemeral: true });
}
async function updateDashboard(interaction) {
  await interaction.update(getDashboardContent(serverConfigs[interaction.guildId]));
}
async function sendAutoroleDashboard(interaction) {
  await interaction.reply({ ...getAutoroleDashboardContent(serverConfigs[interaction.guildId]), ephemeral: true });
}
async function updateAutoroleDashboard(interaction) {
  await interaction.update(getAutoroleDashboardContent(serverConfigs[interaction.guildId]));
}
async function sendSecurityDashboard(interaction) {
  await interaction.reply({ ...getSecurityDashboardContent(serverConfigs[interaction.guildId]), ephemeral: true });
}
async function updateSecurityDashboard(interaction) {
  await interaction.update(getSecurityDashboardContent(serverConfigs[interaction.guildId]));
}

module.exports = { registerCommands };
