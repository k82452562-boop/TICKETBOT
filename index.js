// تشغيل الخادم الوهمي للبقاء أونلاين
try { require('./server.js'); } catch (e) {}

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
const STAFF_ROLE_ID = '1554251752574951425';
const LOG_CHANNEL_ID = '1554252226732490782';
const TICKET_CATEGORY_ID = '1554252056183967795';

// مانع التكرار الفولاذي للرسائل
const processedMessages = new Set();

const aiSystemPrompt = `
أنت بوت ديسكورد ذكي وفلّة وطقطوق لسيرفر "منتدى النظيم".
تتكلم بلهجة سعودية عامية 100% (مصطلحات: يا بعد حيي، يالطيب، وش السالفة، تكفى، كفو، يا حليلك، أرحب).
- في الشات العام والتكتات: جاوب العضو بدقة وبلهجة محترمة ولطيفة وسعودية عامية. إذا كان السؤال غبي أو شاطح طقطق عليه بأسلوب فكاهي.
- إذا كان السؤال يحتاج تدخل إداري أو غير معروف، قل له بوضوح إنك بتنادي الإدارة.
`;

// دالة اتصال شاملة تجرّب الطريقتين تلقائياً (URL Key و Bearer Header)
async function fetchGeminiResponse(userPrompt) {
    const rawKey = process.env.GEMINI_API_KEY;
    if (!rawKey) {
        console.log("❌ GEMINI_API_KEY is missing in Railway Variables!");
        return null;
    }

    const apiKey = rawKey.trim();
    const requestBody = JSON.stringify({
        contents: [{ parts: [{ text: `${aiSystemPrompt}\n\nسؤال المستخدم: ${userPrompt}` }] }]
    });

    // تجربة الطريقة الأولى (Standard Query Key)
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: requestBody
        });
        const data = await res.json();
        if (data && data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
            return data.candidates[0].content.parts[0].text;
        }
    } catch (e) {
        console.log("Method 1 failed, trying Method 2...");
    }

    // تجربة الطريقة الثانية (Bearer Token)
    try {
        const url2 = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`;
        const res2 = await fetch(url2, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: requestBody
        });
        const data2 = await res2.json();
        if (data2 && data2.candidates && data2.candidates[0]?.content?.parts[0]?.text) {
            return data2.candidates[0].content.parts[0].text;
        } else {
            console.error("❌ Gemini API Error Output:", JSON.stringify(data2));
        }
    } catch (e) {
        console.error("❌ Method 2 Exception:", e);
    }

    return null;
}

// الذاكرة المؤقتة للتكتات بحالة الاستلام
const ticketsData = new Map();

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
    console.log(`[!] ارحب! البوت شغال باسم: ${client.user.tag} 👑🚀`);
    client.user.setActivity('منتدى النظيم 🛡️ | الذكاء الاصطناعي', { type: 0 });
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    // حظر التكرار
    if (processedMessages.has(message.id)) return;
    processedMessages.add(message.id);
    setTimeout(() => processedMessages.delete(message.id), 30000);

    const args = message.content.trim().split(/ +/);
    const command = args[0].toLowerCase();

    // 1️⃣ تفاعل التكتات
    if (message.channel.parentId === TICKET_CATEGORY_ID) {
        const isExplicitAiCommand = command === '!سؤال' || command === 'إذكاء' || command === '!ذكاء' || message.mentions.has(client.user);
        const ticketInfo = ticketsData.get(message.channel.id) || { claimedBy: null };

        if (isExplicitAiCommand) {
            const userQuery = message.content.replace(/<@!?\d+>|!سؤال|إذكاء|!ذكاء/g, '').trim();
            if (!userQuery) return message.reply('اكتب سؤالك يا الغالي 🗿');

            await message.channel.sendTyping();
            const aiResponse = await fetchGeminiResponse(userQuery);
            if (aiResponse) {
                await message.reply(aiResponse);
            } else {
                await message.reply('❌ مفتاح الذكاء الاصطناعي غير مفعل حالياً في إعدادات Railway.');
            }
            return;
        }

        if (message.content.startsWith('!')) return;

        // إذا التكت مستلم أو المرسل إداري لا يتلقف البوت
        if (ticketInfo.claimedBy) return;
        const isStaff = message.member.roles.cache.has(STAFF_ROLE_ID) || message.member.permissions.has(PermissionFlagsBits.Administrator);
        if (isStaff) return;

        await message.channel.sendTyping();
        const aiResponse = await fetchGeminiResponse(message.content);

        if (aiResponse) {
            await message.reply(`🤖 **المساعد الذكي:**\n${aiResponse}`);
        } else {
            await message.reply('يا هلا بك! تم استلام رسالتك وسيتم الرد عليك من قبل طاقم الإدارة بأسرع وقت 🚀');
        }
        return;
    }

    // 2️⃣ الشات العام
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
            await message.reply('❌ مفتاح الذكاء الاصطناعي غير مفعل حالياً في إعدادات Railway.');
        }
        return;
    }

    // 3️⃣ Setup
    if (command === '!setup' || command === 'سيت_اب') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ ما عندك صلاحية!');
        }

        const embed = new EmbedBuilder()
            .setTitle('🏛️ مـركـز الـدعـم الـفـنـي والـتـكـتـات | مـنـتـدى الـنـظـيـم 🛡️')
            .setDescription('اختر القسم المناسب لطلبك من القائمة المنسدلة بالأسفل.')
            .setColor('#FFD700')
            .setThumbnail(message.guild.iconURL({ dynamic: true }))
            .setTimestamp();

        const menuRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ticket_select_menu')
                .setPlaceholder('👑 اختر قسم التكت المناسب...')
                .addOptions([
                    { label: 'قسم الدعم الفني والمشاكل', value: 'support_ticket', emoji: '🛠️' },
                    { label: 'قسم الاستفسارات العامة', value: 'general_ticket', emoji: '💬' },
                    { label: 'قسم المتجر والشراء (Store)', value: 'store_ticket', emoji: '💎' },
                    { label: 'تحديث وتفريغ القائمة', value: 'refresh_menu_option', emoji: '🔄' }
                ])
        );

        await message.channel.send({ embeds: [embed], components: [menuRow] });
        await message.delete().catch(() => {});
        return;
    }

    // 4️⃣ أمر مسح الشات
    if (command === 'مسح' || command === '!clear') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return;
        const amount = parseInt(args[1]);
        if (isNaN(amount) || amount < 1 || amount > 100) return;
        await message.channel.bulkDelete(amount, true).catch(() => {});
        const msg = await message.channel.send(`🧹 تم مسح ${amount} رسالة.`);
        setTimeout(() => msg.delete().catch(() => {}), 3000);
        return;
    }
});

// 🛠️ التفاعلات والأزرار
client.on('interactionCreate', async interaction => {
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select_menu') {
        if (interaction.values[0] === 'refresh_menu_option') {
            return interaction.reply({ content: '🔄 تم التحديث!', ephemeral: true });
        }

        const guild = interaction.guild;
        const member = interaction.member;

        const channelName = `ticket-${interaction.values[0]}-${member.user.username}`.toLowerCase();
        if (guild.channels.cache.find(c => c.name === channelName)) {
            return interaction.reply({ content: '❌ عندك تكت مفتوح بالفعل!', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });
        try {
            const ticketChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: TICKET_CATEGORY_ID,
                topic: member.id,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                    { id: STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                    { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
                ]
            });

            ticketsData.set(ticketChannel.id, { ownerId: member.id, claimedBy: null });

            const controlRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('🙋‍♂️ استلام التذكرة').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 إغلاق التذكرة').setStyle(ButtonStyle.Danger)
            );

            await ticketChannel.send({ content: `<@${member.id}> | <@&${STAFF_ROLE_ID}>`, components: [controlRow] });
            await interaction.editReply({ content: `✅ تم إنشاء التكت: ${ticketChannel}` });
        } catch (e) {
            await interaction.editReply({ content: '❌ خطأ في الإنشاء.' });
        }
    }

    if (interaction.isButton() && interaction.customId === 'claim_ticket') {
        const isStaff = interaction.member.roles.cache.has(STAFF_ROLE_ID) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        if (!isStaff) return interaction.reply({ content: '❌ هذا الزر للإدارة فقط!', ephemeral: true });

        let data = ticketsData.get(interaction.channel.id);
        if (!data) {
            data = { ownerId: interaction.channel.topic || 'غير معروف', claimedBy: interaction.user.id };
            ticketsData.set(interaction.channel.id, data);
        } else {
            data.claimedBy = interaction.user.id;
        }

        const row = ActionRowBuilder.from(interaction.message.components[0]);
        row.components.forEach(comp => { 
            if (comp.data.custom_id === 'claim_ticket') comp.setDisabled(true).setLabel(`مستلمة من: ${interaction.user.username}`); 
        });

        await interaction.update({ components: [row] });
        await interaction.followUp({ content: `🙋‍♂️ تم استلام التكت بواسطة <@${interaction.user.id}>. (تم إيقاف الرد الآلي للذكاء الاصطناعي لهذا التكت)` });

        const claimEmbed = new EmbedBuilder()
            .setTitle('🙋‍♂️ استلام تكت (Claim Ticket)')
            .setDescription(`تم استلام التكت بواسطة <@${interaction.user.id}>`)
            .setColor('#FEE75C')
            .setTimestamp();

        await sendLog(interaction.guild, `🙋‍♂️ تم استلام التكت بواسطة: <@${interaction.user.id}>`, claimEmbed);
    }

    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        await sendLog(interaction.guild, `🔒 أُغلق بواسطة: <@${interaction.user.id}>`);
        ticketsData.delete(interaction.channel.id);
        await interaction.reply({ content: '🔒 جاري الحذف...' });
        setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
    }
});

client.login(process.env.TOKEN);
