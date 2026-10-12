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

const STAFF_ROLE_ID = '1554251752574951425';
const LOG_CHANNEL_ID = '1554252226732490782';
const TICKET_CATEGORY_ID = '1554252056183967795';

const part1 = "gsk_xdp5oajBHtY";
const part2 = "osx3ekegMWGdyb3FYlG0L5uS4k7yoKdTde5REYiUL";
const GROQ_API_KEY = part1 + part2;

const processedMessages = new Set();
const ticketsData = new Map();

const aiSystemPrompt = `أنت بوت ديسكورد ذكي وفلّة وطقطوق لسيرفر منتدى النظيم وتتكلم بلهجة سعودية عامية.`;

async function fetchGroqResponse(userPrompt) {
    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [
                    { role: "system", content: aiSystemPrompt },
                    { role: "user", content: userPrompt }
                ]
            })
        });

        const data = await response.json();
        if (data.choices && data.choices[0]?.message?.content) {
            return data.choices[0].message.content;
        } else {
            return null;
        }
    } catch (err) {
        return null;
    }
}

client.once('ready', () => {
    console.log(`[!] البوت شغال باسم: ${client.user.tag} 👑🚀`);
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    if (processedMessages.has(message.id)) return;
    processedMessages.add(message.id);
    setTimeout(() => processedMessages.delete(message.id), 30000);

    const args = message.content.trim().split(/ +/);
    const command = args[0].toLowerCase();

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
                await message.reply('❌ عذراً، صار خطأ بسيط بالاتصال.');
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
            await message.reply('يا هلا بك! تم استلام رسالتك وسيتم الرد عليك قريباً 🚀');
        }
        return;
    }

    if (message.mentions.has(client.user) || command === '!سؤال' || command === 'إذكاء' || command === '!ذكاء') {
        const userQuery = message.content.replace(/<@!?\d+>|!سؤال|إذكاء|!ذكاء/g, '').trim();
        if (!userQuery) return message.reply('وش تبي يا الغالي؟ اكتب سؤالك 🗿');

        await message.channel.sendTyping();
        const aiResponse = await fetchGroqResponse(userQuery);

        if (aiResponse) {
            await message.reply(aiResponse);
        } else {
            await message.reply('❌ عذراً، صار خطأ بسيط بالاتصال.');
        }
        return;
    }

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

client.login(process.env.TOKEN);
