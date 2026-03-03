const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder } = require('discord.js');
const queueManager = require('../managers/queueManager');
const { createTeams } = require('../utils/matchmaking');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (interaction.isButton()) {
            const { customId, user, message, guild } = interaction;

            // Lógica de Entrar na Fila
            if (customId.startsWith('join_queue_')) {
                const mode = customId.split('_')[2];
                const queue = queueManager.getQueue(message.id);

                if (!queue) return interaction.reply({ content: 'Esta fila não está mais ativa.', ephemeral: true });

                const added = queueManager.addPlayer(message.id, user.id);
                if (!added) return interaction.reply({ content: 'Você já está nesta fila!', ephemeral: true });

                await interaction.reply({ content: 'Você entrou na fila!', ephemeral: true });
                await updateQueueEmbed(message, queue);

                // Verificar se a fila está cheia
                if (queueManager.isFull(message.id)) {
                    await startMatch(guild, message, queue);
                }
            }

            // Lógica de Sair da Fila
            else if (customId.startsWith('leave_queue_')) {
                const queue = queueManager.getQueue(message.id);
                if (!queue) return interaction.reply({ content: 'Esta fila não está mais ativa.', ephemeral: true });

                const removed = queueManager.removePlayer(message.id, user.id);
                if (!removed) return interaction.reply({ content: 'Você não está nesta fila!', ephemeral: true });

                await interaction.reply({ content: 'Você saiu da fila!', ephemeral: true });
                await updateQueueEmbed(message, queue);
            }

            // Lógica de Cancelar Fila
            else if (customId.startsWith('cancel_queue_')) {
                const queue = queueManager.getQueue(message.id);
                if (!queue) return interaction.reply({ content: 'Esta fila não está mais ativa.', ephemeral: true });

                // Apenas moderadores ou quem abriu a fila (simplificado para moderadores aqui)
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                    return interaction.reply({ content: 'Você não tem permissão para cancelar esta fila.', ephemeral: true });
                }

                queueManager.deleteQueue(message.id);
                await message.delete();
                await interaction.reply({ content: 'Fila cancelada com sucesso.', ephemeral: true });
            }

            // Lógica de Setar Vencedor (Abrir Menu)
            else if (customId === 'set_winner_btn') {
                const selectMenu = new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('set_winner')
                            .setPlaceholder('Escolha o time vencedor')
                            .addOptions([
                                { label: 'Time 1', value: 'Time 1' },
                                { label: 'Time 2', value: 'Time 2' },
                                { label: 'Empate', value: 'Empate' }
                            ])
                    );
                await interaction.reply({ content: 'Selecione o vencedor:', components: [selectMenu], ephemeral: true });
            }

            // Lógica de MVP (Abrir Menu)
            else if (customId === 'vote_mvp_btn') {
                // Pegar jogadores da embed da partida (simplificado para este exemplo)
                const playersInMatch = interaction.message.embeds[0].description.match(/<@(\d+)>/g) || [];
                const uniquePlayers = [...new Set(playersInMatch.map(p => p.replace(/[<@>]/g, '')))];

                if (uniquePlayers.length === 0) return interaction.reply({ content: 'Nenhum jogador encontrado para votação.', ephemeral: true });

                const selectMenu = new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('vote_mvp')
                            .setPlaceholder('Vote no MVP da partida')
                            .addOptions(uniquePlayers.map(id => ({
                                label: guild.members.cache.get(id)?.displayName || id,
                                value: id
                            })))
                    );
                await interaction.reply({ content: 'Vote no MVP:', components: [selectMenu], ephemeral: true });
            }

            // Lógica de Encerrar Partida
            else if (customId === 'end_match') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                    return interaction.reply({ content: 'Você não tem permissão para encerrar a partida.', ephemeral: true });
                }

                const category = interaction.channel.parent;
                if (category) {
                    const channels = category.children.cache;
                    for (const channel of channels.values()) {
                        await channel.delete();
                    }
                    await category.delete();
                }
            }
        }

        if (interaction.isStringSelectMenu()) {
            const { customId, values } = interaction;

            if (customId === 'set_winner') {
                await interaction.reply({ content: `O vencedor foi definido como: **${values[0]}**`, ephemeral: false });
            } else if (customId === 'vote_mvp') {
                await interaction.reply({ content: `Você votou em <@${values[0]}> para MVP!`, ephemeral: true });
            }
        }
    }
};

