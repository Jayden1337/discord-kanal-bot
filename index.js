require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, PermissionsBitField } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

// Datenbank-Verbindung
const db = new sqlite3.Database('./kanalBot.db', (err) => {
    if (err) return console.error(err.message);
    console.log('Datenbank verbunden.');
});

// Tabelle erstellen, falls sie nicht existiert
db.run(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, approvedCount INTEGER DEFAULT 0, currentChannels INTEGER DEFAULT 0, rank TEXT DEFAULT 'Neuling')`);

// Ränge und Kanal-Limits
const ranks = { "Neuling": 2, "Erfahren": 4, "Meister": 6, "Legende": 10 };

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand() && interaction.commandName === 'panel') {
        const embed = new EmbedBuilder()
            .setTitle('Kanal beantragen')
            .setDescription('Klicke unten auf den Button!')
            .setColor('Blue');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('beantragen')
                .setLabel('Beantragen')
                .setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
    }

    if (interaction.isButton() && interaction.customId === 'beantragen') {
        db.get('SELECT * FROM users WHERE id = ?', [interaction.user.id], async (err, user) => {
            if (!user) db.run('INSERT INTO users (id) VALUES (?)', [interaction.user.id]);

            const maxChannels = ranks[user?.rank || 'Neuling'];
            if (user?.currentChannels >= maxChannels) {
                return interaction.reply({ content: `Du hast das Limit erreicht (${maxChannels} Kanäle).`, ephemeral: true });
            }

            const modal = new ModalBuilder().setCustomId('beantragungsModal').setTitle('Kanal beantragen');
            const nameInput = new TextInputBuilder().setCustomId('channelName').setLabel('Kanalname').setStyle(TextInputStyle.Short).setRequired(true);
            const descInput = new TextInputBuilder().setCustomId('channelDesc').setLabel('Beschreibung').setStyle(TextInputStyle.Paragraph).setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(nameInput), new ActionRowBuilder().addComponents(descInput));
            await interaction.showModal(modal);
        });
    }

    if (interaction.isModalSubmit() && interaction.customId === 'beantragungsModal') {
        const userId = interaction.user.id;
        const channelName = interaction.fields.getTextInputValue('channelName');

        db.get('SELECT * FROM users WHERE id = ?', [userId], async (err, user) => {
            if (!user) return interaction.reply({ content: 'Benutzer nicht gefunden!', ephemeral: true });

            const channel = await interaction.guild.channels.create({
                name: channelName,
                parent: process.env.CATEGORY_ID,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ManageChannels] },
                    { id: process.env.ADMIN_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel] },
                ]
            });

            db.run('UPDATE users SET currentChannels = currentChannels + 1 WHERE id = ?', [userId]);
            await interaction.reply({ content: `Dein Kanal wurde beantragt: ${channel}`, ephemeral: true });
        });
    }
});

client.on('ready', async () => {
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    await guild.commands.set([{ name: 'panel', description: 'Zeigt das Kanal-Beantragungs-Panel an.' }]);
    console.log('Bot ist bereit!');
});

client.login(process.env.DISCORD_TOKEN);
