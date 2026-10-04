// تشغيل الخادم الوهمي أولاً للبقاء أونلاين 24 ساعة
require('./server.js');

const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// إعدادات البوت الأساسية
const STAFF_ROLE_ID = '1545520633939624006'; // رتبة الإدارة
const LOG_CHANNEL_ID = '1543094678038257784'; // روم اللوق
const TICKET_CATEGORY_ID = '1543094678038257784'; // أيدي الكاتجوري الخاص بالتكتات

client.once('ready', () => {
    console.log(`[!] تم تشغيل البوت بنجاح باسم: ${client.user.tag}`);
});

// الأوامر النصية البسيطة (!setup)
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content === '!setup') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('ما عندك صلاحية تستخدم هالأمر!');
        }

        const embed = new EmbedBuilder()
            .setTitle('🎫 نظام التكتات المركزي')
            .setDescription('يرجى اختيار **القسم المناسب** من القائمة المنسدلة بالأسفل لفتح تكت جديد وتوجيهك للإدارة المختصة.')
            .setColor('#5865F2')
            .setFooter({ text: 'نظام الدعم الفني الآلي' });

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ticket_select_menu')
                .setPlaceholder('اختر قسم التكت المناسب...')
                .addOptions([
                    {
                        label: 'الدعم الفني والمشاكل',
                        description: 'لحل المشاكل التقنية وبلاغات اللاعبين',
                        value: 'support_ticket',
                        emoji: '🛠️',
                    },
                    {
                        label: 'الاستفسارات العامة',
                        description: 'لأي استفسار أو سؤال عام',
                        value: 'general_ticket',
                        emoji: '❓',
                    },
                    {
                        label: 'قسم الشراء والـ Store',
                        description: 'للشراء، الشحن، أو الاستفسار عن المنتجات',
                        value: 'store_ticket',
                        emoji: '🛒',
                    },
                ]),
        );

        await message.channel.send({ embeds: [embed], components: [row] });
        await message.delete();
    }
});

// التعامل مع الأزرار والقوائم المنسدلة
client.on('interactionCreate', async interaction => {
    // 1. فتح التكت عبر القائمة المنسدلة
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select_menu') {
        const guild = interaction.guild;
        const member = interaction.member;
        const selectedValue = interaction.values[0];

        let categoryName = 'دعم';
        let categoryColor = '#5865F2';
        if (selectedValue === 'support_ticket') {
            categoryName = 'دعم';
            categoryColor = '#ff5555';
        } else if (selectedValue === 'general_ticket') {
            categoryName = 'استفسار';
            categoryColor = '#55ff55';
        } else if (selectedValue === 'store_ticket') {
            categoryName = 'متجر';
            categoryColor = '#ffaa00';
        }

        const channelName = `ticket-${categoryName}-${member.user.username}`.toLowerCase();
        const existingChannel = guild.channels.cache.find(c => c.name === channelName);
        if (existingChannel) {
            return interaction.reply({ content: '❌ لديك تكت مفتوح بالفعل في هذا القسم!', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const channelOptions = {
                name: channelName,
                type: ChannelType.GuildText,
                parent: TICKET_CATEGORY_ID, // وضع الروم مباشرة تحت الكاتجوري المحدد
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: member.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                    },
                    {
                        id: STAFF_ROLE_ID,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                    },
                    {
                        id: client.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
                    }
                ],
            };

            const ticketChannel = await guild.channels.create(channelOptions);

            const welcomeEmbed = new EmbedBuilder()
                .setTitle(`تكت جديد [ قسم: ${categoryName} ]`)
                .setDescription(`حياك الله يا <@${member.id}>!\nتم فتح التكت بنجاح.\n\nالرجاء طرح مشكلتك أو طلبك بوضوح، **وطاقم الإدارة تم إشعاره وسيتم الرد عليك قريبًا.**\n\nلإغلاق التكت اضغط على الزر بالأسفل.`)
                .setColor(categoryColor);

            const closeRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('إغلاق التكت')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒')
            );

            // منشن رتبة الإدارة وعضو التكت عند الفتح
            await ticketChannel.send({ 
                content: `<@${member.id}> | <@&${STAFF_ROLE_ID}>`, 
                embeds: [welcomeEmbed], 
                components: [closeRow] 
            });

            await interaction.editReply({ content: `✅ تم إنشاء تكت الخاص بك بنجاح: ${ticketChannel}` });

        } catch (error) {
            console.log(error);
            await interaction.editReply({ content: '❌ حدث خطأ أثناء إنشاء التكت.' }).catch(() => {});
        }
    }

    // 2. زر إغلاق التكت
    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        const channel = interaction.channel;
        await interaction.reply({ content: '🔒 سيتم إغلاق التكت وحذفه الآن...' });
        
        setTimeout(async () => {
            try {
                await channel.delete();
            } catch (err) {
                console.log('خطأ أثناء حذف الروم:', err);
            }
        }, 3000);
    }
});

// نظام رصد حذف الرومات (سواء عن طريق البوت أو بوت النقاط الخارجي)
client.on('channelDelete', async channel => {
    if (!channel.guild) return;
    if (channel.name && channel.name.startsWith('ticket-')) {
        try {
            const logChannel = channel.guild.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('🔒 تم إغلاق وحذف تكت')
                    .setDescription(`اسم الروم المحذوف: **${channel.name}**\nتم إغلاقه وحذفه (إما يدوياً أو بواسطة بوت النقاط).`)
                    .setColor('#FF0000')
                    .setTimestamp();
                
                await logChannel.send({ embeds: [logEmbed] });
            }
        } catch (err) {
            console.log('خطأ في إرسال اللوق:', err);
        }
    }
});

// سحب التوكن بأمان من Render
const tokenToUse = process.env.TOKEN;

if (!tokenToUse) {
    console.log('[!] خطأ حرج: لم يتم العثور على التتوكن في إعدادات المنصة!');
    process.exit(1);
}

client.login(tokenToUse);
