const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const queueManager = require('../managers/queueManager');
const matchmaking = require('../utils/matchmaking');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

        const [type, action, mode] = interaction.customId.split('_');
        
        // Lógica para o menu de FINALIZAR PARTIDA (que ocorre no canal da partida)
        if (type === 'match') {
            const match = queueManager.getMatch(interaction.channelId);
            if (!match) return interaction.reply({ content: 'Esta partida não está mais ativa no sistema.', ephemeral: true });

            const isOwner = interaction.user.id === match.ownerId;
            const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

            if (!isOwner && !isAdmin) {
                return interaction.reply({ content: 'Apenas o criador ou administradores podem finalizar a partida.', ephemeral: true });
            }

            if (action === 'menu') {
                const value = interaction.values[0];
                if (value === 'win1' || value === 'win2') {
                    const winner = value === 'win1' ? 'Time 1' : 'Time 2';
                    await interaction.reply({ content: `Partida finalizada! Vitória do **${winner}**. Canais serão deletados em 10 segundos.` });
                    
                    setTimeout(async () => {
                        try {
                            const category = interaction.channel.parent;
                            if (category) {
                                for (const channel of category.children.cache.values()) {
                                    await channel.delete().catch(() => null);
                                }
                                await category.delete().catch(() => null);
                            }
                        } catch (e) {}
                        queueManager.deleteMatch(interaction.channelId);
                    }, 10000);
                } else if (value === 'cancel') {
                    await interaction.reply({ content: 'Partida cancelada. Canais serão deletados em 5 segundos.' });
                    setTimeout(async () => {
                        try {
                            const category = interaction.channel.parent;
                            if (category) {
                                for (const channel of category.children.cache.values()) {
                                    await channel.delete().catch(() => null);
                                }
                                await category.delete().catch(() => null);
                            }
                        } catch (e) {}
                        queueManager.deleteMatch(interaction.channelId);
                    }, 5000);
                }
            }
            return;
        }

        // Lógica de FILA/DESAFIO
        const queue = queueManager.getQueue(interaction.message.id);
        if (!queue) {
            try { await interaction.message.delete(); } catch (e) {}
            return interaction.reply({ content: 'Esta fila não está mais ativa.', ephemeral: true }).catch(() => null);
        }

        const isOwner = interaction.user.id === queue.ownerId;
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        if (interaction.isButton()) {
            if (type === 'queue') {
                if (action === 'join') {
                    if (queue.players.includes(interaction.user.id)) {
                        return interaction.reply({ content: 'Você já está na fila!', ephemeral: true });
                    }
                    queue.players.push(interaction.user.id);
                    await interaction.deferUpdate();
                    return this.updateQueueEmbed(interaction, queue);
                }

                if (action === 'leave') {
                    if (!queue.players.includes(interaction.user.id)) {
                        return interaction.reply({ content: 'Você não está na fila!', ephemeral: true });
                    }
                    queue.players = queue.players.filter(id => id !== interaction.user.id);
                    await interaction.deferUpdate();
                    return this.updateQueueEmbed(interaction, queue);
                }

                if (action === 'start') {
                    if (!isOwner && !isAdmin) return interaction.reply({ content: 'Apenas o criador pode iniciar.', ephemeral: true });
                    if (queue.players.length < queue.maxPlayers) {
                        return interaction.reply({ content: `A fila precisa de pelo menos ${queue.maxPlayers} jogadores para iniciar.`, ephemeral: true });
                    }
                    await interaction.deferUpdate();
                    return this.startMatch(interaction, queue);
                }
            }

            if (type === 'challenge') {
                if (action === 'join') {
                    const teamNum = parseInt(mode);
                    const targetTeam = teamNum === 1 ? queue.team1 : queue.team2;

                    if (targetTeam.includes(interaction.user.id)) return interaction.reply({ content: 'Você já está nesta equipe!', ephemeral: true });
                    if (targetTeam.length >= queue.teamSize) return interaction.reply({ content: 'Este time já está cheio!', ephemeral: true });

                    queue.team1 = queue.team1.filter(id => id !== interaction.user.id);
                    queue.team2 = queue.team2.filter(id => id !== interaction.user.id);
                    targetTeam.push(interaction.user.id);
                    await interaction.deferUpdate();
                    return this.updateChallengeEmbed(interaction, queue);
                }

                if (action === 'leave') {
                    queue.team1 = queue.team1.filter(id => id !== interaction.user.id);
                    queue.team2 = queue.team2.filter(id => id !== interaction.user.id);
                    await interaction.deferUpdate();
                    return this.updateChallengeEmbed(interaction, queue);
                }
            }
        }

        if (interaction.isStringSelectMenu()) {
            const value = interaction.values[0];
            if (!isOwner && !isAdmin) return interaction.reply({ content: 'Apenas o criador pode realizar esta ação.', ephemeral: true });

            if (type === 'queue' && action === 'menu') {
                if (value === 'clear') {
                    queue.players = [];
                    await interaction.deferUpdate();
                    return this.updateQueueEmbed(interaction, queue);
                } else if (value === 'close') {
                    queueManager.deleteQueue(interaction.message.id);
                    await interaction.message.delete().catch(() => null);
                }
            }

            if (type === 'challenge' && action === 'menu') {
                if (value === 'start') {
                    if (queue.team1.length !== queue.teamSize || queue.team2.length !== queue.teamSize) {
                        return interaction.reply({ content: 'Ambos os times precisam estar cheios para iniciar.', ephemeral: true });
                    }
                    await interaction.deferUpdate();
                    return this.startMatch(interaction, queue, true);
                } else if (value === 'cancel') {
                    queueManager.deleteQueue(interaction.message.id);
                    await interaction.message.delete().catch(() => null);
                }
            }
        }
    },

    async updateQueueEmbed(interaction, queue) {
        const embed = EmbedBuilder.from(interaction.message.embeds[0]);
        const currentPlayers = queue.players.length;
        const maxPlayers = queue.maxPlayers;
        const totalToShow = Math.max(currentPlayers, maxPlayers);
        const half = Math.ceil(totalToShow / 2);

        const gen = (s, e) => {
            let l = '';
            for (let i = s; i < e; i++) l += queue.players[i] ? `🔴 <@${queue.players[i]}>\n` : `🟢 Livre\n`;
            return l || '\u200b';
        };

        embed.setFields(
            { name: `Participantes (${currentPlayers}/${maxPlayers})`, value: gen(0, half), inline: true },
            { name: `\u200b`, value: gen(half, totalToShow), inline: true },
            { name: '👑 Criador', value: `<@${queue.ownerId}>`, inline: true },
            { name: '🎮 Modo', value: `\`${queue.mode}\``, inline: true }
        );
        await interaction.message.edit({ embeds: [embed] }).catch(() => null);
    },

    async updateChallengeEmbed(interaction, queue) {
        const embed = EmbedBuilder.from(interaction.message.embeds[0]);
        const ts = queue.teamSize;
        const fmt = (t) => {
            let l = '';
            for (let i = 0; i < ts; i++) l += t[i] ? `🔴 <@${t[i]}>\n` : `🟢 Livre\n`;
            return l;
        };
        embed.setFields(
            { name: `Equipe 1 (${queue.team1.length}/${ts})`, value: fmt(queue.team1), inline: true },
            { name: `Equipe 2 (${queue.team2.length}/${ts})`, value: fmt(queue.team2), inline: true }
        );
        const row = ActionRowBuilder.from(interaction.message.components[1]);
        row.components[0].setLabel(`Entrar [${queue.team1.length}/${ts}]`);
        row.components[1].setLabel(`Entrar [${queue.team2.length}/${ts}]`);
        await interaction.message.edit({ embeds: [embed], components: [interaction.message.components[0], row] }).catch(() => null);
    },

    async startMatch(interaction, queue, isChallenge = false) {
        let t1, t2, reserves = [];
        if (isChallenge) {
            t1 = [...queue.team1]; t2 = [...queue.team2];
        } else {
            const shuffled = matchmaking.fisherYates(queue.players);
            const active = shuffled.slice(0, queue.maxPlayers);
            reserves = shuffled.slice(queue.maxPlayers);
            t1 = active.slice(0, queue.maxPlayers / 2);
            t2 = active.slice(queue.maxPlayers / 2);
        }

        const matchId = matchmaking.generateMatchId();
        try {
            const category = await interaction.guild.channels.create({
                name: `PARTIDA ${matchId}`,
                type: 4,
                permissionOverwrites: [{ id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] }]
            });

            const textChannel = await interaction.guild.channels.create({
                name: `partida-${queue.mode}-${matchId}`,
                parent: category.id,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    ...[...t1, ...t2].map(id => ({ id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }))
                ]
            });

            const v1 = await interaction.guild.channels.create({ name: '🔊 Time 1', type: 2, parent: category.id });
            const v2 = await interaction.guild.channels.create({ name: '🔊 Time 2', type: 2, parent: category.id });

            // REDIRECIONAMENTO DE VOZ
            const movePlayers = async (players, channel) => {
                for (const id of players) {
                    const member = await interaction.guild.members.fetch(id).catch(() => null);
                    if (member && member.voice.channel) {
                        await member.voice.setChannel(channel).catch(() => null);
                    }
                }
            };
            await movePlayers(t1, v1);
            await movePlayers(t2, v2);

            const matchEmbed = new EmbedBuilder()
                .setTitle(`Partida Iniciada - ID: ${matchId}`)
                .setColor('#2b2d31')
                .addFields(
                    { name: '🔵 Equipe 1', value: t1.map(id => `<@${id}>`).join('\n'), inline: true },
                    { name: '🔴 Equipe 2', value: t2.map(id => `<@${id}>`).join('\n'), inline: true }
                );

            if (reserves.length > 0) {
                matchEmbed.addFields({ name: '⏳ Reservas', value: reserves.map(id => `<@${id}>`).join(', ') });
                await interaction.channel.send({ content: `Partida **${matchId}** iniciada! Reservas: ${reserves.map(id => `<@${id}>`).join(', ')}` });
            }

            const matchMenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`match_menu_${matchId}`)
                    .setPlaceholder('Finalizar Partida')
                    .addOptions([
                        { label: 'Vitória Time 1', value: 'win1', emoji: '🔵' },
                        { label: 'Vitória Time 2', value: 'win2', emoji: '🔴' },
                        { label: 'Cancelar Partida', value: 'cancel', emoji: '❌' }
                    ])
            );

            await textChannel.send({ content: [...t1, ...t2].map(id => `<@${id}>`).join(' '), embeds: [matchEmbed], components: [matchMenu] });
            
            // Registrar partida ativa no manager
            queueManager.createMatch({
                matchId,
                textChannelId: textChannel.id,
                ownerId: queue.ownerId,
                team1: t1,
                team2: t2,
                categoryId: category.id
            });

            queueManager.deleteQueue(interaction.message.id);
            await interaction.message.delete().catch(() => null);
        } catch (e) {
            console.error(e);
            return interaction.followUp({ content: 'Erro ao criar canais da partida.', ephemeral: true });
        }
    }
};
