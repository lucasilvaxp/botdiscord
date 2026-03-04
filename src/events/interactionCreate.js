const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder } = require('discord.js');
const queueManager = require('../managers/queueManager');
const { createTeams, generateMatchId } = require('../utils/matchmaking');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        const { customId, user, message, guild, channel } = interaction;

        if (interaction.isButton()) {
            // Lógica de Fila (Join/Leave/Cancel)
            if (customId.startsWith('join_queue_')) {
                const queue = queueManager.getQueue(message.id);
                if (!queue) return interaction.reply({ content: 'Esta fila não está mais ativa.', ephemeral: true });
                if (!queueManager.addPlayer(message.id, user.id)) return interaction.reply({ content: 'Você já está nesta fila!', ephemeral: true });
                await interaction.reply({ content: 'Você entrou na fila!', ephemeral: true });
                await updateQueueEmbed(message, queue);
                if (queueManager.isFull(message.id)) await startMatch(guild, message, queue);
            } 
            else if (customId.startsWith('leave_queue_')) {
                const queue = queueManager.getQueue(message.id);
                if (!queue || !queueManager.removePlayer(message.id, user.id)) return interaction.reply({ content: 'Você não está nesta fila!', ephemeral: true });
                await interaction.reply({ content: 'Você saiu da fila!', ephemeral: true });
                await updateQueueEmbed(message, queue);
            } 
            else if (customId.startsWith('cancel_queue_')) {
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) return interaction.reply({ content: 'Sem permissão.', ephemeral: true });
                queueManager.deleteQueue(message.id);
                await message.delete();
                await interaction.reply({ content: 'Fila cancelada.', ephemeral: true });
            }

            // Lógica de Confirmação de Resultado
            const match = queueManager.getMatch(channel.id);
            if (match) {
                const isCaptain = user.id === match.captain1 || user.id === match.captain2;
                const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
                
                if (!isCaptain && !isAdmin) return interaction.reply({ content: 'Apenas os capitães desta partida podem realizar esta ação.', ephemeral: true });

                if (customId === 'confirm_result') {
                    if (user.id === match.winnerPending?.proposerId) return interaction.reply({ content: 'Aguardando confirmação do capitão adversário.', ephemeral: true });
                    
                    await interaction.reply({ content: `✅ Resultado confirmado por <@${user.id}>. Encerrando partida...` });
                    await endMatchSequence(guild, match, channel);
                } 
                else if (customId === 'contest_result') {
                    match.winnerPending = null;
                    await interaction.reply({ content: `⚠️ O resultado foi contestado por <@${user.id}>. Por favor, entrem em um acordo ou chamem um moderador.` });
                    // Opcional: Notificar moderadores
                }
            }
        }

        if (interaction.isStringSelectMenu()) {
            const match = queueManager.getMatch(channel.id);
            if (!match) return;

            const isCaptain = user.id === match.captain1 || user.id === match.captain2;
            const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!isCaptain && !isAdmin) return interaction.reply({ content: 'Apenas os capitães desta partida podem realizar esta ação.', ephemeral: true });

            if (customId === 'match_options') {
                const action = interaction.values[0];

                if (action === 'set_winner') {
                    const winnerMenu = new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('select_winner')
                            .setPlaceholder('Quem venceu a partida?')
                            .addOptions([
                                { label: 'Time 1', value: 'Time 1', emoji: '1️⃣' },
                                { label: 'Time 2', value: 'Time 2', emoji: '2️⃣' },
                                { label: 'Empate', value: 'Empate', emoji: '🤝' }
                            ])
                    );
                    await interaction.reply({ content: 'Selecione o vencedor:', components: [winnerMenu], ephemeral: true });
                } 
                else if (action === 'vote_mvp') {
                    const allPlayers = [...match.team1, ...match.team2];
                    const mvpMenu = new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('select_mvp')
                            .setPlaceholder('Selecione o MVP')
                            .addOptions(allPlayers.map(id => ({
                                label: guild.members.cache.get(id)?.displayName || id,
                                value: id
                            })))
                    );
                    await interaction.reply({ content: 'Vote no MVP:', components: [mvpMenu], ephemeral: true });
                } 
                else if (action === 'end_match_now') {
                    await interaction.reply({ content: 'Encerrando partida imediatamente...' });
                    await endMatchSequence(guild, match, channel);
                }
            }

            if (customId === 'select_winner') {
                const winner = interaction.values[0];
                match.winnerPending = { winner, proposerId: user.id };

                const confirmRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('confirm_result').setLabel('Confirmar Resultado').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('contest_result').setLabel('Contestar').setStyle(ButtonStyle.Danger)
                );

                await interaction.update({ content: `Vencedor selecionado: **${winner}**. Aguardando confirmação do capitão adversário...`, components: [] });
                await channel.send({ 
                    content: `📢 <@${user.id === match.captain1 ? match.captain2 : match.captain1}>, o capitão adversário definiu o resultado como: **${winner}**. Você confirma?`,
                    components: [confirmRow]
                });
            }

            if (customId === 'select_mvp') {
                await interaction.reply({ content: `⭐ <@${user.id}> votou em <@${interaction.values[0]}> para MVP!`, ephemeral: false });
            }
        }
    }
};

