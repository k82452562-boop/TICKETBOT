
try {
    require('./server.js');
} catch (e) {
    console.log("Server file skipped.");
}

require('dotenv').config();

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

const processedMessages = new Set();
const ticketsData = new Map();

const aiSystemPrompt = `
أنت بوت ديسكورد ذكي وفلّة وطقطوق لسيرفر "منتدى النظيم".
تتكلم بلهجة سعودية عامية 100% (مصطلحات: يا بعد حيي، يالطيب، وش السالفة، تكفى، كفو، يا حليلك، أرحب).
- في الشات العام والتكتات: جاوب العضو بدقة وبلهجة محترمة ولطيفة وسعودية عامية.
- إذا كان السؤال غبي أو شاطح طقطق عليه بأسلوب فكاهي دون إساءة.
- إذا كان السؤال يحتاج تدخل إداري أو غير معروف، وضح للعضو أنه يحتاج مراجعة الإدارة.
`;

async function fetchGroqResponse(userPrompt) {
    const apiKey = process.env.GROQ_API_KEY?.trim();

    if (!apiKey) {
        console.error('[Groq] GROQ_API_KEY is missing');
        return '❌ مفتاح الذكاء الاصطناعي غير مضبوط في Railway.';
    }

    if (typeof fetch !== 'function') {
        console.error('[Groq] fetch is unavailable. Check Node.js version.');
        return '❌ إصدار Node.js لا يدعم الاتصال المطلوب.';
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
        const response = await fetch(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'llama-3.1-8b-instant',
                    messages: [
                        { role: 'system', content: aiSystemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 1024
                }),
                signal: controller.signal
            }
        );

        const rawBody = await response.text();
        let data;

        try {
            data = JSON.parse(rawBody);
        } catch {
            console.error(
                '[Groq] Invalid response:',
                response.status,
                rawBody.slice(0, 500)
            );
            return '❌ وصل رد غير صالح من خدمة الذكاء الاصطناعي.';
        }

        if (!response.ok) {
            console.error('[Groq] HTTP error:', response.status, data);

            if (response.status === 401 || response.status === 403) {
                return '❌ مشكلة في مفتاح Groq أو صلاحياته.';
            }

            if (response.status === 429) {
                return '⏳ تجاوزت حدود الاستخدام، انتظر شوي وجرب.';
            }

            return '❌ خدمة الذكاء الاصطناعي تواجه خطأ مؤقتًا.';
        }

        const answer = data.choices?.[0]?.message?.content;

        if (typeof answer !== 'string' || !answer.trim()) {
            console.error('[Groq] Empty response:', data);
            return '❌ الذكاء الاصطناعي رجع ردًا فارغًا.';
        }

        return answer.trim();

    } catch (err) {
        console.error('[Groq] Connection failure:', {
            name: err.name,
            message: err.message,
            cause: err.cause?.message
        });

        if (err.name === 'AbortError') {
            return '⏳ تأخر رد الذكاء الاصطناعي، جرب مرة ثانية.';
        }

        return '❌ تعذر الاتصال بخدمة الذكاء الاصطناعي حاليًا.';
    } finally {
        clearTimeout(timeout);
    }
}

client.once('ready', () => {
    console.log(`[!] البوت شغال باسم: ${client.user.tag}`);
    client.user.setActivity('منتدى النظيم 🛡️ | ذكاء Groq', {
        type: 0
    });
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    if (processedMessages.has(message.id)) return;

    processedMessages.add(message.id);
    setTimeout(() => processedMessages.delete(message.id), 30000);

    const args = message.content.trim().split(/\s+/);
    const command = (args[0] || '').toLowerCase();

    try {
        if (message.channel.parentId === TICKET_CATEGORY_ID) {
            const isExplicitAiCommand =
                command === '!سؤال' ||
                command === 'إذكاء' ||
                command === '!ذكاء' ||
                message.mentions.has(client.user);

            const ticketInfo = ticketsData.get(message.channel.id) || {
                claimedBy: null
            };

            if (isExplicitAiCommand) {
                const userQuery = message.content
                    .replace(/<@!?\d+>/g, '')
                    .replace(/!سؤال|إذكاء|!ذكاء/g, '')
                    .trim();

                if (!userQuery) {
                    return message.reply('اكتب سؤالك يا الغالي 🗿');
                }

                await message.channel.sendTyping();

                const aiResponse = await fetchGroqResponse(userQuery);
                return await message.reply({
                    content: aiResponse.slice(0, 2000)
                });
            }

            if (message.content.startsWith('!')) return;
            if (ticketInfo.claimedBy) return;

            const isStaff =
                message.member.roles.cache.has(STAFF_ROLE_ID) ||
                message.member.permissions.has(
                    PermissionFlagsBits.Administrator
                );

            if (isStaff) return;

            await message.channel.sendTyping();

            const aiResponse = await fetchGroqResponse(message.content);

            return await message.reply({
                content: `🤖 **المساعد الذكي:**\n${aiResponse}`.slice(0, 2000)
            });
        }

        if (
            message.mentions.has(client.user) ||
            command === '!سؤال' ||
            command === 'إذكاء' ||
            command === '!ذكاء'
        ) {
            const userQuery = message.content
                .replace(/<@!?\d+>/g, '')
                .replace(/!سؤال|إذكاء|!ذكاء/g, '')
                .trim();

            if (!userQuery) {
                return message.reply('وش تبي يا الغالي؟ اكتب سؤالك 🗿');
            }

            await message.channel.sendTyping();

            const aiResponse = await fetchGroqResponse(userQuery);

            return await message.reply({
                content: aiResponse.slice(0, 2000)
            });
        }

        if (command === '!setup' || command === 'سيت_اب') {
            if (!message.member.permissions.has(
                PermissionFlagsBits.Administrator
            )) {
                return message.reply('❌ ما عندك صلاحية!');
            }

            const embed = new EmbedBuilder()
                .setTitle('🏛️ مركز الدعم الفني والتكتات | منتدى النظيم 🛡️')
                .setDescription('اختر القسم المناسب لطلبك من القائمة بالأسفل.')
                .setColor('#FFD700');

            const menuRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('ticket_select_menu')
                    .setPlaceholder('👑 اختر قسم التكت المناسب...')
                    .addOptions([
                        {
                            label: 'قسم الدعم الفني والمشاكل',
                            value: 'support_ticket',
                            emoji: '🛠️'
                        },
                        {
                            label: 'قسم الاستفسارات العامة',
                            value: 'general_ticket',
                            emoji: '💬'
                        },
                        {
                            label: 'قسم المتجر والشراء (Store)',
                            value: 'store_ticket',
                            emoji: '💎'
                        },
                        {
                            label: 'تحديث القائمة',
                            value: 'refresh_menu_option',
                            emoji: '🔄'
                        }
                    ])
            );

            await message.channel.send({
                embeds: [embed],
                components: [menuRow]
            });

            await message.delete().catch(() => {});
        }
    } catch (err) {
        console.error('[Message Handler Error]', err);
    }
});

