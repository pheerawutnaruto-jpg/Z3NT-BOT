const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, EmbedBuilder } = require('discord.js');
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

const guildSettings = new Map();

function getSettings(guildId) {
  if (!guildSettings.has(guildId)) {
    guildSettings.set(guildId, {
      enabled: true,
      channelId: null,
      title: '✨· NEW Member!·✨',
      description: '「 🎉 ยินดีต้อนรับคุณ {user} ! 」',
      color: '#2f636',
      authorText: 'Welcome to {server_name}',
      authorIcon: '',
      footerText: 'สมาชิกคนที่ {server_membercount}',
      footerIcon: '',
      mainImage: '',
      useThumbnail: true,
      useTimestamp: false
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

function getControlPanelComponents(guildId) {
  const settings = getSettings(guildId);
  const statusText = settings.enabled ? '🟢 เปิดอยู่' : '🔴 ปิดอยู่';
  const channelText = settings.channelId ? `<#${settings.channelId}>` : 'ยังไม่ได้เลือกห้อง';

  const embed = new EmbedBuilder()
    .setTitle('⚙️ ตั้งค่าระบบ Welcome (Zen Bot)')
    .setDescription(`เลือกห้อง เปิด/ปิดระบบ และกดปุ่มหมวดหมู่ด้านล่างเพื่อปรับแต่งหน้าตา Embed ได้เลยครับ\n\n**สถานะ:** ${statusText}\n**ห้องต้อนรับ:** ${channelText}`)
    .setColor('#2f636');

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('toggle_welcome')
      .setLabel(settings.enabled ? 'ปิด Welcome' : 'เปิด Welcome')
      .setStyle(settings.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('test_welcome')
      .setLabel('ทดสอบ Welcome')
      .setStyle(ButtonStyle.Primary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('edit_basic').setLabel('Edit Basic Info').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('edit_author').setLabel('Edit Author').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('edit_footer').setLabel('Edit Footer').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('edit_images').setLabel('Edit Images').setStyle(ButtonStyle.Secondary),
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('select_welcome_channel')
      .setPlaceholder('📂 เลือกห้องส่งข้อความต้อนรับ')
      .addChannelTypes(ChannelType.GuildText)
  );

  return { embeds: [embed], components: [row1, row2, row3] };
}

function buildWelcomeEmbed(member, settings) {
  const serverName = member.guild.name;
  const memberCount = member.guild.memberCount;
  const userAvatar = member.user.displayAvatarURL({ dynamic: true });

  const finalTitle = settings.title
    .replace('{user}', member.user.username)
    .replace('{server_name}', serverName);

  const finalDesc = settings.description
    .replace('{user}', `${member}`)
    .replace('{server_name}', serverName)
    .replace('{server_membercount}', memberCount);

  const embed = new EmbedBuilder()
    .setTitle(finalTitle)
    .setDescription(finalDesc)
    .setColor(settings.color || '#2f636');

  if (settings.authorText) {
    embed.setAuthor({ 
      name: settings.authorText.replace('{server_name}', serverName), 
      iconURL: settings.authorIcon || undefined 
    });
  }

  if (settings.footerText) {
    embed.setFooter({ 
      text: settings.footerText.replace('{server_membercount}', memberCount).replace('{server_name}', serverName), 
      iconURL: settings.footerIcon || undefined 
    });
  }

  if (settings.useThumbnail) {
    embed.setThumbnail(userAvatar);
  }

  if (settings.mainImage) {
    embed.setImage(settings.mainImage);
  }

  if (settings.useTimestamp) {
    embed.setTimestamp();
  }

  return embed;
}

client.on('guildMemberAdd', async member => {
  const settings = getSettings(member.guild.id);
  if (!settings.enabled) return;

  if (!settings.channelId) return;
  const channel = member.guild.channels.cache.get(settings.channelId);
  if (!channel) return;

  const embed = buildWelcomeEmbed(member, settings);
  channel.send({ embeds: [embed] });
});

client.on('interactionCreate', async interaction => {
  if (!interaction.guild) return;
  const settings = getSettings(interaction.guild.id);

  // แก้ไขจุดรับคำสั่ง /setwelcome ให้ตอบรับทันทีเพื่อป้องกัน Timeout
  if (interaction.isChatInputCommand() && interaction.commandName === 'setwelcome') {
    if (!interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้งานคำสั่งนี้', ephemeral: true });
    }
    await interaction.deferReply({ ephemeral: true });
    return await interaction.editReply(getControlPanelComponents(interaction.guild.id));
  }

  if (interaction.isButton()) {
    if (!interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: '❌ คุณไม่มีสิทธิ์กดปุ่มนี้', ephemeral: true });
    }

    if (interaction.customId === 'toggle_welcome') {
      settings.enabled = !settings.enabled;
      await interaction.update(getControlPanelComponents(interaction.guild.id));
    } 
    else if (interaction.customId === 'test_welcome') {
      if (!settings.channelId) {
        return await interaction.reply({ content: '⚠️ กรุณาเลือกห้อง Welcome ก่อนทดสอบครับ!', ephemeral: true });
      }
      const channel = interaction.guild.channels.cache.get(settings.channelId);
      if (!channel) {
        return await interaction.reply({ content: '❌ ไม่พบห้องที่ตั้งไว้', ephemeral: true });
      }

      const testEmbed = buildWelcomeEmbed(interaction.member, settings);
      await channel.send({ content: '🧪 **[ทดสอบระบบ Welcome]**', embeds: [testEmbed] });
      await interaction.reply({ content: '✅ ส่งข้อความทดสอบไปที่ห้องเรียบร้อยแล้ว!', ephemeral: true });
    }
    else if (interaction.customId === 'edit_basic') {
      const modal = new ModalBuilder().setCustomId('modal_edit_basic').setTitle('Edit Basic Information');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Title').setStyle(TextInputStyle.Short).setValue(settings.title).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setValue(settings.description).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('color').setLabel('Hex Color (เช่น #2f636)').setStyle(TextInputStyle.Short).setValue(settings.color).setRequired(true))
      );
      await interaction.showModal(modal);
    }
    else if (interaction.customId === 'edit_author') {
      const modal = new ModalBuilder().setCustomId('modal_edit_author').setTitle('Edit Author');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('authorText').setLabel('Author Text').setStyle(TextInputStyle.Short).setValue(settings.authorText).setRequired(false)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('authorIcon').setLabel('Author Icon URL (optional)').setStyle(TextInputStyle.Short).setValue(settings.authorIcon).setRequired(false))
      );
      await interaction.showModal(modal);
    }
    else if (interaction.customId === 'edit_footer') {
      const modal = new ModalBuilder().setCustomId('modal_edit_footer').setTitle('Edit Footer');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('footerText').setLabel('Footer Text').setStyle(TextInputStyle.Short).setValue(settings.footerText).setRequired(false)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('timestamp').setLabel('Timestamp? (yes/no)').setStyle(TextInputStyle.Short).setValue(settings.useTimestamp ? 'yes' : 'no').setRequired(true))
      );
      await interaction.showModal(modal);
    }
    else if (interaction.customId === 'edit_images') {
      const modal = new ModalBuilder().setCustomId('modal_edit_images').setTitle('Edit Images');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('mainImage').setLabel('Main Image URL (optional)').setStyle(TextInputStyle.Short).setValue(settings.mainImage).setRequired(false)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('thumbnail').setLabel('Use User Avatar Thumbnail? (yes/no)').setStyle(TextInputStyle.Short).setValue(settings.useThumbnail ? 'yes' : 'no').setRequired(true))
      );
      await interaction.showModal(modal);
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'modal_edit_basic') {
      settings.title = interaction.fields.getTextInputValue('title');
      settings.description = interaction.fields.getTextInputValue('description');
      settings.color = interaction.fields.getTextInputValue('color');
      await interaction.reply({ content: '✨ อัปเดต Basic Information เรียบร้อย!', ephemeral: true });
    } 
    else if (interaction.customId === 'modal_edit_author') {
      settings.authorText = interaction.fields.getTextInputValue('authorText');
      settings.authorIcon = interaction.fields.getTextInputValue('authorIcon');
      await interaction.reply({ content: '✨ อัปเดต Author เรียบร้อย!', ephemeral: true });
    } 
    else if (interaction.customId === 'modal_edit_footer') {
      settings.footerText = interaction.fields.getTextInputValue('footerText');
      const ts = interaction.fields.getTextInputValue('timestamp').toLowerCase();
      settings.useTimestamp = (ts === 'yes' || ts === 'y' || ts === 'true');
      await interaction.reply({ content: '✨ อัปเดต Footer เรียบร้อย!', ephemeral: true });
    } 
    else if (interaction.customId === 'modal_edit_images') {
      settings.mainImage = interaction.fields.getTextInputValue('mainImage');
      const thumb = interaction.fields.getTextInputValue('thumbnail').toLowerCase();
      settings.useThumbnail = (thumb === 'yes' || thumb === 'y' || thumb === 'true');
      await interaction.reply({ content: '✨ อัปเดต Images เรียบร้อย!', ephemeral: true });
    }
  }

  if (interaction.isChannelSelectMenu() && interaction.customId === 'select_welcome_channel') {
    if (!interaction.member.permissions.has('Administrator')) return;
    settings.channelId = interaction.values[0];
    await interaction.update(getControlPanelComponents(interaction.guild.id));
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'ping') {
    await interaction.reply('Pong! 🏓 บอททำงานระบบ Slash Command ปกติบน Render ครับ 🚀');
  }
});

client.login(process.env.DISCORD_TOKEN);
