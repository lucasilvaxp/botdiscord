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
        const polynomial = 0x1021;

        for (let i = 0; i < data.length; i++) {
            let byte = data.charCodeAt(i);
            for (let j = 0; j < 8; j++) {
                let bit = ((byte >> (7 - j) & 1) === 1);
                let c15 = ((crc >> 15 & 1) === 1);
                crc <<= 1;
                if (c15 ^ bit) crc ^= polynomial;
            }
        }

        crc &= 0xFFFF;
        return crc.toString(16).toUpperCase().padStart(4, '0');
    }

    generatePayload() {
        const formatField = (id, value) => {
            const len = value.length.toString().padStart(2, '0');
            return id + len + value;
        };

        // Merchant Account Information (ID 26)
        const gui = formatField('00', 'br.gov.bcb.pix');
        const key = formatField('01', this.key);
        const merchantAccountInfo = formatField('26', gui + key);

        let payload = '';
        payload += formatField('00', '01'); // Payload Format Indicator
        payload += merchantAccountInfo;
        payload += formatField('52', '0000'); // Merchant Category Code
        payload += formatField('53', '986'); // Transaction Currency (BRL)
        
        if (this.value > 0) {
            payload += formatField('54', this.value.toFixed(2)); // Transaction Amount
        }
        
        payload += formatField('58', 'BR'); // Country Code
        payload += formatField('59', this.receiver.substring(0, 25)); // Merchant Name
        payload += formatField('60', this.city.substring(0, 15)); // Merchant City
        
        // Additional Data Field Template (ID 62) - ID 05 is Reference Label
        const reference = formatField('05', '***');
        payload += formatField('62', reference);

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
