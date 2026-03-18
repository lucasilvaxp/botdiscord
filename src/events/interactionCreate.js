const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const queueManager = require('../managers/queueManager');
const matchmaking = require('../utils/matchmaking');
const Pix = require('../utils/pix');
const User = require('../database/models/User');
const Match = require('../database/models/Match');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (interaction.isButton()) {
            const [type, action, mode] = interaction.customId.split('_');
            const queue = queueManager.getQueue(interaction.message.id);

            if (!queue) return interaction.reply({ content: 'Esta fila não está mais ativa.', ephemeral: true });

            // Verificação de Permissão para Iniciar/Ações
            const isOwner = interaction.user.id === queue.ownerId;
            const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

            if (action === 'start' || action === 'actions') {
                if (!isOwner && !isAdmin) {
                    return interaction.reply({ content: 'Você não tem permissão para gerenciar esta fila.', ephemeral: true });
                }
            }

            if (type === 'queue') {
                if (action === 'join') {
                    if (queue.players.includes(interaction.user.id)) {
                        return interaction.reply({ content: 'Você já está na fila!', ephemeral: true });
                    }
                    queue.players.push(interaction.user.id);
                    await this.updateQueueEmbed(interaction, queue);
                    return interaction.reply({ content: 'Você entrou na fila!', ephemeral: true });
                }

                if (action === 'leave') {
                    if (!queue.players.includes(interaction.user.id)) {
                        return interaction.reply({ content: 'Você não está na fila!', ephemeral: true });
                    }
                    queue.players = queue.players.filter(id => id !== interaction.user.id);
                    await this.updateQueueEmbed(interaction, queue);
                    return interaction.reply({ content: 'Você saiu da fila!', ephemeral: true });
                }

                if (action === 'start') {
                    if (queue.players.length < queue.maxPlayers) {
                        return interaction.reply({ content: `A fila precisa de pelo menos ${queue.maxPlayers} jogadores para iniciar.`, ephemeral: true });
                    }
                    await this.startMatch(interaction, queue);
                }
            }

            if (type === 'challenge') {
                const teamNum = parseInt(mode); // No caso de challenge_join_1_4v4, mode é o número do time
                const realMode = interaction.customId.split('_')[3];

                if (action === 'join') {
                    // Remover de outros times se já estiver
                    queue.team1 = queue.team1.filter(id => id !== interaction.user.id);
                    queue.team2 = queue.team2.filter(id => id !== interaction.user.id);

                    const targetTeam = teamNum === 1 ? queue.team1 : queue.team2;
                    if (targetTeam.length >= queue.teamSize) {
                        return interaction.reply({ content: 'Este time já está cheio!', ephemeral: true });
                    }

                    targetTeam.push(interaction.user.id);
                    await this.updateChallengeEmbed(interaction, queue);
                    return interaction.reply({ content: `Você entrou na Equipe ${teamNum}!`, ephemeral: true });
                }

                if (action === 'leave') {
                    queue.team1 = queue.team1.filter(id => id !== interaction.user.id);
                    queue.team2 = queue.team2.filter(id => id !== interaction.user.id);
                    await this.updateChallengeEmbed(interaction, queue);
                    return interaction.reply({ content: 'Você saiu do desafio!', ephemeral: true });
                }
            }
        }

        if (interaction.isStringSelectMenu()) {
            const [type, action, mode] = interaction.customId.split('_');
            const queue = queueManager.getQueue(interaction.message.id);
            if (!queue) return interaction.reply({ content: 'Fila não encontrada.', ephemeral: true });

            const isOwner = interaction.user.id === queue.ownerId;
            const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

            if (!isOwner && !isAdmin) {
                return interaction.reply({ content: 'Apenas o criador pode realizar esta ação.', ephemeral: true });
            }

            const value = interaction.values[0];

            if (type === 'challenge' && action === 'actions') {
                if (value === 'start') {
                    if (queue.team1.length !== queue.teamSize || queue.team2.length !== queue.teamSize) {
                        return interaction.reply({ content: 'Ambos os times precisam estar cheios para iniciar.', ephemeral: true });
                    }
                    await this.startMatch(interaction, queue, true);
                } else if (value === 'cancel') {
                    queueManager.deleteQueue(interaction.message.id);
                    await interaction.message.delete();
                    return interaction.reply({ content: 'Desafio cancelado.', ephemeral: true });
                }
            }
        }
    },

    async updateQueueEmbed(interaction, queue) {
        const embed = EmbedBuilder.from(interaction.message.embeds[0]);
        const maxPlayers = queue.maxPlayers;
        const currentPlayers = queue.players.length;

        let list = '';
        for (let i = 0; i < Math.max(currentPlayers, maxPlayers); i++) {
            if (i < currentPlayers) {
                list += `🔴 <@${queue.players[i]}>\n`;
            } else if (i < maxPlayers) {
                list += `🟢 Livre\n`;
            }
        }

        embed.setFields(
            { name: `👥 Participantes (${currentPlayers})`, value: list || 'Nenhum participante' },
            { name: '👑 Criador', value: `<@${queue.ownerId}>`, inline: true },
            { name: '🎮 Modo', value: `\`${queue.mode}\``, inline: true }
        );

        await interaction.message.edit({ embeds: [embed] });
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
            { name: `🔵 Equipe 1 (${queue.team1.length}/${teamSize})`, value: formatTeam(queue.team1), inline: true },
            { name: `🔴 Equipe 2 (${queue.team2.length}/${teamSize})`, value: formatTeam(queue.team2), inline: true },
            { name: '👑 Criador', value: `<@${queue.ownerId}>`, inline: false }
        );

        await interaction.message.edit({ embeds: [embed] });
    },

    async startMatch(interaction, queue, isChallenge = false) {
        let team1, team2, reserves = [];

        if (isChallenge) {
            team1 = queue.team1;
            team2 = queue.team2;
        } else {
            const shuffled = matchmaking.fisherYates(queue.players);
            team1 = shuffled.slice(0, queue.maxPlayers / 2);
            team2 = shuffled.slice(queue.maxPlayers / 2, queue.maxPlayers);
            reserves = shuffled.slice(queue.maxPlayers);
        }

        const matchId = matchmaking.generateMatchId();
        const category = await interaction.guild.channels.create({
            name: `PARTIDA ${matchId}`,
            type: 4, // Category
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] }
            ]
        });

        const textChannel = await interaction.guild.channels.create({
            name: `partida-normal-${queue.mode}-${matchId}`,
            parent: category.id,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                ...[...team1, ...team2].map(id => ({ id, allow: [PermissionFlagsBits.ViewChannel] }))
            ]
        });

        const voice1 = await interaction.guild.channels.create({ name: '🔊 Time 1', type: 2, parent: category.id });
        const voice2 = await interaction.guild.channels.create({ name: '🔊 Time 2', type: 2, parent: category.id });

        // Mover jogadores
        for (const id of team1) {
            const member = await interaction.guild.members.fetch(id).catch(() => null);
            if (member?.voice.channel) await member.voice.setChannel(voice1).catch(() => null);
        }
        for (const id of team2) {
            const member = await interaction.guild.members.fetch(id).catch(() => null);
            if (member?.voice.channel) await member.voice.setChannel(voice2).catch(() => null);
        }

        const matchEmbed = new EmbedBuilder()
            .setTitle(`Partida Iniciada - ID: ${matchId}`)
            .setColor('#2b2d31')
            .addFields(
                { name: '🔵 Equipe 1', value: team1.map((id, i) => `${i === 0 ? '⭐' : '👤'} <@${id}>`).join('\n'), inline: true },
                { name: '🔴 Equipe 2', value: team2.map((id, i) => `${i === 0 ? '⭐' : '👤'} <@${id}>`).join('\n'), inline: true },
                { name: '🔊 Canais de Voz', value: `${voice1}\n${voice2}`, inline: false }
            );

        if (reserves.length > 0) {
            matchEmbed.addFields({ name: '⏳ Reservas', value: reserves.map(id => `<@${id}>`).join(', '), inline: false });
        }

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`match_control_${matchId}`)
                .setPlaceholder('Clique aqui para ver as opções dos capitães...')
                .addOptions([
                    { label: 'Definir Vencedor', value: 'winner', emoji: '🏆' },
                    { label: 'Definir MVP', value: 'mvp', emoji: '⭐' },
                    { label: 'Finalizar Partida', value: 'end', emoji: '🏁' }
                ])
        );

        await textChannel.send({ content: `${team1.map(id => `<@${id}>`).join(' ')} ${team2.map(id => `<@${id}>`).join(' ')}`, embeds: [matchEmbed], components: [menu] });

        queueManager.deleteQueue(interaction.message.id);
        await interaction.message.delete().catch(() => null);
        
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: `Partida ${matchId} criada com sucesso!`, ephemeral: true });
        } else {
            await interaction.reply({ content: `Partida ${matchId} criada com sucesso!`, ephemeral: true });
        }
    }
};
