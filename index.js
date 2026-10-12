const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, EmbedBuilder } = require('discord.js');
const http = require('http');

// สร้างเว็บเซิร์ฟเวอร์จำลองเพื่อให้ Render มองเห็น Port และรันออนไลน์ได้ 24 ชม.
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

// ค่าตั้งค่าเริ่มต้นของระบบต้อนรับ (แบบสั้นกระชับ)
let welcomeConfig = {
  enabled: true,
  channelId: null,
  title: '💖 NEW Member! ✨',
  description: '「 🎉 ยินดีต้อนรับคุณ {user} ! 」',
  color: '#2f636'
};

// ลงทะเบียนคำสั่ง Slash Commands
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

// ฟังก์ชันสร้างหน้าตาแผงควบคุม (Control Panel)
function getControlPanelComponents() {
  const statusText = welcomeConfig.enabled ? '🟢 เปิดอยู่' : '🔴 ปิดอยู่';
  const channelText = welcomeConfig.channelId ? `<#${welcomeConfig.channelId}>` : 'ยังไม่ได้เลือกห้อง';

  const embed = new EmbedBuilder()
    .setTitle('⚙️ ตั้งค่าระบบ Welcome / Goodbye')
    .setDescription(`เลือกห้อง เปิด/ปิดระบบ และตั้งค่ารูป Embed ได้จากปุ่มด้านล่าง\n\n**Welcome**\nสถานะ: ${statusText}\nห้อง: ${channelText}`)
    .setColor('#2f636');

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('toggle_welcome')
      .setLabel(welcomeConfig.enabled ? 'ปิด Welcome' : 'เปิด Welcome')
      .setStyle(welcomeConfig.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
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
      .setPlaceholder('📂 เลือกห้อง Welcome')
      .addChannelTypes(ChannelType.GuildText)
  );

  return { embeds: [embed], components: [row1, row2] };
}

// ระบบต้อนรับสมาชิกใหม่เมื่อกดเข้าเซิร์ฟเวอร์
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

  channel.send({ embeds: [embed] });
});

// จัดการการกดปุ่ม, เมนูดรอปดาวน์, ฟอร์ม Modal และคำสั่ง Slash Commands
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
    else if (interaction.customId === 'edit_embed') {
      const modal = new ModalBuilder()
        .setCustomId('edit_welcome_modal')
        .setTitle('Editing: welcome embed');

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

      modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descInput),
        new ActionRowBuilder().addComponents(colorInput),
      );

      await interaction.showModal(modal);
    }
    else if (interaction.customId === 'test_welcome') {
      if (!welcomeConfig.channelId) {
        return await interaction.reply({ content: '⚠️ กรุณาเลือกห้อง Welcome ก่อนทดสอบครับ!', ephemeral: true });
      }
      const channel = interaction.guild.channels.cache.get(welcomeConfig.channelId);
      if (!channel) {
        return await interaction.reply({ content: '❌ ไม่พบห้องที่ตั้งไว้', ephemeral: true });
      }

      const finalTitle = welcomeConfig.title.replace('{user}', interaction.user.username).replace('{server}', interaction.guild.name);
      const finalDesc = welcomeConfig.description.replace('{user}', `${interaction.member}`).replace('{server}', interaction.guild.name);

      const testEmbed = new EmbedBuilder()
        .setTitle(finalTitle)
        .setDescription(finalDesc)
        .setColor(welcomeConfig.color)
        .setTimestamp();

      await channel.send({ content: '🧪 **[ทดสอบระบบ Welcome]**', embeds: [testEmbed] });
      await interaction.reply({ content: '✅ ส่งข้อความทดสอบไปที่ห้องเรียบร้อยแล้ว!', ephemeral: true });
    }
  }

  if (interaction.isChannelSelectMenu() && interaction.customId === 'select_welcome_channel') {
    if (!interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: '❌ คุณไม่มีสิทธิ์เลือกห้องนี้', ephemeral: true });
    }
    welcomeConfig.channelId = interaction.values[0];
    await interaction.update(getControlPanelComponents());
  }

  if (interaction.isModalSubmit() && interaction.customId === 'edit_welcome_modal') {
    welcomeConfig.title = interaction.fields.getTextInputValue('modal_title');
    welcomeConfig.description = interaction.fields.getTextInputValue('modal_desc');
    welcomeConfig.color = interaction.fields.getTextInputValue('modal_color');

    await interaction.reply({ content: '✨ **อัปเดตหน้าตา Embed เรียบร้อยแล้ว!**', ephemeral: true });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'ping') {
    await interaction.reply('Pong! 🏓 บอททำงานระบบ Slash Command ปกติบน Render ครับ 🚀');
  }
});

client.login(process.env.DISCORD_TOKEN);
