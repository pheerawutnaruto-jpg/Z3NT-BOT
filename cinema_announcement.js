const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const cinemaAnnouncementCommand = new SlashCommandBuilder()
  .setName('cinema-announce')
  .setDescription('🎬 [PREMIUM] แผงควบคุมและส่งประกาศรอบฉายสไตล์โรงภาพยนตร์ (สำหรับ Admin)');

// ฟังก์ชันสร้างหน้าตา Dashboard ตั้งค่าประกาศโรงหนัง
function getCinemaDashboardContent(config) {
  const cConfig = config.cinemaAnnouncement || {
    title: '🍿 𝙕𝙀𝙉 𝘾𝙄𝙉𝙀𝙈𝘼𝙎 • NOW SHOWING & COMMUNITY BULLETIN',
    description: '✨ **ยินดีต้อนรับสู่โรงภาพยนตร์ Zen Cinemas! โปรดตรวจดูรอบฉายและสิทธิประโยชน์ประจำวันของคุณ:**\n\n🎥 **FEATURED ATTRACTIONS:**\n• 🪙 **สุ่มเหรียญประจำวัน:** แวะไปที่ห้องเควสต์แล้วกดรับ Zen Coins ฟรีทุก 24 ชั่วโมง!\n• 🛒 **บ็อกซ์ออฟฟิศพรีเมียม:** ตรวจสอบสินค้าและยศถาวรได้ที่ `/shop`\n• 🎙️ **โซนพูดคุย & แชท:** สะสม XP เลเวลพุ่งกระฉูดทั้งพิมพ์แชทและเข้าห้องเสียง!\n\n🎟️ *ขอให้ทุกท่านเพลิดเพลินไปกับการรับชมและใช้เวลาในคอมมูนิตี้ของเราครับ!*',
    imageUrl: 'https://cdn.discordapp.com/attachments/1559878908348997774/1560429202589876295/1792105154505.jpg',
    channelId: null
  };

  const channelName = cConfig.channelId ? `<#${cConfig.channelId}>` : 'ยังไม่ได้เลือกห้อง';

  const embed = new EmbedBuilder()
    .setTitle('🎬 CINEMA ANNOUNCEMENT DASHBOARD')
    .setDescription('ปรับแต่งข้อความ รูปภาพ และเลือกห้องสำหรับส่งประกาศสไตล์โรงภาพยนตร์ได้จากปุ่มด้านล่าง')
    .setColor('#FFD700')
    .addFields(
      { name: '📢 ห้องสำหรับฉายประกาศ', value: channelName, inline: false },
      { name: '📝 หัวข้อปัจจุบัน', value: `\`\`\`${cConfig.title}\`\`\``, inline: false },
      { name: '🖼️ รูปภาพแบนเนอร์', value: cConfig.imageUrl ? `[คลิกดูรูปภาพ](${cConfig.imageUrl})` : 'ยังไม่ได้ตั้งค่า', inline: true }
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cinema_edit_text').setLabel('✏️ แก้ไขข้อความประกาศ').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('cinema_edit_image').setLabel('🖼️ ตั้งค่ารูปภาพแบนเนอร์').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('cinema_send_preview').setLabel('🚀 ส่งประกาศทันที').setStyle(ButtonStyle.Success)
  );

  const channelRow = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('cinema_select_channel')
      .setPlaceholder('📂 เลือกห้องโรงภาพยนตร์สำหรับฉายประกาศ')
      .addChannelTypes(ChannelType.GuildText)
  );

  return { embeds: [embed], components: [row1, channelRow] };
}

async function handleCinemaAnnounceCommand(interaction, serverConfigs) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
  }

  const guildId = interaction.guildId;
  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  
  const payload = getCinemaDashboardContent(serverConfigs[guildId]);
  await interaction.reply({ ...payload, ephemeral: true });
}

