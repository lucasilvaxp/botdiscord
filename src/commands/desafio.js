const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const queueManager = require('../managers/queueManager');

module.exports = {
    name: 'desafio',
    description: 'Cria um desafio com times formados',
    async execute(message, args) {
        const mode = args[0] || '4v4';
        const validModes = ['2v2', '3v3', '4v4'];

        if (!validModes.includes(mode)) {
            return message.reply('Por favor, especifique um modo válido: !desafio 2v2, !desafio 3v3 ou !desafio 4v4.');
        }

        const maxPlayers = parseInt(mode[0]) * 2;
        const teamSize = maxPlayers / 2;

        const embed = new EmbedBuilder()
            .setTitle(`${mode} | Fila Desafio Criada!`)
            .setDescription('Seja Bem Vindo(a) a fila **Desafio**! Aqui todos os times são formados. Caso deseje participar, utilize os botões abaixo para fazer as ações disponíveis.')
            .setColor('#2b2d31')
            .addFields(
                { name: `Equipe 1 (0/${teamSize})`, value: '🟢 Livre\n'.repeat(teamSize), inline: true },
                { name: `Equipe 2 (0/${teamSize})`, value: '🟢 Livre\n'.repeat(teamSize), inline: true }
            )
            .setFooter({ text: `Aguardando jogadores... • Hoje às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`challenge_join_1_${mode}`)
                    .setLabel(`Entrar [0/${teamSize}]`)
                    .setEmoji('✅')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`challenge_join_2_${mode}`)
                    .setLabel(`Entrar [0/${teamSize}]`)
                    .setEmoji('✅')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`challenge_leave_${mode}`)
                    .setLabel('Sair')
                    .setEmoji('❌')
                    .setStyle(ButtonStyle.Secondary)
            );

        const menuRow = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`challenge_menu_${mode}`)
                    .setPlaceholder('Opções do Desafio')
                    .addOptions([
                        { label: 'Iniciar Partida', value: 'start', emoji: '▶️' },
                        { label: 'Expulsar', value: 'kick', emoji: '👢' },
                        { label: 'Encerrar', value: 'cancel', emoji: '🏁' }
                    ])
            );

        // Menu ACIMA dos botões
        const sentMessage = await message.channel.send({ embeds: [embed], components: [menuRow, row] });
        
        queueManager.createQueue(mode, sentMessage.id, message.channel.id);
        const challenge = queueManager.getQueue(sentMessage.id);
        if (challenge) {
            challenge.ownerId = message.author.id;
            challenge.isChallenge = true;
            challenge.team1 = [];
            challenge.team2 = [];
            challenge.maxPlayers = maxPlayers;
            challenge.teamSize = teamSize;
        }
    }
};
