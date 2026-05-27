const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const queueManager = require('../managers/queueManager');
const visual = require('../utils/visualConfig');

module.exports = {
    name: 'fila',
    description: 'Abre uma fila de Sorteado',
    async execute(message, args) {
        const mode = args[0] || '4v4';
        const validModes = ['1v1', '2v2', '3v3', '4v4'];

        if (!validModes.includes(mode)) {
            return message.reply('❌ **Erro:** Por favor, especifique um modo válido: `!fila 1v1`, `!fila 2v2`, `!fila 3v3` ou `!fila 4v4`.');
        }

        const minPlayers = parseInt(mode[0]) * 2;
        const halfMin = minPlayers / 2;
        
        const embed = new EmbedBuilder()
            .setAuthor({ name: visual.systemName, iconURL: visual.assets.logo })
            .setTitle(`『 ${mode} | Fila Sorteada Criada! 』`)
            .setDescription(`> 🎲 Os times serão formados de forma **100% aleatória** após o sorteio.\n\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n\n💸 Após o sorteio, cada jogador deve combinar o **valor da aposta** com seu adversário direto no canal criado.`)
            .setThumbnail(visual.assets.thumbnail)
            .setColor(visual.colors.sorteada)
            .addFields(
                { name: `『 👥 Participantes 』`, value: '🟢 Livre\n'.repeat(halfMin), inline: true },
                { name: `\u200b`, value: '🟢 Livre\n'.repeat(halfMin), inline: true },
                { name: `『 👑 Criador 』`, value: `<@${message.author.id}>`, inline: true },
                { name: `『 🎮 Modo 』`, value: `\`${mode}\``, inline: true },
                { name: `『 📊 Status 』`, value: `🟡 Aguardando jogadores (0/${minPlayers} mínimo)`, inline: false }
            )
            .setFooter({ text: `Sistema de Filas • Powered by ${visual.botName}`, iconURL: visual.assets.footerIcon })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`queue_join_${mode}`)
                    .setLabel('Entrar na Fila')
                    .setEmoji('✅')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`queue_leave_${mode}`)
                    .setLabel('Sair da Fila')
                    .setEmoji('🚪')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`queue_start_${mode}`)
                    .setLabel('Iniciar Partida')
                    .setEmoji('🎮')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`queue_close_${mode}`)
                    .setLabel('Encerrar a Fila')
                    .setEmoji('❌')
                    .setStyle(ButtonStyle.Secondary)
            );

        const menuRow = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`queue_menu_${mode}`)
                    .setPlaceholder('Opções da Fila')
                    .addOptions([
                        { label: 'Configurações', value: 'settings', emoji: '⚙️' },
                        { label: 'Limpar Fila', value: 'clear', emoji: '🧹' }
                    ])
            );

        const sentMessage = await message.channel.send({ embeds: [embed], components: [menuRow, row] });
        
        queueManager.createQueue(mode, sentMessage.id, message.channel.id);
        const queue = queueManager.getQueue(sentMessage.id);
        if (queue) {
            queue.ownerId = message.author.id;
            queue.minPlayers = minPlayers;
            queue.isChallenge = false;
        }
    }
};