async function handleCinemaButtonAndModal(interaction, serverConfigs, saveConfigs) {
  const guildId = interaction.guildId;
  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].cinemaAnnouncement) {
    serverConfigs[guildId].cinemaAnnouncement = {
      title: '🍿 𝙕𝙀𝙉 𝘾𝙄𝙉𝙀𝙈𝘼𝙎 • NOW SHOWING & COMMUNITY BULLETIN',
      description: '✨ **ยินดีต้อนรับสู่โรงภาพยนตร์ Zen Cinemas! โปรดตรวจดูรอบฉายและสิทธิประโยชน์ประจำวันของคุณ:**\n\n🎥 **FEATURED ATTRACTIONS:**\n• 🪙 **สุ่มเหรียญประจำวัน:** แวะไปที่ห้องเควสต์แล้วกดรับ Zen Coins ฟรีทุก 24 ชั่วโมง!\n• 🛒 **บ็อกซ์ออฟฟิศพรีเมียม:** ตรวจสอบสินค้าและยศถาวรได้ที่ `/shop`\n• 🎙️ **โซนพูดคุย & แชท:** สะสม XP เลเวลพุ่งกระฉูดทั้งพิมพ์แชทและเข้าห้องเสียง!\n\n🎟️ *ขอให้ทุกท่านเพลิดเพลินไปกับการรับชมและใช้เวลาในคอมมูนิตี้ของเราครับ!*',
      imageUrl: 'https://cdn.discordapp.com/attachments/1559878908348997774/1560429202589876295/1792105154505.jpg',
      channelId: null
    };
  }

  const config = serverConfigs[guildId].cinemaAnnouncement;

  // 1. กดปุ่มแก้ไขข้อความ
  if (interaction.isButton() && interaction.customId === 'cinema_edit_text') {
    const modal = new ModalBuilder().setCustomId('cinemaTextModal').setTitle('แก้ไขข้อความประกาศโรงหนัง');
    const titleInput = new TextInputBuilder().setCustomId('cinemaTitle').setLabel('Title (หัวข้อประกาศ)').setStyle(TextInputStyle.Short).setValue(config.title).setRequired(true);
    const descInput = new TextInputBuilder().setCustomId('cinemaDesc').setLabel('Description (เนื้อหาประกาศ)').setStyle(TextInputStyle.Paragraph).setValue(config.description).setRequired(true);
    
    modal.addComponents(new ActionRowBuilder().addComponents(titleInput), new ActionRowBuilder().addComponents(descInput));
    return await interaction.showModal(modal);
  }

  // 2. กดปุ่มแก้ไขรูปภาพ
  if (interaction.isButton() && interaction.customId === 'cinema_edit_image') {
    const modal = new ModalBuilder().setCustomId('cinemaImageModal').setTitle('ตั้งค่ารูปภาพแบนเนอร์โรงหนัง');
    const imageInput = new TextInputBuilder().setCustomId('cinemaImageUrl').setLabel('Image URL (ลิงก์รูปภาพ)').setStyle(TextInputStyle.Short).setValue(config.imageUrl || '').setRequired(false);
    
    modal.addComponents(new ActionRowBuilder().addComponents(imageInput));
    return await interaction.showModal(modal);
  }

  // 3. กดปุ่มส่งประกาศทันที
  if (interaction.isButton() && interaction.customId === 'cinema_send_preview') {
    if (!config.channelId) {
      return await interaction.reply({ content: '❌ กรุณาเลือกห้อง (Channel) สำหรับฉายประกาศจากเมนูด้านล่างก่อนกดส่งครับ!', ephemeral: true });
    }

    try {
      const channel = await interaction.guild.channels.fetch(config.channelId).catch(() => null);
      if (!channel) return await interaction.reply({ content: '❌ ไม่พบห้องที่เลือกไว้ กรุณาเลือกห้องใหม่อีกครั้งครับ', ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle(config.title)
        .setDescription(config.description)
        .setColor('#FFD700')
        .setFooter({ text: '🎬 Zen Cinemas • Enjoy The Show!' })
        .setTimestamp();

      if (config.imageUrl && config.imageUrl.trim() !== '') {
        embed.setImage(config.imageUrl.trim());
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('🎟️ เปิดตู้ขายตั๋ว (/shop)')
          .setStyle(ButtonStyle.Link)
          .setURL('https://discord.com')
      );

      await channel.send({ 
        content: '@everyone 📢 **ไฟในโรงภาพยนตร์หรี่ลงแล้ว! มีประกาศรอบฉายใหม่มาเสิร์ฟครับ!**', 
        embeds: [embed], 
        components: [row] 
      });

      return await interaction.reply({ content: `✅ ส่งประกาศสไตล์โรงภาพยนตร์ไปยังห้อง <#${config.channelId}> เรียบร้อยแล้วครับ! 🎬`, ephemeral: true });
    } catch (err) {
      console.error('Error sending cinematic announcement:', err);
      return await interaction.reply({ content: '❌ เกิดข้อผิดพลาดในการส่งประกาศ กรุณาตรวจสอบสิทธิ์ของบอทอีกครั้งครับ', ephemeral: true });
    }
  }

  // 4. เลือกห้องจาก Channel Select Menu
  if (interaction.isChannelSelectMenu() && interaction.customId === 'cinema_select_channel') {
    await interaction.deferUpdate().catch(() => {});
    config.channelId = interaction.values[0];
    await saveConfigs(serverConfigs);
    return await interaction.editReply(getCinemaDashboardContent(serverConfigs[guildId]));
  }

  // 5. บันทึก Modal ข้อความ
  if (interaction.isModalSubmit() && interaction.customId === 'cinemaTextModal') {
    config.title = interaction.fields.getTextInputValue('cinemaTitle');
    config.description = interaction.fields.getTextInputValue('cinemaDesc');
    await saveConfigs(serverConfigs);
    return await interaction.reply({ content: '✅ บันทึกหัวข้อและเนื้อหาประกาศเรียบร้อยแล้ว!', ephemeral: true });
  }

  // 6. บันทึก Modal รูปภาพ
  if (interaction.isModalSubmit() && interaction.customId === 'cinemaImageModal') {
    config.imageUrl = interaction.fields.getTextInputValue('cinemaImageUrl');
    await saveConfigs(serverConfigs);
    return await interaction.reply({ content: '✅ บันทึกลิงก์รูปภาพแบนเนอร์เรียบร้อยแล้ว!', ephemeral: true });
  }

  return false;
}

module.exports = {
  cinemaAnnouncementCommand,
  handleCinemaAnnounceCommand,
  handleCinemaButtonAndModal
};