client.on('interactionCreate', async interaction => {
    try {
        if (
            interaction.isStringSelectMenu() &&
            interaction.customId === 'ticket_select_menu'
        ) {
            if (interaction.values[0] === 'refresh_menu_option') {
                return interaction.reply({
                    content: '🔄 تم تحديث القائمة!',
                    ephemeral: true
                });
            }

            const guild = interaction.guild;
            const member = interaction.member;

            await interaction.deferReply({ ephemeral: true });

            const channelName =
                `ticket-${interaction.values[0]}-${member.user.username}`
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, '-')
                    .slice(0, 90);

            const ticketChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: TICKET_CATEGORY_ID,
                topic: member.id,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: member.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    },
                    {
                        id: STAFF_ROLE_ID,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    }
                ]
            });

            ticketsData.set(ticketChannel.id, {
                ownerId: member.id,
                claimedBy: null
            });

            const controlRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('claim_ticket')
                    .setLabel('🙋‍♂️ استلام')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('🔒 إغلاق')
                    .setStyle(ButtonStyle.Danger)
            );

            await ticketChannel.send({
                content: `<@${member.id}> | <@&${STAFF_ROLE_ID}>`,
                components: [controlRow]
            });

            await interaction.editReply({
                content: `✅ تم إنشاء التكت: ${ticketChannel}`
            });
        }

        if (
            interaction.isButton() &&
            interaction.customId === 'claim_ticket'
        ) {
            const isStaff =
                interaction.member.roles.cache.has(STAFF_ROLE_ID) ||
                interaction.member.permissions.has(
                    PermissionFlagsBits.Administrator
                );

            if (!isStaff) {
                return interaction.reply({
                    content: '❌ هذا الزر للإدارة فقط.',
                    ephemeral: true
                });
            }

            const data = ticketsData.get(interaction.channel.id) || {
                claimedBy: null
            };

            if (data.claimedBy) {
                return interaction.reply({
                    content: '⚠️ التكت مستلم بالفعل.',
                    ephemeral: true
                });
            }

            data.claimedBy = interaction.user.id;
            ticketsData.set(interaction.channel.id, data);

            return interaction.reply({
                content: `🙋‍♂️ تم استلام التكت بواسطة <@${interaction.user.id}>`
            });
        }

        if (
            interaction.isButton() &&
            interaction.customId === 'close_ticket'
        ) {
            const data = ticketsData.get(interaction.channel.id);
            const isStaff =
                interaction.member.roles.cache.has(STAFF_ROLE_ID) ||
                interaction.member.permissions.has(
                    PermissionFlagsBits.Administrator
                );

            if (!isStaff && data?.ownerId !== interaction.user.id) {
                return interaction.reply({
                    content: '❌ لا تملك صلاحية إغلاق هذا التكت.',
                    ephemeral: true
                });
            }

            await interaction.reply({
                content: '🔒 جاري إغلاق التكت...'
            });

            setTimeout(() => {
                interaction.channel.delete().catch(console.error);
            }, 2000);
        }
    } catch (err) {
        console.error('[Interaction Handler Error]', err);

        if (interaction.isRepliable() && !interaction.replied &&
            !interaction.deferred) {
            await interaction.reply({
                content: '❌ حدث خطأ، راجع سجلات Railway.',
                ephemeral: true
            }).catch(() => {});
        }
    }
});

client.login(process.env.TOKEN).catch(err => {
    console.error('[Discord Login Error]', err);
});
