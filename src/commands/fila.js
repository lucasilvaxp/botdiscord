const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const queueManager = require('../managers/queueManager');

module.exports = {
    name: 'fila',
    description: 'Abre uma fila de Sorteado',
    async execute(message, args) {
        const mode = args[0];
        const validModes = ['2v2', '3v3', '4v4'];

        if (!mode || !validModes.includes(mode)) {
            return message.reply('Por favor, especifique um modo válido: !fila 2v2, !fila 3v3 ou !fila 4v4.');
        }

        const maxPlayers = parseInt(mode[0]) * 2;
        
        const embed = new EmbedBuilder()
            .setTitle(`Fila Aberta [${mode}]`)
            .setDescription('Clique nos botões abaixo para participar da fila.')
            .setColor('#2b2d31')
            .addFields(
                { name: `👥 Participantes (0)`, value: this.generateParticipantList(0, maxPlayers, []) },
                { name: '👑 Criador', value: `<@${message.author.id}>`, inline: true },
                { name: '🎮 Modo', value: `\`${mode}\``, inline: true }
            )
            .setFooter({ text: `Aguardando jogadores para iniciar... • Hoje às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`queue_join_${mode}`)
                    .setLabel('Entrar')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`queue_leave_${mode}`)
                    .setLabel('Sair')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`queue_start_${mode}`)
                    .setLabel('Iniciar Partida')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`queue_actions_${mode}`)
                    .setEmoji('⚙️')
                    .setStyle(ButtonStyle.Secondary)
            );

        const sentMessage = await message.channel.send({ embeds: [embed], components: [row] });
        
        queueManager.createQueue(mode, sentMessage.id, message.channel.id);
        const queue = queueManager.getQueue(sentMessage.id);
        if (queue) {
            queue.ownerId = message.author.id;
            queue.maxPlayers = maxPlayers;
        }
    },

    generateParticipantList(current, max, players) {
        let list = '';
        for (let i = 0; i < Math.max(current, max); i++) {
            if (i < current) {
                list += `🔴 <@${players[i]}>\n`;
            } else if (i < max) {
                list += `🟢 Livre\n`;
            }
        }
        return list || 'Nenhum participante';
    }
};
