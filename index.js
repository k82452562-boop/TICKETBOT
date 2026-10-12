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

// ⚙️ الإعدادات الأساسية والثوابت
const STAFF_ROLE_ID = '1554251752574951425';
const LOG_CHANNEL_ID = '1554252226732490782';
const TICKET_CATEGORY_ID = '1554252056183967795';

// 🔑 مفتاح Groq الصحيح (حرف g صغير)
const GROQ_API_KEY = "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";

const processedMessages = new Set();
const ticketsData = new Map();

const aiSystemPrompt = `
أنت بوت ديسكورد ذكي وفلّة وطقطوق لسيرفر "منتدى النظيم".
تتكلم بلهجة سعودية عامية 100% (مصطلحات: يا بعد حيي، يالطيب، وش السالفة، تكفى، كفو، يا حليلك، أرحب).
- في الشات العام والتكتات: جاوب العضو بدقة وبلهجة محترمة ولطيفة وسعودية عامية. إذا كان السؤال غبي أو شاطح طقطق عليه بأسلوب فكاهي.
- إذا كان السؤال يحتاج تدخل إداري أو غير معروف، قل له بوضوح إنك بتنادي الإدارة.
`;

// 🤖 دالة الاتصال بـ Groq المحدثة بنموذج سليم 100%
async function fetchGroqResponse(userPrompt) {
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    
    const requestBody = {
        model: "llama-3.1-8b-instant",
        messages: [
            { role: "system", content: aiSystemPrompt },
            { role: "user", content: userPrompt }
        ],
        temperature: 0.7
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        if (data && data.choices && data.choices[0]?.message?.content) {
            return data.choices[0].message.content;
        } else {
            console.error("❌ Groq Error Response:", JSON.stringify(data));
            return null;
        }
    } catch (err) {
        console.error("❌ Groq Exception:", err);
        return null;
    }
}

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
    console.log(`[!] البوت شغال بصاروخ Groq باسم: ${client.user.tag} 👑🚀`);
    client.user.setActivity('منتدى النظيم 🛡️ | ذكاء Groq الخارق', { type: 0 });
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    // مانع التكرار الصارم
    if (processedMessages.has(message.id)) return;
    processedMessages.add(message.id);
    setTimeout(() => processedMessages.delete(message.id), 30000);

    const args = message.content.trim().split(/ +/);
    const command = args[0].toLowerCase();

    // 1️⃣ الشات في التكتات
    if (message.channel.parentId === TICKET_CATEGORY_ID) {
        const isExplicitAiCommand = command === '!سؤال' || command === 'إذكاء' || command === '!ذكاء' || message.mentions.has(client.user);
        const ticketInfo = ticketsData.get(message.channel.id) || { claimedBy: null };

        if (isExplicitAiCommand) {
            const userQuery = message.content.replace(/<@!?\d+>|!سؤال|إذكاء|!ذكاء/g, '').trim();
            if (!userQuery) return message.reply('اكتب سؤالك يا الغالي 🗿');

            await message.channel.sendTyping();
            const aiResponse = await fetchGroqResponse(userQuery);
            if (aiResponse) {
                await message.reply(aiResponse);
            } else {
                await message.reply('❌ واجهت مشكلة في الاتصال بـ Groq AI.');
            }
            return;
        }

        if (message.content.startsWith('!')) return;
        if (ticketInfo.claimedBy) return;

        const isStaff = message.member.roles.cache.has(STAFF_ROLE_ID) || message.member.permissions.has(PermissionFlagsBits.Administrator);
        if (isStaff) return;

        await message.channel.sendTyping();
        const aiResponse = await fetchGroqResponse(message.content);

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
        if (!userQuery) return message.reply('وش تبي يا الغالي؟ اكتب سؤالك 🗿');

        await message.channel.sendTyping();
        const aiResponse = await fetchGroqResponse(userQuery);

        if (aiResponse) {
            await message.reply(aiResponse);
        } else {
            await message.reply('❌ واجهت مشكلة في الاتصال بـ Groq AI.');
        }
        return;
    }

    // 3️⃣ أمر سيت اب
    if (command === '!setup' || command === 'سيت_اب') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('❌ ما عندك صلاحية!');

        const embed = new EmbedBuilder()
            .setTitle('🏛️ مـركـز الـدعـم الـفـنـي والـتـكـتـات | مـنـتـدى الـنـظـيـم 🛡️')
            .setDescription('اختر القسم المناسب لطلبك من القائمة المنسدلة بالأسفل.')
            .setColor('#FFD700');

        const menuRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ticket_select_menu')
                .setPlaceholder('👑 اختر قسم التكت المناسب...')
                .addOptions([
                    { label: 'قسم الدعم الفني والمشاكل', value: 'support_ticket', emoji: '🛠️' },
                    { label: 'قسم الاستفسارات العامة', value: 'general_ticket', emoji: '💬' },
                    { label: 'قسم المتجر والشراء (Store)', value: 'store_ticket', emoji: '💎' },
                    { label: 'تحديث القائمة', value: 'refresh_menu_option', emoji: '🔄' }
                ])
        );

        await message.channel.send({ embeds: [embed], components: [menuRow] });
        await message.delete().catch(() => {});
        return;
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select_menu') {
        if (interaction.values[0] === 'refresh_menu_option') {
            return interaction.reply({ content: '🔄 تم تحديث القائمة!', ephemeral: true });
        }

        const guild = interaction.guild;
        const member = interaction.member;
        const channelName = `ticket-${interaction.values[0]}-${member.user.username}`.toLowerCase();

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
                    { id: STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ],
            });

            ticketsData.set(ticketChannel.id, { ownerId: member.id, claimedBy: null });

            const controlRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('🙋‍♂️ استلام').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 إغلاق').setStyle(ButtonStyle.Danger)
            );

            await ticketChannel.send({ content: `<@${member.id}> | <@&${STAFF_ROLE_ID}>`, components: [controlRow] });
            await interaction.editReply({ content: `✅ تم إنشاء التكت: ${ticketChannel}` });
        } catch (e) {
            await interaction.editReply({ content: '❌ حدث خطأ أثناء إنشاء التكت.' });
        }
    }

    if (interaction.isButton() && interaction.customId === 'claim_ticket') {
        let data = ticketsData.get(interaction.channel.id) || {};
        data.claimedBy = interaction.user.id;
        ticketsData.set(interaction.channel.id, data);
        await interaction.reply({ content: `🙋‍♂️ تم استلام التكت بواسطة <@${interaction.user.id}>` });
    }

    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        await interaction.reply({ content: '🔒 جاري إغلاق التكت...' });
        setTimeout(() => interaction.channel.delete().catch(() => {}), 2000);
    }
});

client.login(process.env.TOKEN);
