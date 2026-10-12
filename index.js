import discord
from discord.ext import commands
import sqlite3
import json
import os
from datetime import datetime

# ==================== 1. إعداد قاعدة البيانات واستمراريتها ====================
db = sqlite3.connect("tickets_database.db")
cursor = db.cursor()
cursor.execute("""
    CREATE TABLE IF NOT EXISTS active_tickets (
        channel_id TEXT PRIMARY KEY,
        owner_id TEXT,
        category TEXT,
        claimed_by TEXT,
        added_users TEXT
    )
""")
db.commit()

# ==================== 2. إعدادات وصلاحيات البوت ====================
intents = discord.Intents.default()
intents.message_content = True
intents.guilds = True
intents.members = True

bot = commands.Bot(command_prefix="!", intents=intents, help_command=None)

# === الثوابت المركزية (محدثة بالكامل) ===
STAFF_ROLE_ID = 1554251752574951425      # رتبة طاقم الإدارة
TICKET_CATEGORY_ID = 1554252223763058809 # كاتجوري التكتات
LOG_CHANNEL_ID = 1543094678038257784     # روم اللوق
EMBED_COLOR = 0x2f3136

# دالة إرسال اللوق الموحد
async def send_log(guild, embed):
    try:
        log_channel = guild.get_channel(LOG_CHANNEL_ID)
        if log_channel:
            await log_channel.send(embed=embed)
    except Exception as err:
        print(f"[LOG_ERROR] {err}")

@bot.event
async def on_ready():
    print(f"[SYSTEM] البوت شغال وجاهز يا طويل العمر باسم: {bot.user}")

# ==================== 3. نظام المودالات (Modals) ====================

