require('./server.js');
require('dotenv').config();

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
    PermissionFlagsBits,
    Collection
} = require('discord.js');

const fs = require('fs');

// نظام حفظ التكتات في ملف محلي لمنع أخطاء البناء
const DB_FILE = './tickets_data.json';
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({}));
}

function getTicketsData() {
    try {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch {
        return {};
    }
}

function saveTicketData(channelId, data) {
    const db = getTicketsData();
    if (data === null) {
        delete db[channelId];
    } else {
        db[channelId] = data;
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// === الثوابت والإعدادات المركزية ===
const CONFIG = {
    STAFF_ROLE_ID: '1554251752574951425',
    TICKET_CATEGORY_ID: '1554252223763058809',
    LOG_CHANNEL_ID: '1543094678038257784',
    EMBED_COLOR: '#2f3136'
};

const cooldowns = new Collection();

async function sendLog(guild, embed) {
    try {
        const logChannel = guild.channels.cache.get(CONFIG.LOG_CHANNEL_ID);
        if (logChannel && logChannel.isTextBased()) {
            await logChannel.send({ embeds: [embed] });
        }
    } catch (err) {
        console.error('[LOG_ERROR]', err.message);
    }
}

client.once('ready', () => {
    console.log(`[SYSTEM] البوت شغال وجاهز يا طويل العمر باسم: ${client.user.tag}`);
});

// === الأوامر النصية ===
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    if (message.content === '!setup') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('ما عندك صلاحية تستخدم هالأمر يا طويل العمر!').then(m => setTimeout(() => m.delete().catch(() => {}), 4000));
        }

        const setupEmbed = new EmbedBuilder()
            .setTitle('🎫 مركز التذاكر والدعم الفني')
            .setDescription(
                'أرحب بك في مركز الدعم الفني والخدمات العامة!\n\n' +
                'يرجى اختيار **القسم المناسب لموضوعك** من القائمة المنسدلة بالأسفل لفتح تكت وتوجيهك للإدارة المختصة مباشرة.'
            )
            .setColor(CONFIG.EMBED_COLOR)
            .setFooter({ text: 'نظام الدعم الفني الآلي', iconURL: message.guild.iconURL() });

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ticket_select')
                .setPlaceholder('اختر القسم المناسب من هنا يا بعدي...')
                .addOptions([
                    {
                        label: 'الدعم الفني والمشاكل',
                        description: 'لحل المشاكل التقنية وبلاغات اللاعبين',
                        value: 'support',
                        emoji: '🛠️'
                    },
                    {
                        label: 'الاستفسارات العامة',
                        description: 'لأي استفسار أو سؤال عام عندك',
                        value: 'general',
                        emoji: '💬'
                    },
                    {
                        label: 'قسم المتجر والشراء',
                        description: 'للشراء، الشحن، والاستفسار عن المنتجات',
                        value: 'store',
                        emoji: '🛒'
                    },
                    {
                        label: 'إعادة ضبط القائمة',
                        description: 'تفريغ الاختيار الحالي من القائمة',
                        value: 'reset',
                        emoji: '🔄'
                    }
                ])
        );

        await message.channel.send({ embeds: [setupEmbed], components: [menu] });
        await message.delete().catch(() => {});
        return;
    }

    // أوامر الباند المخصصة
    const customBans = [
        'بنعالي', '!بنعالي', 
        'بنعال_براء', '!بنعال_براء', 
        'بنعال_حرب', '!بنعال_حرب', 
        'بنعال_ريان', '!بنعال_ريان'
    ];
    const args = message.content.trim().split(/ +/);
    const cmd = args[0];

    if (customBans.includes(cmd)) {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return message.reply('❌ ما عندك صلاحية تبنيد يا الغالي!');
        }

        const target = message.mentions.members.first() || await message.guild.members.fetch(args[1]).catch(() => null);
        if (!target) {
            return message.reply(`❌ لاهنت سو منشن للشخص أو اكتب ايديه!\nمثال: \`${cmd} @user السبب\``);
        }

        if (!target.bannable) {
            return message.reply('❌ ما أقدر أبنّد هذا الشخص! (قد تكون رتبته أعلى مني أو رتبة إدارية).');
        }

        const reason = args.slice(2).join(' ') || 'بدون سبب محدد';
        try {
            await target.ban({ reason: `الأمر: ${cmd} | بواسطة: ${message.author.tag} \vert{} السبب: ${reason}` });
            await message.channel.send(`✅ **${target.user.username}** banned from the server! ✈️`);
        } catch (err) {
            console.error('[BAN_ERROR]', err);
            await message.reply('❌ حدث خطأ أثناء تنفيذ الحظر.');
        }
    }
});

