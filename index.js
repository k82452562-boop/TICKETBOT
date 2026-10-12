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

// ⚙️ الآيديات الخاصة بالسيرفر (منتدى النظيم)
const STAFF_ROLE_ID = '1554251752574951425';
const LOG_CHANNEL_ID = '1554252226732490782';
const TICKET_CATEGORY_ID = '1554252056183967795';

const ticketsData = new Map();

// 📢 دالة إرسال اللوقز
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

// 👑 عند تشغيل البوت
client.once('ready', () => {
    console.log(`[!] البوت شغال بنجاح باسم: ${client.user.tag} 👑🚀`);
    client.user.setActivity('منتدى النظيم 🛡️ | خدمة الدعم الفني', { type: 0 });
});

// 💬 الأوامر والرسائل
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const args = message.content.trim().split(/ +/);
    const command = args[0].toLowerCase();

    // 1️⃣ امر السيت اب لتثبيت لوحة التكتات (!setup أو سيت_اب)
    if (command === '!setup' || command === 'سيت_اب') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ ما عندك صلاحية لتنفيذ هذا الأمر!');
        }

        const embed = new EmbedBuilder()
            .setTitle('🏛️ مـركـز الـدعـم الـفـنـي والـتـكـتـات | مـنـتـدى الـنـظـيـم 🛡️')
            .setDescription('أهلاً بك في مركز الدعم الفني الخاص بـ **منتدى النظيم**.\n\nيرجى اختيار القسم المناسب لطلبك من القائمة المنسدلة بالأسفل ليتم فتح تكت لك وتواصل طاقم الإدارة معك.')
            .setColor('#FFD700')
            .setFooter({ text: 'منتدى النظيم 🛡️ - جميع الحقوق محفوظة' });

        const menuRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ticket_select_menu')
                .setPlaceholder('👑 اختر قسم التكت المناسب...')
                .addOptions([
                    { label: 'قسم الدعم الفني والمشاكل', value: 'support_ticket', emoji: '🛠️', description: 'لمشاكل السيرفر أو البوتات' },
                    { label: 'قسم الاستفسارات العامة', value: 'general_ticket', emoji: '💬', description: 'لأي سؤال أو استفسار عام' },
                    { label: 'قسم المتجر والشراء (Store)', value: 'store_ticket', emoji: '💎', description: 'للشراء والاستفسار عن الرتب' },
                    { label: 'تحديث القائمة', value: 'refresh_menu_option', emoji: '🔄', description: 'لتحديث خيارات القائمة' }
                ])
        );

        await message.channel.send({ embeds: [embed], components: [menuRow] });
        await message.delete().catch(() => {});
        return;
    }

    // 2️⃣ الرد التلقائي داخل التكتات (إذا لم تكن الرسالة أمراً)
    if (message.channel.parentId === TICKET_CATEGORY_ID) {
        if (message.content.startsWith('!')) return;

        const ticketInfo = ticketsData.get(message.channel.id) || { claimedBy: null };
        const isStaff = message.member.roles.cache.has(STAFF_ROLE_ID) || message.member.permissions.has(PermissionFlagsBits.Administrator);

        // إذا كانت الرسالة من صاحب التكت والتكت غير مستلم بعد
        if (!isStaff && !ticketInfo.claimedBy) {
            await message.reply('يا هلا بك يا الغالي! تم استلام رسالتك وسيتم الرد عليك من قبل طاقم الإدارة بـ **منتدى النظيم** في أقرب وقت 🚀');
        }
    }
});

// 🔘 التفاعل مع القوائم والأزرار
client.on('interactionCreate', async interaction => {
    // التعامل مع القائمة المنسدلة
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select_menu') {
        if (interaction.values[0] === 'refresh_menu_option') {
            return interaction.reply({ content: '🔄 تم تحديث القائمة بنجاح!', ephemeral: true });
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
                new ButtonBuilder().setCustomId('claim_ticket').setLabel('🙋‍♂️ استلام التكت').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 إغلاق التكت').setStyle(ButtonStyle.Danger)
            );

            const welcomeEmbed = new EmbedBuilder()
                .setTitle('🏛️ أهلاً بك في تكت الدعم الفني')
                .setDescription(`أهلاً بك <@${member.id}>، تم فتح التكت بنجاح.\nيرجى كتابة مشكلتك أو استفسارك بالتفصيل وسيقوم طاقم الإدارة <@&${STAFF_ROLE_ID}> بالرد عليك.`)
                .setColor('#3498DB');

            await ticketChannel.send({ content: `<@${member.id}> | <@&${STAFF_ROLE_ID}>`, embeds: [welcomeEmbed], components: [controlRow] });
            await interaction.editReply({ content: `✅ تم إنشاء التكت بنجاح: ${ticketChannel}` });

            // إرسال اللوق
            const logEmbed = new EmbedBuilder()
                .setTitle('🎟️ إنشاء تكت جديد')
                .addFields(
                    { name: 'صاحب التكت:', value: `<@${member.id}>`, inline: true },
                    { name: 'الروم:', value: `${ticketChannel}`, inline: true }
                )
                .setColor('#2ECC71')
                .setTimestamp();
            await sendLog(guild, null, logEmbed);

        } catch (e) {
            console.error(e);
            await interaction.editReply({ content: '❌ حدث خطأ أثناء إنشاء التكت، تأكد من صلاحيات البوت.' });
        }
    }

    // زر استلام التكت (Claim)
    if (interaction.isButton() && interaction.customId === 'claim_ticket') {
        const isStaff = interaction.member.roles.cache.has(STAFF_ROLE_ID) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        if (!isStaff) return interaction.reply({ content: '❌ هذا الزر مخصص لطاقم الإدارة فقط!', ephemeral: true });

        let data = ticketsData.get(interaction.channel.id) || {};
        if (data.claimedBy) {
            return interaction.reply({ content: `❌ هذا التكت مستلم بالفعل بواسطة <@${data.claimedBy}>`, ephemeral: true });
        }

        data.claimedBy = interaction.user.id;
        ticketsData.set(interaction.channel.id, data);

        await interaction.reply({ content: `🙋‍♂️ تم استلام هذا التكت بواسطة الإداري: <@${interaction.user.id}>` });
    }

    // زر إغلاق التكت (Close)
    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        await interaction.reply({ content: '🔒 جاري إغلاق وتظريف التكت خلال ثوانٍ...' });

        const guild = interaction.guild;
        const logEmbed = new EmbedBuilder()
            .setTitle('🔒 إغلاق تكت')
            .addFields(
                { name: 'أُغلق بواسطة:', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'اسم الروم:', value: `${interaction.channel.name}`, inline: true }
            )
            .setColor('#E74C3C')
            .setTimestamp();

        await sendLog(guild, null, logEmbed);

        setTimeout(() => {
            interaction.channel.delete().catch(() => {});
        }, 3000);
    }
});

client.login(process.env.TOKEN);