# مودال إدخال تفاصيل التكت عند الفتح
class TicketModal(discord.ui.Modal, title="تفاصيل التكت والاستفسار"):
    subject = discord.ui.TextInput(
        label="موضوع الطلب / المشكلة",
        placeholder="اكتب عنوان بسيط لموضوعك هنا...",
        style=discord.TextStyle.short,
        required=True,
        max_length=100
    )
    details = discord.ui.TextInput(
        label="شرح المشكلة بالتفصيل",
        placeholder="اكتب كل التفاصيل اللي تبيها عشان نقدر نخدمك بسرعة...",
        style=discord.TextStyle.paragraph,
        required=True,
        max_length=1000
    )

    def __init__(self, category_key):
        super().__init__()
        self.category_key = category_key

    async def on_submit(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        guild = interaction.guild
        member = interaction.user

        # التحقق من عدم وجود تكت مفتوح لنفس الشخص في نفس القسم
        cursor.execute("SELECT channel_id FROM active_tickets WHERE owner_id = ? AND category = ?", (str(member.id), self.category_key))
        existing = cursor.fetchone()
        if existing and guild.get_channel(int(existing[0])):
            return await interaction.edit_original_response(content="❌ يا غالي عندك تكت مفتوح أصلاً في هذا القسم!")

        cat_configs = {
            "support": ("دعم-فني", 0xED4245),
            "general": ("استفسار", 0x57F287),
            "store": ("متجر", 0xFEE75C)
        }
        cat_name, cat_color = cat_configs.get(self.category_key, ("دعم", 0x5865F2))

        category_channel = guild.get_channel(TICKET_CATEGORY_ID)

        # صلاحيات القناة
        overwrites = {
            guild.default_role: discord.PermissionOverwrite(view_channel=False),
            member: discord.PermissionOverwrite(view_channel=True, send_messages=True, read_message_history=True, attach_files=True),
            guild.get_role(STAFF_ROLE_ID): discord.PermissionOverwrite(view_channel=True, send_messages=True, read_message_history=True, attach_files=True),
            guild.me: discord.PermissionOverwrite(view_channel=True, send_messages=True, manage_channels=True)
        }

        try:
            ticket_channel = await guild.create_text_channel(
                name=f"{cat_name}-{member.name}",
                category=category_channel,
                topic=str(member.id),
                overwrites=overwrites
            )

            # حفظ البيانات في SQLite
            cursor.execute(
                "INSERT INTO active_tickets (channel_id, owner_id, category, claimed_by, added_users) VALUES (?, ?, ?, ?, ?)",
                (str(ticket_channel.id), str(member.id), self.category_key, None, json.dumps([]))
            )
            db.commit()

            # --- نص القوانين والكلام الطويل داخل التكت ---
            rules_text = (
                "📌 **قوانين وتعليمات التكت:**\n"
                "1️⃣ **احترام طاقم الإدارة:** يرجى التحدث بأسلوب راقي والتزود بالصبر حتى يتم الرد عليك.\n"
                "2️⃣ **وضوح المشكلة:** يرجى كتابة مشكلتك أو طلبك كاملاً مع إرفاق الصور أو الأدلة إن وجدت.\n"
                "3️⃣ **منع التكرار والسبام:** يرجى عدم عمل منشن مستمر للإدارة، فالرد يكون بأسرع وقت ممكن حسب الأسبقية.\n"
                "4️⃣ **الالتزام بالقسم:** يرجى التأكد من فتح التكت في القسم المخصص لمشكلتك لضمان خدمتك بسرعة.\n"
                "5️⃣ **إغلاق التكت:** عند انتهاء مشكلتك أو استلام طلبك، يرجى الضغط على زر **إغلاق التكت**.\n\n"
                "📜 **تفاصيل طلبك:**\n"
                f"• **العنوان:** {self.subject.value}\n"
                f"• **الشرح:**\n```\n{self.details.value}\n```"
            )

            welcome_embed = discord.Embed(
                title=f"أرحب يا <@{member.id}> 👋 | تكت [ {cat_name} ]",
                description=f"يا هلا والله بك في مركز الدعم الفني الخاص بنا!\nتم فتح التكت الخاص بك بنجاح، وطاقم الإدارة اتوصل له إشعار وبيردون عليك بأقرب وقت.\n\n{rules_text}",
                color=cat_color,
                timestamp=datetime.utcnow()
            )
            welcome_embed.set_footer(text="نظام الدعم الفني وإدارة التذاكر")

            view = TicketControlView()
            await ticket_channel.send(
                content=f"<@{member.id}> | <@&{STAFF_ROLE_ID}>",
                embed=welcome_embed,
                view=view
            )

            await interaction.edit_original_response(content=f"✅ أبشر، تم فتح التكت حقك هنا: {ticket_channel.mention}")

        except Exception as e:
            print(f"[TICKET_CREATION_ERROR] {e}")
            await interaction.edit_original_response(content="❌ حدث خطأ غير متوقع أثناء إنشاء التكت، تأكد من صلاحيات البوت!")

# مودال سبب الإغلاق
class CloseReasonModal(discord.ui.Modal, title="سبب إغلاق التكت"):
    reason = discord.ui.TextInput(
        label="سبب الإغلاق (اختياري)",
        placeholder="اكتب سبب إغلاق التكت هنا...",
        style=discord.TextStyle.short,
        required=False,
        max_length=200
    )

    async def on_submit(self, interaction: discord.Interaction):
        channel = interaction.channel
        close_reason = self.reason.value or "بدون ذكر سبب"

        cursor.execute("SELECT owner_id, category, claimed_by, added_users FROM active_tickets WHERE channel_id = ?", (str(channel.id),))
        row = cursor.fetchone()

        owner_id = row[0] if row else "غير معروف"
        category = row[1] if row else "غير محدد"
        claimed_by = row[2] if row and row[2] else "لم تُستلم"
        added_users = json.loads(row[3]) if row and row[3] else []
        added_formatted = ", ".join([f"<@{uid}>" for uid in added_users]) if added_users else "لا يوجد"

        close_log = discord.Embed(
            title="📄 تقرير إغلاق تكت",
            color=0xED4245,
            timestamp=datetime.utcnow()
        )
        close_log.add_field(name="📌 التكت:", value=f"`{channel.name}`", inline=True)
        close_log.add_field(name="📂 القسم:", value=f"`{category}`", inline=True)
        close_log.add_field(name="👤 صاحب التكت:", value=f"<@{owner_id}>", inline=False)
        close_log.add_field(name="🙋‍♂️ المستلم:", value=f"<@{claimed_by}>" if claimed_by != "لم تُستلم" else "لم تُستلم", inline=True)
        close_log.add_field(name="👥 المضافين:", value=added_formatted, inline=True)
        close_log.add_field(name="🔒 أُغلق بواسطة:", value=f"<@{interaction.user.id}>", inline=False)
        close_log.add_field(name="📝 السبب:", value=f"```{close_reason}```", inline=False)

        await send_log(interaction.guild, close_log)
        cursor.execute("DELETE FROM active_tickets WHERE channel_id = ?", (str(channel.id),))
        db.commit()

        await interaction.response.send_message("🔒 تم، بيتم حذف وقفل التكت خلال 3 ثوانٍ...")

        import asyncio
        await asyncio.sleep(3)
        try:
            await channel.delete()
        except Exception:
            pass

# ==================== 4. واجهات الأزرار والقوائم المنسدلة ====================

class TicketSelectMenu(discord.ui.Select):
    def __init__(self):
        options = [
            discord.SelectOption(label="الدعم الفني والمشاكل", description="لحل المشاكل التقنية وبلاغات اللاعبين", value="support", emoji="🛠️"),
            discord.SelectOption(label="الاستفسارات العامة", description="لأي استفسار أو سؤال عام عندك", value="general", emoji="💬"),
            discord.SelectOption(label="قسم المتجر والشراء", description="للشراء، الشحن، والاستفسار عن المنتجات", value="store", emoji="🛒"),
            discord.SelectOption(label="إعادة ضبط القائمة", description="تفريغ الاختيار الحالي من القائمة", value="reset", emoji="🔄")
        ]
        super().__init__(placeholder="اختر القسم المناسب من هنا يا بعدي...", min_values=1, max_values=1, options=options, custom_id="ticket_select_menu")

    async def callback(self, interaction: discord.Interaction):
        if self.values[0] == "reset":
            return await interaction.response.send_message("🔄 تم تفريغ الاختيار بنجاح.", ephemeral=True)
        
        modal = TicketModal(self.values[0])
        await interaction.response.send_modal(modal)

class TicketSetupView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)
        self.add_item(TicketSelectMenu())

