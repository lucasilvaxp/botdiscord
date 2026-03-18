const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const Pix = require('../utils/pix');

module.exports = {
    name: 'pix',
    description: 'Gera um QR Code PIX válido',
    async execute(message, args) {
        const key = args[0];
        const value = parseFloat(args[1]) || 0;

        if (!key) {
            return message.reply('Por favor, forneça uma chave PIX: !pix <chave> [valor]');
        }

        try {
            const pix = new Pix(key, 'Beneficiário', 'Cidade', value);
            const { payload, qrCodeBase64 } = await pix.generateQRCode();

            const buffer = Buffer.from(qrCodeBase64.split(',')[1], 'base64');
            const attachment = new AttachmentBuilder(buffer, { name: 'pix-qrcode.png' });

            const embed = new EmbedBuilder()
                .setTitle('Pagamento via PIX')
                .setDescription('Escaneie o QR Code abaixo ou utilize a chave Copia e Cola.')
                .setColor('#2b2d31')
                .addFields(
                    { name: '🔑 Chave PIX', value: `\`${key}\``, inline: true },
                    { name: '💰 Valor', value: `\`R$ ${value.toFixed(2)}\``, inline: true },
                    { name: '📋 Copia e Cola', value: `\`\`\`${payload}\`\`\`` }
                )
                .setImage('attachment://pix-qrcode.png')
                .setFooter({ text: 'Pagamento seguro via Banco Central' })
                .setTimestamp();

            await message.channel.send({ embeds: [embed], files: [attachment] });
        } catch (err) {
            console.error('Erro ao gerar PIX:', err);
            message.reply('Houve um erro ao gerar o PIX.');
        }
    }
};
