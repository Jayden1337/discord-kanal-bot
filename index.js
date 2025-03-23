require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, PermissionsBitField } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

// Datenbank-Verbindung
const db = new sqlite3.Database('./kanalBot.db', (err) => {
    if (err) return console.error(err.message);
    console.log('Datenbank verbunden.');
});

// Tabelle erstellen
db.run(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, currentChannels INTEGER DEFAULT 0)`);

// Ränge und Limits
const maxChannels = 3;  // Max. Kanäle pro Nutzer

client.on('interactionCreate', async interaction => {
    // Panel anzeigen
    if (interaction.isChatInputCommand() && interaction.commandName === 'panel') {
        const embed = new EmbedBuilder()
            .setTitle('📝 Kanal beantragen')
            .setDescription('Klicke auf den Button, um einen eigenen Kanal zu beantragen!')
            .setColor('Blue');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('beantragen')
                .setLabel('Beantragen')
                .setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
    }

    // Button: Beantragen
    if (interaction.isButton() && interaction.customId === 'beantragen') {
        db.get('SELECT currentChannels FROM users WHERE id = ?', [interaction.user.id], async (err, user) => {
            if (!user) db.run('INSERT INTO users (id) VALUES (?)', [interaction.user.id]);

            if (user?.currentChannels >= maxChannels) {
                return interaction.reply({ content: `Du hast das Limit erreicht (${maxChannels} Kanäle).`, ephemeral: true });
            }

            // Modal anzeigen (Kategorie + Kanalname)
            const modal = new ModalBuilder().setCustomId('beantragungsModal').setTitle('Kanal beantragen');
            const categoryInput = new TextInputBuilder().setCustomId('categoryName').setLabel('Kategoriename').setStyle(TextInputStyle.Short).setRequired(true);
            const channelInput = new TextInputBuilder().setCustomId('channelName').setLabel('Kanalname').setStyle(TextInputStyle.Short).setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(categoryInput),
                new ActionRowBuilder().addComponents(channelInput)
            );

            await interaction.showModal(modal);
        });
    }

    // Modal: Kanal beantragen
    if (interaction.isModalSubmit() && interaction.customId === 'beantragungsModal') {
        const userId = interaction.user.id;
        const categoryName = interaction.fields.getTextInputValue('categoryName');
        const channelName = interaction.fields.getTextInputValue('channelName');

        // Kategorie erstellen
        const category = await interaction.guild.channels.create({
            name: categoryName,
            type: 4 // Kategorie-Typ
        });

        // Kanal in der Kategorie erstellen
        const channel = await interaction.guild.channels.create({
            name: channelName,
            parent: category.id,  // Setzt die Kategorie
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ManageChannels] }
            ]
        });

        // Nutzerdaten aktualisieren
        db.run('UPDATE users SET currentChannels = currentChannels + 1 WHERE id = ?', [userId]);

        await interaction.reply({ content: `✅ Deine Kategorie **${categoryName}** und der Kanal **${channelName}** wurden erstellt!`, ephemeral: true });
    }
});

// Slash-Befehl registrieren
client.on('ready', async () => {
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    await guild.commands.set([{ name: 'panel', description: 'Zeigt das Kanal-Beantragungs-Panel an.' }]);
    console.log('Bot ist bereit!');
});

// Bot starten
client.login(process.env.DISCORD_TOKEN);
