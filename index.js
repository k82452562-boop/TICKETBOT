// تشغيل الخادم الوهمي للبقاء أونلاين 24 ساعة
require('./server.js');

const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    ChannelType, 
    PermissionFlagsBits 
} = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// ⚙️ الإعدادات الأساسية (الآديهات الرسمية الخاصة بك)
const STAFF_ROLE_ID = '1554251752574951425'; // رتبة الإدارة الجديدة
const LOG_CHANNEL_ID = '1554252226732490782'; // روم لوق التكتات
const TICKET_CATEGORY_ID = '1554252056183967795'; // كاتجوري التكتات

// تهيئة الذكاء الاصطناعي (Gemini AI)
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// شخصية البوت الذكي بالطقطقة واللهجة السعودية
const aiSystemPrompt = `
أنت بوت ديسكورد ذكي وفلّة وطقطوق لسيرفر "منتدى النظيم".
تتكلم بلهجة سعودية عامية 100% (مصطلحات: يا بعد حيي، يالطيب، وش السالفة، تكفى، كفو، يا حليلك، أرحب).
- في الشات العام: إذا سألك أحد سؤال غبي أو بديهي، طقطق عليه بأسلوب فكاهي وسريع قبل تجاوبه.
- في التكتات والدعم الفني: حاول تساعد العضو بدقة وبلهجة محترمة ولطيفة. إذا السؤال ما تعرفه أو يحتاج تدخل إداري بشر، قل له بكل بساطة إنك بتنادي الإدارة.
`;

const aiModel = genAI ? genAI.getGenerativeModel({ model: "gemini-1.5-flash", systemInstruction: aiSystemPrompt }) : null;

// الذاكرة المؤقتة للتكتات والتحذيرات
const ticketsData = new Map();
const userWarnings = new Map();

// 📢 دالة مساعدة لإرسال اللوق لروم اللوق
async function sendLog(guild, content, embed) {
    try {
        const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
            const options = {};
            if (content) options.content = content;
            if (embed) options.embeds = [embed];
            await logChannel.send(options);
        }
    } catch (err) {
        console.log('❌ خطأ في إرسال اللوق:', err);
    }
}

client.once('ready', () => {
    console.log(`[!] ارحب تراحيب المطر! البوت الخارق والذكاء الاصطناعي شغالين باسم: ${client.user.tag} 👑🚀`);
    client.user.setActivity('منتدى النظيم 🛡️ | الذكاء السعودي المطور', { type: 0 });
});

