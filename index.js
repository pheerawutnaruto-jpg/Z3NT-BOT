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

const guildSettings = new Map();

function getSettings(guildId) {
  if (!guildSettings.has(guildId)) {
    guildSettings.set(guildId, {
      enabled: true,
      channelId: null,
      roleId: null,
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
  const roleText = settings.roleId ? `<@&${settings.roleId}>` : 'ยังไม่ได้เลือกยศ';

  const embed = new EmbedBuilder()
    .setTitle('⚙️ ตั้งค่าระบบ Welcome (Zen Bot)')
    .setDescription(`เลือกห้อง เปิด/ปิดระบบ ตั้งค่า Embed และเลือกยศอัตโนมัติได้จากด้านล่าง\n\n**สถานะ:** ${statusText}\n**ห้องต้อนรับ:** ${channelText}\n**ยศอัตโนมัติ (Auto Role):** ${roleText}`)
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

  const row4 = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('select_autorole')
      .setPlaceholder('👑 เลือกยศแจกอัตโนมัติ (Auto Role)')
  );

  return { embeds: [embed], components: [row1, row2, row3, row4] };
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

  // ระบบแจกยศอัตโนมัติ (Auto Role)
  if (settings.roleId) {
    try {
      await member.roles.add(settings.roleId);
    } catch (err) {
      console.error('ไม่สามารถแจกยศอัตโนมัติได้ (กรุณาเช็กสิทธิ์บอทและลำดับยศ):', err);
    }
  }

  if (!settings.channelId) return;
  const channel = member.guild.channels.cache.get(settings.channelId);
  if (!channel) return;

  const embed = buildWelcomeEmbed(member, settings);
  channel.send({ embeds: [embed] });
});

client.on('interactionCreate', async interaction => {
  if (!interaction.guild) return;
  const settings = getSettings(interaction.guild.id);

  if (interaction.isChatInputCommand() && interaction.commandName === 'setwelcome') {
    if (!interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้งานคำสั่งนี้', ephemeral: true });
    }
    await interaction.reply({ ...getControlPanelComponents(interaction.guild.id), ephemeral: true });
  }

  if (interaction.isButton())
