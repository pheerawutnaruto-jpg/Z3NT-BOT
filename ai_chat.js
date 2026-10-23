const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const axios = require('axios');

const setAiChannelCommand = new SlashCommandBuilder()
  .setName('set-ai-channel')
  .setDescription('🤖 [PREMIUM] ตั้งค่าห้องสำหรับพูดคุยกับ Zen AI (สำหรับ Admin)')
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('เลือกห้องที่ต้องการให้บอทคุยกับสมาชิกเป็น AI')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  );

async function handleSetAiChannelCommand(interaction, serverConfigs, saveConfigs) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({ content: '❌ เฉพาะ Administrator เท่านั้นที่จะใช้คำสั่งนี้ได้ครับ!', ephemeral: true });
  }

  const guildId = interaction.guildId;
  const channel = interaction.options.getChannel('channel');

  if (!serverConfigs[guildId]) serverConfigs[guildId] = {};
  serverConfigs[guildId].aiChannelId = channel.id;
  await saveConfigs(serverConfigs);

  return await interaction.reply({ content: `✅ ตั้งค่าห้องแชท AI เรียบร้อยแล้วที่ห้อง <#${channel.id}>! สมาชิกสามารถพิมพ์คุยกับบอทในห้องนี้ได้ทันที`, ephemeral: true });
}

async function handleAiChatMessage(message, serverConfigs) {
  if (!message.guild || message.author.bot) return false;

  const guildId = message.guild.id;
  const config = serverConfigs[guildId];
  if (!config || config.aiChannelId !== message.channel.id) return false;

  // แสดงสถานะกำลังพิมพ์ (Typing indicator) ให้เหมือนกำลังคิดคำตอบ
  await message.channel.sendTyping();

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      await message.reply('❌ ยังไม่ได้ตั้งค่าตัวแปร GEMINI_API_KEY ในระบบโฮสต์ (Render) ครับ!');
      return true;
    }

    const prompt = message.content;
    
    // เรียกใช้งาน Gemini API 
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            parts: [{ text: `คุณคือ Zen Bot ผู้ช่วยอัจฉริยะประจำเซิร์ฟเวอร์ Discord สไตล์เป็นกันเอง เป็นมิตร และช่วยเหลือผู้ใช้ ตอบเป็นภาษาไทย: ${prompt}` }]
          }
        ]
      }
    );

    const aiReply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'ขออภัยครับ ตอนนี้สมองผมกำลังมึนๆ ลองพิมพ์ใหม่อีกทีนะครับ!';

    // Discord จำกัดข้อความไม่เกิน 2000 ตัวอักษรต่อ 1 ข้อความ
    if (aiReply.length > 2000) {
      const chunks = aiReply.match(/[\s\S]{1,2000}/g) || [];
      for (const chunk of chunks) {
        await message.reply(chunk);
      }
    } else {
      await message.reply(aiReply);
    }

  } catch (err) {
    console.error('Error calling Gemini API:', err);
    await message.reply('❌ เกิดข้อผิดพลาดในการเชื่อมต่อกับระบบ AI ครับ');
  }

  return true;
}

module.exports = {
  setAiChannelCommand,
  handleSetAiChannelCommand,
  handleAiChatMessage
};
