const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../database/models/User');

module.exports = {
    name: 'p',
    description: 'Exibe o perfil do usuário',
    async execute(message, args) {
        const target = message.mentions.users.first() || message.author;
        
        let userData = await User.findOne({ discordId: target.id });
        
        if (!userData) {
            userData = await User.create({ discordId: target.id });
        }

        const winrate = userData.totalMatches > 0 
            ? ((userData.wins / userData.totalMatches) * 100).toFixed(1) 
            : '0.0';

        const embed = new EmbedBuilder()
            .setTitle(`Perfil de ${target.username}`)
            .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 512 }))
            .setColor('#2b2d31')
            .addFields(
                { name: '💎 Pontos', value: `\`${userData.points}\``, inline: true },
                { name: '⭐ MVPs', value: `\`${userData.mvps}\``, inline: true },
                { name: '📈 Winrate', value: `\`${winrate}%\``, inline: true },
                { name: '✅ Vitórias', value: `\`${userData.wins}\``, inline: true },
                { name: '❌ Derrotas', value: `\`${userData.losses}\``, inline: true },
                { name: '🎮 Total', value: `\`${userData.totalMatches}\``, inline: true },
                { name: '🔥 Sequência', value: `\`${userData.streak}\``, inline: true }
            )
            .setFooter({ text: 'Estatísticas atualizadas em tempo real' })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('profile_info')
                    .setLabel('Informações')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('profile_custom')
                    .setLabel('Customização')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('profile_acc')
                    .setLabel('Acessórios')
                    .setStyle(ButtonStyle.Secondary)
            );

        await message.channel.send({ embeds: [embed], components: [row] });
    }
};
