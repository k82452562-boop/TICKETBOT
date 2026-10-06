// تشغيل الخادم الوهمي أولاً للبقاء أونلاين 24 ساعة
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
const TICKET_CATEGORY_ID = '1546498225404379279'; // أيدي الكاتجوري الخاص بالتكتات

// ذاكرة مؤقتة لتجميع بيانات التكت
const ticketsData = new Map();

// دالة مساعدة لإرسال اللوق (نص + إمبد) لروم اللوق
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
        console.log('خطأ في إرسال اللوق:', err);
    }
}

client.once('ready', () => {
    console.log(`[!] تم تشغيل البوت بنجاح باسم: ${client.user.tag}`);
});

// الأوامر النصية (!setup + أوامر الباند)
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    // 1. أمر Setup القائمة
    if (message.content === '!setup') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('ما عندك صلاحية تستخدم هالأمر!');
        }

        const embed = new EmbedBuilder()
            .setTitle('🎫 نظام التكتات المركزي')
            .setDescription('يرجى اختيار **القسم المناسب** من القائمة المنسدلة بالأسفل لفتح تكت جديد وتوجيهك للإدارة المختصة.')
            .setColor('#5865F2')
            .setFooter({ text: 'نظام الدعم الفني الآلي' });

        const menuRow = new ActionRowBuilder().addComponents(
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
                    {
                        label: 'Refresh Menu',
                        description: 'إعادة تحديث وتفريغ اختيار القائمة',
                        value: 'refresh_menu_option',
                        emoji: '🔄',
                    },
                ]),
        );

        await message.channel.send({ embeds: [embed], components: [menuRow] });
        await message.delete().catch(() => {});
        return;
    }

    // 2. أوامر الباند المخصصة (تعمل بـ ! أو بدون !)
    const banCommands = [
        'بنعالي', '!بنعالي', 
        'بنعال_براء', '!بنعال_براء', 
        'بنعال_حرب', '!بنعال_حرب', 
        'بنعال_ريان', '!بنعال_ريان'
    ];

    const args = message.content.trim().split(/ +/);
    const command = args[0];

    if (banCommands.includes(command)) {
        // التحقق من صلاحية الباند لدى الشخص المُرْسِل
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return message.reply('❌ ليس لديك صلاحية إعطاء باند!');
        }

        // جلب العضو المطلوب تبنيده من المنشن أو الـ ID
        const target = message.mentions.members.first() || 
            await message.guild.members.fetch(args[1]).catch(() => null);

        if (!target) {
            return message.reply(`❌ يرجى منشن الشخص أو كتابة ايديه!\nمثال: \`${command} @user السبب\``);
        }

        // التحقق من هرمية الرتب وقدرة البوت على التبنيد
        if (!target.bannable) {
            return message.reply('❌ لا أستطيع تبنيد هذا الشخص! (قد تكون رتبته أعلى مني أو مع إداري أعلى).');
        }

        // تحديد سبب الباند
        const reason = args.slice(2).join(' ') || 'بدون سبب محدد';

        // عناوين مخصصة حسب الأمر (تدعم وجود ! أو عدمه)
        let embedTitle = '💥 تم جلد العضو وإعطائه بنعال!';
        if (command.includes('بنعالي')) embedTitle = '👞 بنعال مباشر شديد اللهجة!';
        if (command.includes('بنعال_براء')) embedTitle = '👟 بنعال ملكي من **براء**!';
        if (command.includes('بنعال_حرب')) embedTitle = '⚔️ بنعال حربي من **حرب**!';
        if (command.includes('بنعال_ريان')) embedTitle = '👢 بنعال فاخر من **ريان**!';

        try {
            await target.ban({ reason: `الأمر: ${command} | بواسطة: ${message.author.tag} \vert{} السبب: ${reason}` });

            const banEmbed = new EmbedBuilder()
                .setTitle(embedTitle)
                .setDescription(`تم طرد وتبنيد العضو **${target.user.tag}** بنجاح من السيرفر! 🚀`)
                .addFields(
                    { name: '👤 العضو المبند:', value: `${target.user} (\`${target.id}\`)`, inline: true },
                    { name: '🛡️ بواسطة:', value: `${message.author}`, inline: true },
                    { name: '📝 السبب:', value: reason, inline: false }
                )
                .setColor('#FF0000')
                .setTimestamp()
                .setFooter({ text: message.guild.name, iconURL: message.guild.iconURL() });

            await message.channel.send({ embeds: [banEmbed] });

        } catch (err) {
            console.error('خطأ في الباند:', err);
            await message.reply('❌ حدث خطأ أثناء تنفيذ أمر الباند.');
        }
    }
});

