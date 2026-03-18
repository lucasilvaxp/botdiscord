const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const queueManager = require('../managers/queueManager');

module.exports = {
    name: 'fila',
    description: 'Abre uma fila de Sorteado',
    async execute(message, args) {
        const mode = args[0] || '4v4';
        const validModes = ['2v2', '3v3', '4v4'];

        if (!validModes.includes(mode)) {
            return message.reply('Por favor, especifique um modo válido: !fila 2v2, !fila 3v3 ou !fila 4v4.');
        }

        const maxPlayers = parseInt(mode[0]) * 2;
        const halfMax = maxPlayers / 2;
        
        const embed = new EmbedBuilder()
            .setTitle(`Fila Aberta [${mode}]`)
            .setDescription('Clique nos botões abaixo para participar da fila.')
            .setColor('#2b2d31')
            .addFields(
                { name: `Participantes (0/${maxPlayers})`, value: '🟢 Livre\n'.repeat(halfMax), inline: true },
                { name: `\u200b`, value: '🟢 Livre\n'.repeat(halfMax), inline: true },
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
                    .setStyle(ButtonStyle.Primary)
            );

        const menuRow = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`queue_menu_${mode}`)
                    .setPlaceholder('Opções da Fila')
                    .addOptions([
                        { label: 'Configurações', value: 'settings', emoji: '⚙️' },
                        { label: 'Limpar Fila', value: 'clear', emoji: '🧹' },
                        { label: 'Fechar Fila', value: 'close', emoji: '🔒' }
                    ])
            );

        // Menu ACIMA dos botões
        const sentMessage = await message.channel.send({ embeds: [embed], components: [menuRow, row] });
        
        queueManager.createQueue(mode, sentMessage.id, message.channel.id);
        const queue = queueManager.getQueue(sentMessage.id);
        if (queue) {
            queue.ownerId = message.author.id;
            queue.maxPlayers = maxPlayers;
            queue.isChallenge = false;
        }
    }
};
