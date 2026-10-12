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

// ⚙️ الإعدادات الأساسية (الآديهات الخاصة بسيرفرك الجديد)
const STAFF_ROLE_ID = '1554251752574951425'; // رتبة الإدارة
const LOG_CHANNEL_ID = '1543094678038257784'; // روم اللوق
const TICKET_CATEGORY_ID = '1554252056183967795'; // كاتجوري التكتات

// ذاكرة مؤقتة للتكتات والتحذيرات
const ticketsData = new Map();
const userWarnings = new Map();

// دالة مساعدة لإرسال اللوق لروم اللوق
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
    console.log(`[!] ارحب! البوت الخارق شغال وجاهز باسم: ${client.user.tag} 🚀`);
    client.user.setActivity('منتدى النظيم | تحت الخدمة 🛡️', { type: 0 });
});

// 📩 نظام الأوامر النصية
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const args = message.content.trim().split(/ +/);
    const command = args[0].toLowerCase();

    // 1️⃣ أمر Setup قائمة التكتات
    if (command === '!setup' || command === 'سيت_اب') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ يا طويل العمر ما عندك صلاحية تستخدم هالأمر!');
        }

        const embed = new EmbedBuilder()
            .setTitle('🎫 مركز الدعم الفني والتكتات | منتدى النظيم 🛡️')
            .setDescription(`
يا هلا والله ومسيكم بالخير جميعاً 👋
عشان نخدمك بأسرع وقت وأفضل جودة، اختار القسم المناسب لطلبك من القائمة تحت 👇

---

⚖️ **قوانين وشروط فتح التكت:**
- 1️⃣ **اطرح مشكلتك فوراً:** أول ما تفتح التكت اكتب موضوعك وتفاصيلك كاملة.
- 2️⃣ **يمنع الاستهبال والتجربة:** فتح التكت بدون سبب يعرّضك للباند 👞.
- 3️⃣ **احترام طاقم الإدارة:** التعامل بأسلوب راقي يسرّع من حل مشكلتك.
- 4️⃣ **التحلي بالصبر:** سيتم الرد عليك بأسرع وقت ممكن.

---
✨ **اختر القسم المناسب لك من القائمة المنسدلة بالأسفل:**
            `)
            .setColor('#FFD700')
            .setThumbnail(message.guild.iconURL({ dynamic: true }))
            .setFooter({ text: 'منتدى النظيم • الخدمة السريعة والمميزة', iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        const menuRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ticket_select_menu')
                .setPlaceholder('👑 اضغط هنا واختر القسم المناسب لطلبك...')
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

    // 2️⃣ أوامر الباند المخصصة
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

    // 3️⃣ أمر مسح الشات
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
});

// 🛠️ التعامل مع التفاعلات والأزرار
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
        if (selectedValue === 'support_ticket') {
            categoryName = 'دعم فني';
            categoryColor = '#FF3366';
        } else if (selectedValue === 'general_ticket') {
            categoryName = 'استفسار عام';
            categoryColor = '#00FFCC';
        } else if (selectedValue === 'store_ticket') {
            categoryName = 'متجر وشراء';
            categoryColor = '#FFCC00';
        }

        const channelName = `ticket-${categoryName}-${member.user.username}`.toLowerCase();
        const existingChannel = guild.channels.cache.find(c => c.name === channelName);
        if (existingChannel) {
            return interaction.reply({ content: '❌ يا بعدي عندك تكت مفتوح بالفعل بهذا القسم!', ephemeral: true });
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
                .setDescription(`يا هلا والله ومسهلا بك يا <@${member.id}>!\n\n**الرجاء كتابة طلبك أو مشكلتك فوراً بدون الانتظار.**\nطاقم الإدارة تلقى الإشعار وسيقوم بالرد عليك بـأسرع وقت 🚀`)
                .setColor(categoryColor)
                .setFooter({ text: 'يرجى الالتزام بالتعليمات وعدم الاستهبال' });

            const controlRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('استلام التكت').setStyle(ButtonStyle.Success).setEmoji('🙋‍♂️'),
                new ButtonBuilder().setCustomId('add_user').setLabel('إضافة عضو').setStyle(ButtonStyle.Primary).setEmoji('➕'),
                new ButtonBuilder().setCustomId('summon_user').setLabel('استدعاء العضو').setStyle(ButtonStyle.Secondary).setEmoji('🔔'),
                new ButtonBuilder().setCustomId('summon_staff').setLabel('استدعاء الإدارة').setStyle(ButtonStyle.Secondary).setEmoji('📢'),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التكت').setStyle(ButtonStyle.Danger).setEmoji('🔒')
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

    // زر استلام التكت
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

    // زر إضافة عضو
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

    // زر استدعاء العضو
    if (interaction.isButton() && interaction.customId === 'summon_user') {
        const ticketOwnerId = interaction.channel.topic;
        if (!ticketOwnerId) return interaction.reply({ content: '❌ لم يتم العثور على صاحب التكت.', ephemeral: true });
        await interaction.reply({ content: `🔔 <@${ticketOwnerId}>، يرجى التواجد بالروم! استدعاء من الإداري: <@${interaction.user.id}>` });
    }

    // زر استدعاء الإدارة
    if (interaction.isButton() && interaction.customId === 'summon_staff') {
        await interaction.reply({ content: `📢 <@&${STAFF_ROLE_ID}>، تم استدعاء الإدارة بواسطة <@${interaction.user.id}>!` });
    }

    // زر إغلاق التكت
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
