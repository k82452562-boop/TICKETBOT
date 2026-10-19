// تشغيل الخادم الوهمي أولاً للبقاء أونلاين 24 ساعة
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
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
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

// ⚙️ الثوابت والآيديات
const STAFF_ROLE_ID = '1545520633939624006'; // رتبة الإدارة العامة
const HIGHER_STAFF_ROLE_ID = '1545520950064316516'; // رتبة الشكاوى والمسؤولين العليا
const LOG_CHANNEL_ID = '1543094678038257784'; // روم اللوق
const TICKET_CATEGORY_ID = '1546498225404379279'; // كاتجوري التكتات

const ticketsData = new Map();

// 📢 دالة إرسال اللوق العامة
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
    console.log(`[!] ارحب! البوت الفاخر شغال بأعلى أداء باسم: ${client.user.tag} 👑🚀`);
    client.user.setActivity('منتدى النظيم 🛡️ | النظام الملكي المطور', { type: 0 });
});

// 📩 الأوامر النصية
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
            .setTitle('نظام التذاكر | الدعم الفني 🎫')
            .setDescription(`
نرحّب بكم، ونفيدكم بأنه في حال وجود استفسار أو طلب مساعدة، يُرجى إنشاء تذكرة عبر القسم المخصص، مع توضيح تفاصيل الطلب بشكل دقيق لضمان سرعة المعالجة وتقديم الدعم اللازم.

نأمل الالتزام بفتح تذكرة واحدة لكل موضوع، وسيتم التعامل مع طلبكم والرد عليه في أقرب وقت ممكن.

شكرًا لتعاونكم، ونسعد بخدمتكم دائمًا.
            `)
            .setColor('#FFD700')
            .setThumbnail(message.guild.iconURL({ dynamic: true }))
            .setFooter({ text: 'نظام الدعم الآلي • منتدى النظيم', iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        const menuRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ticket_select_menu')
                .setPlaceholder('👑 اضغط هنا واختر قسم التكت المناسب...')
                .addOptions([
                    { label: 'قسم الدعم الفني والمشاكل', description: 'بلاغات اللاعبين والمشاكل التقنية', value: 'support_ticket', emoji: '🛠️' },
                    { label: 'قسم الاستفسارات العامة', description: 'لأي سؤال أو استفسار عام', value: 'general_ticket', emoji: '💬' },
                    { label: 'قسم الشكوى على إداري', description: 'رفع شكوى خاصة ومباشرة للإدارة العليا', value: 'admin_complaint_ticket', emoji: '⚖️' },
                    { label: 'قسم المتجر والشراء (Store)', description: 'للشراء والشحن والاستفسار', value: 'store_ticket', emoji: '💎' },
                    { label: 'تحديث وتفريغ القائمة', description: 'إعادة تصفير خيار القائمة', value: 'refresh_menu_option', emoji: '🔄' },
                ]),
        );

        await message.channel.send({ embeds: [embed], components: [menuRow] });
        await message.delete().catch(() => {});
        return;
    }

    // 2️⃣ أوامر الباند
    const banCommands = ['بنعالي', '!بنعالي', 'بنعال_براء', '!بنعال_براء', 'بنعال_حرب', '!بنعال_حرب', 'بنعال_ريان', '!بنعال_ريان'];
    if (banCommands.includes(command)) {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return message.reply('❌ ما عندك صلاحية تعطي بنعال يا غالي!');
        }
        const target = message.mentions.members.first() || await message.guild.members.fetch(args[1]).catch(() => null);
        if (!target) return message.reply(`❌ منشن الشخص أو اكتب الآيدي حقه!`);
        if (!target.bannable) return message.reply('❌ ما أقدر أبنّده!');
        const reason = args.slice(2).join(' ') || 'بدون سبب محدد';
        try {
            await target.ban({ reason: `الأمر: ${command} | بواسطة: ${message.author.tag} \vert{} السبب: ${reason}` });
            await message.channel.send(`✅ **${target.user.username}** banned from the server! ✈️`);
        } catch (err) {
            await message.reply('❌ حدث خطأ أثناء تنفيذ أمر الباند.');
        }
        return;
    }

    // 3️⃣ أمر مسح الشات
    if (command === 'مسح' || command === '!clear' || command === 'clear') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return message.reply('❌ ما عندك صلاحية!');
        const amount = parseInt(args[1]);
        if (isNaN(amount) || amount < 1 || amount > 100) return message.reply('❌ حدد عدد الرسائل من 1 إلى 100!');
        await message.channel.bulkDelete(amount, true).catch(() => {});
        const msg = await message.channel.send(`🧹 **تم تنظيف الشات ومسح ${amount} رسالة بنجاح!**`);
        setTimeout(() => msg.delete().catch(() => {}), 3000);
        return;
    }

    // 4️⃣ أمر كتم العضو
    if (command === 'اسكت' || command === '!timeout' || command === 'timeout') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return message.reply('❌ ما عندك صلاحية!');
        const target = message.mentions.members.first() || await message.guild.members.fetch(args[1]).catch(() => null);
        if (!target) return message.reply('❌ منشن الشخص!');
        const minutes = parseInt(args[2]) || 5;
        try {
            await target.timeout(minutes * 60 * 1000, `بواسطة: ${message.author.tag}`);
            await message.channel.send(`🤐 تم إعطاء كتم للعضو <@${target.id}> لمدة ${minutes} دقايق.`);
        } catch (err) {
            await message.reply('❌ ما قدرت أعطيه كتم.');
        }
        return;
    }

    // 5️⃣ أمر معلومات الحساب
    if (command === 'معلومات' || command === 'بروفايل' || command === '!userinfo') {
        const target = message.mentions.members.first() || message.member;
        const userEmbed = new EmbedBuilder()
            .setTitle(`👤 بطاقة بيانات العضو: ${target.user.username}`)
            .setThumbnail(target.user.displayAvatarURL({ dynamic: true, size: 512 }))
            .setColor('#9B59B6')
            .addFields(
                { name: '🆔 آيدي العضو:', value: `\`${target.id}\``, inline: true },
                { name: '🏷️ اللقب بالسيرفر:', value: `${target.displayName}`, inline: true },
                { name: '📅 تاريخ إنشاء الحساب:', value: `<t:${Math.floor(target.user.createdTimestamp / 1000)}:R>`, inline: false },
                { name: '📥 تاريخ الانضمام للسيرفر:', value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:R>`, inline: false },
                { name: '👑 أعلى رتبة يملكها:', value: `${target.roles.highest}`, inline: true }
            )
            .setFooter({ text: `طلب بواسطة: ${message.author.tag}` })
            .setTimestamp();
        await message.channel.send({ embeds: [userEmbed] });
        return;
    }

    // 6️⃣ أمر إحصائيات السيرفر
    if (command === 'السيرفر' || command === '!server' || command === 'server') {
        const serverEmbed = new EmbedBuilder()
            .setTitle(`📊 إحصائيات سيرفر: ${message.guild.name}`)
            .setThumbnail(message.guild.iconURL({ dynamic: true }))
            .setColor('#3498DB')
            .addFields(
                { name: '👥 عدد الأعضاء الإجمالي:', value: `**${message.guild.memberCount}** عضو`, inline: true },
                { name: '👑 مالك السيرفر:', value: `<@${message.guild.ownerId}>`, inline: true },
                { name: '🚀 عدد البوستات (Boosts):', value: `**${message.guild.premiumSubscriptionCount || 0}** بوست`, inline: true },
                { name: '🆔 آيدي السيرفر:', value: `\`${message.guild.id}\``, inline: false }
            )
            .setFooter({ text: 'منتدى النظيم الملكي' })
            .setTimestamp();
        await message.channel.send({ embeds: [serverEmbed] });
        return;
    }

    // 7️⃣ أمر البينغ
    if (command === 'بينغ' || command === '!ping' || command === 'ping') {
        const msg = await message.reply('⚡ جاري قياس سرعة الاستجابة...');
        const ping = msg.createdTimestamp - message.createdTimestamp;
        await msg.edit(`🚀 **سرعة البوت:** \`${ping}ms\` | **سيرفرات الديسكورد:** \`${Math.round(client.ws.ping)}ms\``);
        return;
    }
});

