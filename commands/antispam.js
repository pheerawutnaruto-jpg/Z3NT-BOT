const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '../config.json');

function loadConfigs() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      if (data.trim() !== '') return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error loading config:', e);
  }
  return {};
}

function saveConfigs(configs) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2));
  } catch (e) {
    console.error('Error saving config:', e);
  }
}

function getAntiSpamDashboardContent(sec) {
  const statusText = sec.enabled ? 'เปิด' : 'ปิด';
  const inviteText = sec.inviteLink ? 'เปิด' : 'ปิด';
  const spamText = sec.messageSpam ? 'เปิด' : 'ปิด';
  const mrBeastText = sec.mrBeastSpam ? 'เปิด' : 'ปิด';
  
  const channelsList = sec.selectedChannels.length > 0 
    ? sec.selectedChannels.map(id => `<#${id}>`).join(' ') 
    : 'ทุกห้อง';

  const desc = `ตั้งค่าระบบกันสแปม\nสถานะ: **${statusText}**\nลบลิงก์เชิญ: **${inviteText}**\nลบข้อความสแปม: **${spamText}**\nลบสแปม MrBeast: **${mrBeastText}**\nสแปม: **${sec.spamLimit} ข้อความ / ${sec.spamSeconds} วินาที**\nระงับผู้ใช้: **${sec.timeoutSeconds} วินาที**\nคูลดาวน์ลงโทษซ้ำ: **${sec.cooldown} วินาที**\nInvite action: **${sec.inviteAction}**\nSpam action: **${sec.spamAction}**\nMrBeast action: **${sec.mrBeastAction}**\nห้องที่เลือก: ${channelsList}`;

  const embed = new EmbedBuilder()
    .setTitle('🛡️ แผงควบคุมระบบป้องกันความปลอดภัย')
    .setDescription(desc)
    .setColor('#00FF99');

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sec_toggle').setLabel(sec.enabled ? 'ปิดระบบ' : 'เปิดระบบ').setStyle(sec.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('sec_invite').setLabel(`ลิงก์เชิญ: ${inviteText}`).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sec_spam').setLabel(`สแปม: ${spamText}`).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sec_mrbeast').setLabel(`MrBeast: ${mrBeastText}`).setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sec_action_timeout').setLabel('Timeout').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('sec_action_kick').setLabel('Kick').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sec_reset').setLabel('รีเซ็ตทั้งหมด').setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [row1, row2] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antispam-panel')
    .setDescription('เปิดแผงควบคุมระบบป้องกันความปลอดภัย'),
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({ content: '❌ สำหรับ Administrator เท่านั้น', ephemeral: true });
    }

    const guildId = interaction.guildId;
    let serverConfigs = loadConfigs();
    if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
    if (!serverConfigs[guildId].security) {
      serverConfigs[guildId].security = {
        enabled: true,
        inviteLink: true,
        messageSpam: true,
        mrBeastSpam: true,
        spamLimit: 3,
        spamSeconds: 6,
        timeoutSeconds: 3000,
        cooldown: 1,
        inviteAction: 'Timeout 3000s + Kick',
        spamAction: 'Timeout 3000s + Kick',
        mrBeastAction: 'Timeout 3000s + Kick',
        selectedChannels: []
      };
      saveConfigs(serverConfigs);
    }

    const content = getAntiSpamDashboardContent(serverConfigs[guildId].security);
    await interaction.reply({ ...content, ephemeral: true });
  },
  getAntiSpamDashboardContent
};
