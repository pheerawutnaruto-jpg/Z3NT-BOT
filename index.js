process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const http = require('http');
const { Redis } = require('@upstash/redis');

const { validateEnv, getGuildId } = require('./src/config/env');
const { debugLog, debugError } = require('./src/utils/debug');
validateEnv();
const TEST_GUILD_ID = getGuildId();

const { COLORS } = require('./constants');
const { getSecurityDashboardContent, handleSecurityMessage } = require('./security');
const { handleLeveling, handleCommandLeveling, levelCommand, handleLevelCommand, leaderboardCommand, handleLeaderboardCommand, setLevelCommand, handleSetLevelCommand, startVoiceXpCron } = require('./level');
const { setupQuestCommand, handleSetupQuestCommand, handleQuestButton } = require('./quest');
const { setupShopCommand, handleSetupShopCommand, boostStatusCommand, handleBoostStatusCommand, coinsCommand, addCoinsCommand, handleCoinsCommand, handleAddCoinsCommand, handleShopButton } = require('./shop');
const { setupArtistCommand, handleSetupArtistCommand, handleArtistButton, handleArtistModalSubmit } = require('./artist_card');
const { setupMediaGuardCommand, handleSetupMediaGuardCommand, handleMediaGuardMessage } = require('./media_guard');
const { setupOrderTicketCommand, handleSetupOrderTicketCommand, handleOrderTicketSelect, handleOrderPaymentButton, handleCloseTicketButton } = require('./order_ticket');
const { isServerPremium, grantPremiumCommand, handleGrantPremiumCommand } = require('./license');
const { setupCinemaCommand, cinemaBroadcastCommand, handleSetupCinemaCommand, handleCinemaBroadcastCommand, handleCinemaButton, handleCinemaSelect, handleCinemaModal } = require('./cinema');
const { autoCinemaCommand, handleAutoCinemaCommand, handleAutoCinemaButton, handleAutoCinemaSelect, handleAutoCinemaModal, loadAllAutoCinemaCrons } = require('./auto_cinema');
const { setupShowcaseCommand, handleSetupShowcaseCommand, handleShowcaseMessage } = require('./media_showcase');
const { petShopCommand, handlePetShopCommand, setPetChannelCommand, handleSetPetChannelCommand, setPetRoleCommand, handleSetPetRoleCommand, petCommand, handlePetCommand, handleCompanionButton, petBattleCommand, handlePetBattleCommand, handleBattleButtons, petLeaderboardCommand, handlePetLeaderboardCommand, startPetHatchCron } = require('./companion');

// 📥 นำเข้าโมดูลที่เราแยกออกไป
const { setWelcomeCommand, setAutoroleCommand, handleWelcomeAutoroleCommands, handleWelcomeAutoroleInteraction, handleGuildMemberAdd } = require('./welcome_autorole');
const { utilityCommands, loadAllAutoClearCrons, handleUtilityCommands } = require('./utility');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates]
});

const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
let serverConfigs = {};
let saveTimeout = null;

async function loadConfigs() {
  try {
    const data = await redis.get('server_configs');
    return data ? (typeof data === 'string' ? JSON.parse(data) : data) : {};
  } catch (e) { return {}; }
}

async function saveConfigs(configs) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try { await redis.set('server_configs', JSON.stringify(configs)); } catch (e) {}
  }, 1500);
}

function ensureGuildConfig(guildId) {
  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  return serverConfigs[guildId];
}

client.once('ready', async () => {
  serverConfigs = await loadConfigs();
  console.log(`Bot Online แล้วจ้า: ${client.user.tag}`);
  
  startVoiceXpCron(client, serverConfigs, saveConfigs);
  startPetHatchCron(client, serverConfigs, saveConfigs);
  loadAllAutoCinemaCrons(client, serverConfigs);
  loadAllAutoClearCrons(client, serverConfigs, serverConfigs);

  // ลงทะเบียนคำสั่งรวมกันที่นี่ (ดึงตัวแปร SlashCommand มาจากแต่ละไฟล์ได้เลย)
  const commands = [
    setWelcomeCommand,
    setAutoroleCommand,
    ...utilityCommands,
    new SlashCommandBuilder().setName('set-security').setDescription('เปิดแผงควบคุมระบบป้องกันความปลอดภัยขั้นสูง').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    levelCommand, leaderboardCommand, setupQuestCommand, setupShopCommand, setupOrderTicketCommand,
    coinsCommand, addCoinsCommand, grantPremiumCommand, boostStatusCommand, setupArtistCommand,
    setupMediaGuardCommand, setupShowcaseCommand, setLevelCommand, setupCinemaCommand,
    cinemaBroadcastCommand, autoCinemaCommand, petShopCommand, petCommand, petBattleCommand,
    petLeaderboardCommand, setPetChannelCommand, setPetRoleCommand
  ].map(c => c.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    if (TEST_GUILD_ID) await rest.put(Routes.applicationGuildCommands(client.user.id, TEST_GUILD_ID), { body: commands });
    else await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
  } catch (error) {}
});

