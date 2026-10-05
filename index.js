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
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
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
        await message.delete();
    }
});

// التعامل مع التفاعلات (أزرار، قوائم، ونوافذ مدخلات)
client.on('interactionCreate', async interaction => {

    // 1. التعامل مع القائمة المنسدلة
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select_menu') {
        const selectedValue = interaction.values[0];

        // تفريغ وتحديث الاختيار
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

            const welcomeEmbed = new EmbedBuilder()
                .setTitle(`تكت جديد [ قسم: ${categoryName} ]`)
                .setDescription(`حياك الله يا <@${member.id}>!\nتم فتح التكت بنجاح.\n\nالرجاء طرح مشكلتك أو طلبك بوضوح، **وطاقم الإدارة تم إشعاره وسيتم الرد عليك قريبًا.**`)
                .setColor(categoryColor);

            // أزرار التحكم داخل التكت (5 أزرار)
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
                content: `<@${member.id}> | <@&${STAFF_ROLE_ID}>`, 
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
            // بقاء الروم ظاهرة للإدارة مع سحب صلاحية إرسال الرسائل منهم
            await interaction.channel.permissionOverwrites.edit(STAFF_ROLE_ID, {
                ViewChannel: true,
                SendMessages: false
            });

            // إعطاء الإداري المستلم صلاحية رؤية التكت والكتابة فيه
            await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });

            // تحديث زر الاستلام بتمكينه وتغيير اسمه
            const row = ActionRowBuilder.from(interaction.message.components[0]);
            row.components.forEach(comp => {
                if (comp.data.custom_id === 'claim_ticket') {
                    comp.setDisabled(true).setLabel(`مستلمة من: ${interaction.user.username}`);
                }
            });

            await interaction.update({ components: [row] });
            await interaction.followUp({ content: `🙋‍♂️ تم استلام التكت بواسطة <@${interaction.user.id}>. (باقي طاقم الإدارة يمكنهم مشاهدة التكت فقط بدون إمكانية الكتابة).` });
        } catch (err) {
            console.log('خطأ في استلام التكت:', err);
        }
    }

    // 3. زر إضافة عضو (فتح النافذة المنبثقة)
    if (interaction.isButton() && interaction.customId === 'add_user') {
        const isStaff = interaction.member.roles.cache.has(STAFF_ROLE_ID) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        if (!isStaff) {
            return interaction.reply({ content: '❌ هذا الزر مخصص لطاقم الإدارة فقط!', ephemeral: true });
        }

        const modal = new ModalBuilder()
            .setCustomId('add_user_modal')
            .setTitle('إضافة شخص إلى التكت');

        const userInput = new TextInputBuilder()
            .setCustomId('target_user_id')
            .setLabel('أدخل ايدي (ID) العضو المراد إضافته:')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('مثال: 123456789012345678')
            .setRequired(true);

        const actionRow = new ActionRowBuilder().addComponents(userInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);
    }

    // معالجة النتيجة بعد إدخال أيدي العضو في النافذة
    if (interaction.isModalSubmit() && interaction.customId === 'add_user_modal') {
        const rawInput = interaction.fields.getTextInputValue('target_user_id');
        const targetId = rawInput.replace(/[<@!>]/g, '').trim();

        try {
            const targetMember = await interaction.guild.members.fetch(targetId);
            if (!targetMember) {
                return interaction.reply({ content: '❌ لم يتم العثور على العضو بهذا الأيدي!', ephemeral: true });
            }

            // إعطاء العضو المضاف الصلاحيات
            await interaction.channel.permissionOverwrites.edit(targetMember.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });

            await interaction.reply({ content: `✅ تم إضافة العضو <@${targetMember.id}> إلى التكت بنجاح بواسطة <@${interaction.user.id}>.` });
        } catch (err) {
            await interaction.reply({ content: '❌ أيدي العضو غير صحيح أو أن العضو غير موجود في السيرفر.', ephemeral: true });
        }
    }

    // 4. زر استدعاء العضو (صاحب التكت)
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

// نظام رصد حذف الرومات
client.on('channelDelete', async channel => {
    if (!channel.guild) return;
    if (channel.name && channel.name.startsWith('ticket-')) {
        try {
            const logChannel = channel.guild.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('🔒 تم إغلاق وحذف تكت')
                    .setDescription(`اسم الروم المحذوف: **${channel.name}**\nتم إغلاقه وحذفه بنجاح.`)
                    .setColor('#FF0000')
                    .setTimestamp();
                
                await logChannel.send({ embeds: [logEmbed] });
            }
        } catch (err) {
            console.log('خطأ في إرسال اللوق:', err);
        }
    }
});

// سحب التوكن بأمان من المنصة
const tokenToUse = process.env.TOKEN;

if (!tokenToUse) {
    console.log('[!] خطأ حرج: لم يتم العثور على التوكن في إعدادات المنصة!');
    process.exit(1);
}

client.login(tokenToUse);
