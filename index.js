const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, EmbedBuilder } = require('discord.js');
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running!\n');
});
server.listen(process.env.PORT || 3000);

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
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
      footerText: 'สมาชิกคนที่ {server_membercount}',
      thumbnail: '{user_avatar}',
      mainImage: ''
    });
  }
  return guildSettings.get(guildId);
}

client.once('ready', async () => {
  console.log(`Bot Online: ${client.user.tag}`);
  const commands = [
    new SlashCommandBuilder().setName('ping').setDescription('เช็กสถานะบอท'),
    new SlashCommandBuilder().setName('setwelcome').setDescription('เปิดแผงควบคุมระบบต้อนรับ'),
  ].map(c => c.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    for (const [guildId] of client.guilds.cache) {
      await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
    }
    console.log('ลงทะเบียนคำสั่งสำเร็จ!');
  } catch (error) {
    console.error(error);
  }
});

function getControlPanel(guildId) {
  const s = getSettings(guildId);
  const embed = new EmbedBuilder()
    .setTitle('⚙️ ตั้งค่าระบบ Welcome (Zen Bot)')
    .setDescription(`สถานะ: ${s.enabled ? '🟢 เปิดอยู่' : '🔴 ปิดอยู่'}\nห้อง: ${s.channelId ? `<#${s.channelId}>` : 'ยังไม่ได้เลือก'}`)
    .setColor('#2f636');

  // แถวที่ 1: ปุ่มเปิด/ปิด และทดสอบ
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('toggle').setLabel(s.enabled ? 'ปิด Welcome' : 'เปิด Welcome').setStyle(s.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('test').setLabel('ทดสอบ Welcome').setStyle(ButtonStyle.Primary),
  );

  // แถวที่ 2: ปุ่มแต่ง Basic กับ Author
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('edit_basic').setLabel('Edit Basic').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('edit_author').setLabel('Edit Author').setStyle(ButtonStyle.Secondary),
  );

  // แถวที่ 3: ปุ่มแต่ง Footer กับ Images
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('edit_footer').setLabel('Edit Footer').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('edit_images').setLabel('Edit Images').setStyle(ButtonStyle.Secondary),
  );

  // แถวที่ 4: เมนูดรอปดาวน์เลือกห้อง
  const row4 = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder().setCustomId('select_channel').setPlaceholder('📂 เลือกห้อง Welcome').addChannelTypes(ChannelType.GuildText)
  );

  return { embeds: [embed], components: [row1, row2, row3, row4] };
}

function buildEmbed(member, s) {
  const embed = new EmbedBuilder().setColor(s.color);
  if (s.title) embed.setTitle(s.title.replace('{user}', member.user.username).replace('{server}', member.guild.name));
  if (s.description) embed.setDescription(s.description.replace('{user}', `${member}`).replace('{server}', member.guild.name));
  if (s.authorText) embed.setAuthor({ name: s.authorText.replace('{server_name}', member.guild.name) });
  if (s.footerText) embed.setFooter({ text: s.footerText.replace('{server_membercount}', member.guild.memberCount) });
  if (s.thumbnail) embed.setThumbnail(s.thumbnail === '{user_avatar}' ? member.user.displayAvatarURL({ dynamic: true }) : s.thumbnail);
  if (s.mainImage) embed.setImage(s.mainImage);
  embed.setTimestamp();
  return embed;
}

client.on('guildMemberAdd', member => {
  const s = getSettings(member.guild.id);
  if (!s.enabled || !s.channelId) return;
  const channel = member.guild.channels.cache.get(s.channelId);
  if (!channel) return;
  channel.send({ embeds: [buildEmbed(member, s)] });
});

