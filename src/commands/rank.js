const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../database/models/User');

module.exports = {
    name: 'rank',
    description: 'Exibe o ranking de pontos',
    async execute(message, args) {
        const users = await User.find().sort({ points: -1 });
        const userIndex = users.findIndex(u => u.discordId === message.author.id);
        const userRank = userIndex !== -1 ? userIndex + 1 : 'N/A';
        const userPoints = userIndex !== -1 ? users[userIndex].points : 0;

        const pageSize = 10;
        const totalPages = Math.ceil(users.length / pageSize) || 1;
        let currentPage = 0;

        const generateEmbed = (page) => {
            const start = page * pageSize;
            const end = start + pageSize;
            const currentUsers = users.slice(start, end);

            const leaderboard = currentUsers.map((u, i) => {
                const pos = start + i + 1;
                let emoji = '🔹';
                if (pos === 1) emoji = '🥇';
                else if (pos === 2) emoji = '🥈';
                else if (pos === 3) emoji = '🥉';
                
                return `**${pos}.** ${emoji} <@${u.discordId}> - \`${u.points} pts\``;
            }).join('\n') || 'Nenhum usuário no ranking.';

            return new EmbedBuilder()
                .setTitle('🏆 Ranking Global de Pontos')
                .setColor('#2b2d31')
                .setDescription(leaderboard)
                .addFields({ 
                    name: 'Sua Posição', 
                    value: `Você está em **#${userRank}** com **${userPoints}** pontos.`, 
                    inline: false 
                })
                .setFooter({ text: `Página ${page + 1} de ${totalPages}` })
                .setTimestamp();
        };

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('prev_page')
                    .setLabel('⬅️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage === 0),
                new ButtonBuilder()
                    .setCustomId('next_page')
                    .setLabel('➡️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage === totalPages - 1)
            );

        const sentMessage = await message.channel.send({ 
            embeds: [generateEmbed(currentPage)], 
            components: [row] 
        });

        const collector = sentMessage.createMessageComponentCollector({ 
            filter: i => i.user.id === message.author.id, 
            time: 60000 
        });

        collector.on('collect', async i => {
            if (i.customId === 'prev_page') currentPage--;
            else if (i.customId === 'next_page') currentPage++;

            const newRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev_page')
                        .setLabel('⬅️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentPage === 0),
                    new ButtonBuilder()
                        .setCustomId('next_page')
                        .setLabel('➡️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentPage === totalPages - 1)
                );

            await i.update({ 
                embeds: [generateEmbed(currentPage)], 
                components: [newRow] 
            });
        });

        collector.on('end', () => {
            sentMessage.edit({ components: [] }).catch(() => {});
        });
    }
};
