const QRCode = require('qrcode');

class Pix {
    constructor(key, receiver, city, value = 0) {
        this.key = key;
        this.receiver = receiver;
        this.city = city;
        this.value = value;
    }

    static crc16(data) {
        let crc = 0xFFFF;
        for (let i = 0; i < data.length; i++) {
            crc ^= data.charCodeAt(i) << 8;
            for (let j = 0; j < 8; j++) {
                if (crc & 0x8000) {
                    crc = (crc << 1) ^ 0x1021;
                } else {
                    crc <<= 1;
                }
                crc &= 0xFFFF;
            }
        }
        return crc.toString(16).toUpperCase().padStart(4, '0');
    }

    generatePayload() {
        const formatField = (id, value) => id + value.length.toString().padStart(2, '0') + value;

        let payload = '';
        payload += formatField('00', '01'); // Payload Format Indicator
        payload += formatField('26', formatField('00', 'br.gov.bcb.pix') + formatField('01', this.key)); // Merchant Account Information
        payload += formatField('52', '0000'); // Merchant Category Code
        payload += formatField('53', '986'); // Transaction Currency (BRL)
        if (this.value > 0) payload += formatField('54', this.value.toFixed(2)); // Transaction Amount
        payload += formatField('58', 'BR'); // Country Code
        payload += formatField('59', this.receiver.substring(0, 25)); // Merchant Name
        payload += formatField('60', this.city.substring(0, 15)); // Merchant City
        payload += formatField('62', formatField('05', '***')); // Additional Data Field Template

        payload += '6304'; // CRC16 Identifier
        payload += Pix.crc16(payload);

        return payload;
    }

    async generateQRCode() {
        const payload = this.generatePayload();
        const qrCodeBase64 = await QRCode.toDataURL(payload);
        return { payload, qrCodeBase64 };
    }
}

module.exports = Pix;