// Event ส่งต่อให้ระบบย่อย
client.on('messageCreate', async message => {
  if (!message.guild || message.author.bot) return;
  const config = ensureGuildConfig(message.guild.id);
  if (await isServerPremium(message.guild.id, serverConfigs) && handleMediaGuardMessage(message, serverConfigs)) return;
  if (await handleSecurityMessage(message, config, new Map())) return;
  if (await handleShowcaseMessage(message, serverConfigs)) return;
  handleLeveling(message, serverConfigs, saveConfigs, client);
});

client.on('guildMemberAdd', async member => {
  await handleGuildMemberAdd(member, serverConfigs);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.guild) return;

  // ส่งต่อให้ Handler ของแต่ละระบบเช็กปุ่ม/เมนู
  if (await handleCompanionButton(interaction, serverConfigs, saveConfigs)) return;
  if (await handleBattleButtons(interaction, serverConfigs, saveConfigs)) return;
  if (await handleCinemaButton(interaction, serverConfigs, saveConfigs)) return;
  if (await handleAutoCinemaButton(interaction, serverConfigs, saveConfigs, client)) return;
  if (await handleOrderPaymentButton(interaction)) return;
  if (await handleCloseTicketButton(interaction)) return;
  if (await handleQuestButton(interaction, serverConfigs, saveConfigs)) return;
  if (await handleShopButton(interaction, serverConfigs, saveConfigs)) return;
  if (await handleArtistButton(interaction, serverConfigs)) return;
  if (await handleWelcomeAutoroleInteraction(interaction, serverConfigs, saveConfigs)) return;

  if (interaction.isChatInputCommand()) {
    handleCommandLeveling(interaction, serverConfigs, saveConfigs, client);
    
    // ถ้าเป็นคำสั่งใน Utility หรือ Welcome ให้แยกไปทำในไฟล์นั้นๆ
    if (await handleUtilityCommands(interaction, serverConfigs, saveConfigs, client)) return;
    const cmd = interaction.commandName;
    if (cmd === 'set-welcome' || cmd === 'set-autorole') return await handleWelcomeAutoroleCommands(interaction, serverConfigs);

    // คำสั่งอื่นๆ ที่เหลือ... (Level, Shop, Pet ฯลฯ สามารถเรียกผ่านไฟล์เดิมได้ปกติ)
    if (cmd === 'level') return await handleLevelCommand(interaction, serverConfigs);
    if (cmd === 'leaderboard') return await handleLeaderboardCommand(interaction, serverConfigs);
    if (cmd === 'setup-quest') return await handleSetupQuestCommand(interaction);
    if (cmd === 'setup-in-game-shop') return await handleSetupShopCommand(interaction);
    if (cmd === 'setup-order-ticket') return await handleSetupOrderTicketCommand(interaction);
    if (cmd === 'coins') return await handleCoinsCommand(interaction, serverConfigs);
    if (cmd === 'grant-premium') return await handleGrantPremiumCommand(interaction, serverConfigs, saveConfigs);
    if (cmd === 'add-coins') return await handleAddCoinsCommand(interaction, serverConfigs, saveConfigs);
    if (cmd === 'boost-status') return await handleBoostStatusCommand(interaction, serverConfigs);
    if (cmd === 'setup-artist-card') return await handleSetupArtistCommand(interaction);
    if (cmd === 'setup-media-guard') return await handleSetupMediaGuardCommand(interaction, serverConfigs, saveConfigs);
    if (cmd === 'setup-showcase') return await handleSetupShowcaseCommand(interaction, serverConfigs, saveConfigs);
    if (cmd === 'cinema-setup') return await handleSetupCinemaCommand(interaction);
    if (cmd === 'cinema-broadcast') return await handleCinemaBroadcastCommand(interaction, serverConfigs);
    if (cmd === 'auto-cinema') return await handleAutoCinemaCommand(interaction, serverConfigs);
    if (cmd === 'set-level') return await handleSetLevelCommand(interaction, serverConfigs);
    if (cmd === 'pet-shop') return await handlePetShopCommand(interaction);
    if (cmd === 'set-pet-channel') return await handleSetPetChannelCommand(interaction, serverConfigs, saveConfigs);
    if (cmd === 'set-pet-role') return await handleSetPetRoleCommand(interaction, serverConfigs, saveConfigs);
    if (cmd === 'pet') return await handlePetCommand(interaction, serverConfigs, saveConfigs, client);
    if (cmd === 'pet-battle') return await handlePetBattleCommand(interaction, serverConfigs, client);
    if (cmd === 'pet-leaderboard') return await handlePetLeaderboardCommand(interaction, serverConfigs);
  }
});

client.login(process.env.DISCORD_TOKEN);