// التعامل مع التفاعلات (أزرار والقوائم المنسدلة)
client.on('interactionCreate', async interaction => {

    // 1. التعامل مع القائمة المنسدلة (فتح التكت)
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select_menu') {
        const selectedValue = interaction.values[0];

        if (selectedValue === 'refresh_menu_option') {
            return interaction.reply({ 
                content: '🔄 تم تحديث القائمة وتفريغ الاختيار بنجاح!', 
                ephemeral: true 
            });
        }

        const guild = interaction.guild;
        const member = interaction.member;

        let categoryName = 'دعم';
        let categoryColor = '#5865F2';
        if (selectedValue === 'support_ticket') {
            categoryName = 'دعم فني';
            categoryColor = '#ff5555';
        } else if (selectedValue === 'general_ticket') {
            categoryName = 'استفسار عام';
            categoryColor = '#55ff55';
        } else if (selectedValue === 'store_ticket') {
            categoryName = 'متجر وشراء';
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
                parent: TICKET_CATEGORY_ID,
                topic: member.id, // حفظ أيدي صاحب التكت
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

            // حفظ بيانات التكت
            ticketsData.set(ticketChannel.id, {
                ownerId: member.id,
                category: categoryName,
                claimedBy: null,
                addedUsers: []
            });

            const welcomeEmbed = new EmbedBuilder()
                .setTitle(`تكت جديد [ قسم: ${categoryName} ]`)
                .setDescription(`حياك الله يا <@${member.id}>!\nتم فتح التكت بنجاح.\n\nالرجاء طرح مشكلتك أو طلبك بوضوح، **وطاقم الإدارة تم إشعاره وسيتم الرد عليك قريبًا.**`)
                .setColor(categoryColor);

            const controlRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('claim_ticket')
                    .setLabel('استلام التكت')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🙋‍♂️'),
                new ButtonBuilder()
                    .setCustomId('add_user')
                    .setLabel('إضافة عضو')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('➕'),
                new ButtonBuilder()
                    .setCustomId('summon_user')
                    .setLabel('استدعاء العضو')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔔'),
                new ButtonBuilder()
                    .setCustomId('summon_staff')
                    .setLabel('استدعاء الإدارة')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📢'),
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('إغلاق التكت')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒')
            );

            await ticketChannel.send({ 
                content: `<@${member.id}> \vert{} <@&${STAFF_ROLE_ID}>`, 
                embeds: [welcomeEmbed], 
                components: [controlRow] 
            });

            await interaction.editReply({ content: `✅ تم إنشاء تكت الخاص بك بنجاح: ${ticketChannel}` });

        } catch (error) {
            console.log(error);
            await interaction.editReply({ content: '❌ حدث خطأ أثناء إنشاء التكت.' }).catch(() => {});
        }
    }

    // 2. زر استلام التكت (Claim)
    if (interaction.isButton() && interaction.customId === 'claim_ticket') {
        const isStaff = interaction.member.roles.cache.has(STAFF_ROLE_ID) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        if (!isStaff) {
            return interaction.reply({ content: '❌ هذا الزر مخصص لطاقم الإدارة فقط!', ephemeral: true });
        }

        try {
            const data = ticketsData.get(interaction.channel.id);
            if (data) {
                data.claimedBy = interaction.user.id;
            }

            await interaction.channel.permissionOverwrites.edit(STAFF_ROLE_ID, {
                ViewChannel: true,
                SendMessages: false
            });

            await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });

            const row = ActionRowBuilder.from(interaction.message.components[0]);
            row.components.forEach(comp => {
                if (comp.data.custom_id === 'claim_ticket') {
                    comp.setDisabled(true).setLabel(`مستلمة من: ${interaction.user.username}`);
                }
            });

            await interaction.update({ components: [row] });
            await interaction.followUp({ content: `🙋‍♂️ تم استلام التكت بواسطة <@${interaction.user.id}>.` });

            // 📣 إرسال رسالة فورية في اللوق ليستوعبها بوت النقاط فوراً
            const claimEmbed = new EmbedBuilder()
                .setTitle('🙋‍♂️ استلام تكت (Claim Ticket)')
                .setDescription(`تم استلام التكت بواسطة <@${interaction.user.id}>`)
                .addFields(
                    { name: '👤 المستلم:', value: `<@${interaction.user.id}> (\`${interaction.user.id}\`)`, inline: true },
                    { name: '📌 التكت:', value: `${interaction.channel.name}`, inline: true }
                )
                .setColor('#FEE75C')
                .setTimestamp();

            await sendLog(
                interaction.guild, 
                `🙋‍♂️ تم استلام التكت بواسطة: <@${interaction.user.id}>`, 
                claimEmbed
            );

        } catch (err) {
            console.log('خطأ في استلام التكت:', err);
        }
    }

    // 3. زر إضافة عضو
    if (interaction.isButton() && interaction.customId === 'add_user') {
        const isStaff = interaction.member.roles.cache.has(STAFF_ROLE_ID) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        if (!isStaff) {
            return interaction.reply({ content: '❌ هذا الزر مخصص لطاقم الإدارة فقط!', ephemeral: true });
        }

        await interaction.reply({ 
            content: '💬 **الرجاء منشن الشخص الذي تريد إضافته (أو كتابة الـ ID الخاص به) في الشات الآن...**\n*(لديك 30 ثانية للإرسال)*',
            ephemeral: true
        });

        const filter = m => m.author.id === interaction.user.id;
        const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });

        collector.on('collect', async message => {
            const cleanInput = message.content.trim().replace(/[<@!>]/g, '');
            const targetMember = message.mentions.members.first() || 
                await interaction.guild.members.fetch(cleanInput).catch(() => null);

            if (!targetMember) {
                await message.delete().catch(() => {});
                return interaction.followUp({ content: '❌ لم يتم العثور على العضو! تأكد من عمل منشن صحيح أو كتابة الـ ID بشكل صحيح.', ephemeral: true });
            }

            try {
                const data = ticketsData.get(interaction.channel.id);
                if (data && !data.addedUsers.includes(targetMember.id)) {
                    data.addedUsers.push(targetMember.id);
                }

                await interaction.channel.permissionOverwrites.edit(targetMember.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });

                await message.delete().catch(() => {});

                await interaction.channel.send({ 
                    content: `✅ تم إضافة العضو <@${targetMember.id}> إلى التكت بنجاح بواسطة <@${interaction.user.id}>.` 
                });

            } catch (err) {
                console.log('خطأ في إضافة العضو:', err);
                await interaction.followUp({ content: '❌ حدث خطأ أثناء إضافة العضو.', ephemeral: true });
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                interaction.followUp({ content: '⏰ انتهت المهلة! لم تقم بمنشن أي شخص.', ephemeral: true });
            }
        });
    }

    // 4. زر استدعاء العضو
    if (interaction.isButton() && interaction.customId === 'summon_user') {
        const isStaff = interaction.member.roles.cache.has(STAFF_ROLE_ID) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        if (!isStaff) {
            return interaction.reply({ content: '❌ هذا الزر مخصص لطاقم الإدارة فقط!', ephemeral: true });
        }

        const ticketOwnerId = interaction.channel.topic;
        if (!ticketOwnerId) {
            return interaction.reply({ content: '❌ لم يتم العثور على صاحب التكت.', ephemeral: true });
        }

        await interaction.reply({ content: `🔔 <@${ticketOwnerId}>، يرجى التواجد بالروم! استدعاء من الإداري: <@${interaction.user.id}>` });
    }

    // 5. زر استدعاء الإدارة
    if (interaction.isButton() && interaction.customId === 'summon_staff') {
        await interaction.reply({ content: `📢 <@&${STAFF_ROLE_ID}>، تم استدعاء الإدارة بواسطة <@${interaction.user.id}>!` });
    }

    // 6. زر إغلاق التكت
    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        const channel = interaction.channel;
        const data = ticketsData.get(channel.id) || {
            ownerId: channel.topic || 'غير معروف',
            category: 'غير محدد',
            claimedBy: null,
            addedUsers: []
        };

        const addedUsersText = data.addedUsers.length > 0 
            ? data.addedUsers.map(id => `<@${id}>`).join(', ') 
            : 'لا يوجد أعضاء مضافين';

        // 📄 اللوق الشامل للتكت عند الإغلاق
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
            .setFooter({ text: 'نظام اللوق الموحد' });

        // إرسال لوق الإغلاق النهائي
        await sendLog(
            interaction.guild, 
            `🔒 تم إغلاق التكت بواسطة: <@${interaction.user.id}> | المستلم: ${data.claimedBy ? `<@${data.claimedBy}>` : 'لا يوجد'}`, 
            finalLogEmbed
        );

        ticketsData.delete(channel.id);

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

// سحب التوكن من الإعدادات
const tokenToUse = process.env.TOKEN;

if (!tokenToUse) {
    console.log('[!] خطأ حرج: لم يتم العثور على التوكن في إعدادات المنصة!');
    process.exit(1);
}

client.login(tokenToUse);
