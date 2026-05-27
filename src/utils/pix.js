const QRCode = require('qrcode');
const { Merchant } = require('steplix-emv-qrcps');

class Pix {
    constructor(key, receiver, city, value = 0, reference = '***') {
        this.key = key;
        this.receiver = receiver;
        this.city = city;
        this.value = value;
        this.reference = reference;
    }

    static formatText(text) {
        if (!text) return '';
        // Normaliza para remover acentos e caracteres especiais, conforme o padrão EMV
        return text.normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9\s]/g, "")
            .trim();
    }

    generatePayload() {
        // Build the EMVQR object using the official Merchant builder
        const emvqr = Merchant.buildEMVQR();

        // Standard Pix Configuration
        emvqr.setPayloadFormatIndicator("01");
        emvqr.setCountryCode("BR");
        emvqr.setMerchantCategoryCode("0000");
        emvqr.setTransactionCurrency("986"); // BRL

        // Merchant Account Information (ID 26)
        const merchantAccountInformation = Merchant.buildMerchantAccountInformation();
        merchantAccountInformation.setGloballyUniqueIdentifier("BR.GOV.BCB.PIX");
        merchantAccountInformation.addPaymentNetworkSpecific("01", this.key); // Chave Pix
        emvqr.addMerchantAccountInformation("26", merchantAccountInformation);

        // Merchant Details
        emvqr.setMerchantName(Pix.formatText(this.receiver).substring(0, 25));
        emvqr.setMerchantCity(Pix.formatText(this.city).substring(0, 15));

        // Transaction Amount
        if (this.value > 0) {
            // A biblioteca lida com a formatação correta do valor
            emvqr.setTransactionAmount(this.value.toFixed(2));
        }

        // Additional Data (Reference/TXID)
        const additionalDataFieldTemplate = Merchant.buildAdditionalDataFieldTemplate();
        const ref = Pix.formatText(this.reference).replace(/\s/g, '').substring(0, 25);
        additionalDataFieldTemplate.setReferenceLabel(ref || '***');
        emvqr.setAdditionalDataFieldTemplate(additionalDataFieldTemplate);

        // Generates the final payload with the correct CRC16
        return emvqr.generatePayload();
    }

    async generateQRCode() {
        try {
            const payload = this.generatePayload();
            // console.log('Payload Gerado:', payload); // Útil para debug se necessário
            const qrCodeBase64 = await QRCode.toDataURL(payload);
            return { payload, qrCodeBase64 };
        } catch (error) {
            console.error('Erro ao gerar QR Code:', error);
            throw error;
        }
    }
}

module.exports = Pix;
