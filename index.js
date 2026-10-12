// تشغيل الخادم الوهمي للبقاء أونلاين 24 ساعة
try {
    require('./server.js');
} catch (e) {
    console.log("Server file skipped.");
}

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

require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// ⚙️ الإعدادات الأساسية
const STAFF_ROLE_ID = '1554251752574951425'; // رتبة الإدارة
const LOG_CHANNEL_ID = '1554252226732490782'; // روم لوق التكتات
const TICKET_CATEGORY_ID = '1554252056183967795'; // كاتجوري التكتات

// حماية من الردود المزدوجة والمكررة
const processedMessages = new Set();

const aiSystemPrompt = `
أنت بوت ديسكورد ذكي وفلّة وطقطوق لسيرفر "منتدى النظيم".
تتكلم بلهجة سعودية عامية 100% (مصطلحات: يا بعد حيي، يالطيب، وش السالفة، تكفى، كفو، يا حليلك، أرحب).
- في الشات العام والتكتات: جاوب العضو بدقة وبلهجة محترمة ولطيفة وسعودية عامية. إذا كان السؤال غبي أو شاطح طقطق عليه بأسلوب فكاهي.
- إذا كان السؤال يحتاج تدخل إداري أو غير معروف، قل له بوضوح إنك بتنادي الإدارة.
`;

// دالة الاتصال المباشر بـ Gemini API لدعم مفاتيح AQ. والمفاتيح التقليدية
async function fetchGeminiResponse(userPrompt) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`;

    const requestBody = {
        system_instruction: {
            parts: [{ text: aiSystemPrompt }]
        },
        contents: [
            {
                parts: [{ text: userPrompt }]
            }
        ]
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        if (data && data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
            return data.candidates[0].content.parts[0].text;
        } else {
            console.error("Gemini API Error details:", JSON.stringify(data));
            return null;
        }
    } catch (err) {
        console.error("Gemini Fetch Exception:", err);
        return null;
    }
}

// الذاكرة المؤقتة للتكتات
const ticketsData = new Map();

// 📢 دالة إرسال اللوق
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
    console.log(`[!] ارحب تراحيب المطر! البوت الخارق شغال باسم: ${client.user.tag} 👑🚀`);
    client.user.setActivity('منتدى النظيم 🛡️ | الذكاء السعودي المطور', { type: 0 });
});

// 📩 الاستجابة التلقائية ومنع التكرار
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    // منع المعالجة المزدوجة للرسالة المحددة
    if (processedMessages.has(message.id)) return;
    processedMessages.add(message.id);
    setTimeout(() => processedMessages.delete(message.id), 60000);

    const args = message.content.trim().split(/ +/);
    const command = args[0].toLowerCase();

    // 1️⃣ الرد التلقائي الفوري داخل التكتات بدون أمر
    if (message.channel.parentId === TICKET_CATEGORY_ID) {
        if (message.content.startsWith('!')) return;

        await message.channel.sendTyping();
        const aiResponse = await fetchGeminiResponse(`سؤال العضو في التكت: "${message.content}"`);

        if (aiResponse) {
            await message.reply(`🤖 **المساعد الذكي:**\n${aiResponse}`);
        } else {
            await message.reply('يا هلا بك! تم استلام رسالتك وسيتم الرد عليك من قبل طاقم الإدارة بأسرع وقت 🚀');
        }
        return;
    }

    // 2️⃣ الذكاء الاصطناعي في الشات العام (!سؤال / إذكاء / منشن للبوت)
    if (message.mentions.has(client.user) || command === '!سؤال' || command === 'إذكاء' || command === '!ذكاء') {
        const userQuery = message.content.replace(/<@!?\d+>|!سؤال|إذكاء|!ذكاء/g, '').trim();

        if (!userQuery) {
            return message.reply('وش تبي يا الغالي؟ اكتب سؤالك مو تسوي لي منشن فاضي 🗿');
        }

        await message.channel.sendTyping();
        const aiResponse = await fetchGeminiResponse(userQuery);

        if (aiResponse) {
            await message.reply(aiResponse);
        } else {
            await message.reply('❌ مفتاح الذكاء الاصطناعي غير مفعل حالياً أو فيه مشكلة في الإعدادات بـ Railway.');
        }
        return;
    }

    // 3️⃣ أمر Setup قائمة التكتات
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

📜 **قوانين وشروط فتح التكت:**
▫️ **1. اطرح مشكلتك فوراً:** أول ما تفتح التكت اكتب موضوعك وتفاصيلك كاملة.
▫️ **2. يمنع الاستهبال والتجربة:** فتح التكت بدون سبب جدي يعرّضك للباند 👞.
▫️ **3. الصبر والاحترام:** المساعد الذكي والإدارة متواجدون لخدمتك.

─── ･ ｡ﾟ☆: *.☽ .* :☆ﾟ. ───
✨ **اختر القسم المناسب لك من القائمة تحت 👇**
            `)
            .setColor('#FFD700')
            .setThumbnail(message.guild.iconURL({ dynamic: true }))
            .setFooter({ text: 'نظام الدعم الآلي والذكاء الاصطناعي • منتدى النظيم', iconURL: client.user.displayAvatarURL() })
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
    const banCommands = ['بنعالي', '!بنعالي', 'بنعال_براء', '!بنعال_براء', 'بنعال_حرب', '!بنعال_حرب', 'بنعال_ريان', '!بنعال_ريان'];
    if (banCommands.includes(command)) {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return message.reply('❌ ما عندك صلاحية تعطي بنعال يا غالي!');
        }

        const target = message.mentions.members.first() || await message.guild.members.fetch(args[1]).catch(() => null);
        if (!target) return message.reply(`❌ منشن الشخص أو اكتب الآيدي حقه!`);
        if (!target.bannable) return message.reply('❌ ما أقدر أبنّده! (رتبته أعلى مني أو مع إداري أعلى).');

        const reason = args.slice(2).join(' ') || 'بدون سبب محدد';
        try {
            await target.ban({ reason: `الأمر: ${command} | بواسطة: ${message.author.tag} \vert{} السبب: ${reason}` });
            await message.channel.send(`✅ **${target.user.username}** banned from the server! ✈️`);
        } catch (err) {
            await message.reply('❌ حدث خطأ أثناء تنفيذ أمر الباند.');
        }
        return;
    }

    // 5️⃣ أمر مسح الشات
    if (command === 'مسح' || command === '!clear' || command === 'clear') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return message.reply('❌ ما عندك صلاحية!');
        const amount = parseInt(args[1]);
        if (isNaN(amount) || amount < 1 || amount > 100) return message.reply('❌ حدد من 1 إلى 100!');

        await message.channel.bulkDelete(amount, true).catch(() => {});
        const msg = await message.channel.send(`🧹 **تم مسح ${amount} رسالة بنجاح!**`);
        setTimeout(() => msg.delete().catch(() => {}), 3000);
        return;
    }
});