async function updateQueueEmbed(message, queue) {
    const playersList = Array.from(queue.players).map(id => `<@${id}>`).join('\n') || 'Nenhum jogador na fila.';
    const embed = EmbedBuilder.from(message.embeds[0])
        .setFields(
            { name: 'Jogadores', value: playersList, inline: false },
            { name: 'Progresso', value: `${queue.players.size}/${queue.config.playersNeeded}`, inline: true }
        );
    await message.edit({ embeds: [embed] });
}

async function startMatch(guild, message, queue) {
    const players = Array.from(queue.players);
    const { team1, team2 } = createTeams(players);
    const matchId = generateMatchId();
    
    const captain1 = team1[0];
    const captain2 = team2[0];

    queueManager.deleteQueue(message.id);
    await message.edit({ components: [] });

    const category = await guild.channels.create({
        name: `PARTIDAS ${queue.mode}`,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }],
    });

    const voice1 = await guild.channels.create({ name: '🔊 Time 1', type: ChannelType.GuildVoice, parent: category.id });
    const voice2 = await guild.channels.create({ name: '🔊 Time 2', type: ChannelType.GuildVoice, parent: category.id });
    const textChannel = await guild.channels.create({
        name: `partida-normal-${queue.mode}-${matchId}`,
        type: ChannelType.GuildText,
        parent: category.id,
    });

    for (const id of players) {
        await textChannel.permissionOverwrites.create(id, { ViewChannel: true, SendMessages: true });
        await voice1.permissionOverwrites.create(id, { ViewChannel: true, Connect: true });
        await voice2.permissionOverwrites.create(id, { ViewChannel: true, Connect: true });
    }

    // Mover jogadores
    for (const id of team1) {
        const m = await guild.members.fetch(id).catch(() => null);
        if (m?.voice.channel) await m.voice.setChannel(voice1).catch(() => {});
    }
    for (const id of team2) {
        const m = await guild.members.fetch(id).catch(() => null);
        if (m?.voice.channel) await m.voice.setChannel(voice2).catch(() => {});
    }

    const matchEmbed = new EmbedBuilder()
        .setTitle(`🎮 Partida Iniciada - ID #${matchId}`)
        .setColor('#2b2d31')
        .setDescription(`Bem-vindos à partida. Utilize o menu abaixo para gerenciar o resultado.`)
        .addFields(
            { name: '🎙️ Canais de Voz', value: `<#${voice1.id}> | <#${voice2.id}>`, inline: false },
            { 
                name: '🔵 Equipe 1', 
                value: team1.map((id, i) => `${i === 0 ? '⭐ **Capitão**' : '👤 Jogador'}: <@${id}>`).join('\n'), 
                inline: true 
            },
            { 
                name: '🔴 Equipe 2', 
                value: team2.map((id, i) => `${i === 0 ? '⭐ **Capitão**' : '👤 Jogador'}: <@${id}>`).join('\n'), 
                inline: true 
            }
        )
        .setFooter({ text: 'Apenas os capitães podem interagir com o menu.' })
        .setTimestamp();

    const optionsMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('match_options')
            .setPlaceholder('Clique aqui para ver as opções dos capitães...')
            .addOptions([
                { label: 'Definir Vencedor', value: 'set_winner', emoji: '🏆', description: 'Inicia o processo de confirmação de resultado.' },
                { label: 'Definir MVP', value: 'vote_mvp', emoji: '⭐', description: 'Votação para o melhor jogador da partida.' },
                { label: 'Finalizar Partida', value: 'end_match_now', emoji: '🏁', description: 'Encerra e deleta os canais imediatamente.' }
            ])
    );

    await textChannel.send({ embeds: [matchEmbed], components: [optionsMenu] });

    queueManager.createMatch({
        matchId, mode: queue.mode, team1, team2, captain1, captain2,
        categoryId: category.id, textChannelId: textChannel.id,
        voice1Id: voice1.id, voice2Id: voice2.id
    });
}

async function endMatchSequence(guild, match, channel) {
    await channel.send({ content: '🏁 **Partida Finalizada!** Obrigado por jogarem na **Peixaria**. Os canais serão deletados em 10 segundos.' });
    
    queueManager.deleteMatch(channel.id);

    setTimeout(async () => {
        try {
            const category = guild.channels.cache.get(match.categoryId);
            if (category) {
                const children = category.children.cache;
                for (const c of children.values()) {
                    // Tentar mover jogadores de volta ou desconectar
                    if (c.type === ChannelType.GuildVoice) {
                        for (const m of c.members.values()) {
                            await m.voice.disconnect().catch(() => {});
                        }
                    }
                    await c.delete().catch(() => {});
                }
                await category.delete().catch(() => {});
            }
        } catch (e) { console.error('Erro ao limpar canais:', e); }
    }, 10000);
}
