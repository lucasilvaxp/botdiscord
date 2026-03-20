const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const queueManager = require('../managers/queueManager');
const matchmaking = require('../utils/matchmaking');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

        const customIdParts = interaction.customId.split('_');
        const type = customIdParts[0];
        const action = customIdParts[1];
        
        // Lógica para o menu de CAPITÃES (no canal da partida)
        if (type === 'match') {
            const match = queueManager.getMatch(interaction.channelId);
            if (!match) return interaction.reply({ content: 'Esta partida não está mais ativa no sistema.', ephemeral: true });

            const isCaptain = interaction.user.id === match.team1[0] || interaction.user.id === match.team2[0];
            const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

            if (!isCaptain && !isAdmin) {
                return interaction.reply({ content: 'Apenas os capitães ou administradores podem usar este painel.', ephemeral: true });
            }

            if (action === 'menu') {
                const value = interaction.values[0];
                
                if (value === 'win') {
                    const winMenu = new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId(`match_winner_selection_${match.matchId}`)
                            .setPlaceholder('Selecione a equipe vencedora')
                            .addOptions([
                                { label: 'Equipe 1', value: 'win1', emoji: '🔵' },
                                { label: 'Equipe 2', value: 'win2', emoji: '🔴' }
                            ])
                    );
                    return interaction.reply({ content: 'Selecione quem venceu a partida:', components: [winMenu], ephemeral: true });
                }

                if (value === 'mvp') {
                    const allPlayers = [...match.team1, ...match.team2];
                    const mvpMenu = new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId(`match_mvp_selection_${match.matchId}`)
                            .setPlaceholder('Selecione o MVP da partida')
                            .addOptions(allPlayers.map(id => ({
                                label: interaction.guild.members.cache.get(id)?.displayName || id,
                                value: id
                            })).slice(0, 25))
                    );
                    return interaction.reply({ content: 'Selecione o MVP:', components: [mvpMenu], ephemeral: true });
                }

                if (value === 'cancel' || value === 'finish') {
                    const confirmMsg = value === 'cancel' ? 'Partida cancelada.' : 'Partida finalizada.';
                    await interaction.reply({ content: `${confirmMsg} Os canais serão deletados em 10 segundos.` });
                    
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
                }
            }

            // Sub-menus de seleção
            if (action === 'winner') {
                const winner = interaction.values[0] === 'win1' ? 'Equipe 1' : 'Equipe 2';
                await interaction.update({ content: `Vencedor definido: **${winner}**`, components: [] });
                await interaction.channel.send({ content: `🏆 **${winner}** foi declarado vencedor pelo capitão ${interaction.user}!` });
            }

            if (action === 'mvp') {
                const mvpId = interaction.values[0];
                await interaction.update({ content: `MVP definido: <@${mvpId}>`, components: [] });
                await interaction.channel.send({ content: `🌟 <@${mvpId}> foi eleito o MVP da partida!` });
            }

            return;
        }

        // Lógica de FILA/DESAFIO
        const queue = queueManager.getQueue(interaction.message.id);
        if (!queue) {
            return interaction.reply({ content: 'Esta fila não está mais ativa.', ephemeral: true }).catch(() => null);
        }

        const isOwner = interaction.user.id === queue.ownerId;
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        if (interaction.isButton()) {
            if (type === 'queue') {
                if (action === 'join') {
                    if (queue.players.includes(interaction.user.id)) return interaction.reply({ content: 'Você já está na fila!', ephemeral: true });
                    queue.players.push(interaction.user.id);
                    await interaction.deferUpdate();
                    return this.updateQueueEmbed(interaction, queue);
                }
                if (action === 'leave') {
                    if (!queue.players.includes(interaction.user.id)) return interaction.reply({ content: 'Você não está na fila!', ephemeral: true });
                    queue.players = queue.players.filter(id => id !== interaction.user.id);
                    await interaction.deferUpdate();
                    return this.updateQueueEmbed(interaction, queue);
                }
                if (action === 'start') {
                    if (!isOwner && !isAdmin) return interaction.reply({ content: 'Apenas o criador pode iniciar.', ephemeral: true });
                    if (queue.players.length < queue.maxPlayers) return interaction.reply({ content: `A fila precisa de pelo menos ${queue.maxPlayers} jogadores para iniciar.`, ephemeral: true });
                    await interaction.deferUpdate();
                    return this.startMatch(interaction, queue);
                }
            }

            if (type === 'challenge') {
                if (action === 'join') {
                    const teamNum = parseInt(customIdParts[2]);
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
                name: `PARTIDA ${queue.mode}`,
                type: 4,
                permissionOverwrites: [{ id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] }]
            });

            const textChannel = await interaction.guild.channels.create({
                name: `partida-${queue.mode}`,
                parent: category.id,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    ...[...t1, ...t2].map(id => ({ id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }))
                ]
            });

            const v1 = await interaction.guild.channels.create({ name: '🔊 Time 1', type: 2, parent: category.id });
            const v2 = await interaction.guild.channels.create({ name: '🔊 Time 2', type: 2, parent: category.id });

            const movePlayers = async (players, channel) => {
                for (const id of players) {
                    const member = await interaction.guild.members.fetch(id).catch(() => null);
                    if (member && member.voice.channel) await member.voice.setChannel(channel).catch(() => null);
                }
            };
            await movePlayers(t1, v1);
            await movePlayers(t2, v2);

            // NOVO LAYOUT DE PARTIDA (CONFORME PRINT)
            const matchEmbed = new EmbedBuilder()
                .setTitle('Partida Criada')
                .setDescription(`Seja bem-vindo(a) à partida **${queue.mode}**! Abaixo encontram-se os canais de voz, os capitães e seus jogadores. Para realizar qualquer ação desta partida, é necessário que o jogador seja um capitão de um dos dois times ou tenha permissão para gerenciar partidas.\n\n↪️ Somente os capitães conseguem usar esse painel; nenhum outro tem permissão para interagir.`)
                .setColor('#2b2d31')
                .addFields(
                    { name: '🔊 Canais de Voz', value: `🟦 **Equipe 1:** <#${v1.id}>\n🟥 **Equipe 2:** <#${v2.id}>`, inline: false },
                    { name: '🟦 Equipe 1', value: `👤 **Capitão:** <@${t1[0]}>\n👥 **Jogador:** ${t1.slice(1).map(id => `<@${id}>`).join(' | ') || 'Nenhum'}`, inline: true },
                    { name: '🟥 Equipe 2', value: `👤 **Capitão:** <@${t2[0]}>\n👥 **Jogador:** ${t2.slice(1).map(id => `<@${id}>`).join(' | ') || 'Nenhum'}`, inline: true }
                );

            const matchMenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`match_menu_${matchId}`)
                    .setPlaceholder('Clique aqui para ver as opções dos capitães...')
                    .addOptions([
                        { label: 'Definir Vencedor', value: 'win', description: 'Definir a equipe vencedora da partida.', emoji: '🏆' },
                        { label: 'Definir MVP', value: 'mvp', description: 'Definir o MVP da partida.', emoji: '🌟' },
                        { label: 'Definir Criador', value: 'owner', description: 'Definir o criador da sala.', emoji: '👤' },
                        { label: 'Finalizar a Partida', value: 'finish', description: 'Os canais criados vão ser fechados.', emoji: '🏁' }
                    ])
            );

            await textChannel.send({ content: [...t1, ...t2].map(id => `<@${id}>`).join(' '), embeds: [matchEmbed], components: [matchMenu] });
            
            queueManager.createMatch({
                matchId,
                textChannelId: textChannel.id,
                ownerId: queue.ownerId,
                team1: t1,
                team2: t2,
                categoryId: category.id,
                players: [...t1, ...t2]
            });

            const disabledEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setColor('#ff0000').setFooter({ text: 'Partida Iniciada • Mensagem Desativada' });
            const disabledComponents = interaction.message.components.map(row => {
                const newRow = ActionRowBuilder.from(row);
                newRow.components.forEach(c => c.setDisabled(true));
                return newRow;
            });
            await interaction.message.edit({ embeds: [disabledEmbed], components: disabledComponents }).catch(() => null);
            queueManager.deleteQueue(interaction.message.id);

        } catch (e) {
            console.error(e);
            return interaction.followUp({ content: 'Erro ao criar canais da partida.', ephemeral: true });
        }
    }
};
