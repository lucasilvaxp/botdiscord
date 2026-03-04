const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const QRCode = require('qrcode');

module.exports = {
    name: 'pix',
    description: 'Gera um QR Code para pagamento via PIX',
    async execute(message, args) {
        const key = args[0];
        if (!key) return message.reply('Por favor, forneça uma chave PIX (CPF, Telefone, Email ou Aleatória). Ex: `!pix sua@chave.com`');

        try {
            // Gerar QR Code como Buffer
            const qrBuffer = await QRCode.toBuffer(key, {
                errorCorrectionLevel: 'H',
                type: 'png',
                margin: 1,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            });

            const attachment = new AttachmentBuilder(qrBuffer, { name: 'pix-qrcode.png' });

            const embed = new EmbedBuilder()
                .setTitle('💸 Pagamento via PIX')
                .setDescription(`Escaneie o QR Code abaixo ou utilize a chave **Copia e Cola**.\n\n**Chave:** \`${key}\``)
                .setColor('#00bfa5')
                .setImage('attachment://pix-qrcode.png')
                .setFooter({ text: 'Pagamento seguro via PIX' })
                .setTimestamp();

            await message.channel.send({ embeds: [embed], files: [attachment] });
        } catch (err) {
            console.error('Erro ao gerar QR Code:', err);
            message.reply('Houve um erro ao gerar o QR Code do PIX.');
        }
    }
};
