const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder } = require('discord.js');
const http = require('http');
const fs = require('fs');
const cron = require('node-cron');
const { getSecurityDashboardContent, handleSecurityMessage } = require('./security');
const { levelCommands, getLevelDashboardContent, handleLevelMessage, handleLevelCommand, levelData, saveLevels } = require('./level');

const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running!\n');
});
httpServer.listen(process.env.PORT || 3000);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const CONFIG_FILE = './config.json';

function loadConfigs() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      if (data.trim() !== '') {
        return JSON.parse(data);
      }
    }
  } catch (e) {
    console.error('Error loading config:', e);
  }
  return {};
}

function saveConfigs(configs) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2));
  } catch (e) {
    console.error('Error saving config:', e);
  }
}

let serverConfigs = loadConfigs();
let activeCronJobs = {};
const spamTracker = new Map();

client.once('ready', async () => {
  console.log(`Bot Online แล้วจ้า: ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName('ping')
      .setDescription('เช็กความเร็วและสถานะของบอท'),
    new SlashCommandBuilder()
      .setName('set-welcom')
      .setDescription('เปิดแผงควบคุมระบบต้อนรับ (Welcome Dashboard)'),
    new SlashCommandBuilder()
      .setName('set-autorole')
      .setDescription('ตั้งค่าระบบแจกยศอัตโนมัติสำหรับสมาชิกใหม่'),
    new SlashCommandBuilder()
      .setName('set-security')
      .setDescription('เปิดแผงควบคุมระบบป้องกันความปลอดภัยขั้นสูง'),
    new SlashCommandBuilder()
      .setName('clear')
      .setDescription('ลบข้อความในแชทจำนวน 1-100 ข้อความ')
      .addIntegerOption(option =>
        option.setName('amount')
          .setDescription('จำนวนข้อความที่ต้องการลบ (1-100)')
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName('set-autoclear')
      .setDescription('ตั้งเวลาระบบลบข้อความอัตโนมัติ')
      .addStringOption(option =>
        option.setName('time')
          .setDescription('ระบุเวลาในรูปแบบ HH:MM เช่น 06:00')
          .setRequired(true)
      )
      .addChannelOption(option =>
        option.setName('channel')
          .setDescription('เลือกห้องที่ต้องการให้ลบข้อความอัตโนมัติ')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      ),
  ].map(command => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands },
    );
    console.log('ลงทะเบียนคำสั่งสำเร็จเรียบร้อย!');
  } catch (error) {
    console.error(error);
  }

  for (const guildId in serverConfigs) {
    const config = serverConfigs[guildId];
    if (config && config.autoClear && config.autoClear.enabled && config.autoClear.time && config.autoClear.channelId) {
      setupCronJob(guildId, config.autoClear.time, config.autoClear.channelId);
    }
  }
});

function setupCronJob(guildId, timeStr, channelId) {
  if (activeCronJobs[guildId]) {
    activeCronJobs[guildId].stop();
    delete activeCronJobs[guildId];
  }

  const [hour, minute] = timeStr.split(':');
  if (!hour || !minute) return;

  const cronExpression = `${minute} ${hour} * * *`;

  activeCronJobs[guildId] = cron.schedule(cronExpression, async () => {
    try {
      const guild = await client.guilds.fetch(guildId);
      if (!guild) return;
      const channel = await guild.channels.fetch(channelId);
      if (channel && channel.isTextBased()) {
        const fetched = await channel.messages.fetch({ limit: 100 });
        await channel.bulkDelete(fetched, true);
        console.log(`✅ ลบข้อความอัตโนมัติเวลา ${timeStr} สำเร็จในห้อง #${channel.name}`);
      }
    } catch (err) {
      console.error(`❌ เกิดข้อผิดพลาดในการลบข้อความอัตโนมัติ (Guild: ${guildId}):`, err);
    }
  }, {
    timezone: "Asia/Bangkok"
  });

  console.log(`⏰ ตั้งเวลา Auto-Clear สำเร็จสำหรับ Guild ${guildId} เวลา ${timeStr} ในห้องช่อง ID: ${channelId}`);
}

