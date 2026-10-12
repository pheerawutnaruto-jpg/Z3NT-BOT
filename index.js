const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType, EmbedBuilder } = require('discord.js');
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running!\n');
});
server.listen(process.env.PORT || 3000);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// เก็บข้อมูลตั้งค่าแยกตามแต่ละเซิร์ฟเวอร์ (Guild ID -> Settings)
const guildSettings = new Map();

function getSettings(guildId) {
  if (!guildSettings.has(guildId)) {
    guildSettings.set(guildId, {
      enabled: true,
      channelId: null,
      roleId: null,
      title: '💖 NEW Member! ✨',
      description: '「 🎉 ยินดีต้อนรับคุณ {user} ! 」',
      color: '#2f636'
    });
  }
  return guildSettings.get(guildId);
}

client.once('ready', async () => {
  console.log(`Bot Online แล้วจ้า: ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName('ping')
      .setDescription('เช็กความเร็วและสถานะของบอท'),
    new SlashCommandBuilder()
      .setName('setwelcome')
      .setDescription('เปิดแผงควบคุมระบบต้อนรับสมาชิกใหม่ (Control Panel)'),
  ].map(command => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    for (const [guildId] of client.guilds.cache) {
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, guildId),
        { body: commands },
      );
    }
    console.log('ลงทะเบียนคำสั่งสำเร็จเรียบร้อย!');
  } catch (error) {
    console.error(error);
  }
});

// ฟังก์ชันสร้างหน้าตาแผงควบคุมเฉพาะของแต่ละเซิร์ฟเวอร์
function getControlPanelComponents(guildId) {
  const settings = getSettings(guildId);
  const statusText = settings.enabled ? '🟢 เปิดอยู่' : '🔴 ปิดอยู่';
  const channelText = settings.channelId ? `<#${settings.channelId}>` : 'ยังไม่ได้เลือกห้อง';
  const roleText = settings.roleId ? `<@&${settings.roleId}>` : 'ยังไม่ได้เลือกยศ';

  const embed = new EmbedBuilder()
    .setTitle('⚙️ ตั้งค่าระบบ Welcome (Zen Bot)')
    .setDescription(`เลือกห้อง เปิด/ปิดระบบ ตั้งค่า Embed และยศต้อนรับอัตโนมัติได้จากด้านล่าง\n\n**สถานะ:** ${statusText}\n**ห้องต้อนรับ:** ${channelText}\n**ยศอัตโนมัติ (Auto Role):** ${roleText}`)
    .setColor('#2f636');

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('toggle_welcome')
      .setLabel(settings.enabled ? 'ปิด Welcome' : 'เปิด Welcome')
      .setStyle(settings.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('edit_embed')
      .setLabel('ตั้งค่า Embed')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('test_welcome')
      .setLabel('ทดสอบ Welcome')
      .setStyle(ButtonStyle.Primary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('select_welcome_channel')
      .setPlaceholder('📂 เลือกห้องส่งข้อความต้อนรับ')
      .addChannelTypes(ChannelType.GuildText)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('select_autorole')
      .setPlaceholder('👑 เลือกยศที่จะแจกให้อัตโนมัติ')
  );

  return { embeds: [embed], components: [row1, row2, row3] };
}

// ระบบต้อนรับสมาชิกใหม่ + แจกยศอัตโนมัติ
client.on('guildMemberAdd', async member => {
  const settings = getSettings(member.guild.id);
  if (!settings.enabled) return;

  // 1. แจกยศอัตโนมัติ (ถ้ามีการตั้งค่าไว้)
  if (settings.roleId) {
    try {
      await member.roles.add(settings.roleId);
    } catch (err) {
      console.error('ไม่สามารถแจกยศอัตโนมัติได้ (กรุณาเช็กสิทธิ์บอท):', err);
    }
  }

  // 2. ส่งข้อความต้อนรับ Embed
  if (!settings.channelId) return;
  const channel = member.guild.channels.cache.get(settings.channelId);
  if (!channel) return;

  const finalTitle = settings.title.replace('{user}', member.user.username).replace('{server}', member.guild.name);
  const finalDesc = settings.description.replace('{user}', `${member}`).replace('{server}`, member.guild.name);

  const embed = new EmbedBuilder()
    .setTitle(finalTitle)
    .setDescription(finalDesc)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true })) // แนบรูปโปรไฟล์สมาชิกใหม่
    .setColor(settings.color)
    .setTimestamp();

  channel.send({ embeds: [embed] });
});

// จัดการปุ่ม เมนู และคำสั่ง
client.on('interactionCreate', async interaction => {
  if (!interaction.guild) return;
  const settings = getSettings(interaction.guild.id);

  if (interaction.isChatInputCommand() && interaction.commandName === 'setwelcome') {
    if (!interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้งานคำสั่งนี้', ephemeral: true });
    }
    await interaction.reply({ ...getControlPanelComponents(interaction.guild.id), ephemeral: true });
  }

  if (interaction.isButton()) {
    if (!interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: '❌ คุณไม่มีสิทธิ์กดปุ่มนี้', ephemeral: true });
    }

    if (interaction.customId === 'toggle_welcome') {
      settings.enabled = !settings.enabled;
      await interaction.update(getControlPanelComponents(interaction.guild.id));
    } 
    else if (interaction.customId === 'edit_embed') {
      const modal = new ModalBuilder()
        .setCustomId('edit_welcome_modal')
        .setTitle('Editing: welcome embed');

      const titleInput = new TextInputBuilder()
        .setCustomId('modal_title')
        .setLabel('Title')
        .setStyle(TextInputStyle.Short)
        .setValue(settings.title)
        .setRequired(true);

      const descInput = new TextInputBuilder()
        .setCustomId('modal_desc')
        .setLabel('Description')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(settings.description)
        .setRequired(true);

      const colorInput = new TextInputBuilder()
        .setCustomId('modal_color')
        .setLabel('Hex Color (เช่น #2f636)')
        .setStyle(TextInputStyle.Short)
        .setValue(settings.color)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descInput),
        new ActionRowBuilder().addComponents(colorInput),
      );

      await interaction.showModal(modal);
    }
    else if (interaction.customId === 'test_welcome') {
      if (!settings.channelId) {
        return await interaction.reply({ content: '⚠️ กรุณาเลือกห้อง Welcome ก่อนทดสอบครับ!', ephemeral: true });
      }
      const channel = interaction.guild.channels.cache.get(settings.channelId);
      if (!channel) {
        return await interaction.reply({ content: '❌ ไม่พบห้องที่ตั้งไว้', ephemeral: true });
      }

      const finalTitle = settings.title.replace('{user}', interaction.user.username).replace('{server}', interaction.guild.name);
      const finalDesc = settings.description.replace('{user}', `${interaction.member}`).replace('{server}`, interaction.guild.name);

      const testEmbed = new EmbedBuilder()
        .setTitle(finalTitle)
        .setDescription(finalDesc)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setColor(settings.color)
        .setTimestamp();

      await channel.send({ content: '🧪 **[ทดสอบระบบ Welcome]**', embeds: [testEmbed] });
      await interaction.reply({ content: '✅ ส่งข้อความทดสอบไปที่ห้องเรียบร้อยแล้ว!', ephemeral: true });
    }
  }

  // เลือกห้องจากเมนูดรอปดาวน์
  if (interaction.isChannelSelectMenu() && interaction.customId === 'select_welcome_channel') {
    if (!interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: '❌ คุณไม่มีสิทธิ์เลือกห้องนี้', ephemeral: true });
    }
    settings.channelId = interaction.values[0];
    await interaction.update(getControlPanelComponents(interaction.guild.id));
  }

  // เลือกยศอัตโนมัติจากเมนูดรอปดาวน์
  if (interaction.isRoleSelectMenu() && interaction.customId === 'select_autorole') {
    if (!interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: '❌ คุณไม่มีสิทธิ์เลือกยศนี้', ephemeral: true });
    }
    settings.roleId = interaction.values[0];
    await interaction.update(getControlPanelComponents(interaction.guild.id));
  }

  // บันทึกฟอร์ม Modal แต่ง Embed
  if (interaction.isModalSubmit() && interaction.customId === 'edit_welcome_modal') {
    settings.title = interaction.fields.getTextInputValue('modal_title');
    settings.description = interaction.fields.getTextInputValue('modal_desc');
    settings.color = interaction.fields.getTextInputValue('modal_color');

    await interaction.reply({ content: '✨ **อัปเดตหน้าตา Embed เรียบร้อยแล้ว!**', ephemeral: true });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'ping') {
    await interaction.reply('Pong! 🏓 บอททำงานระบบ Slash Command ปกติบน Render ครับ 🚀');
  }
});

client.login(process.env.DISCORD_TOKEN);
