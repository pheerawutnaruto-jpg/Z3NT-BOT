const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-autoclear')
    .setDescription('ตั้งเวลาระบบลบข้อความอัตโนมัติ')
    .addStringOption(option =>
      option.setName('time')
        .setDescription('ระบุเวลาในรูปแบบ HH:MM เช่น 06:00')
        .setRequired(true)
    )
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('เลือกห้องที่ต้องการให้ลบข้อความอัตโนมัติ')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),
  async execute(interaction, client, serverConfigs, saveConfigs, setupCronJob) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({ content: '❌ คุณต้องเป็น Administrator ถึงจะใช้งานคำสั่งนี้ได้ครับ', ephemeral: true });
    }

    const guildId = interaction.guildId;
    const timeInput = interaction.options.getString('time');
    const channelInput = interaction.options.getChannel('channel');

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(timeInput)) {
      return await interaction.reply({ content: '❌ รูปแบบเวลาไม่ถูกต้อง กรุณาใส่ในรูปแบบ **HH:MM** (เช่น `06:00` หรือ `23:30`)', ephemeral: true });
    }

    if (!serverConfigs[guildId]) {
      serverConfigs[guildId] = { welcomeEnabled: false, channelId: null, embed: { title: '', description: '', color: '#66FFFF', image: '' } };
    }

    if (!serverConfigs[guildId].autoClear) {
      serverConfigs[guildId].autoClear = {};
    }

    serverConfigs[guildId].autoClear.enabled = true;
    serverConfigs[guildId].autoClear.time = timeInput;
    serverConfigs[guildId].autoClear.channelId = channelInput.id;
    saveConfigs(serverConfigs);

    setupCronJob(guildId, timeInput, channelInput.id);

    return await interaction.reply({ content: `✅ ตั้งค่าระบบ Auto-Clear สำเร็จ!\n⏰ เวลา: **${timeInput} น.** (ทุกวัน)\n📢 ช่อง: <#${channelInput.id}>`, ephemeral: true });
  },
};