/**
 * Atualiza a Embed da fila com os jogadores atuais.
 */
async function updateQueueEmbed(message, queue) {
    const playersList = Array.from(queue.players).map(id => `<@${id}>`).join('\n') || 'Nenhum jogador na fila.';
    const embed = EmbedBuilder.from(message.embeds[0])
        .setFields(
            { name: 'Jogadores', value: playersList, inline: false },
            { name: 'Progresso', value: `${queue.players.size}/${queue.config.playersNeeded}`, inline: true }
        );

    await message.edit({ embeds: [embed] });
}

/**
 * Inicia a partida: sorteia times, cria canais e move jogadores.
 */
async function startMatch(guild, message, queue) {
    const players = Array.from(queue.players);
    const { team1, team2 } = createTeams(players);
    
    // Remover a fila do gerenciador
    queueManager.deleteQueue(message.id);
    await message.edit({ components: [] }); // Desativar botões da fila original

    // 1. Criar Categoria Privada
    const category = await guild.channels.create({
        name: `Partida ${queue.mode}`,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
            {
                id: guild.id,
                deny: [PermissionFlagsBits.ViewChannel],
            }
        ],
    });

    // 2. Criar Canais de Voz
    const voice1 = await guild.channels.create({
        name: '🔊 Time 1',
        type: ChannelType.GuildVoice,
        parent: category.id,
    });

    const voice2 = await guild.channels.create({
        name: '🔊 Time 2',
        type: ChannelType.GuildVoice,
        parent: category.id,
    });

    // 3. Criar Canal de Texto e configurar permissões para jogadores
    const textChannel = await guild.channels.create({
        name: 'match-chat',
        type: ChannelType.GuildText,
        parent: category.id,
    });

    // Adicionar permissões para cada jogador
    for (const playerId of players) {
        await textChannel.permissionOverwrites.create(playerId, {
            ViewChannel: true,
            SendMessages: true,
        });
        await voice1.permissionOverwrites.create(playerId, { ViewChannel: true, Connect: true });
        await voice2.permissionOverwrites.create(playerId, { ViewChannel: true, Connect: true });
    }

    // 4. Mover Jogadores
    for (const id of team1) {
        const member = await guild.members.fetch(id).catch(() => null);
        if (member && member.voice.channel) {
            await member.voice.setChannel(voice1).catch(console.error);
        }
    }
    for (const id of team2) {
        const member = await guild.members.fetch(id).catch(() => null);
        if (member && member.voice.channel) {
            await member.voice.setChannel(voice2).catch(console.error);
        }
    }

    // 5. Enviar Painel de Controle
    const matchEmbed = new EmbedBuilder()
        .setTitle('Partida Iniciada!')
        .setDescription(`Modo: **${queue.mode}**\n\n**Time 1:**\n${team1.map(id => `<@${id}>`).join(', ')}\n\n**Time 2:**\n${team2.map(id => `<@${id}>`).join(', ')}`)
        .setColor('#ff9900');

    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('set_winner_btn').setLabel('Setar Vencedor').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('vote_mvp_btn').setLabel('MVP').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('end_match').setLabel('Encerrar Partida').setStyle(ButtonStyle.Danger)
        );

    // Nota: Para simplificar o exemplo, vamos enviar os menus de seleção em interações separadas quando os botões forem clicados.
    // Mas para atender ao requisito de "mensagem fixa", vamos adicionar a lógica de botões que abrem os menus.
    
    await textChannel.send({ embeds: [matchEmbed], components: [actionRow] });

    // Adicionar listener temporário para os botões de controle da partida (ou tratar no interactionCreate global)
    // Para este exemplo, vamos expandir o interactionCreate para lidar com esses novos botões.
}