class TicketControlView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)

    @discord.ui.button(label="استلام التكت", style=discord.ButtonStyle.success, emoji="🙋‍♂️", custom_id="claim_ticket_btn")
    async def claim_ticket(self, interaction: discord.Interaction, button: discord.ui.Button):
        is_staff = interaction.user.get_role(STAFF_ROLE_ID) or interaction.user.guild_permissions.administrator
        if not is_staff:
            return await interaction.response.send_message("❌ هذا الزر مخصص لرجال الإدارة فقط!", ephemeral=True)

        cursor.execute("SELECT claimed_by FROM active_tickets WHERE channel_id = ?", (str(interaction.channel.id),))
        row = cursor.fetchone()
        if row and row[0]:
            return await interaction.response.send_message(f"❌ التكت مستلمة أصلاً بواسطة <@{row[0]}>", ephemeral=True)

        cursor.execute("UPDATE active_tickets SET claimed_by = ? WHERE channel_id = ?", (str(interaction.user.id), str(interaction.channel.id)))
        db.commit()

        button.disabled = True
        button.label = f"مستلمة: {interaction.user.name}"
        await interaction.message.edit(view=self)
        await interaction.channel.send(f"🙋‍♂️ كفو! تم استلام التكت بواسطة الإداري: <@{interaction.user.id}>.")

        claim_embed = discord.Embed(
            title="🙋‍♂️ استلام تكت",
            color=0xFEE75C,
            timestamp=datetime.utcnow()
        )
        claim_embed.add_field(name="التكت:", value=interaction.channel.name, inline=True)
        claim_embed.add_field(name="المستلم:", value=f"<@{interaction.user.id}>", inline=True)
        await send_log(interaction.guild, claim_embed)

    @discord.ui.button(label="إضافة عضو", style=discord.ButtonStyle.primary, emoji="➕", custom_id="add_user_btn")
    async def add_user(self, interaction: discord.Interaction, button: discord.ui.Button):
        is_staff = interaction.user.get_role(STAFF_ROLE_ID) or interaction.user.guild_permissions.administrator
        if not is_staff:
            return await interaction.response.send_message("❌ هذا الخيار للإدارة فقط.", ephemeral=True)

        await interaction.response.send_message("💬 أرسل منشن العضو أو الأيدي حقه بالشات الحين (معك 30 ثانية)...", ephemeral=True)

        def check(m):
            return m.author.id == interaction.user.id and m.channel.id == interaction.channel.id

        try:
            msg = await bot.wait_for('message', check=check, timeout=30.0)
            clean_id = msg.content.strip().replace("<@", "").replace(">", "").replace("!", "")
            target = await interaction.guild.fetch_member(int(clean_id))

            await interaction.channel.set_permissions(target, view_channel=True, send_messages=True, read_message_history=True)
            await msg.delete()

            cursor.execute("SELECT added_users FROM active_tickets WHERE channel_id = ?", (str(interaction.channel.id),))
            row = cursor.fetchone()
            if row:
                users_list = json.loads(row[0] or "[]")
                if str(target.id) not in users_list:
                    users_list.append(str(target.id))
                    cursor.execute("UPDATE active_tickets SET added_users = ? WHERE channel_id = ?", (json.dumps(users_list), str(interaction.channel.id)))
                    db.commit()

            await interaction.channel.send(f"✅ أبشر، تم إضافة العضو <@{target.id}> للتكت بواسطة <@{interaction.user.id}>.")
        except Exception:
            await interaction.followup.send("⏰ انتهت المهلة أو الأيدي غير صحيح!", ephemeral=True)

    @discord.ui.button(label="استدعاء العضو", style=discord.ButtonStyle.secondary, emoji="🔔", custom_id="summon_user_btn")
    async def summon_user(self, interaction: discord.Interaction, button: discord.ui.Button):
        is_staff = interaction.user.get_role(STAFF_ROLE_ID) or interaction.user.guild_permissions.administrator
        if not is_staff:
            return await interaction.response.send_message("❌ هذا الخيار للإدارة فقط.", ephemeral=True)

        owner_id = interaction.channel.topic
        if not owner_id:
            return await interaction.response.send_message("❌ ما قدرنا نوصل لصاحب التكت.", ephemeral=True)

        await interaction.response.send_message(f"🔔 يا <@{owner_id}>، لاهنت ارجع للتكت! استدعاء من الإداري: <@{interaction.user.id}>")

    @discord.ui.button(label="استدعاء الإدارة", style=discord.ButtonStyle.secondary, emoji="📢", custom_id="summon_staff_btn")
    async def summon_staff(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_message(f"📢 يا إخوان <@&{STAFF_ROLE_ID}>، مطلوب حضوركم للتكت من قبل: <@{interaction.user.id}>!")

    @discord.ui.button(label="إغلاق التكت", style=discord.ButtonStyle.danger, emoji="🔒", custom_id="close_ticket_btn")
    async def close_ticket(self, interaction: discord.Interaction, button: discord.ui.Button):
        modal = CloseReasonModal()
        await interaction.response.send_modal(modal)

# ==================== 5. الأوامر النصية وأوامر الباند المخصصة ====================

@bot.event
async def on_message(message):
    if message.author.bot or not message.guild:
        return

    # 1. أمر إنشاء لوحة التكتات !setup
    if message.content == "!setup":
        if not message.author.guild_permissions.administrator:
            return await message.reply("ما عندك صلاحية تستخدم هالأمر يا طويل العمر!")

        embed = discord.Embed(
            title="🎫 مركز التذاكر والدعم الفني",
            description=(
                "أرحب بك في مركز الدعم الفني والخدمات العامة!\n\n"
                "يرجى اختيار **القسم المناسب لموضوعك** من القائمة المنسدلة بالأسفل لفتح تكت وتوجيهك للإدارة المختصة مباشرة."
            ),
            color=EMBED_COLOR
        )
        embed.set_footer(text="نظام الدعم الفني الآلي")

        view = TicketSetupView()
        await message.channel.send(embed=embed, view=view)
        await message.delete().catch(lambda _: None)
        return

    # 2. أوامر الباند المخصصة
    ban_commands = [
        'بنعالي', '!بنعالي', 
        'بنعال_براء', '!بنعال_براء', 
        'بنعال_حرب', '!بنعال_حرب', 
        'بنعال_ريان', '!بنعال_ريان'
    ]

    args = message.content.strip().split()
    if args and args[0] in ban_commands:
        if not message.author.guild_permissions.ban_members:
            return await message.reply("❌ ما عندك صلاحية تبنيد يا الغالي!")

        target = None
        if message.mentions:
            target = message.mentions[0]
        elif len(args) > 1:
            try:
                target = await message.guild.fetch_member(int(args[1]))
            except:
                pass

        if not target:
            return await message.reply(f"❌ لاهنت سو منشن للشخص أو اكتب ايديه!\nمثال: `{args[0]} @user السبب`")

        reason = " ".join(args[2:]) if len(args) > 2 else "بدون سبب محدد"

        try:
            await target.ban(reason=f"الأمر: {args[0]} | بواسطة: {message.author} | السبب: {reason}")
            await message.channel.send(f"✅ **{target.name}** banned from the server! ✈️")
        except Exception as e:
            print(f"[BAN_ERROR] {e}")
            await message.reply("❌ ما أقدر أبنّد هذا الشخص! (قد تكون رتبته أعلى مني أو رتبة إدارية).")

    await bot.process_commands(message)

# ==================== 6. تشغيل البوت ====================
token = os.getenv("TOKEN")
if token:
    bot.run(token)
else:
    bot.run(os.environ.get("DISCORD_TOKEN", "TOKEN_HERE"))
