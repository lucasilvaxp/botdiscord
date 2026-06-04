const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const queueManager = require('../managers/queueManager');
const visual = require('../utils/visualConfig');

module.exports = {
    name: 'desafio',
    description: 'Abre um desafio de times formados',
    async execute(message, args) {
        const mode = args[0] || '2v2';
        const validModes = ['1v1', '2v2', '3v3', '4v4'];

        if (!validModes.includes(mode)) {
            return message.reply('❌ **Erro:** Por favor, especifique um modo válido: `!desafio 1v1`, `!desafio 2v2`, `!desafio 3v3` ou `!desafio 4v4`.');
        }

        const teamSize = parseInt(mode[0]);
        
        const embed = new EmbedBuilder()
            .setAuthor({ name: visual.systemName, iconURL: visual.assets.logo })
            .setTitle(`『 ${mode} | Fila Desafio Criada! 』`)
            .setDescription(`> ⚔️ Seja Bem Vindo(a) à fila **Desafio**! Aqui todos os times são formados.\n\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n\nCaso deseje participar, utilize os botões abaixo para fazer as ações disponíveis.`)
            .setThumbnail(visual.assets.thumbnail)
            .setColor(visual.colors.desafio)
            .addFields(
                { name: `『 🟦 Equipe 1 』`, value: '🟢 Livre\n'.repeat(teamSize), inline: true },
                { name: `『 🟥 Equipe 2 』`, value: '🟢 Livre\n'.repeat(teamSize), inline: true },
                { name: `『 👑 Criador 』`, value: `<@${message.author.id}>`, inline: true },
                { name: `『 📊 Status 』`, value: `🟡 Aguardando jogadores...`, inline: false }
            )
            .setFooter({ text: `Sistema de Filas • Powered by ${visual.botName}`, iconURL: visual.assets.footerIcon })
            .setTimestamp();

        const menuRow = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`challenge_menu_${mode}`)
                    .setPlaceholder('Opções do Desafio')
                    .addOptions([
                        { label: 'Iniciar Partida', value: 'start', emoji: '🎮' },
                        { label: 'Cancelar Desafio', value: 'cancel', emoji: '❌' }
                    ])
            );

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`challenge_join_1_${mode}`)
                    .setLabel(`Entrar [0/${teamSize}]`)
                    .setEmoji('🟦')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`challenge_join_2_${mode}`)
                    .setLabel(`Entrar [0/${teamSize}]`)
                    .setEmoji('🟥')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`challenge_leave_${mode}`)
                    .setLabel('Sair')
                    .setEmoji('❌')
                    .setStyle(ButtonStyle.Danger)
            );

        const sentMessage = await message.channel.send({ embeds: [embed], components: [menuRow, row] });
        
        queueManager.createQueue(mode, sentMessage.id, message.channel.id);
        const queue = queueManager.getQueue(sentMessage.id);
        if (queue) {
            queue.ownerId = message.author.id;
            queue.teamSize = teamSize;
            queue.isChallenge = true;
            queue.team1 = [];
            queue.team2 = [];
        }
    }
};