// เรียกใช้งานระบบตรวจจับข้อความ Security จาก security.js
client.on('messageCreate', async message => {
  const config = serverConfigs[message.guild?.id];
  handleSecurityMessage(message, config, spamTracker);
});

client.on('guildMemberAdd', async member => {
  const guildId = member.guild.id;
  const config = serverConfigs[guildId];

  if (!config) return;

  // 1. ระบบ Autorole
  if (config.autoroleEnabled && config.autoroleId) {
    try {
      const role = await member.guild.roles.fetch(config.autoroleId);
      if (role) {
        await member.roles.add(role);
        console.log(`✅ มอบยศ ${role.name} ให้กับคุณ ${member.user.tag} สำเร็จ`);
      }
    } catch (err) {
      console.error('Autorole error:', err);
    }
  }

  // 2. ระบบ Welcome Message
  if (!config.welcomeEnabled || !config.channelId) return;

  try {
    const channel = await member.guild.channels.fetch(config.channelId);
    if (!channel) return;

    const embedConfig = config.embed || {
      title: '',
      description: '**𑣲⋆ 𝙉𝙀𝙒 𝙈𝙚𝙢𝙗𝙚𝙧!** ✨\n🎉 ยินดีต้อนรับคุณ {user} สู่เซิร์ฟเวอร์ **{server}** ครับ!',
      color: '#66FFFF',
      image: '',
      footerText: '',
      footerIcon: '',
      timestamp: 'no'
    };

    const finalTitle = embedConfig.title ? embedConfig.title
      .replace('{user}', member.user.username)
      .replace('{server}', member.guild.name) : null;
      
    const finalDesc = embedConfig.description
      .replace('{user}', `${member}`)
      .replace('{server}', member.guild.name);

    let embedColor = '#66FFFF';
    try {
      embedColor = embedConfig.color;
    } catch (e) {
      embedColor = '#66FFFF';
    }

    const embed = new EmbedBuilder()
      .setDescription(finalDesc)
      .setColor(embedColor);

    if (finalTitle) {
      embed.setTitle(finalTitle);
    }

    if (embedConfig.image && embedConfig.image.trim() !== '') {
      embed.setImage(embedConfig.image.trim());
    }

    if (embedConfig.footerText && embedConfig.footerText.trim() !== '') {
      const memberCount = member.guild.memberCount.toString();
      const finalFooterText = embedConfig.footerText.replace('{server_membercount}', memberCount);
      
      if (embedConfig.footerIcon && embedConfig.footerIcon.trim() !== '') {
        embed.setFooter({ text: finalFooterText, iconURL: embedConfig.footerIcon.trim() });
      } else {
        embed.setFooter({ text: finalFooterText });
      }
    }

    if (embedConfig.timestamp && embedConfig.timestamp.toLowerCase() === 'yes') {
      embed.setTimestamp();
    }

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Send welcome error:', err);
  }
});

