const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');

const TOPUP_ITEMS = [
  { id: 'buy_coins_5', name: '🪙 เติม 5 Zen Coins', price: 5, coins: 5, description: 'เติมเงิน 5 บาท รับทันที 5 Zen Coins' },
  { id: 'buy_coins_10', name: '🪙 เติม 10 Zen Coins', price: 10, coins: 10, description: 'เติมเงิน 10 บาท รับทันที 10 Zen Coins' },
  { id: 'buy_coins_30', name: '🪙 เติม 30 Zen Coins', price: 30, coins: 30, description: 'เติมเงิน 30 บาท รับทันที 30 Zen Coins' }
];

const topupCommand = new SlashCommandBuilder()
  .setName('topup')
  .setDescription('💎 [ADMIN] เติม Zen Coins ให้กับสมาชิก')
  .addUserOption(option => option.setName('user').setDescription('เลือกสมาชิกที่ต้องการเติมเหรียญ').setRequired(true))
  .addIntegerOption(option => option.setName('amount').setDescription('จำนวน Zen Coins ที่ต้องการเติม').setRequired(true));

const setupTopupShopCommand = new SlashCommandBuilder()
  .setName('setup-topup-shop')
  .setDescription('💎 ส่งแผงป้ายเติมเหรียญ Zen Coins ไปยังห้องนี้ (สำหรับ Admin)');

const coinsCommand = new SlashCommandBuilder()
  .setName('coins')
  .setDescription('💎 เช็กยอด Zen Coins และเหรียญคงเหลือในกระเป๋าของคุณ');

async function handleSetupTopupShopCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle('<a:emoji_93:1560403772025344101> 𝙕𝙀𝙉 𝘽𝙊𝙏 • TOPUP CENTER')
    .setDescription('✨ **เติมเหรียญ Zen Coins สะสมง่ายๆ ได้ด้วยตัวเองที่นี่!**\n\n📌 เลือกแพ็กเกจเหรียญที่ต้องการแล้วกดปุ่มด้านล่างเพื่อเปิดห้องเติมเงินได้เลยครับ')
    .setImage('https://cdn.discordapp.com/attachments/1559878908348997774/1560424207702040647/1792104497426.jpg')
    .setColor('#FFD700');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('open_topup_shop_panel')
      .setLabel('💳 เปิดแผงเติมเหรียญ Zen Coins')
      .setStyle(ButtonStyle.Success)
  );

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: '✅ ส่งป้ายร้านค้าเติมเหรียญไปยังห้องนี้สำเร็จแล้ว!', ephemeral: true });
}

async function handleCoinsCommand(interaction, serverConfigs) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const config = serverConfigs[guildId] || {};
  const userStat = config.levels?.[userId];
  const userCoins = userStat ? (userStat.orbs || 0) : 0;

  const embed = new EmbedBuilder()
    .setTitle('💰 WALLET • ยอดเหรียญของคุณ')
    .setDescription(`ยอด Zen Coins คงเหลือในกระเป๋าของ <@${userId}>:\n🪙 **${userCoins} Zen Coins**`)
    .setColor('#FFD700')
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleTopupCommand(interaction, serverConfigs, saveConfigs) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้น', ephemeral: true });
  }

  const targetUser = interaction.options.getUser('user');
  const amount = interaction.options.getInteger('amount');
  const guildId = interaction.guildId;
  const userId = targetUser.id;

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  if (!serverConfigs[guildId].levels) serverConfigs[guildId].levels = {};
  if (!serverConfigs[guildId].levels[userId]) {
    serverConfigs[guildId].levels[userId] = { xp: 0, level: 1, orbs: 0, lastDaily: 0, boostUntil: 0, artistUntil: 0, customTheme: '' };
  }

  const userStat = serverConfigs[guildId].levels[userId];
  userStat.orbs = (userStat.orbs || 0) + amount;
  await saveConfigs(serverConfigs);

  await interaction.reply({ content: `✅ เติม Zen Coins จำนวน **+${amount} Coins** ให้กับคุณ <@${userId}> สำเร็จแล้ว! (ยอดรวม: ${userStat.orbs} Coins)`, ephemeral: true });
}

