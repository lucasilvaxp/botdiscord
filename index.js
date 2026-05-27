require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Events, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const queueManager = require('./src/managers/queueManager');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ]
});

// Carregar Comandos
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'src/commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.name, command);
}

// Carregar Eventos
const eventsPath = path.join(__dirname, 'src/events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// Handler de Comandos e Detecção de ID/Senha
client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;

    // Detecção de ID e Senha em canais de partida
    const match = queueManager.getMatch(message.channel.id);
    if (match) {
        const content = message.content.trim();
        
        // Se for apenas números e tiver entre 5 e 12 dígitos, tratamos como ID
        if (/^\d{5,12}$/.test(content)) {
            match.pendingId = content;
            return; // Aguarda a senha
        }

        // Se tiver o ID pendente e a mensagem atual for curta (senha), ou se for o formato "ID SENHA"
        const idPassRegex = /^(\d{5,12})\s+(\d{1,8})$/;
        const matchResult = content.match(idPassRegex);

        let finalId = null;
        let finalPass = null;

        if (matchResult) {
            finalId = matchResult[1];
            finalPass = matchResult[2];
        } else if (match.pendingId && /^\d{1,8}$/.test(content)) {
            finalId = match.pendingId;
            finalPass = content;
            match.pendingId = null; // Limpa após usar
        }

        if (finalId && finalPass) {
            const infoEmbed = new EmbedBuilder()
                .setTitle('🎮 Sala Criada!')
                .setDescription(`A sala foi criada com sucesso! Todos os jogadores foram mencionados abaixo. Vocês têm **3 minutos** para entrar na sala.`)
                .addFields(
                    { name: '🆔 ID da Sala', value: `\`${finalId}\``, inline: true },
                    { name: '🔑 Senha', value: `\`${finalPass}\``, inline: true }
                )
                .setColor('#00ff00')
                .setTimestamp();

            await message.channel.send({ 
                content: match.players.map(id => `<@${id}>`).join(' '), 
                embeds: [infoEmbed] 
            });
            return;
        }
    }

    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);
    if (!command) return;

    try {
        await command.execute(message, args);
    } catch (error) {
        console.error(error);
        message.reply('Houve um erro ao executar este comando!');
    }
});

client.once(Events.ClientReady, c => {
    console.log(`Pronto! Logado como ${c.user.tag}`);
});

if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => console.log('Conectado ao MongoDB com sucesso!'))
        .catch(err => console.error('Erro ao conectar ao MongoDB:', err));
}

if (process.env.DISCORD_TOKEN) {
    client.login(process.env.DISCORD_TOKEN);
}