client.on('interactionCreate', async interaction => {
  const guildId = interaction.guildId;
  if (!guildId) return;

  if (!serverConfigs[guildId]) {
    serverConfigs[guildId] = {
      welcomeEnabled: false,
      channelId: null,
      autoroleEnabled: false,
      autoroleId: null,
      security: {
        enabled: false,
        antiLink: true,
        antiSpam: true,
        antiMrBeast: true,
        spamCount: 3,
        spamSeconds: 6,
        timeoutSeconds: 3000,
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
      autoClear: {
        enabled: false,
        time: '06:00',
        channelId: null
      }
    };
  }
  const config = serverConfigs[guildId];
  if (!config.security) {
    config.security = {
      enabled: false,
      antiLink: true,
      antiSpam: true,
      antiMrBeast: true,
      spamCount: 3,
      spamSeconds: 6,
      timeoutSeconds: 3000,
      actions: {
        invite: { timeout: true, kick: true, ban: false },
        spam: { timeout: true, kick: true, ban: false },
        mrbeast: { timeout: true, kick: true, ban: false }
      },
      ignoredChannels: []
    };
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'ping') {
    return await interaction.reply({ content: 'Pong! 🏓 บอททำงานระบบ Slash Command ปกติบน Render ครับ 🚀', ephemeral: true });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'set-security') {
    if (!interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
    }
    return await interaction.reply({ ...getSecurityDashboardContent(config), ephemeral: true });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'clear') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return await interaction.reply({ content: '❌ คุณไม่มีสิทธิ์จัดการข้อความ (Manage Messages) ครับ', ephemeral: true });
    }

    const amount = interaction.options.getInteger('amount');
    if (amount < 1 || amount > 100) {
      return await interaction.reply({ content: '⚠️ กรุณาระบุจำนวนข้อความระหว่าง 1 ถึง 100 ครับ', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const messages = await interaction.channel.messages.fetch({ limit: amount });
      await interaction.channel.bulkDelete(messages, true);
      await interaction.editReply({ content: `🧹 ลบข้อความจำนวน **${amount}** ข้อความเรียบร้อยแล้ว!` });
    } catch (err) {
      console.error(err);
      await interaction.editReply({ content: '❌ เกิดข้อผิดพลาด ไม่สามารถลบข้อความที่เก่าเกิน 14 วันได้ครับ' });
    }
    return;
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'set-autoclear') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({ content: '❌ คุณต้องเป็น Administrator ถึงจะใช้งานคำสั่งนี้ได้ครับ', ephemeral: true });
    }

    const timeInput = interaction.options.getString('time');
    const channelInput = interaction.options.getChannel('channel');

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(timeInput)) {
      return await interaction.reply({ content: '❌ รูปแบบเวลาไม่ถูกต้อง กรุณาใส่ในรูปแบบ **HH:MM** (เช่น `06:00` หรือ `23:30`)', ephemeral: true });
    }

    if (!config.autoClear) {
      config.autoClear = {};
    }

    config.autoClear.enabled = true;
    config.autoClear.time = timeInput;
    config.autoClear.channelId = channelInput.id;
    saveConfigs(serverConfigs);

    setupCronJob(guildId, timeInput, channelInput.id);

    return await interaction.reply({ content: `✅ ตั้งค่าระบบ Auto-Clear สำเร็จ!\n⏰ เวลา: **${timeInput} น.** (ทุกวัน)\n📢 ช่อง: <#${channelInput.id}>`, ephemeral: true });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'set-welcom') {
    if (!interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: '❌ คุณต้องเป็น Administrator ถึงจะใช้งานได้ครับ', ephemeral: true });
    }
    return await sendDashboard(interaction);
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'set-autorole') {
    if (!interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: '❌ คุณต้องเป็น Administrator ถึงจะใช้งานได้ครับ', ephemeral: true });
    }
    return await sendAutoroleDashboard(interaction);
  }

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

    if (id === 'sec_toggle_main') {
      config.security.enabled = !config.security.enabled;
    } else if (id === 'sec_toggle_link') {
      config.security.antiLink = !config.security.antiLink;
    } else if (id === 'sec_toggle_spam') {
      config.security.antiSpam = !config.security.antiSpam;
    } else if (id === 'sec_toggle_mrbeast') {
      config.security.antiMrBeast = !config.security.antiMrBeast;
    } else if (id === 'sec_config_time') {
      const modal = new ModalBuilder().setCustomId('secTimeModal').setTitle('ตั้งค่าเวลาและเกณฑ์สแปม');
      const countInput = new TextInputBuilder().setCustomId('spamCount').setLabel('จำนวนข้อความ (เช่น 3)').setStyle(TextInputStyle.Short).setValue(config.security.spamCount.toString()).setRequired(true);
      const secInput = new TextInputBuilder().setCustomId('spamSec').setLabel('ภายในกี่วินาที (เช่น 6)').setStyle(TextInputStyle.Short).setValue(config.security.spamSeconds.toString()).setRequired(true);
      const timeoutInput = new TextInputBuilder().setCustomId('timeoutSec').setLabel('ระงับผู้ใช้กี่วินาที (เช่น 3000)').setStyle(TextInputStyle.Short).setValue(config.security.timeoutSeconds.toString()).setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(countInput), new ActionRowBuilder().addComponents(secInput), new ActionRowBuilder().addComponents(timeoutInput));
      return await interaction.showModal(modal);
    } else if (id === 'sec_reset') {
      config.security = {
        enabled: false,
        antiLink: true,
        antiSpam: true,
        antiMrBeast: true,
        spamCount: 3,
        spamSeconds: 6,
        timeoutSeconds: 3000,
        actions: {
          invite: { timeout: true, kick: true, ban: false },
          spam: { timeout: true, kick: true, ban: false },
          mrbeast: { timeout: true, kick: true, ban: false }
        },
        ignoredChannels: []
      };
    }

    saveConfigs(serverConfigs);

    if (id === 'toggle_welcome') {
      return await updateDashboard(interaction);
    } else if (id === 'toggle_autorole') {
      return await updateAutoroleDashboard(interaction);
    } else if (id.startsWith('sec_')) {
      return await interaction.update(getSecurityDashboardContent(config));
    }

    if (interaction.customId === 'test_welcome') {
      if (!config.channelId) {
        return await interaction.reply({ content: '❌ กรุณาเลือกช่อง (Channel) สำหรับส่งข้อความต้อนรับก่อนกดทดสอบครับ!', ephemeral: true });
      }

      await interaction.reply({ content: `🔄 กำลังส่งข้อความทดสอบไปที่ห้อง <#${config.channelId}>...`, ephemeral: true });

      try {
        const channel = await interaction.guild.channels.fetch(config.channelId);
        if (channel) {
          const embedConfig = config.embed;
          const finalTitle = embedConfig.title ? embedConfig.title
            .replace('{user}', interaction.user.username)
            .replace('{server}', interaction.guild.name) : null;
          const finalDesc = embedConfig.description
            .replace('{user}', `${interaction.user}`)
            .replace('{server}', interaction.guild.name);

          let embedColor = '#66FFFF';
          try {
            embedColor = embedConfig.color;
          } catch (e) {
            embedColor = '#66FFFF';
          }

          const embed = new EmbedBuilder()
            .setDescription(finalDesc)
            .setColor(embedColor);

          if (finalTitle) {
            embed.setTitle(finalTitle);
          }

          if (embedConfig.image && embedConfig.image.trim() !== '') {
            embed.setImage(embedConfig.image.trim());
          }

          if (embedConfig.footerText && embedConfig.footerText.trim() !== '') {
            const memberCount = interaction.guild.memberCount.toString();
            const finalFooterText = embedConfig.footerText.replace('{server_membercount}', memberCount);
            
            if (embedConfig.footerIcon && embedConfig.footerIcon.trim() !== '') {
              embed.setFooter({ text: finalFooterText, iconURL: embedConfig.footerIcon.trim() });
            } else {
              embed.setFooter({ text: finalFooterText });
            }
          }

          if (embedConfig.timestamp && embedConfig.timestamp.toLowerCase() === 'yes') {
            embed.setTimestamp();
          }
          
          await channel.send({ embeds: [embed] });
        }
      } catch (err) {
        console.error('Test welcome send error:', err);
      }
      return;
    }

    if (interaction.customId === 'edit_embed') {
      const modal = new ModalBuilder()
        .setCustomId('editEmbedModal')
        .setTitle('Editing: welcome embed');

      const titleInput = new TextInputBuilder()
        .setCustomId('embedTitle')
        .setLabel('Title (เว้นว่างไว้ได้)')
        .setStyle(TextInputStyle.Short)
        .setValue(config.embed.title || '')
        .setRequired(false);

      const descInput = new TextInputBuilder()
        .setCustomId('embedDesc')
        .setLabel('Description')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(config.embed.description || '')
        .setRequired(true);

      const colorInput = new TextInputBuilder()
        .setCustomId('embedColor')
        .setLabel('Hex Color (เช่น 66FFFF)')
        .setStyle(TextInputStyle.Short)
        .setValue(config.embed.color || '#66FFFF')
        .setRequired(true);

      const imageInput = new TextInputBuilder()
        .setCustomId('embedImage')
        .setLabel('Image URL (ลิงก์รูปภาพ หรือเว้นว่าง)')
        .setStyle(TextInputStyle.Short)
        .setValue(config.embed.image || '')
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descInput),
        new ActionRowBuilder().addComponents(colorInput),
        new ActionRowBuilder().addComponents(imageInput),
      );

      return await interaction.showModal(modal);
    }

    if (interaction.customId === 'edit_footer') {
      const modal = new ModalBuilder()
        .setCustomId('editFooterModal')
        .setTitle('Editing: welcome footer');

      const footerTextInput = new TextInputBuilder()
        .setCustomId('embedFooterText')
        .setLabel('Footer Text')
        .setStyle(TextInputStyle.Short)
        .setValue(config.embed.footerText || '')
        .setRequired(false);

      const footerIconInput = new TextInputBuilder()
        .setCustomId('embedFooterIcon')
        .setLabel('Footer Image (optional)')
        .setStyle(TextInputStyle.Short)
        .setValue(config.embed.footerIcon || '')
        .setRequired(false);

      const timestampInput = new TextInputBuilder()
        .setCustomId('embedTimestamp')
        .setLabel('Timestamp? (yes/no)')
        .setStyle(TextInputStyle.Short)
        .setValue(config.embed.timestamp || 'no')
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(footerTextInput),
        new ActionRowBuilder().addComponents(footerIconInput),
        new ActionRowBuilder().addComponents(timestampInput),
      );

      return await interaction.showModal(modal);
    }
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'act_invite_select') {
      const vals = interaction.values;
      config.security.actions.invite.timeout = vals.includes('timeout');
      config.security.actions.invite.kick = vals.includes('kick');
      config.security.actions.invite.ban = vals.includes('ban');
      saveConfigs(serverConfigs);
      return await interaction.update(getSecurityDashboardContent(config));
    }
    if (interaction.customId === 'act_spam_select') {
      const vals = interaction.values;
      config.security.actions.spam.timeout = vals.includes('timeout');
      config.security.actions.spam.kick = vals.includes('kick');
      config.security.actions.spam.ban = vals.includes('ban');
      saveConfigs(serverConfigs);
      return await interaction.update(getSecurityDashboardContent(config));
    }
  }

  if (interaction.isChannelSelectMenu() && interaction.customId === 'select_channel') {
    await interaction.deferUpdate();
    config.channelId = interaction.values[0];
    saveConfigs(serverConfigs);
    return await updateDashboardAfterDefer(interaction);
  }

  if (interaction.isRoleSelectMenu() && interaction.customId === 'select_autorole') {
    await interaction.deferUpdate();
    config.autoroleId = interaction.values[0];
    saveConfigs(serverConfigs);
    return await updateAutoroleDashboardAfterDefer(interaction);
  }

  if (interaction.isChannelSelectMenu() && interaction.customId === 'sec_select_ignored') {
    await interaction.deferUpdate();
    config.security.ignoredChannels = interaction.values;
    saveConfigs(serverConfigs);
    return await interaction.editReply(getSecurityDashboardContent(config));
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'editEmbedModal') {
      config.embed.title = interaction.fields.getTextInputValue('embedTitle');
      config.embed.description = interaction.fields.getTextInputValue('embedDesc');
      
      let colorVal = interaction.fields.getTextInputValue('embedColor').trim();
      if (!colorVal.startsWith('#')) colorVal = '#' + colorVal;
      if (colorVal.length === 4) {
        colorVal = '#' + colorVal[1] + colorVal[1] + colorVal[2] + colorVal[2] + colorVal[3] + colorVal[3];
      }
      config.embed.color = colorVal;
      
      config.embed.image = interaction.fields.getTextInputValue('embedImage');
      saveConfigs(serverConfigs);

      return await interaction.reply({ content: '✅ บันทึกรูปแบบ Embed และรูปภาพเรียบร้อยแล้ว!', ephemeral: true });
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
});