client.on('interactionCreate', async interaction => {
  if (!interaction.guild) return;
  const s = getSettings(interaction.guild.id);

  if (interaction.isChatInputCommand() && interaction.commandName === 'setwelcome') {
    if (!interaction.member.permissions.has('Administrator')) return interaction.reply({ content: '❌ ไม่มีสิทธิ์', ephemeral: true });
    return interaction.reply({ ...getControlPanel(interaction.guild.id), ephemeral: true });
  }

  if (interaction.isButton()) {
    if (!interaction.member.permissions.has('Administrator')) return interaction.reply({ content: '❌ ไม่มีสิทธิ์', ephemeral: true });
    
    if (interaction.customId === 'toggle') {
      s.enabled = !s.enabled;
      return interaction.update(getControlPanel(interaction.guild.id));
    }
    if (interaction.customId === 'test') {
      if (!s.channelId) return interaction.reply({ content: '⚠️ กรุณาเลือกห้องก่อน!', ephemeral: true });
      const channel = interaction.guild.channels.cache.get(s.channelId);
      if (!channel) return interaction.reply({ content: '❌ ไม่พบห้อง', ephemeral: true });
      await channel.send({ content: '🧪 **[ทดสอบ]**', embeds: [buildEmbed(interaction.member, s)] });
      return interaction.reply({ content: '✅ ส่งข้อความทดสอบแล้ว!', ephemeral: true });
    }

    if (interaction.customId === 'edit_basic') {
      const modal = new ModalBuilder().setCustomId('m_basic').setTitle('Editing: Basic Info');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t').setLabel('Title').setStyle(TextInputStyle.Short).setValue(s.title).setRequired(false)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('d').setLabel('Description').setStyle(TextInputStyle.Paragraph).setValue(s.description).setRequired(false)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c').setLabel('Hex Color').setStyle(TextInputStyle.Short).setValue(s.color).setRequired(true))
      );
      return interaction.showModal(modal);
    }
    if (interaction.customId === 'edit_author') {
      const modal = new ModalBuilder().setCustomId('m_author').setTitle('Editing: Author');
      modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('at').setLabel('Author Text').setStyle(TextInputStyle.Short).setValue(s.authorText).setRequired(false)));
      return interaction.showModal(modal);
    }
    if (interaction.customId === 'edit_footer') {
      const modal = new ModalBuilder().setCustomId('m_footer').setTitle('Editing: Footer');
      modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ft').setLabel('Footer Text').setStyle(TextInputStyle.Short).setValue(s.footerText).setRequired(false)));
      return interaction.showModal(modal);
    }
    if (interaction.customId === 'edit_images') {
      const modal = new ModalBuilder().setCustomId('m_images').setTitle('Editing: Images');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('mi').setLabel('Main Image URL').setStyle(TextInputStyle.Short).setValue(s.mainImage).setRequired(false)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('th').setLabel('Thumbnail').setStyle(TextInputStyle.Short).setValue(s.thumbnail).setRequired(false))
      );
      return interaction.showModal(modal);
    }
  }

  if (interaction.isChannelSelectMenu() && interaction.customId === 'select_channel') {
    s.channelId = interaction.values[0];
    return interaction.update(getControlPanel(interaction.guild.id));
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'm_basic') {
      s.title = interaction.fields.getTextInputValue('t');
      s.description = interaction.fields.getTextInputValue('d');
      s.color = interaction.fields.getTextInputValue('c');
    } else if (interaction.customId === 'm_author') {
      s.authorText = interaction.fields.getTextInputValue('at');
    } else if (interaction.customId === 'm_footer') {
      s.footerText = interaction.fields.getTextInputValue('ft');
    } else if (interaction.customId === 'm_images') {
      s.mainImage = interaction.fields.getTextInputValue('mi');
      s.thumbnail = interaction.fields.getTextInputValue('th');
    }
    return interaction.reply({ content: '✨ **บันทึกสำเร็จ!**', ephemeral: true });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'ping') {
    return interaction.reply('Pong! 🚀');
  }
});

client.login(process.env.DISCORD_TOKEN);
');
      settings.thumbnail = interaction.fields.getTextInputValue('thumbnail');
    }

    await interaction.reply({ content: '✨ **บันทึกการตั้งค่า Embed เรียบร้อยแล้ว!**', ephemeral: true });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'ping') {
    await interaction.reply('Pong! 🏓 บอททำงานระบบ Slash Command ปกติบน Render ครับ 🚀');
  }
});

client.login(process.env.DISCORD_TOKEN);
