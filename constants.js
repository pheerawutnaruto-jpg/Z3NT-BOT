// constants.js - ศูนย์รวม Role IDs, Developer ID และลิงก์รูปภาพเริ่มต้นของ Zen Bot

module.exports = {
  DEVELOPER_ID: '795347337773580299',

  // 👑 Role IDs ทั้งหมดในระบบ
  ROLES: {
    ARTIST_PERM: '1560224726868295740',    // ยศ Artist ถาวร
    ARTIST_TEMP: '1560136361015513108',    // ยศ Artist | 3d (เช่า 3 วัน)
    XP_BOOSTER: '1559992075095773184',     // ยศ XP Booster x2
    CINEMA_PERM: '1560731553766707241',    // ตั๋วหนัง 21 วัน / แจ้งเตือน Now Showing
    CINEMA_TEMP: '1551006184272560148',    // ตั๋วหนัง 1 วัน
    CINEMA_COMING_SOON: '1551183125076508713', // ยศแท็ก Coming Soon
    CHILLING: '1560002494204084395',       // ยศสายชิลล์
    NIGHTOWL: '1560002616266854420'        // ยศคนนอนดึก
  },

  // 🖼️ ลิงก์รูปภาพและไอคอนมาตรฐาน
  IMAGES: {
    DEFAULT_CINEMA: 'https://cdn.discordapp.com/attachments/1559878908348997774/1560429202589876295/1792105154505.jpg',
    ARTIST_BANNER: 'https://cdn.discordapp.com/attachments/1550576199829430382/1559721936588636220/IMG_7335.jpg',
    QUEST_BANNER: 'https://cdn.discordapp.com/attachments/1550576199829430382/1560524247216955432/IMG_7329.jpg',
    SHOP_STOREFRONT: 'https://cdn.discordapp.com/attachments/1559878908348997774/1560429209522806814/1792105478227.jpg',
    BOT_PRESENTATION: 'https://cdn.discordapp.com/attachments/1550576199829430382/1559721017583337512/1791877721245.jpg',
    PROMPTPAY_QR: 'https://cdn.discordapp.com/attachments/1559878908348997774/1560193260293595176/ReceiveMoney_QR_2026-10-15_14.13.55.png',
    ORDER_LOADING_GIF: 'https://cdn.discordapp.com/attachments/1559878908348997774/1560407479412588686/IMG_7559.gif',
    NEW_ORDER_GIF: 'https://cdn.discordapp.com/attachments/1559878908348997774/1560415906281300059/image0.gif'
  },

  // 🎨 สีมาตรฐานของ Embed
  COLORS: {
    PRIMARY: '#66FFFF',
    GOLD: '#FFD700',
    PINK: '#FF69B4',
    RED: '#FF0000',
    GREEN: '#00FF00',
    DISCORD_BLURPLE: '#5865F2'
  }
};