// 📩 التعامل مع الأوامر والتفاعلات النصية والذكية
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const args = message.content.trim().split(/ +/);
    const command = args[0].toLowerCase();

    // 1️⃣ تفاعل الذكاء الاصطناعي داخل التكتات تلقائياً (التكفل بالدعم)
    if (message.channel.parentId === TICKET_CATEGORY_ID && !message.content.startsWith('!')) {
        const ticketInfo = ticketsData.get(message.channel.id);
        
        // إذا الرسالة من صاحب التكت ولم يتم الرد عليه بالذكاء الاصطناعي بعد
        if (ticketInfo && message.author.id === ticketInfo.ownerId && !ticketInfo.aiResponded) {
            ticketInfo.aiResponded = true; // كي لا يكرر الرد التلقائي

            if (aiModel) {
                await message.channel.sendTyping();
                try {
                    // البحث في محتوى رومات السيرفر النصية (مثل رومات الشروط والقوانين)
                    let serverContext = "";
                    const textChannels = message.guild.channels.cache.filter(c => c.type === ChannelType.GuildText && c.id !== message.channel.id);
                    
                    for (const [id, ch] of textChannels) {
                        if (ch.permissionsFor(message.guild.members.me).has(PermissionFlagsBits.ReadMessageHistory)) {
                            const lastMsgs = await ch.messages.fetch({ limit: 5 }).catch(() => null);
                            if (lastMsgs) {
                                serverContext += `\n[محتوى من روم ${ch.name}]: ` + lastMsgs.map(m => m.content).join(" | ");
                            }
                        }
                    }

                    const prompt = `
سؤال العضو في التكت: "${message.content}"
معلومات إضافية من رومات السيرفر:
${serverContext.slice(0, 1500)}

المطلوب:
إذا كان السؤال بسيط وموجود بالمعلومات أعلاه، جاوب العضو فوراً بلهجة سعودية عامية لطيفة ومباشرة.
إذا كان السؤال يحتاج تدخل إداري أو غير معروف، رد عليه بـ: "NEED_STAFF" متضمنة مع رسالة ترحيبية وتقول له إنك بتنادي الإدارة.
`;

                    const result = await aiModel.generateContent(prompt);
                    const aiText = result.response.text();

                    if (aiText.includes("NEED_STAFF")) {
                        const cleanMsg = aiText.replace("NEED_STAFF", "").trim();
                        await message.reply(cleanMsg || "يا هلا بك! موضوعك يبيله تدخل طاقم الإدارة، أبشر بعزك تم إشعارهم وسيتم الرد عليك فوراً 🚀");
                        await message.channel.send(`📢 <@&${STAFF_ROLE_ID}>، استدعاء آلي للتكت! العضو ينظر المساعدة.`);
                    } else {
                        await message.reply(`🤖 **المساعد الذكي:**\n${aiText}\n\n*(إذا إجابتي ما كفتك، اضغط على زر "📢 إشعار طاقم الإدارة" تحت ويوصلونك بأسرع وقت!)*`);
                    }

                } catch (err) {
                    console.error("خطأ في ذكاء التكت:", err);
                }
            }
            return;
        }
    }

    // 2️⃣ الذكاء الاصطناعي في الشات العام والطقطقة (!سؤال أو منشن للبوت)
    if (message.mentions.has(client.user) || command === '!سؤال' || command === '!ذكاء') {
        const userQuery = message.content.replace(/<@!?\d+>|!سؤال|!ذكاء/g, '').trim();

        if (!userQuery) {
            return message.reply('وش تبي يا الغالي؟ اكتب سؤالك مو تسوي لي منشن فاضي 🗿');
        }

        if (!aiModel) {
            return message.reply('❌ مفتاح الذكاء الاصطناعي غير مفعل حالياً لدى الإدارة.');
        }

        await message.channel.sendTyping();
        try {
            const result = await aiModel.generateContent(userQuery);
            await message.reply(result.response.text());
        } catch (err) {
            console.error(err);
            await message.reply('أبشرك الذكاء عندي فصل، جرب تسألني بعد شوي 🌚');
        }
        return;
    }

    // 3️⃣ أمر Setup قائمة التكتات بتصميم أسطوري
    if (command === '!setup' || command === 'سيت_اب') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ يا طويل العمر ما عندك صلاحية تستخدم هالأمر!');
        }

        const embed = new EmbedBuilder()
            .setTitle('🏛️ مـركـز الـدعـم الـفـنـي والـتـكـتـات | مـنـتـدى الـنـظـيـم 🛡️')
            .setDescription(`
─── ･ ｡ﾟ☆: *.☽ .* :☆ﾟ. ───

يا هلا والله ومسهلا فيكم جميعاً في مركز الدعم الفني 👋
عشان نخدمك بأفضل شكل وبسرعة قياسية، **اختر القسم المناسب لطلبك من القائمة المنسدلة بالأسفل.**

─── ･ ｡ﾟ☆: *.☽ .* :☆ﾟ. ───

📜 **قوانين وشروط فتح التكت (نرجو الالتزام):**
▫️ **1. اطرح مشكلتك فوراً:** أول ما تفتح التكت اكتب موضوعك وتفاصيلك كاملة بدون انتظار.
▫️ **2. يمنع الاستهبال والتجربة:** فتح التكت بدون سبب جدي يحرّمك من الخدمة وقد يعرّضك للباند 👞.
▫️ **3. الاحترام المتبادل:** التعامل الأنيق يسرّع من إنجاز طلبك.
▫️ **4. التزام الصبر:** المساعد الذكي والإدارة متواجدون لخدمتك بأقرب وقت.

─── ･ ｡ﾟ☆: *.☽ .* :☆ﾟ. ───
✨ **اختر القسم المناسب لك من القائمة تحت 👇**
            `)
            .setColor('#FFD700') // ذهبي فخم
            .setThumbnail(message.guild.iconURL({ dynamic: true }))
            .setFooter({ text: 'نظام الدعم الآلي الفاخر والذكاء الاصطناعي • منتدى النظيم', iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        const menuRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ticket_select_menu')
                .setPlaceholder('👑 اضغط هنا واختر قسم التكت المناسب...')
                .addOptions([
                    {
                        label: 'قسم الدعم الفني والمشاكل',
                        description: 'بلاغات اللاعبين، المشاكل التقنية والحلول',
                        value: 'support_ticket',
                        emoji: '🛠️',
                    },
                    {
                        label: 'قسم الاستفسارات العامة',
                        description: 'لأي سؤال أو استفسار بخصوص السيرفر',
                        value: 'general_ticket',
                        emoji: '💬',
                    },
                    {
                        label: 'قسم المتجر والشراء (Store)',
                        description: 'للشراء، الشحن، والاستفسار عن المنتجات',
                        value: 'store_ticket',
                        emoji: '💎',
                    },
                    {
                        label: 'تحديث وتفريغ القائمة',
                        description: 'إعادة تصفير خيار القائمة',
                        value: 'refresh_menu_option',
                        emoji: '🔄',
                    },
                ]),
        );

        await message.channel.send({ embeds: [embed], components: [menuRow] });
        await message.delete().catch(() => {});
        return;
    }

    // 4️⃣ أوامر الباند الفاخرة
    const banCommands = [
        'بنعالي', '!بنعالي', 
        'بنعال_براء', '!بنعال_براء', 
        'بنعال_حرب', '!بنعال_حرب', 
        'بنعال_ريان', '!بنعال_ريان'
    ];

    if (banCommands.includes(command)) {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return message.reply('❌ ما عندك صلاحية تعطي بنعال يا غالي!');
        }

        const target = message.mentions.members.first() || 
            await message.guild.members.fetch(args[1]).catch(() => null);

        if (!target) {
            return message.reply(`❌ منشن الشخص أو اكتب الآيدي حقه!\nمثال: \`${command} @user السبب\``);
        }

        if (!target.bannable) {
            return message.reply('❌ ما أقدر أبنّده! (رتبته أعلى مني أو مع إداري أعلى).');
        }

        const reason = args.slice(2).join(' ') || 'بدون سبب محدد';

        try {
            await target.ban({ reason: `الأمر: ${command} | بواسطة: ${message.author.tag} \vert{} السبب: ${reason}` });
            
            await message.channel.send(`✅ **${target.user.username}** banned from the server! ✈️`);

        } catch (err) {
            console.error('خطأ في الباند:', err);
            await message.reply('❌ حدث خطأ أثناء تنفيذ أمر الباند.');
        }
        return;
    }

    // 5️⃣ أمر مسح الشات (مسح / clear)
    if (command === 'مسح' || command === '!clear' || command === 'clear') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return message.reply('❌ ما عندك صلاحية مسح الرسائل!');
        }

        const amount = parseInt(args[1]);
        if (isNaN(amount) || amount < 1 || amount > 100) {
            return message.reply('❌ حدد عدد الرسائل المراد مسحها من 1 إلى 100 يا طويل العمر!');
        }

        await message.channel.bulkDelete(amount, true).catch(() => {});
        const msg = await message.channel.send(`🧹 **تم تنظيف الشات ومسح ${amount} رسالة بنجاح!**`);
        setTimeout(() => msg.delete().catch(() => {}), 3000);
        return;
    }

    // 6️⃣ أمر كتم العضو (اسكت / timeout)
    if (command === 'اسكت' || command === '!timeout' || command === 'timeout') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return message.reply('❌ ما عندك صلاحية لكتم الأعضاء!');
        }

        const target = message.mentions.members.first() || await message.guild.members.fetch(args[1]).catch(() => null);
        if (!target) return message.reply('❌ منشن الشخص!');

        const minutes = parseInt(args[2]) || 5;
        try {
            await target.timeout(minutes * 60 * 1000, `بواسطة: ${message.author.tag}`);
            await message.channel.send(`🤐 تم إعطاء كتم (Timeout) للعضو <@${target.id}> لمدة ${minutes} دقايق.`);
        } catch (err) {
            await message.reply('❌ ما قدرت أعطيه كتم (تأكد من صلاحيات رتبتي).');
        }
        return;
    }

    // 7️⃣ أمر كارت حساب العضو (معلومات / userinfo / profile)
    if (command === 'معلومات' || command === 'بروفايل' || command === '!userinfo') {
        const target = message.mentions.members.first() || message.member;
        
        const userEmbed = new EmbedBuilder()
            .setTitle(`👤 بطاقة بيانات العضو: ${target.user.username}`)
            .setThumbnail(target.user.displayAvatarURL({ dynamic: true, size: 512 }))
            .setColor('#9B59B6')
            .addFields(
                { name: '🆔 آيدي العضو:', value: `\`${target.id}\``, inline: true },
                { name: '🏷️ اللقب بالسيرفر:', value: `${target.displayName}`, inline: true },
                { name: '📅 تاريخ إنشاء الحساب:', value: `<t:${Math.floor(target.user.createdTimestamp / 1000)}:R>`, inline: false },
                { name: '📥 تاريخ الانضمام للسيرفر:', value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:R>`, inline: false },
                { name: '👑 أعلى رتبة يملكها:', value: `${target.roles.highest}`, inline: true }
            )
            .setFooter({ text: `طلب بواسطة: ${message.author.tag}` })
            .setTimestamp();

        await message.channel.send({ embeds: [userEmbed] });
        return;
    }

    // 8️⃣ أمر إحصائيات السيرفر (السيرفر / server)
    if (command === 'السيرفر' || command === '!server' || command === 'server') {
        const serverEmbed = new EmbedBuilder()
            .setTitle(`📊 إحصائيات سيرفر: ${message.guild.name}`)
            .setThumbnail(message.guild.iconURL({ dynamic: true }))
            .setColor('#3498DB')
            .addFields(
                { name: '👥 عدد الأعضاء الإجمالي:', value: `**${message.guild.memberCount}** عضو`, inline: true },
                { name: '👑 مالك السيرفر:', value: `<@${message.guild.ownerId}>`, inline: true },
                { name: '🚀 عدد البوستات (Boosts):', value: `**${message.guild.premiumSubscriptionCount || 0}** بوست`, inline: true },
                { name: '🆔 آيدي السيرفر:', value: `\`${message.guild.id}\``, inline: false }
            )
            .setFooter({ text: 'منتدى النظيم الملكي' })
            .setTimestamp();

        await message.channel.send({ embeds: [serverEmbed] });
        return;
    }

    // 9️⃣ أمر قياس البينغ والسرعة (بينغ / ping)
    if (command === 'بينغ' || command === '!ping' || command === 'ping') {
        const msg = await message.reply('⚡ جاري قياس سرعة الاستجابة...');
        const ping = msg.createdTimestamp - message.createdTimestamp;
        await msg.edit(`🚀 **سرعة البوت:** \`${ping}ms\` | **سيرفرات الديسكورد:** \`${Math.round(client.ws.ping)}ms\``);
        return;
    }
});