// === إدارة التفاعلات ===
client.on('interactionCreate', async (interaction) => {

    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
        const val = interaction.values[0];

        if (val === 'reset') {
            return interaction.reply({ content: '🔄 تم تفريغ الاختيار بنجاح.', ephemeral: true });
        }

        const db = getTicketsData();
        const hasOpenTicket = Object.values(db).some(t => t.owner_id === interaction.user.id && t.category === val);
        if (hasOpenTicket) {
            return interaction.reply({ content: '❌ يا غالي عندك تكت مفتوح أصلاً في هذا القسم!', ephemeral: true });
        }

        const modal = new ModalBuilder()
            .setCustomId(`ticket_modal_${val}`)
            .setTitle('تفاصيل التكت والاستفسار');

        const titleInput = new TextInputBuilder()
            .setCustomId('ticket_subject')
            .setLabel('موضوع الطلب / المشكلة')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('اكتب عنوان بسيط لموضوعك هنا...')
            .setRequired(true)
            .setMaxLength(100);

        const descInput = new TextInputBuilder()
            .setCustomId('ticket_details')
            .setLabel('شرح المشكلة بالتفصيل')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('اكتب كل التفاصيل اللي تبيها عشان نقدر نخدمك بسرعة...')
            .setRequired(true)
            .setMaxLength(1000);

        modal.addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(descInput)
        );

        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_modal_')) {
        const categoryKey = interaction.customId.replace('ticket_modal_', '');
        const subject = interaction.fields.getTextInputValue('ticket_subject');
        const details = interaction.fields.getTextInputValue('ticket_details');

        let catName = 'دعم-عام';
        let catColor = '#5865F2';
        if (categoryKey === 'support') { catName = 'دعم-فني'; catColor = '#ED4245'; }
        else if (categoryKey === 'general') { catName = 'استفسار'; catColor = '#57F287'; }
        else if (categoryKey === 'store') { catName = 'متجر'; catColor = '#FEE75C'; }

        await interaction.deferReply({ ephemeral: true });

        try {
            const ticketChannel = await interaction.guild.channels.create({
                name: `${catName}-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: CONFIG.TICKET_CATEGORY_ID,
                topic: interaction.user.id,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
                    { id: CONFIG.STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
                    { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
                ]
            });

            saveTicketData(ticketChannel.id, {
                owner_id: interaction.user.id,
                category: catName,
                claimed_by: null,
                added_users: []
            });

            const rulesText = 
                "📌 **قوانين وتعليمات التكت:**\n" +
                "1️⃣ **احترام طاقم الإدارة:** يرجى التحدث بأسلوب راقي والتزود بالصبر حتى يتم الرد عليك.\n" +
                "2️⃣ **وضوح المشكلة:** يرجى كتابة مشكلتك أو طلبك كاملاً مع إرفاق الصور أو الأدلة إن وجدت.\n" +
                "3️⃣ **منع التكرار والسبام:** يرجى عدم عمل منشن مستمر للإدارة، فالرد يكون بأسرع وقت ممكن حسب الأسبقية.\n" +
                "4️⃣ **الالتزام بالقسم:** يرجى التأكد من فتح التكت في القسم المخصص لمشكلتك لضمان خدمتك بسرعة.\n" +
                "5️⃣ **إغلاق التكت:** عند انتهاء مشكلتك أو استلام طلبك، يرجى الضغط على زر **إغلاق التكت**.\n\n" +
                `📜 **تفاصيل طلبك:**\n• **العنوان:** ${subject}\n• **الشرح:**\n\`\`\`\n${details}\n\`\`\``;

            const mainEmbed = new EmbedBuilder()
                .setTitle(`أرحب يا <@${interaction.user.id}> 👋 \vert{} تكت [ ${catName} ]`)
                .setDescription(`يا هلا والله بك في مركز الدعم الفني الخاص بنا!\nتم فتح التكت الخاص بك بنجاح، وطاقم الإدارة اتوصل له إشعار وبيردون عليك بأقرب وقت.\n\n${rulesText}`)
                .setColor(catColor)
                .setFooter({ text: 'نظام الدعم الفني وإدارة التذاكر' })
                .setTimestamp();

            const controlButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket_claim').setLabel('استلام التكت').setStyle(ButtonStyle.Success).setEmoji('🙋‍♂️'),
                new ButtonBuilder().setCustomId('ticket_add').setLabel('إضافة عضو').setStyle(ButtonStyle.Primary).setEmoji('➕'),
                new ButtonBuilder().setCustomId('ticket_ping_user').setLabel('استدعاء العضو').setStyle(ButtonStyle.Secondary).setEmoji('🔔'),
                new ButtonBuilder().setCustomId('ticket_ping_staff').setLabel('استدعاء الإدارة').setStyle(ButtonStyle.Secondary).setEmoji('📢'),
                new ButtonBuilder().setCustomId('ticket_close_modal').setLabel('إغلاق التكت').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            await ticketChannel.send({
                content: `<@${interaction.user.id}> \vert{} <@&${CONFIG.STAFF_ROLE_ID}>`,
                embeds: [mainEmbed],
                components: [controlButtons]
            });

            await interaction.editReply({ content: `✅ أبشر، تم فتح التكت حقك هنا: ${ticketChannel}` });

        } catch (err) {
            console.error('[TICKET_CREATION_ERROR]', err);
            await interaction.editReply({ content: '❌ حدث خطأ غير متوقع أثناء إنشاء التكت، تأكد من صلاحيات البوت!' });
        }
    }

    if (interaction.isButton()) {
        const { customId, channel, member, guild } = interaction;
        const isStaff = member.roles.cache.has(CONFIG.STAFF_ROLE_ID) || member.permissions.has(PermissionFlagsBits.Administrator);

        if (customId === 'ticket_claim') {
            if (!isStaff) return interaction.reply({ content: '❌ هذا الزر مخصص لرجال الإدارة فقط!', ephemeral: true });

            const db = getTicketsData();
            const ticketData = db[channel.id];
            if (ticketData && ticketData.claimed_by) {
                return interaction.reply({ content: `❌ التكت مستلمة أصلاً بواسطة <@${ticketData.claimed_by}>`, ephemeral: true });
            }

            if (ticketData) {
                ticketData.claimed_by = member.id;
                saveTicketData(channel.id, ticketData);
            }

            await channel.permissionOverwrites.edit(CONFIG.STAFF_ROLE_ID, { ViewChannel: true, SendMessages: false });
            await channel.permissionOverwrites.edit(member.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });

            const row = ActionRowBuilder.from(interaction.message.components[0]);
            row.components[0].setDisabled(true).setLabel(`مستلمة: ${member.user.username}`);

            await interaction.update({ components: [row] });
            await channel.send({ content: `🙋‍♂️ كفو! تم استلام التكت بواسطة الإداري: <@${member.id}>.` });

            const log = new EmbedBuilder()
                .setTitle('🙋‍♂️ استلام تكت')
                .setColor('#FEE75C')
                .addFields(
                    { name: 'التكت:', value: `${channel.name}`, inline: true },
                    { name: 'المستلم:', value: `<@${member.id}>`, inline: true }
                )
                .setTimestamp();
            await sendLog(guild, log);
        }

        if (customId === 'ticket_add') {
            if (!isStaff) return interaction.reply({ content: '❌ هذا الخيار للإدارة فقط.', ephemeral: true });

            await interaction.reply({ content: '💬 أرسل منشن العضو أو الأيدي حقه بالشات الحين (معك 30 ثانية)...', ephemeral: true });

            const filter = m => m.author.id === member.id;
            const collector = channel.createMessageCollector({ filter, time: 30000, max: 1 });

            collector.on('collect', async m => {
                const targetId = m.content.trim().replace(/[<@!>]/g, '');
                const target = await guild.members.fetch(targetId).catch(() => null);

                if (!target) {
                    await m.delete().catch(() => {});
                    return interaction.followUp({ content: '⏰ انتهت المهلة أو الأيدي غير صحيح!', ephemeral: true });
                }

                await channel.permissionOverwrites.edit(target.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
                await m.delete().catch(() => {});
                await channel.send({ content: `✅ أبشر، تم إضافة العضو <@${target.id}> للتكت بواسطة <@${member.id}>.` });

                const db = getTicketsData();
                const ticketData = db[channel.id];
                if (ticketData) {
                    if (!ticketData.added_users.includes(target.id)) {
                        ticketData.added_users.push(target.id);
                        saveTicketData(channel.id, ticketData);
                    }
                }
            });
        }

        if (customId === 'ticket_ping_user') {
            if (!isStaff) return interaction.reply({ content: '❌ هذا الخيار للإدارة فقط.', ephemeral: true });

            const ownerId = channel.topic;
            if (!ownerId) return interaction.reply({ content: '❌ ما قدرنا نوصل لصاحب التكت.', ephemeral: true });

            await interaction.reply({ content: `🔔 يا <@${ownerId}>، لاهنت ارجع للتكت! استدعاء من الإداري: <@${member.id}>` });
        }

        if (customId === 'ticket_ping_staff') {
            const now = Date.now();
            const cooldownAmount = 180000;

            if (cooldowns.has(channel.id)) {
                const expirationTime = cooldowns.get(channel.id) + cooldownAmount;
                if (now < expirationTime) {
                    const timeLeft = ((expirationTime - now) / 1000).toFixed(0);
                    return interaction.reply({ content: `⏳ هدي الوضع يا بعدي، انتظر \`${timeLeft}\` ثانية قبل ترسل استدعاء جديد.`, ephemeral: true });
                }
            }

            cooldowns.set(channel.id, now);
            await interaction.reply({ content: `📢 يا إخوان <@&${CONFIG.STAFF_ROLE_ID}>، مطلوب حضوركم للتكت من قبل: <@${member.id}>!` });
        }

        if (customId === 'ticket_close_modal') {
            const modal = new ModalBuilder()
                .setCustomId('ticket_close_reason_modal')
                .setTitle('إغلاق التكت');

            const reasonInput = new TextInputBuilder()
                .setCustomId('close_reason')
                .setLabel('سبب الإغلاق (اختياري)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('اكتب سبب إغلاق التكت هنا...')
                .setRequired(false)
                .setMaxLength(200);

            modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
            await interaction.showModal(modal);
        }
    }

    if (interaction.isModalSubmit() && interaction.customId === 'ticket_close_reason_modal') {
        const reason = interaction.fields.getTextInputValue('close_reason') || 'بدون ذكر سبب';
        const channel = interaction.channel;

        const db = getTicketsData();
        const ticketData = db[channel.id] || {};
        const addedList = ticketData.added_users || [];
        const addedFormatted = addedList.length > 0 ? addedList.map(id => `<@${id}>`).join(', ') : 'لا يوجد';

        const closeLogEmbed = new EmbedBuilder()
            .setTitle('📄 تقرير إغلاق تكت')
            .setColor('#ED4245')
            .addFields(
                { name: '📌 التكت:', value: `\`${channel.name}\``, inline: true },
                { name: '📂 القسم:', value: `\`${ticketData.category || 'غير محدد'}\``, inline: true },
                { name: '👤 صاحب التكت:', value: `<@${ticketData.owner_id || channel.topic}>`, inline: false },
                { name: '🙋‍♂️ المستلم:', value: ticketData.claimed_by ? `<@${ticketData.claimed_by}>` : 'لم تُستلم', inline: true },
                { name: '👥 المضافين:', value: addedFormatted, inline: true },
                { name: '🔒 أُغلق بواسطة:', value: `<@${interaction.user.id}>`, inline: false },
                { name: '📝 السبب:', value: `\`\`\`${reason}\`\`\`` }
            )
            .setTimestamp();

        await sendLog(interaction.guild, closeLogEmbed);
        saveTicketData(channel.id, null);

        await interaction.reply({ content: '🔒 تم، بيتم حذف وقفل التكت خلال 3 ثوانٍ...' });

        setTimeout(async () => {
            await channel.delete().catch(err => console.error('[DELETE_CHANNEL_ERROR]', err));
        }, 3000);
    }
});

client.login(process.env.TOKEN);
