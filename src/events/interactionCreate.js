const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const queueManager = require('../managers/queueManager');
const matchmaking = require('../utils/matchmaking');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        // Ignora se não for botão ou menu
        if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

        const [type, action, mode] = interaction.customId.split('_');
        const queue = queueManager.getQueue(interaction.message.id);

        if (!queue) {
            // Tenta deletar a mensagem se a fila não existir mais para evitar botões órfãos
            try { await interaction.message.delete(); } catch (e) {}
            return interaction.reply({ content: 'Esta fila não está mais ativa.', ephemeral: true }).catch(() => null);
        }

        const isOwner = interaction.user.id === queue.ownerId;
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        // Tratamento de Botões
        if (interaction.isButton()) {
            // Ações que exigem permissão
            if (action === 'start' || action === 'actions') {
                if (!isOwner && !isAdmin) {
                    return interaction.reply({ content: 'Você não tem permissão para gerenciar esta fila.', ephemeral: true });
                }
            }

            // Lógica para FILA NORMAL
            if (type === 'queue') {
                if (action === 'join') {
                    if (queue.players.includes(interaction.user.id)) {
                        return interaction.reply({ content: 'Você já está na fila!', ephemeral: true });
                    }
                    queue.players.push(interaction.user.id);
                    await interaction.deferUpdate(); // Evita erro de interação
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
                    if (queue.players.length < queue.maxPlayers) {
                        return interaction.reply({ content: `A fila precisa de pelo menos ${queue.maxPlayers} jogadores para iniciar.`, ephemeral: true });
                    }
                    await interaction.deferUpdate();
                    return this.startMatch(interaction, queue);
                }
            }

            // Lógica para DESAFIO
            if (type === 'challenge') {
                if (action === 'join') {
                    const teamNum = parseInt(mode);
                    const targetTeam = teamNum === 1 ? queue.team1 : queue.team2;
                    const otherTeam = teamNum === 1 ? queue.team2 : queue.team1;

                    if (targetTeam.includes(interaction.user.id)) {
                        return interaction.reply({ content: 'Você já está nesta equipe!', ephemeral: true });
                    }

                    if (targetTeam.length >= queue.teamSize) {
                        return interaction.reply({ content: 'Este time já está cheio!', ephemeral: true });
                    }

                    // Remove do outro time se estiver lá
                    queue.team1 = queue.team1.filter(id => id !== interaction.user.id);
                    queue.team2 = queue.team2.filter(id => id !== interaction.user.id);
                    
                    targetTeam.push(interaction.user.id);
                    await interaction.deferUpdate();
                    return this.updateChallengeEmbed(interaction, queue);
                }

                if (action === 'leave') {
                    if (!queue.team1.includes(interaction.user.id) && !queue.team2.includes(interaction.user.id)) {
                        return interaction.reply({ content: 'Você não está em nenhuma equipe!', ephemeral: true });
                    }
                    queue.team1 = queue.team1.filter(id => id !== interaction.user.id);
                    queue.team2 = queue.team2.filter(id => id !== interaction.user.id);
                    await interaction.deferUpdate();
                    return this.updateChallengeEmbed(interaction, queue);
                }
            }
        }

        // Tratamento de Menus
        if (interaction.isStringSelectMenu()) {
            const value = interaction.values[0];

            if (type === 'queue' && action === 'menu') {
                if (!isOwner && !isAdmin) {
                    return interaction.reply({ content: 'Apenas o criador pode realizar esta ação.', ephemeral: true });
                }
                
                if (value === 'clear') {
                    queue.players = [];
                    await interaction.deferUpdate();
                    return this.updateQueueEmbed(interaction, queue);
                } else if (value === 'close') {
                    queueManager.deleteQueue(interaction.message.id);
                    await interaction.message.delete().catch(() => null);
                    return interaction.reply({ content: 'Fila encerrada.', ephemeral: true }).catch(() => null);
                }
            }

            if (type === 'challenge' && action === 'menu') {
                if (!isOwner && !isAdmin) {
                    return interaction.reply({ content: 'Apenas o criador pode realizar esta ação.', ephemeral: true });
                }

                if (value === 'start') {
                    if (queue.team1.length !== queue.teamSize || queue.team2.length !== queue.teamSize) {
                        return interaction.reply({ content: 'Ambos os times precisam estar cheios para iniciar.', ephemeral: true });
                    }
                    await interaction.deferUpdate();
                    return this.startMatch(interaction, queue, true);
                } else if (value === 'cancel') {
                    queueManager.deleteQueue(interaction.message.id);
                    await interaction.message.delete().catch(() => null);
                    return interaction.reply({ content: 'Desafio cancelado.', ephemeral: true }).catch(() => null);
                }
            }
        }
    },

    async updateQueueEmbed(interaction, queue) {
        const embed = EmbedBuilder.from(interaction.message.embeds[0]);
        const currentPlayers = queue.players.length;
        const maxPlayers = queue.maxPlayers;

        let list = '';
        const totalToShow = Math.max(currentPlayers, maxPlayers);
        for (let i = 0; i < totalToShow; i++) {
            if (i < currentPlayers) {
                list += `🔴 <@${queue.players[i]}>\n`;
            } else {
                list += `🟢 Livre\n`;
            }
        }

        embed.setFields(
            { name: `👥 Participantes (${currentPlayers})`, value: list || 'Nenhum participante' },
            { name: '👑 Criador', value: `<@${queue.ownerId}>`, inline: true },
            { name: '🎮 Modo', value: `\`${queue.mode}\``, inline: true }
        );

        await interaction.message.edit({ embeds: [embed] }).catch(() => null);
    },

    async updateChallengeEmbed(interaction, queue) {
        const embed = EmbedBuilder.from(interaction.message.embeds[0]);
        const teamSize = queue.teamSize;

        const formatTeam = (team) => {
            let list = '';
            for (let i = 0; i < teamSize; i++) {
                list += team[i] ? `🔴 <@${team[i]}>\n` : `🟢 Livre\n`;
            }
            return list;
        };

        embed.setFields(
            { name: `Equipe 1 (${queue.team1.length}/${teamSize})`, value: formatTeam(queue.team1), inline: true },
            { name: `Equipe 2 (${queue.team2.length}/${teamSize})`, value: formatTeam(queue.team2), inline: true }
        );

        // Atualiza labels dos botões se necessário
        const row = ActionRowBuilder.from(interaction.message.components[0]);
        row.components[0].setLabel(`Entrar [${queue.team1.length}/${teamSize}]`);
        row.components[1].setLabel(`Entrar [${queue.team2.length}/${teamSize}]`);

        await interaction.message.edit({ embeds: [embed], components: [row, interaction.message.components[1]] }).catch(() => null);
    },

    async startMatch(interaction, queue, isChallenge = false) {
        let team1, team2, reserves = [];
        
        if (isChallenge) {
            team1 = [...queue.team1];
            team2 = [...queue.team2];
        } else {
            // Sorteio com Reserva
            const shuffled = matchmaking.fisherYates(queue.players);
            const activePlayers = shuffled.slice(0, queue.maxPlayers);
            reserves = shuffled.slice(queue.maxPlayers);
            
            team1 = activePlayers.slice(0, queue.maxPlayers / 2);
            team2 = activePlayers.slice(queue.maxPlayers / 2);
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
                    ...[...team1, ...team2].map(id => ({ id, allow: [PermissionFlagsBits.ViewChannel] }))
                ]
            });

            await interaction.guild.channels.create({ name: '🔊 Time 1', type: 2, parent: category.id });
            await interaction.guild.channels.create({ name: '🔊 Time 2', type: 2, parent: category.id });

            const matchEmbed = new EmbedBuilder()
                .setTitle(`Partida Iniciada - ID: ${matchId}`)
                .setDescription(`Modo: **${queue.mode}**`)
                .setColor('#2b2d31')
                .addFields(
                    { name: '🔵 Equipe 1', value: team1.map((id, i) => `${i === 0 ? '⭐' : '👤'} <@${id}>`).join('\n'), inline: true },
                    { name: '🔴 Equipe 2', value: team2.map((id, i) => `${i === 0 ? '⭐' : '👤'} <@${id}>`).join('\n'), inline: true }
                )
                .setTimestamp();

            if (reserves.length > 0) {
                matchEmbed.addFields({ name: '⏳ Reservas', value: reserves.map(id => `<@${id}>`).join(', ') });
                
                // Notifica os reservas no canal original
                await interaction.channel.send({ 
                    content: `A partida **${matchId}** começou! Os seguintes jogadores ficaram na reserva para a próxima: ${reserves.map(id => `<@${id}>`).join(', ')}` 
                });
            }

            await textChannel.send({ content: [...team1, ...team2].map(id => `<@${id}>`).join(' '), embeds: [matchEmbed] });
            
            queueManager.deleteQueue(interaction.message.id);
            await interaction.message.delete().catch(() => null);
            
        } catch (error) {
            console.error('Erro ao criar partida:', error);
            return interaction.followUp({ content: 'Ocorreu um erro ao criar os canais da partida. Verifique minhas permissões.', ephemeral: true });
        }
    }
};