// 🛠️ التعامل مع التفاعلات والأزرار
client.on('interactionCreate', async interaction => {

    // 1️⃣ القائمة المنسدلة للتكتات
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select_menu') {
        const selectedValue = interaction.values[0];

        if (selectedValue === 'refresh_menu_option') {
            return interaction.reply({ content: '🔄 تم تحديث القائمة وتفريغ اختيارك بنجاح!', ephemeral: true });
        }

        const guild = interaction.guild;
        const member = interaction.member;

        let categoryName = 'دعم';
        let categoryColor = '#FFD700';
        if (selectedValue === 'support_ticket') { categoryName = 'دعم فني'; categoryColor = '#FF3366'; }
        else if (selectedValue === 'general_ticket') { categoryName = 'استفسار عام'; categoryColor = '#00FFCC'; }
        else if (selectedValue === 'store_ticket') { categoryName = 'متجر وشراء'; categoryColor = '#FFCC00'; }

        const channelName = `ticket-${categoryName}-${member.user.username}`.toLowerCase();
        const existingChannel = guild.channels.cache.find(c => c.name === channelName);
        if (existingChannel) return interaction.reply({ content: '❌ عندك تكت مفتوح بالفعل بهذا القسم!', ephemeral: true });

        await interaction.deferReply({ ephemeral: true });

        try {
            const ticketChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: TICKET_CATEGORY_ID,
                topic: member.id,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                    { id: STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                    { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
                ],
            });

            ticketsData.set(ticketChannel.id, {
                ownerId: member.id,
                category: categoryName,
                claimedBy: null,
                addedUsers: [],
                aiResponded: false
            });

            const welcomeEmbed = new EmbedBuilder()
                .setTitle(`🎫 تكت جديد | قسم: ${categoryName}`)
                .setDescription(`يا هلا والله ومسهلا بك يا <@${member.id}>!\n\n**الرجاء كتابة طلبك أو مشكلتك فوراً.**\nالمساعد الذكي وطاقم الإدارة متواجدون لخدمتك 🚀`)
                .setColor(categoryColor);

            const controlRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('🙋‍♂️ | استلام التذكرة').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('add_user').setLabel('➕ | إضافة عضو للتكت').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('summon_user').setLabel('🔔 | تنبيه صاحب التكت').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('summon_staff').setLabel('📢 | إشعار طاقم الإدارة').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 | إنهاء وإغلاق التذكرة').setStyle(ButtonStyle.Danger)
            );

            await ticketChannel.send({ 
                content: `<@${member.id}> \vert{} <@&${STAFF_ROLE_ID}>`, 
                embeds: [welcomeEmbed], 
                components: [controlRow] 
            });

            await interaction.editReply({ content: `✅ تم إنشاء التكت الخاص بك بنجاح: ${ticketChannel}` });

        } catch (error) {
            console.log(error);
            await interaction.editReply({ content: '❌ حدث خطأ أثناء إنشاء التكت.' }).catch(() => {});
        }
    }

    // 2️⃣ زر استلام التكت (Claim)
    if (interaction.isButton() && interaction.customId === 'claim_ticket') {
        const isStaff = interaction.member.roles.cache.has(STAFF_ROLE_ID) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        if (!isStaff) return interaction.reply({ content: '❌ هذا الزر مخصص لطاقم الإدارة فقط!', ephemeral: true });

        try {
            const data = ticketsData.get(interaction.channel.id);
            if (data) data.claimedBy = interaction.user.id;

            await interaction.channel.permissionOverwrites.edit(STAFF_ROLE_ID, { ViewChannel: true, SendMessages: false });
            await interaction.channel.permissionOverwrites.edit(interaction.user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });

            const row = ActionRowBuilder.from(interaction.message.components[0]);
            row.components.forEach(comp => {
                if (comp.data.custom_id === 'claim_ticket') {
                    comp.setDisabled(true).setLabel(`مستلمة من: ${interaction.user.username}`);
                }
            });

            await interaction.update({ components: [row] });
            await interaction.followUp({ content: `🙋‍♂️ تم استلام التكت بواسطة <@${interaction.user.id}>.` });

            const claimEmbed = new EmbedBuilder()
                .setTitle('🙋‍♂️ استلام تكت (Claim Ticket)')
                .setDescription(`تم استلام التكت بواسطة <@${interaction.user.id}>`)
                .addFields(
                    { name: '👤 المستلم:', value: `<@${interaction.user.id}> (\`${interaction.user.id}\`)`, inline: true },
                    { name: '📌 التكت:', value: `${interaction.channel.name}`, inline: true }
                )
                .setColor('#FEE75C')
                .setTimestamp();

            await sendLog(interaction.guild, `🙋‍♂️ تم استلام التكت بواسطة: <@${interaction.user.id}>`, claimEmbed);

        } catch (err) {
            console.log('خطأ في استلام التكت:', err);
        }
    }

    // 3️⃣ زر إضافة عضو
    if (interaction.isButton() && interaction.customId === 'add_user') {
        const isStaff = interaction.member.roles.cache.has(STAFF_ROLE_ID) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        if (!isStaff) return interaction.reply({ content: '❌ هذا الزر مخصص لطاقم الإدارة فقط!', ephemeral: true });

        await interaction.reply({ content: '💬 **الرجاء منشن الشخص الذي تريد إضافته (أو كتابة الـ ID الخاص به) في الشات الآن...**\n*(لديك 30 ثانية للإرسال)*', ephemeral: true });

        const filter = m => m.author.id === interaction.user.id;
        const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });

        collector.on('collect', async message => {
            const cleanInput = message.content.trim().replace(/[<@!>]/g, '');
            const targetMember = message.mentions.members.first() || await interaction.guild.members.fetch(cleanInput).catch(() => null);

            if (!targetMember) {
                await message.delete().catch(() => {});
                return interaction.followUp({ content: '❌ لم يتم العثور على العضو!', ephemeral: true });
            }

            try {
                const data = ticketsData.get(interaction.channel.id);
                if (data && !data.addedUsers.includes(targetMember.id)) data.addedUsers.push(targetMember.id);

                await interaction.channel.permissionOverwrites.edit(targetMember.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
                await message.delete().catch(() => {});
                await interaction.channel.send({ content: `✅ تم إضافة العضو <@${targetMember.id}> إلى التكت بنجاح بواسطة <@${interaction.user.id}>.` });

            } catch (err) {
                console.log('خطأ في إضافة العضو:', err);
            }
        });
    }

    // 4️⃣ زر استدعاء العضو
    if (interaction.isButton() && interaction.customId === 'summon_user') {
        const ticketOwnerId = interaction.channel.topic;
        if (!ticketOwnerId) return interaction.reply({ content: '❌ لم يتم العثور على صاحب التكت.', ephemeral: true });
        await interaction.reply({ content: `🔔 <@${ticketOwnerId}>، يرجى التواجد بالروم! استدعاء من الإداري: <@${interaction.user.id}>` });
    }

    // 5️⃣ زر استدعاء الإدارة
    if (interaction.isButton() && interaction.customId === 'summon_staff') {
        await interaction.reply({ content: `📢 <@&${STAFF_ROLE_ID}>، تم استدعاء الإدارة بواسطة <@${interaction.user.id}>!` });
    }

    // 6️⃣ زر إغلاق التكت والتقرير الشامل
    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        const channel = interaction.channel;
        const data = ticketsData.get(channel.id) || { ownerId: channel.topic || 'غير معروف', category: 'غير محدد', claimedBy: null, addedUsers: [] };

        const addedUsersText = data.addedUsers.length > 0 ? data.addedUsers.map(id => `<@${id}>`).join(', ') : 'لا يوجد أعضاء مضافين';

        const finalLogEmbed = new EmbedBuilder()
            .setTitle('📋 تقرير إغلاق تذكرة (Ticket Log)')
            .addFields(
                { name: '📌 اسم التكت:', value: `\`${channel.name}\``, inline: true },
                { name: '📂 القسم:', value: `${data.category}`, inline: true },
                { name: '👤 فتح بواسطة:', value: `<@${data.ownerId}> (\`${data.ownerId}\`)`, inline: false },
                { name: '🙋‍♂️ المستلم:', value: data.claimedBy ? `<@${data.claimedBy}> (\`${data.claimedBy}\`)` : 'لم تُستلم من قبل أي إداري', inline: false },
                { name: '➕ الأعضاء المضافين:', value: addedUsersText, inline: false },
                { name: '🔒 أُغلقت بواسطة:', value: `<@${interaction.user.id}> (\`${interaction.user.id}\`)`, inline: false }
            )
            .setColor('#ED4245')
            .setTimestamp()
            .setFooter({ text: 'نظام اللوق الموحد - منتدى النظيم' });

        await sendLog(interaction.guild, `🔒 تم إغلاق التكت بواسطة: <@${interaction.user.id}> | المستلم: ${data.claimedBy ? `<@${data.claimedBy}>` : 'لا يوجد'}`, finalLogEmbed);

        ticketsData.delete(channel.id);
        await interaction.reply({ content: '🔒 سيتم إغلاق التكت وحذفه الآن...' });
        
        setTimeout(async () => {
            try { await channel.delete(); } catch (err) { console.log('خطأ أثناء حذف الروم:', err); }
        }, 3000);
    }
});

// 🔑 تسجيل الدخول
const tokenToUse = process.env.TOKEN;
if (!tokenToUse) {
    console.log('[!] خطأ حرج: لم يتم العثور على التوكن في إعدادات المنصة!');
    process.exit(1);
}
client.login(tokenToUse);