function getDashboardContent(config) {
  const channelName = config.channelId ? `<#${config.channelId}>` : 'ยังไม่ได้เลือกช่อง';
  const statusText = config.welcomeEnabled ? '✅ เปิดอยู่' : '❌ ปิดอยู่';

  const embed = new EmbedBuilder()
    .setTitle('⚙️ ตั้งค่าระบบ Welcome')
    .setDescription('เลือกช่อง เปิด/ปิดระบบ และตั้งค่ารูป Embed ได้จากปุ่มด้านล่าง')
    .setColor('#5865F2')
    .addFields(
      { name: '📥 Welcome Status', value: statusText, inline: true },
      { name: '📢 ห้องต้อนรับ', value: channelName, inline: true }
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('toggle_welcome')
      .setLabel(config.welcomeEnabled ? 'ปิด Welcome' : 'เปิด Welcome')
      .setStyle(config.welcomeEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('edit_embed')
      .setLabel('ตั้งค่ารูป Embed')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('edit_footer')
      .setLabel('ตั้งค่า Footer')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('test_welcome')
      .setLabel('ทดสอบ Welcome')
      .setStyle(ButtonStyle.Secondary)
  );

  const channelRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('select_channel')
      .setPlaceholder('📂 เลือกช่องสำหรับส่งข้อความต้อนรับ')
      .addChannelTypes(ChannelType.GuildText)
  );

  return { embeds: [embed], components: [row1, channelRow] };
}