async function handleTopupShopButton(interaction, serverConfigs) {
  if (interaction.customId === 'open_topup_shop_panel') {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const config = serverConfigs[guildId] || {};
    const userStat = config.levels?.[userId];
    const userCoins = userStat ? (userStat.orbs || 0) : 0;

    const embed = new EmbedBuilder()
      .setTitle('<a:emoji_93:1560403772025344101> 𝙕𝙀𝙉 𝘽𝙊𝙏 • TOPUP CENTER')
      .setDescription(`🛒 ศูนย์เติม Zen Coins\n<a:emoji_100:1560416789211516938> เหรียญของคุณตอนนี้: **${userCoins} Coins**\n\n📌 เลือกแพ็กเกจเติมเงินด้านล่างเพื่อสร้างห้องส่วนตัว:`)
      .setColor('#FFD700');

    TOPUP_ITEMS.forEach(item => {
      embed.addFields({
        name: `${item.name} (ราคา: ${item.price} บาท)`,
        value: `${item.description}\n──────────────────────`,
        inline: false
      });
    });

    const row = new ActionRowBuilder();
    TOPUP_ITEMS.forEach(item => {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`create_topup_${item.id}`)
          .setLabel(item.name)
          .setEmoji('1560416845322920067')
          .setStyle(ButtonStyle.Primary)
      );
    });

    return await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }

  if (interaction.customId.startsWith('create_topup_')) {
    const itemId = interaction.customId.replace('create_topup_', '');
    const item = TOPUP_ITEMS.find(i => i.id === itemId);
    if (!item) return true;

    const guild = interaction.guild;
    const user = interaction.user;
    const loadingGif = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560407479412588686/IMG_7559.gif';

    const loadingEmbed = new EmbedBuilder()
      .setTitle('⏳ กำลังเตรียมห้องเติมเงินของคุณ...')
      .setDescription('ระบบกำลังสร้างห้องส่วนตัว กรุณารอสักครู่ครับ...')
      .setImage(loadingGif)
      .setColor('#00FFFF');

    await interaction.reply({ embeds: [loadingEmbed], ephemeral: true });

    try {
      const ticketChannel = await guild.channels.create({
        name: `🪙-topup-${user.username}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
        ],
      });

      const newOrderGif = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560415906281300059/image0.gif';

      const embed = new EmbedBuilder()
        .setTitle(`<a:emoji_103:1560417845903491112> เติมเหรียญ: ${item.name}`)
        .setDescription(`สวัสดีคุณ <@${user.id}>!\nคุณเลือกแพ็กเกจเติมเงิน: **${item.name}**\n💰 **ยอดชำระ:** \`${item.price} บาท\``)
        .setImage(newOrderGif)
        .setColor('#FFD700')
        .setFooter({ text: 'ช่องทางชำระ' });

      const payRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`topup_truemoney_${item.id}`)
          .setLabel('TrueMoney')
          .setEmoji('1560403718153965618')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`topup_promptpay_${item.id}`)
          .setLabel('PromptPay')
          .setEmoji('1560403647882334208')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('close_topup_ticket')
          .setLabel('🔒 ปิดห้องเติมเงิน')
          .setStyle(ButtonStyle.Danger)
      );

      await ticketChannel.send({ content: `🔔 รายการเติมเหรียญใหม่จาก <@${user.id}>`, embeds: [embed], components: [payRow] });
      await interaction.editReply({ content: `✅ สร้างห้องเติมเงินส่วนตัวให้คุณเรียบร้อยแล้ว: <#${ticketChannel.id}>`, embeds: [] });
    } catch (err) {
      console.error('Error creating topup ticket channel:', err);
      await interaction.editReply({ content: '❌ เกิดข้อผิดพลาดในการสร้างห้อง กรุณาติดต่อแอดมินครับ', embeds: [] });
    }

    return true;
  }

  if (interaction.customId.startsWith('topup_promptpay_') || interaction.customId.startsWith('topup_truemoney_')) {
    const isTrueMoney = interaction.customId.startsWith('topup_truemoney_');
    const itemId = interaction.customId.replace(isTrueMoney ? 'topup_truemoney_' : 'topup_promptpay_', '');
    const item = TOPUP_ITEMS.find(i => i.id === itemId);
    if (!item) return true;

    const promptPayQr = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560193260293595176/ReceiveMoney_QR_2026-10-15_14.13.55.png';
    const trueMoneyQr = 'https://cdn.discordapp.com/attachments/1559878908348997774/1560193259953717279/ReceiveMoney_QR_2026-10-15_14.14.01.png';
    const truemoneyLink = 'https://tmn.app.link/57MAEZTBf7b';

    const selectedQr = isTrueMoney ? trueMoneyQr : promptPayQr;

    const embed = new EmbedBuilder()
      .setTitle('💳 ช่องทางการชำระเงินเติมเหรียญ')
      .setDescription(`แพ็กเกจ: **${item.name}**\n💰 ยอดชำระ: \`${item.price} บาท\`\n\n──────────────────────\n📌 **${isTrueMoney ? 'สแกน QR Code ทรูมันนี่ หรือเติมผ่านซองของขวัญ:' : 'สแกน QR Code PromptPay ด้านล่างเพื่อโอนเงิน:'}**\n${isTrueMoney ? `🔗 [กดที่นี่เพื่อเปิดแอป TrueMoney Wallet](${truemoneyLink})` : ''}\n\n*โอนเงินแล้วส่งสลิปหลักฐานในห้องนี้เพื่อให้แอดมินตรวจสอบและเติมเหรียญให้ได้เลยครับ*`)
      .setImage(selectedQr)
      .setColor('#00FF00')
      .setFooter({ text: 'ช่องทางชำระ' });

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('close_topup_ticket')
        .setLabel('🔒 ปิดห้องเติมเงิน')
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.update({ embeds: [embed], components: [closeRow] });
    return true;
  }

  if (interaction.customId === 'close_topup_ticket') {
    await interaction.reply({ content: '🔒 กำลังปิดห้องเติมเงินใน 5 วินาที...' });
    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 5000);
    return true;
  }

  return false;
}

module.exports = {
  topupCommand,
  setupTopupShopCommand,
  coinsCommand,
  handleSetupTopupShopCommand,
  handleCoinsCommand,
  handleTopupCommand,
  handleTopupShopButton
};
