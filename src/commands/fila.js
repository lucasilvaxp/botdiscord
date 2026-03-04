const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const queueManager = require('../managers/queueManager');

module.exports = {
    name: 'fila',
    description: 'Abre uma fila de matchmaking',
    async execute(message, args) {
        const mode = args[0];
        const validModes = ['1v1', '2v2', '3v3', '4v4'];

        if (!mode || !validModes.includes(mode)) {
            return message.reply('Modo inválido! Use: `!fila 1v1`, !fila 2v2`, `!fila 3v3` ou `!fila 4v4`.');
        }

        const embed = new EmbedBuilder()
            .setTitle(`🎮 Fila Aberta [${mode}]`)
            .setDescription('Clique nos botões abaixo para participar da fila de matchmaking.')
            .setColor('#2b2d31')
            .addFields(
                { name: '👥 Jogadores na Fila', value: 'Nenhum jogador na fila.', inline: false },
                { name: '📊 Progresso', value: `0/${queueManager.modes[mode].playersNeeded}`, inline: true }
            )
            .setFooter({ text: 'O sorteio iniciará automaticamente quando a fila estiver cheia.' })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`join_queue_${mode}`)
                    .setLabel('Entrar na Fila')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`leave_queue_${mode}`)
                    .setLabel('Sair')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`cancel_queue_${mode}`)
                    .setLabel('Cancelar Fila')
                    .setStyle(ButtonStyle.Danger)
            );

        const sentMessage = await message.channel.send({ embeds: [embed], components: [row] });
        
        // Registrar a fila no gerenciador
        queueManager.createQueue(mode, sentMessage.id, message.channel.id);
        
        // Adicionar ownerId à fila
        const queue = queueManager.getQueue(sentMessage.id);
        if (queue) queue.ownerId = message.author.id;
    }
};