function getAutoroleDashboardContent(config) {
  const roleName = config.autoroleId ? `<@&${config.autoroleId}>` : 'ยังไม่ได้เลือกยศ';
  const statusText = config.autoroleEnabled ? '✅ เปิดอยู่' : '❌ ปิดอยู่';

  const embed = new EmbedBuilder()
    .setTitle('🛡️ ตั้งค่าระบบ Autorole (ยศอัตโนมัติ)')
    .setDescription('เลือกยศที่ต้องการแจกให้สมาชิกใหม่เมื่อเข้าเซิร์ฟเวอร์')
    .setColor('#5865F2')
    .addFields(
      { name: '📥 Autorole Status', value: statusText, inline: true },
      { name: '👑 ยศที่จะได้รับ', value: roleName, inline: true }
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('toggle_autorole')
      .setLabel(config.autoroleEnabled ? 'ปิด Autorole' : 'เปิด Autorole')
      .setStyle(config.autoroleEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
  );

  const roleRow = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('select_autorole')
      .setPlaceholder('👑 เลือกยศสำหรับแจกสมาชิกใหม่')
  );

  return { embeds: [embed], components: [row1, roleRow] };
}

async function sendDashboard(interaction) {
  const codeConfig = serverConfigs[interaction.guildId];
  const content = getDashboardContent(codeConfig);
  await interaction.reply({ ...content, ephemeral: true });
}

async function updateDashboard(interaction) {
  const codeConfig = serverConfigs[interaction.guildId];
  const content = getDashboardContent(codeConfig);
  await interaction.update({ ...content });
}

async function updateDashboardAfterDefer(interaction) {
  const codeConfig = serverConfigs[interaction.guildId];
  const content = getDashboardContent(codeConfig);
  await interaction.editReply({ ...content });
}

async function sendAutoroleDashboard(interaction) {
  const codeConfig = serverConfigs[interaction.guildId];
  const content = getAutoroleDashboardContent(codeConfig);
  await interaction.reply({ ...content, ephemeral: true });
}

async function updateAutoroleDashboard(interaction) {
  const codeConfig = serverConfigs[interaction.guildId];
  const content = getAutoroleDashboardContent(codeConfig);
  await interaction.update({ ...content });
}

async function updateAutoroleDashboardAfterDefer(interaction) {
  const codeConfig = serverConfigs[interaction.guildId];
  const content = getAutoroleDashboardContent(codeConfig);
  await interaction.editReply({ ...content });
}

client.login(process.env.DISCORD_TOKEN);
