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

// เก็บค่าการตั้งค่าแยกตามแต่ละเซิร์ฟเวอร์
const guildSettings = new Map();

function getSettings(guildId) {
  if (!guildSettings.has(guildId)) {
    guildSettings.set(guildId, {
      enabled: true,
      channelId: null,
      title: '✨· NEW Member!·✨',
      description: '「 🎉 ยินดีต้อนรับคุณ {user} ! \nรบกวนทำตามขั้นตอนด้านล่างนี้ก่อนไปสนุกกันนะครับ 」\n\nปล. ⚠️ | เมื่อกดรับยศเสร็จแล้วห้องพูดคุยจะปลดล็อกขึ้นมาให้ทันทีครับ !\n\n📜 | อ่านกฎที่นี่ # 📋 | rules',
      color: '#2f636',
      authorText: 'Welcome to {server_name}',
      authorIcon: '',
      footerText: 'สมาชิกคนที่ {server_membercount}',
      footerIcon: '',
      mainImage: '',
      thumbnail: '{user_avatar}'
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
      .setDescription('เปิดแผงควบคุมระบบต้อนรับ (Control Panel)'),
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

// ฟังก์ชันสร้างหน้าตาแผงควบคุม (Control Panel ตามเรฟ)
function getControlPanelComponents(guildId) {
  const settings = getSettings(guildId);
  const statusText = settings.enabled ? '🟢 เปิดอยู่' : '🔴 ปิดอยู่';
  const channelText = settings.channelId ? `<#${settings.channelId}>` : 'ยังไม่ได้เลือกห้อง';

  const embed = new EmbedBuilder()
    .setTitle('⚙️ ตั้งค่าระบบ Welcome (Zen Bot)')
    .setDescription(`เลือกห้อง เปิด/ปิดระบบ และตั้งค่ารูป Embed ได้จากปุ่มด้านล่าง\n\n**Welcome**\nสถานะ: ${statusText}\nห้อง: ${channelText}`)
    .setColor('#2f636');

  // แถวที่ 1: ปุ่มสถานะและทดสอบ
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

  // แถวที่ 2: ปุ่มแต่ง Embed แยกหมวดหมู่ (ตามเรฟของคุณ)
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('edit_basic')
      .setLabel('Edit Basic')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('edit_author')
      .setLabel('Edit Author')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('edit_footer')
      .setLabel('Edit Footer')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('edit_images')
      .setLabel('Edit Images')
      .setStyle(ButtonStyle.Secondary),
  );

  // แถวที่ 3: เมนูดรอปดาวน์เลือกห้อง
  const row3 = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('select_welcome_channel')
      .setPlaceholder('📂 เลือกห้อง Welcome')
      .addChannelTypes(ChannelType.GuildText)
  );

  return { embeds: [embed], components: [row1, row2, row3] };
}

// ฟังก์ชันสร้างตัวอย่าง Embed สำหรับส่งจริง
function buildWelcomeEmbed(member, settings) {
  const serverName = member.guild.name;
  const memberCount = member.guild.memberCount;
  const userAvatar = member.user.displayAvatarURL({ dynamic: true });

  const embed = new EmbedBuilder()
    .setColor(settings.color);

  if (settings.title) {
    embed.setTitle(settings.title.replace('{user}', member.user.username).replace('{server}', serverName));
  }
  if (settings.description) {
    embed.setDescription(settings.description.replace('{user}', `${member}`).replace('{server}', serverName));
  }
  if (settings.authorText) {
    const authorName = settings.authorText.replace('{server_name}', serverName);
    embed.setAuthor({ 
      name: authorName, 
      iconURL: settings.authorIcon ? settings.authorIcon.replace('{server_icon}', member.guild.iconURL() || '') : null 
    });
  }
  if (settings.footerText) {
    const footerName = settings.footerText.replace('{server_membercount}', memberCount);
    embed.setFooter({ text: footerName });
  }
  if (settings.thumbnail) {
    const thumbUrl = settings.thumbnail === '{user_avatar}' ? userAvatar : settings.thumbnail;
    embed.setThumbnail(thumbUrl);
  }
  if (settings.mainImage) {
    embed.setImage(settings.mainImage);
  }

  embed.setTimestamp();
  return embed;
}

// เมื่อมีสมาชิกใหม่เข้าเซิร์ฟเวอร์
client.on('guildMemberAdd', member => {
  const settings = getSettings(member.guild.id);
  if (!settings.enabled || !settings.channelId) return;

  const channel = member.guild.channels.cache.get(settings.channelId);
  if (!channel) return;

  const embed = buildWelcomeEmbed(member, settings);
  channel.send({ embeds: [embed] });
});

// จัดการการกดปุ่ม เมนู และฟอร์ม Modal
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
    // ปุ่มเปิด Modal แต่งแต่ละหมวดหมู่ตามเรฟ
    else if (interaction.customId === 'edit_basic') {
      const modal = new ModalBuilder().setCustomId('modal_basic').setTitle('Editing: Basic Info');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Title').setStyle(TextInputStyle.Short).setValue(settings.title).setRequired(false)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setValue(settings.description).setRequired(false)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('color').setLabel('Hex Color (เช่น #2f636)').setStyle(TextInputStyle.Short).setValue(settings.color).setRequired(true))
      );
      await interaction.showModal(modal);
    }
    else if (interaction.customId === 'edit_author') {
      const modal = new ModalBuilder().setCustomId('modal_author').setTitle('Editing: Author');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('authorText').setLabel('Author Text').setStyle(TextInputStyle.Short).setValue(settings.authorText).setRequired(false)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('authorIcon').setLabel('Author Icon URL (optional)').setStyle(TextInputStyle.Short).setValue(settings.authorIcon).setRequired(false))
      );
      await interaction.showModal(modal);
    }
    else if (interaction.customId === 'edit_footer') {
      const modal = new ModalBuilder().setCustomId('modal_footer').setTitle('Editing: Footer');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('footerText').setLabel('Footer Text').setStyle(TextInputStyle.Short).setValue(settings.footerText).setRequired(false))
      );
      await interaction.showModal(modal);
    }
    else if (interaction.customId === 'edit_images') {
      const modal = new ModalBuilder().setCustomId('modal_images').setTitle('Editing: Images');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('mainImage').setLabel('Main Image URL').setStyle(TextInputStyle.Short).setValue(settings.mainImage).setRequired(false)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('thumbnail').setLabel('Thumbnail ({user_avatar} หรือ URL)').setStyle(TextInputStyle.Short).setValue(settings.thumbnail).setRequired(false))
      );
      await interaction.showModal(modal);
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

  // รับค่าจากการ Submit Modal แต่ละหมวดหมู่
  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'modal_basic') {
      settings.title = interaction.fields.getTextInputValue('title');
      settings.description = interaction.fields.getTextInputValue('description');
      settings.color = interaction.fields.getTextInputValue('color');
    } else if (interaction.customId === 'modal_author') {
      settings.authorText = interaction.fields.getTextInputValue('authorText');
      settings.authorIcon = interaction.fields.getTextInputValue('authorIcon');
    } else if (interaction.customId === 'modal_footer') {
      settings.footerText = interaction.fields.getTextInputValue('footerText');
    } else if (interaction.customId === 'modal_images') {
      settings.mainImage = interaction.fields.getTextInputValue('mainImage');
      settings.thumbnail = interaction.fields.getTextInputValue('thumbnail');
    }

    await interaction.reply({ content: '✨ **บันทึกการตั้งค่า Embed เรียบร้อยแล้ว!**', ephemeral: true });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'ping') {
    await interaction.reply('Pong! 🏓 บอททำงานระบบ Slash Command ปกติบน Render ครับ 🚀');
  }
});

client.login(process.env.DISCORD_TOKEN);
