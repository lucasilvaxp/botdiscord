const { EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Pix = require('../utils/pix');

module.exports = {
    name: 'pix',
    description: 'Gera um QR Code PIX válido',
    async execute(message, args) {
        const key = args[0];
        const value = parseFloat(args[1]) || 0;

        if (!key) {
            return message.reply('❌ **Erro:** Forneça uma chave PIX: `!pix <chave> [valor]`');
        }

        try {
            const pix = new Pix(key, 'Matchmaking Bot', 'SAO PAULO', value);
            const { payload, qrCodeBase64 } = await pix.generateQRCode();

            const buffer = Buffer.from(qrCodeBase64.split(',')[1], 'base64');
            const attachment = new AttachmentBuilder(buffer, { name: 'pix-qrcode.png' });

            const embed = new EmbedBuilder()
                .setTitle('💎 Sistema de Pagamento')
                .setDescription('Para concluir, escaneie o QR Code ou utilize o código Copia e Cola abaixo.')
                .setColor('#2b2d31')
                .addFields(
                    { name: '🔑 Chave', value: `\`${key}\``, inline: true },
                    { name: '💰 Valor', value: `\`R$ ${value.toFixed(2)}\``, inline: true },
                    { name: '📋 Copia e Cola', value: `\`\`\`${payload}\`\`\`` }
                )
                .setImage('attachment://pix-qrcode.png')
                .setFooter({ text: 'Arena Matchmaking • Pagamento via Banco Central' })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('copy_pix_info')
                    .setLabel('Como pagar?')
                    .setEmoji('❓')
                    .setStyle(ButtonStyle.Secondary)
            );

            await message.channel.send({ 
                embeds: [embed], 
                files: [attachment], 
                components: [row] 
            });

        } catch (err) {
            console.error('Erro ao gerar PIX:', err);
            message.reply('⚠️ Houve um erro ao processar seu PIX. Verifique a chave e tente novamente.');
        }
    }
};