// 🛠️ التفاعلات والأزرار
client.on('interactionCreate', async interaction => {

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
                addedUsers: []
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

    // أزرار التحكم
    if (interaction.isButton() && interaction.customId === 'claim_ticket') {
        const isStaff = interaction.member.roles.cache.has(STAFF_ROLE_ID) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        if (!isStaff) return interaction.reply({ content: '❌ هذا الزر مخصص لطاقم الإدارة فقط!', ephemeral: true });

        const data = ticketsData.get(interaction.channel.id);
        if (data) data.claimedBy = interaction.user.id;

        await interaction.channel.permissionOverwrites.edit(STAFF_ROLE_ID, { ViewChannel: true, SendMessages: false });
        await interaction.channel.permissionOverwrites.edit(interaction.user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });

        const row = ActionRowBuilder.from(interaction.message.components[0]);
        row.components.forEach(comp => { if (comp.data.custom_id === 'claim_ticket') comp.setDisabled(true).setLabel(`مستلمة من: ${interaction.user.username}`); });

        await interaction.update({ components: [row] });
        await interaction.followUp({ content: `🙋‍♂️ تم استلام التكت بواسطة <@${interaction.user.id}>.` });

        const claimEmbed = new EmbedBuilder()
            .setTitle('🙋‍♂️ استلام تكت (Claim Ticket)')
            .setDescription(`تم استلام التكت بواسطة <@${interaction.user.id}>`)
            .setColor('#FEE75C')
            .setTimestamp();

        await sendLog(interaction.guild, `🙋‍♂️ تم استلام التكت بواسطة: <@${interaction.user.id}>`, claimEmbed);
    }

    if (interaction.isButton() && interaction.customId === 'summon_staff') {
        await interaction.reply({ content: `📢 <@&${STAFF_ROLE_ID}>، تم استدعاء الإدارة بواسطة <@${interaction.user.id}>!` });
    }

    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        const channel = interaction.channel;
        const data = ticketsData.get(channel.id) || { ownerId: channel.topic || 'غير معروف', category: 'غير محدد', claimedBy: null };

        const finalLogEmbed = new EmbedBuilder()
            .setTitle('📋 تقرير إغلاق تذكرة (Ticket Log)')
            .addFields(
                { name: '📌 اسم التكت:', value: `\`${channel.name}\``, inline: true },
                { name: '👤 فتح بواسطة:', value: `<@${data.ownerId}>`, inline: false },
                { name: '🙋‍♂️ المستلم:', value: data.claimedBy ? `<@${data.claimedBy}>` : 'لم تُستلم', inline: false },
                { name: '🔒 أُغلقت بواسطة:', value: `<@${interaction.user.id}>`, inline: false }
            )
            .setColor('#ED4245')
            .setTimestamp();

        await sendLog(interaction.guild, `🔒 تم إغلاق التكت بواسطة: <@${interaction.user.id}>`, finalLogEmbed);
        ticketsData.delete(channel.id);
        await interaction.reply({ content: '🔒 سيتم إغلاق التكت وحذفه الآن...' });
        setTimeout(() => channel.delete().catch(() => {}), 3000);
    }
});

const tokenToUse = process.env.TOKEN;
if (!tokenToUse) {
    console.log('[!] خطأ حرج: لم يتم العثور على التوكن في إعدادات المنصة!');
    process.exit(1);
}
client.login(tokenToUse);
