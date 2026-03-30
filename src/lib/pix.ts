/**
 * Pix BR Code (EMV) generator — Pix Estático
 * Spec: https://www.bcb.gov.br/content/estabilidadefinanceira/forumpagamentos/PaymentInitiationDraft.pdf
 */

function field(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

function crc16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return ((crc & 0xffff).toString(16).toUpperCase().padStart(4, "0"));
}

export interface PixParams {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amount?: number;   // em reais (ex: 29.90)
  description?: string;
  txid?: string;
}

export function generatePixBRCode(params: PixParams): string {
  const { pixKey, merchantName, merchantCity, amount, description, txid } = params;

  // Merchant account info
  const gui = field("00", "BR.GOV.BCB.PIX");
  const key = field("01", pixKey);
  const desc = description ? field("02", description.substring(0, 72)) : "";
  const merchantAccountInfo = field("26", gui + key + desc);

  // Additional data — txid (required, use "***" if not set)
  const label = txid ? txid.replace(/[^a-zA-Z0-9]/g, "").substring(0, 25) : "***";
  const additionalDataField = field("62", field("05", label));

  // Build payload without CRC
  const payload =
    field("00", "01") +                        // Payload format indicator
    field("01", "12") +                         // Point of initiation (12 = static)
    merchantAccountInfo +
    field("52", "0000") +                       // Merchant category code
    field("53", "986") +                        // Currency BRL
    (amount !== undefined && amount > 0
      ? field("54", amount.toFixed(2))
      : "") +
    field("58", "BR") +                         // Country code
    field("59", merchantName.substring(0, 25)) +
    field("60", merchantCity.substring(0, 15).toUpperCase()) +
    additionalDataField +
    "6304";                                     // CRC placeholder

  return payload + crc16(payload);
}