// 🛠️ التفاعلات والأزرار
client.on('interactionCreate', async interaction => {

    // 1️⃣ اختيار القسم من القائمة المنسدلة
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select_menu') {
        const selectedValue = interaction.values[0];

        if (selectedValue === 'refresh_menu_option') {
            return interaction.reply({ content: '🔄 تم تحديث القائمة بنجاح!', ephemeral: true });
        }

        if (selectedValue === 'admin_complaint_ticket') {
            const modal = new ModalBuilder()
                .setCustomId('admin_complaint_modal')
                .setTitle('⚖️ نموذج تقديم شكوى على إداري');

            const adminInput = new TextInputBuilder()
                .setCustomId('complaint_admin_name')
                .setLabel('اسم الإداري المشكوى عليه / الآيدي')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const detailsInput = new TextInputBuilder()
                .setCustomId('complaint_details')
                .setLabel('ما هي مشكلتك بالتفصيل؟')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            const proofInput = new TextInputBuilder()
                .setCustomId('complaint_proof')
                .setLabel('هل يوجد أدلة؟ (صور / روابط / فيديو)')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(adminInput),
                new ActionRowBuilder().addComponents(detailsInput),
                new ActionRowBuilder().addComponents(proofInput)
            );

            return await interaction.showModal(modal);
        }

        const guild = interaction.guild;
        const member = interaction.member;

        let categoryName = 'دعم';
        let categoryColor = '#FFD700';
        if (selectedValue === 'support_ticket') { categoryName = 'دعم فني'; categoryColor = '#FF3366'; }
        else if (selectedValue === 'general_ticket') { categoryName = 'استفسار عام'; categoryColor = '#00FFCC'; }
        else if (selectedValue === 'store_ticket') { categoryName = 'متجر وشراء'; categoryColor = '#FFCC00'; }

        const channelName = `ticket-${selectedValue.replace('_ticket', '')}-${member.user.username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'user'}`;
        
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
                    { id: HIGHER_STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                    { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
                ],
            });

            ticketsData.set(ticketChannel.id, {
                ownerId: member.id,
                category: categoryName,
                claimedBy: null,
                closedBy: null,
                addedUsers: [],
                createdAt: Date.now()
            });

            const welcomeEmbed = new EmbedBuilder()
                .setTitle(`🎫 تكت جديد | قسم: ${categoryName}`)
                .setDescription(`يا هلا والله ومسهلا بك يا <@${member.id}>!\n\n**الرجاء كتابة طلبك أو مشكلتك فوراً بدون الانتظار.**\nطاقم الإدارة تلقى الإشعار وسيقوم بالرد عليك بأسرع وقت 🚀`)
                .setColor(categoryColor);

            const controlRow1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('🙋‍♂️ | استلام التكت').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('add_user').setLabel('➕ | إضافة عضو').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('summon_user').setLabel('🔔 | تنبيه العضو').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('summon_staff').setLabel('📢 | إشعار الإدارة').setStyle(ButtonStyle.Secondary)
            );

            const controlRow2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('user_info_button').setLabel('👤 | معلومات العضو').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('unclaim_ticket').setLabel('🔄 | تفريغ الاستلام').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 | إغلاق التكت').setStyle(ButtonStyle.Danger)
            );

            await ticketChannel.send({ 
                content: `<@${member.id}> \vert{} <@&${STAFF_ROLE_ID}>`, 
                embeds: [welcomeEmbed], 
                components: [controlRow1, controlRow2] 
            });

            await interaction.editReply({ content: `✅ تم إنشاء التكت بنجاح: ${ticketChannel}` });

        } catch (error) {
            console.error('❌ خطأ حرج أثناء إنشاء روم التكت:', error);
            await interaction.editReply({ content: `❌ حدث خطأ أثناء إنشاء التكت. (${error.message})` }).catch(() => {});
        }
    }

    // 2️⃣ نموذج الشكوى
    if (interaction.isModalSubmit() && interaction.customId === 'admin_complaint_modal') {
        const guild = interaction.guild;
        const member = interaction.member;

        const adminTarget = interaction.fields.getTextInputValue('complaint_admin_name');
        const details = interaction.fields.getTextInputValue('complaint_details');
        const proof = interaction.fields.getTextInputValue('complaint_proof') || 'لا يوجد أدلة مرفقة';

        const channelName = `ticket-complaint-${member.user.username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'user'}`;

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
                    { id: HIGHER_STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                    { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
                ],
            });

            ticketsData.set(ticketChannel.id, {
                ownerId: member.id,
                category: 'شكوى على إداري',
                claimedBy: null,
                closedBy: null,
                addedUsers: [],
                createdAt: Date.now()
            });

            const complaintEmbed = new EmbedBuilder()
                .setTitle('⚖️ تكت شكوى على إداري (حسّاس وخاص)')
                .setDescription(`أهلاً بك <@${member.id}>، تم إرسال شكواك للجهات العليا المختصة وسيتعاملون مع طلبك بأقصى سرية.`)
                .addFields(
                    { name: '👤 الإداري المشكوى عليه:', value: `\`\`\`${adminTarget}\`\`\``, inline: false },
                    { name: '📝 تفاصيل الشكوى:', value: `\`\`\`${details}\`\`\``, inline: false },
                    { name: '📂 الأدلة والمرفقات:', value: `\`\`\`${proof}\`\`\``, inline: false }
                )
                .setColor('#E74C3C')
                .setTimestamp();

            const controlRow1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('🙋‍♂️ | استلام التكت').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('add_user').setLabel('➕ | إضافة عضو').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('summon_user').setLabel('🔔 | تنبيه العضو').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('summon_staff').setLabel('📢 | إشعار المسؤولين').setStyle(ButtonStyle.Secondary)
            );

            const controlRow2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('user_info_button').setLabel('👤 | معلومات العضو').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('unclaim_ticket').setLabel('🔄 | تفريغ الاستلام').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 | إغلاق التكت').setStyle(ButtonStyle.Danger)
            );

            await ticketChannel.send({ 
                content: `<@${member.id}> \vert{} <@&${HIGHER_STAFF_ROLE_ID}>`, 
                embeds: [complaintEmbed], 
                components: [controlRow1, controlRow2] 
            });

            await interaction.editReply({ content: `✅ تم فتح تكت الشكوى بنجاح وسيتم معالجته بسرية: ${ticketChannel}` });

        } catch (error) {
            console.error('❌ خطأ إنشاء تكت الشكوى بالتفصيل:', error);
            await interaction.editReply({ content: `❌ حدث خطأ أثناء فتح تكت الشكوى. (${error.message})` });
        }
    }

    // 3️⃣ 🙋‍♂️ زر استلام التكت (قفل التكت عن بقية الإدارة، وإرسال لوق خاص لبوت النقاط)
    if (interaction.isButton() && interaction.customId === 'claim_ticket') {
        const isStaff = interaction.member.roles.cache.has(STAFF_ROLE_ID) || interaction.member.roles.cache.has(HIGHER_STAFF_ROLE_ID) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        if (!isStaff) return interaction.reply({ content: '❌ هذا الزر مخصص للإدارة فقط يا بعد حيي!', ephemeral: true });

        const data = ticketsData.get(interaction.channel.id) || { claimedBy: null };

        if (data.claimedBy) {
            return interaction.reply({ 
                content: `❌ **التكت مستلم سابقاً بواسطة الإداري:** <@${data.claimedBy}>!`, 
                ephemeral: true 
            });
        }

        data.claimedBy = interaction.user.id;
        ticketsData.set(interaction.channel.id, data);

        try {
            // أ) تعديل صلاحيات القناة: قفل التكت عن الإدارة العامة وسماح فقط للمستلم والإدارة العليا
            await interaction.channel.permissionOverwrites.edit(STAFF_ROLE_ID, {
                ViewChannel: false,
                SendMessages: false
            });

            await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });

            await interaction.channel.permissionOverwrites.edit(HIGHER_STAFF_ROLE_ID, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });

            // ب) تحديث حالة الأزرار
            const rows = interaction.message.components.map(row => {
                const newRow = ActionRowBuilder.from(row);
                newRow.components.forEach(comp => {
                    if (comp.data.custom_id === 'claim_ticket') {
                        comp.setDisabled(true).setLabel(`مستلمة من: ${interaction.user.username}`);
                    }
                });
                return newRow;
            });

            await interaction.update({ components: rows });
            
            // ج) إرسال تنبيه في شات التكت
            await interaction.channel.send(`🙋‍♂️ تم استلام التكت بواسطة <@${interaction.user.id}> وتم تخصيصه للإداري والإدارة العليا فقط.`);

            // د) إرسال رسالة لوق فورية في روم اللوقز لبوت النقاط
            const claimLogEmbed = new EmbedBuilder()
                .setTitle('📥 إشعار استلام تذكرة جديد')
                .setDescription(`🙋‍♂️ قام الإداري <@${interaction.user.id}> (\`${interaction.user.id}\`) باستلام التكت **#${interaction.channel.name}**`)
                .setColor('#2ECC71')
                .setTimestamp();

            await sendLog(interaction.guild, `🙋‍♂️ قام الإداري <@${interaction.user.id}> باستلام التكت ${interaction.channel.name}`, claimLogEmbed);

        } catch (err) {
            console.log('خطأ في استلام التكت وتعديل الصلاحيات:', err);
        }
    }

    // 4️⃣ 🔄 زر تفريغ الاستلام (محصور بمستلم التكت والإدارة العليا فقط)
    if (interaction.isButton() && interaction.customId === 'unclaim_ticket') {
        const data = ticketsData.get(interaction.channel.id);
        if (!data || !data.claimedBy) {
            return interaction.reply({ content: '⚠️ التكت مو مستلم أصلاً عشان تفرغه!', ephemeral: true });
        }

        const isClaimer = interaction.user.id === data.claimedBy;
        const isHigherStaff = interaction.member.roles.cache.has(HIGHER_STAFF_ROLE_ID) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        if (!isClaimer && !isHigherStaff) {
            return interaction.reply({ 
                content: `❌ **عفواً! فقط الإداري المستلم للتكت (<@${data.claimedBy}>) أو الإدارة العليا هم من يستطيعون تفريغ التكت!**`, 
                ephemeral: true 
            });
        }

        data.claimedBy = null;
        ticketsData.set(interaction.channel.id, data);

        try {
            // إعادة فتح الصلاحيات للإدارة العامة
            await interaction.channel.permissionOverwrites.edit(STAFF_ROLE_ID, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });

            const rows = interaction.message.components.map(row => {
                const newRow = ActionRowBuilder.from(row);
                newRow.components.forEach(comp => {
                    if (comp.data.custom_id === 'claim_ticket') {
                        comp.setDisabled(false).setLabel('🙋‍♂️ | استلام التكت');
                    }
                });
                return newRow;
            });

            await interaction.update({ components: rows });
            await interaction.followUp({ content: `🔄 **تم إلغاء الاستلام وتفريغ التكت بنجاح! تم إعادة فتح التكت لطاقم الإدارة مجدداً.**` });

        } catch (err) {
            console.log('خطأ أثناء تفريغ التكت:', err);
        }
    }

    // 5️⃣ 👤 زر معلومات العضو (يظهر للجميع في الشات العام)
    if (interaction.isButton() && interaction.customId === 'user_info_button') {
        const ownerId = interaction.channel.topic;
        if (!ownerId) return interaction.reply({ content: '❌ متعذر العثور على صاحب التكت.', ephemeral: true });

        const targetMember = await interaction.guild.members.fetch(ownerId).catch(() => null);
        if (!targetMember) return interaction.reply({ content: '❌ العضو غير موجود بالسيرفر حالياً.', ephemeral: true });

        const infoEmbed = new EmbedBuilder()
            .setTitle(`👤 بطاقة بيانات صاحب التكت: ${targetMember.user.username}`)
            .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
            .setColor('#3498DB')
            .addFields(
                { name: '🆔 الآيدي:', value: `\`${targetMember.id}\``, inline: true },
                { name: '🏷️ اسمه بالسيرفر:', value: `${targetMember.displayName}`, inline: true },
                { name: '📅 انضمامه للسيرفر:', value: `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:R>`, inline: false },
                { name: '📅 إنشاء الحساب:', value: `<t:${Math.floor(targetMember.user.createdTimestamp / 1000)}:R>`, inline: false }
            )
            .setFooter({ text: `طلب بواسطة: ${interaction.user.tag}` })
            .setTimestamp();

        // إرسال البطاقة علنياً في الشات ليراها الجميع
        await interaction.reply({ embeds: [infoEmbed], ephemeral: false });
    }

    // 6️⃣ إضافة عضو
    if (interaction.isButton() && interaction.customId === 'add_user') {
        const isStaff = interaction.member.roles.cache.has(STAFF_ROLE_ID) || interaction.member.roles.cache.has(HIGHER_STAFF_ROLE_ID) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        if (!isStaff) return interaction.reply({ content: '❌ هذا الزر مخصص للإدارة فقط!', ephemeral: true });

        await interaction.reply({ content: '💬 **منشن العضو أو اكتب الآيدي حقه في الشات الآن...**', ephemeral: true });

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
                await interaction.channel.send({ content: `✅ تم إضافة العضو <@${targetMember.id}> للتكت بنجاح.` });

            } catch (err) {
                console.log('خطأ في إضافة العضو:', err);
            }
        });
    }

    // 7️⃣ تنبيه صاحب التكت
    if (interaction.isButton() && interaction.customId === 'summon_user') {
        const ticketOwnerId = interaction.channel.topic;
        if (!ticketOwnerId) return interaction.reply({ content: '❌ لم يتم العثور على صاحب التكت.', ephemeral: true });
        await interaction.reply({ content: `🔔 <@${ticketOwnerId}>، يا بعد حيي يرجى التواجد بالتكت للضرورة!` });
    }

    // 8️⃣ إشعار الإدارة
    if (interaction.isButton() && interaction.customId === 'summon_staff') {
        const data = ticketsData.get(interaction.channel.id);
        const roleToMention = (data && data.category === 'شكوى على إداري') ? HIGHER_STAFF_ROLE_ID : STAFF_ROLE_ID;
        await interaction.reply({ content: `📢 <@&${roleToMention}>، تم إشعار الإدارة بواسطة <@${interaction.user.id}>!` });
    }

    // 9️⃣ طلب إغلاق التكت
    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        const confirmEmbed = new EmbedBuilder()
            .setTitle('❓ تأكيد إغلاق التكت')
            .setDescription('**هل أنت متأكد من إغلاق هذا التكت؟**')
            .setColor('#E67E22');

        const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_close_ticket').setLabel('✅ تأكيد الإغلاق').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cancel_close_ticket').setLabel('❌ إلغاء').setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({ embeds: [confirmEmbed], components: [confirmRow], ephemeral: true });
    }

    // 🔟 إلغاء الإغلاق
    if (interaction.isButton() && interaction.customId === 'cancel_close_ticket') {
        await interaction.update({ content: '✅ تم إلغاء عملية إغلاق التكت.', embeds: [], components: [] });
    }

    // 1️⃣1️⃣ تأكيد الإغلاق الفعلي (حفظ اللوق النهائي الشامل)
    if (interaction.isButton() && interaction.customId === 'confirm_close_ticket') {
        const channel = interaction.channel;
        const data = ticketsData.get(channel.id) || { ownerId: channel.topic || 'غير معروف', category: 'دعم فني', claimedBy: null, addedUsers: [], createdAt: Date.now() };

        await interaction.update({ content: '🔒 جاري إغلاق التكت وحفظ التقرير...', embeds: [], components: [] });

        let messageCount = 0;
        try {
            const fetchedMessages = await channel.messages.fetch({ limit: 100 });
            messageCount = fetchedMessages.size;
        } catch (e) {
            messageCount = 1;
        }

        const durationMs = Date.now() - data.createdAt;
        const durationMinutes = Math.max(1, Math.round(durationMs / 60000));

        const participantsText = [];
        if (data.claimedBy) {
            participantsText.push(`👑 — المستلم: <@${data.claimedBy}>`);
        }
        participantsText.push(`👤 — صاحب التذكرة: <@${data.ownerId}>`);
        if (data.addedUsers && data.addedUsers.length > 0) {
            data.addedUsers.forEach(id => {
                participantsText.push(`➕ — مشارك: <@${id}>`);
            });
        }

        const claimerText = data.claimedBy ? `<@${data.claimedBy}>` : 'لم تُستلم';
        const closerText = `<@${interaction.user.id}>`;

        const exactLogEmbed = new EmbedBuilder()
            .setTitle(`📦 نسخة التذكرة — ${data.category}`)
            .setDescription(`🔒 انحفظت تلقائياً عند الإغلاق — أغلَقها ${closerText}`)
            .addFields(
                { name: '👤 صاحب التذكرة', value: `<@${data.ownerId}>\n\`${data.ownerId}\``, inline: false },
                { name: '📍 الروم', value: `\`#${channel.name}\``, inline: false },
                { name: '🙋‍♂️ مستلم التكت', value: claimerText, inline: true },
                { name: '🔒 أُغلقت بواسطة', value: closerText, inline: true },
                { name: '💬 الرسائل', value: `${messageCount}`, inline: true },
                { name: '📎 المرفقات', value: 'ما فيه', inline: true },
                { name: '⏱️ مدة التذكرة', value: `${durationMinutes} دقيقة`, inline: true },
                { name: '📌 الحالة', value: 'مغلقة', inline: true },
                { name: '👥 المشاركين (' + participantsText.length + ')', value: participantsText.join('\n'), inline: false }
            )
            .setColor('#2C2F33')
            .setFooter({ text: `🎫 التذاكر • نسخة من ديسكورد مباشرة | ${new Date().toLocaleString('ar-SA')}` })
            .setTimestamp();

        await sendLog(interaction.guild, null, exactLogEmbed);

        ticketsData.delete(channel.id);

        setTimeout(async () => {
            try { await channel.delete(); } catch (err) {}
        }, 3000);
    }
});

// 🔑 تسجيل الدخول
const tokenToUse = process.env.TOKEN;
if (!tokenToUse) {
    console.log('[!] خطأ: لم يتم العثور على التوكن!');
    process.exit(1);
}
client.login(tokenToUse);
