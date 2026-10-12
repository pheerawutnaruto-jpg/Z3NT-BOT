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

// ข้อมูลการตั้งค่าระบบ Welcome และ Goodbye
let welcomeConfig = {
  enabled: true,
  channelId: null,
  title: '💖 NEW Member! ✨',
  description: '「 🎉 ยินดีต้อนรับคุณ {user} ! 」',
  color: '#2f636',
  image: '' // ลิงก์รูปภาพต้อนรับ (ถ้ามี)
};

let goodbyeConfig = {
  enabled: true,
  channelId: null,
  title: '👋 Goodbye Member...',
  description: '「 ขอให้โชคดีนะคุณ {user} 👋 」',
  color: '#ed4245'
};

client.once('ready', async () => {
  console.log(`Bot Online แล้วจ้า: ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName('ping')
      .setDescription('เช็กความเร็วและสถานะของบอท'),
    new SlashCommandBuilder()
      .setName('setwelcome')
      .setDescription('เปิดแผงควบคุมระบบ Welcome และ Goodbye'),
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

// ฟังก์ชันสร้างหน้าตาแผงควบคุม (Control Panel) แบบครบเครื่อง
function getControlPanelComponents() {
  const wStatus = welcomeConfig.enabled ? '🟢 เปิดอยู่' : '🔴 ปิดอยู่';
  const wChan = welcomeConfig.channelId ? `<#${welcomeConfig.channelId}>` : 'ยังไม่ได้เลือกห้อง';
  
  const gStatus = goodbyeConfig.enabled ? '🟢 เปิดอยู่' : '🔴 ปิดอยู่';
  const gChan = goodbyeConfig.channelId ? `<#${goodbyeConfig.channelId}>` : 'ยังไม่ได้เลือกห้อง';

  const embed = new EmbedBuilder()
    .setTitle('⚙️ ตั้งค่าระบบ Welcome / Goodbye')
    .setDescription(`เลือกห้อง เปิด/ปิดระบบ และตั้งค่า Embed ได้จากปุ่มด้านล่าง\n\n**Welcome**\nสถานะ: ${wStatus} \vert{} ห้อง: ${wChan}\n\n**Goodbye**\nสถานะ: ${gStatus} \vert{} ห้อง: ${gChan}`)
    .setColor('#2f636');

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('toggle_welcome')
      .setLabel(welcomeConfig.enabled ? 'ปิด Welcome' : 'เปิด Welcome')
      .setStyle(welcomeConfig.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('toggle_goodbye')
      .setLabel(goodbyeConfig.enabled ? 'ปิด Goodbye' : 'เปิด Goodbye')
      .setStyle(goodbyeConfig.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('edit_embed')
      .setLabel('ตั้งค่ารูป/Embed Welcome')
      .setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('test_welcome')
      .setLabel('ทดสอบ Welcome')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('test_goodbye')
      .setLabel('ทดสอบ Goodbye')
      .setStyle(ButtonStyle.Primary),
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('select_welcome_channel')
      .setPlaceholder('📂 เลือกห้อง Welcome')
      .addChannelTypes(ChannelType.GuildText)
  );

  const row4 = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('select_goodbye_channel')
      .setPlaceholder('📂 เลือกห้อง Goodbye')
      .addChannelTypes(ChannelType.GuildText)
  );

  return { embeds: [embed], components: [row1, row2, row3, row4] };
}

// 1. ระบบต้อนรับสมาชิกใหม่
client.on('guildMemberAdd', member => {
  if (!welcomeConfig.enabled || !welcomeConfig.channelId) return;
  const channel = member.guild.channels.cache.get(welcomeConfig.channelId);
  if (!channel) return;

  const finalTitle = welcomeConfig.title.replace('{user}', member.user.username).replace('{server}', member.guild.name);
  const finalDesc = welcomeConfig.description.replace('{user}', `${member}`).replace('{server}', member.guild.name);

  const embed = new EmbedBuilder()
    .setTitle(finalTitle)
    .setDescription(finalDesc)
    .setColor(welcomeConfig.color)
    .setTimestamp();

  if (welcomeConfig.image && welcomeConfig.image.startsWith('http')) {
    embed.setImage(welcomeConfig.image);
  }

  channel.send({ embeds: [embed] });
});

// 2. ระบบอำลาสมาชิก (Goodbye)
client.on('guildMemberRemove', member => {
  if (!goodbyeConfig.enabled || !goodbyeConfig.channelId) return;
  const channel = member.guild.channels.cache.get(goodbyeConfig.channelId);
  if (!channel) return;

  const finalTitle = goodbyeConfig.title.replace('{user}', member.user.username).replace('{server}', member.guild.name);
  const finalDesc = goodbyeConfig.description.replace('{user}', member.user.username).replace('{server}', member.guild.name);

  const embed = new EmbedBuilder()
    .setTitle(finalTitle)
    .setDescription(finalDesc)
    .setColor(goodbyeConfig.color)
    .setTimestamp();

  channel.send({ embeds: [embed] });
});

// จัดการปุ่ม เมนู และคำสั่ง
client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand() && interaction.commandName === 'setwelcome') {
    if (!interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้งานคำสั่งนี้', ephemeral: true });
    }
    await interaction.reply({ ...getControlPanelComponents(), ephemeral: true });
  }

  if (interaction.isButton()) {
    if (!interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: '❌ คุณไม่มีสิทธิ์กดปุ่มนี้', ephemeral: true });
    }

    if (interaction.customId === 'toggle_welcome') {
      welcomeConfig.enabled = !welcomeConfig.enabled;
      await interaction.update(getControlPanelComponents());
    } 
    else if (interaction.customId === 'toggle_goodbye') {
      goodbyeConfig.enabled = !goodbyeConfig.enabled;
      await interaction.update(getControlPanelComponents());
    }
    else if (interaction.customId === 'edit_embed') {
      const modal = new ModalBuilder()
        .setCustomId('edit_welcome_modal')
        .setTitle('Editing: Welcome Embed & Image');

      const titleInput = new TextInputBuilder()
        .setCustomId('modal_title')
        .setLabel('Title')
        .setStyle(TextInputStyle.Short)
        .setValue(welcomeConfig.title)
        .setRequired(true);

      const descInput = new TextInputBuilder()
        .setCustomId('modal_desc')
        .setLabel('Description')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(welcomeConfig.description)
        .setRequired(true);

      const colorInput = new TextInputBuilder()
        .setCustomId('modal_color')
        .setLabel('Hex Color (เช่น #2f636)')
        .setStyle(TextInputStyle.Short)
        .setValue(welcomeConfig.color)
        .setRequired(true);

      const imageInput = new TextInputBuilder()
        .setCustomId('modal_image')
        .setLabel('Image URL (ลิงก์รูปภาพแบนเนอร์ ถ้ามี)')
        .setStyle(TextInputStyle.Short)
        .setValue(welcomeConfig.image || '')
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descInput),
        new ActionRowBuilder().addComponents(colorInput),
        new ActionRowBuilder().addComponents(imageInput),
      );

      await interaction.showModal(modal);
    }
    else if (interaction.customId === 'test_welcome') {
      if (!welcomeConfig.channelId) {
        return await interaction.reply({ content: '⚠️ กรุณาเลือกห้อง Welcome ก่อนทดสอบ!', ephemeral: true });
      }
      const channel = interaction.guild.channels.cache.get(welcomeConfig.channelId);
      if (!channel) return await interaction.reply({ content: '❌ ไม่พบห้องที่ตั้งไว้', ephemeral: true });

      const finalTitle = welcomeConfig.title.replace('{user}', interaction.user.username).replace('{server}', interaction.guild.name);
      const finalDesc = welcomeConfig.description.replace('{user}', `${interaction.member}`).replace('{server}`, interaction.guild.name);

      const testEmbed = new EmbedBuilder()
        .setTitle(finalTitle)
        .setDescription(finalDesc)
        .setColor(welcomeConfig.color)
        .setTimestamp();

      if (welcomeConfig.image && welcomeConfig.image.startsWith('http')) {
        testEmbed.setImage(welcomeConfig.image);
      }

      await channel.send({ content: '🧪 **[ทดสอบระบบ Welcome]**', embeds: [testEmbed] });
      await interaction.reply({ content: '✅ ส่งข้อความทดสอบ Welcome ไปที่ห้องเรียบร้อย!', ephemeral: true });
    }
    else if (interaction.customId === 'test_goodbye') {
      if (!goodbyeConfig.channelId) {
        return await interaction.reply({ content: '⚠️ กรุณาเลือกห้อง Goodbye ก่อนทดสอบ!', ephemeral: true });
      }
      const channel = interaction.guild.channels.cache.get(goodbyeConfig.channelId);
      if (!channel) return await interaction.reply({ content: '❌ ไม่พบห้องที่ตั้งไว้', ephemeral: true });

      const finalTitle = goodbyeConfig.title.replace('{user}', interaction.user.username).replace('{server}', interaction.guild.name);
      const finalDesc = goodbyeConfig.description.replace('{user}', interaction.user.username).replace('{server}', interaction.guild.name);

      const testEmbed = new EmbedBuilder()
        .setTitle(finalTitle)
        .setDescription(finalDesc)
        .setColor(goodbyeConfig.color)
        .setTimestamp();

      await channel.send({ content: '🧪 **[ทดสอบระบบ Goodbye]**', embeds: [testEmbed] });
      await interaction.reply({ content: '✅ ส่งข้อความทดสอบ Goodbye ไปที่ห้องเรียบร้อย!', ephemeral: true });
    }
  }

  // เลือกห้อง Welcome
  if (interaction.isChannelSelectMenu() && interaction.customId === 'select_welcome_channel') {
    if (!interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: '❌ คุณไม่มีสิทธิ์เลือกห้องนี้', ephemeral: true });
    }
    welcomeConfig.channelId = interaction.values[0];
    await interaction.update(getControlPanelComponents());
  }

  // เลือกห้อง Goodbye
  if (interaction.isChannelSelectMenu() && interaction.customId === 'select_goodbye_channel') {
    if (!interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: '❌ คุณไม่มีสิทธิ์เลือกห้องนี้', ephemeral: true });
    }
    goodbyeConfig.channelId = interaction.values[0];
    await interaction.update(getControlPanelComponents());
  }

  // บันทึกฟอร์ม Modal ตั้งค่า Embed และ Image URL
  if (interaction.isModalSubmit() && interaction.customId === 'edit_welcome_modal') {
    welcomeConfig.title = interaction.fields.getTextInputValue('modal_title');
    welcomeConfig.description = interaction.fields.getTextInputValue('modal_desc');
    welcomeConfig.color = interaction.fields.getTextInputValue('modal_color');
    welcomeConfig.image = interaction.fields.getTextInputValue('modal_image');

    await interaction.reply({ content: '✨ **อัปเดตหน้าตา Embed และรูปภาพต้อนรับเรียบร้อยแล้ว!**', ephemeral: true });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'ping') {
    await interaction.reply('Pong! 🏓 บอททำงานระบบ Slash Command ปกติบน Render ครับ 🚀');
  }
});

client.login(process.env.DISCORD_TOKEN);
