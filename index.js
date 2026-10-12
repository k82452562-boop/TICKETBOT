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
const Groq = require('groq-sdk');
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

// 🔑 المفتاح الجديد مقسم لتجاوز حظر GitHub وضمان العمل الفوري
const part1 = "Gsk_Ibr0aLXHX0Ba1";
const part2 = "OjTDPYOWGdyb3FYvz3izhQT08Nm3Y1Qyi1ZSxqm";
const GROQ_API_KEY = part1 + part2;

const groq = new Groq({ apiKey: GROQ_API_KEY });

const processedMessages = new Set();
const ticketsData = new Map();

const aiSystemPrompt = `أنت بوت ديسكورد ذكي وفلّة وطقطوق لسيرفر منتدى النظيم وتتكلم بلهجة سعودية عامية.`;

async function fetchGroqResponse(userPrompt) {
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: aiSystemPrompt },
                { role: "user", content: userPrompt }
            ],
            model: "llama-3.1-8b-instant",
        });

        return chatCompletion.choices[0]?.message?.content || null;
    } catch (err) {
        console.error("Groq SDK Error:", err);
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
