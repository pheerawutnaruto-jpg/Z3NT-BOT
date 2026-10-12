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
    .replace
