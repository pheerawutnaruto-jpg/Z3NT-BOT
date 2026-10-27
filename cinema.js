import java.awt.Color;
import net.dv8tion.jda.api.EmbedBuilder;
import net.dv8tion.jda.api.events.interaction.command.SlashCommandInteractionEvent;
import net.dv8tion.jda.api.events.interaction.component.ButtonInteractionEvent;
import net.dv8tion.jda.api.hooks.ListenerAdapter;
import net.dv8tion.jda.api.interactions.components.ActionRow;
import net.dv8tion.jda.api.interactions.components.buttons.Button;
import net.dv8tion.jda.api.utils.messages.MessageCreateBuilder;

public class CinemaTicketBot extends ListenerAdapter {

    // 1. คำสั่ง Slash Command สำหรับส่งแผง Ticket / Box Office
    @Override
    public void onSlashCommandInteraction(SlashCommandInteractionEvent event) {
        if (event.getName().equals("cinema-setup")) {
            
            // สร้าง Embed การ์ดข้อความ
            EmbedBuilder embed = new EmbedBuilder();
            embed.setTitle("🎟️ ZEN CINEMA • BOX OFFICE");
            embed.setDescription("✨ **บริการจำหน่ายตั๋วรับชมภาพยนตร์** ✨\nกดปุ่มด้านล่างเพื่อเลือกซื้อตั๋วเข้าชม");
            embed.setColor(Color.RED); // กำหนดเส้นขอบสีแดง
            embed.setImage("https://example.com/your-image.png"); // ใส่ URL รูปภาพของคุณ

            // สร้างปุ่ม (Button)
            Button buyButton = Button.success("cinema_temp_ticket", "🎟️ 250c ( movie | 1d )");

            // มัดรวม Embed และ ปุ่ม เข้าไปใน Message เดียวกัน
            MessageCreateBuilder message = new MessageCreateBuilder();
            message.setEmbeds(embed.build());
            message.setComponents(ActionRow.of(buyButton));

            // ส่งข้อความไปที่ห้องที่ใช้งานคำสั่ง
            event.getChannel().sendMessage(message.build()).queue();

            // ตอบกลับผู้ใช้งานที่กดสั่งคำสั่ง
            event.reply("✅ ส่งแผงป้าย Box Office เรียบร้อยแล้ว!").setEphemeral(true).queue();
        }
    }

    // 2. ระบบรองรับเมื่อผู้ใช้งานคลิกปุ่ม (Button Click Handler)
    @Override
    public void onButtonInteraction(ButtonInteractionEvent event) {
        if (event.getComponentId().equals("cinema_temp_ticket")) {
            // เมื่อมีคนกดปุ่ม cinema_temp_ticket
            event.reply("🎉 **ซื้อตั๋วสำเร็จ!** ระบบได้ทำการออกตั๋วให้คุณเรียบร้อยแล้ว")
                 .setEphemeral(true) // ให้เห็นเฉพาะคนที่กด
                 .queue();
        }
    }
}
