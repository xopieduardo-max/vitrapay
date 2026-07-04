/**
 * Pure pricing math shared by the UI simulator and tests.
 * All monetary values are in CENTS (integer).
 *
 * Regras de referência:
 *  - Asaas cartão: 1x 2,99% · 2-6x 3,49% · 7-12x 3,99% (+ R$ 0,49 fixo POR PARCELA)
 *  - Antecipação D+2: soma +1,15% ao percentual da faixa
 *  - Asaas PIX/Boleto: R$ 1,99 fixo
 *  - Comprador paga 1,6% a.m. de juros a partir da 2ª parcela (repassado)
 *  - Taxa de serviço: R$ 0,99 paga pelo comprador (Asaas cobra % dela no cartão)
 *
 * Deve ficar em sincronia com `supabase/functions/create-card-payment/index.ts`.
 */

export const ASAAS_CARD_FIXED_CENTS = 49;
export const ASAAS_D2_ADD_PCT = 1.15;
export const ASAAS_PIX_FIXED_CENTS = 199;
export const ASAAS_BOLETO_FIXED_CENTS = 199;
export const SERVICE_FEE_CENTS = 99;
export const BUYER_INSTALLMENT_INTEREST_MONTHLY = 1.6;

export type PaymentMethod = "pix" | "card" | "boleto";
export type Antecipacao = "D30" | "D2";

/** Máximo de parcelas permitido conforme o preço do produto (em centavos). */
export function maxInstallmentsForPrice(amountCents: number): number {
  if (amountCents < 2000) return 3;
  if (amountCents < 5000) return 6;
  if (amountCents < 10000) return 10;
  return 12;
}

/** Percentual Asaas por faixa de parcela (sem antecipação). */
export function asaasCardTierPct(installments: number): number {
  if (installments <= 1) return 2.99;
  if (installments <= 6) return 3.49;
  return 3.99;
}

/** Percentual Asaas efetivo, considerando antecipação D+2. */
export function asaasEffectivePct(installments: number, antecipacao: Antecipacao): number {
  return asaasCardTierPct(installments) + (antecipacao === "D2" ? ASAAS_D2_ADD_PCT : 0);
}

/** Valor total que o comprador paga (produto + juros parcelado + taxa serviço). */
export function computeBuyerTotal(
  amountCents: number,
  method: PaymentMethod,
  installments: number,
): number {
  if (method !== "card" || installments <= 1) return amountCents + SERVICE_FEE_CENTS;
  const factor = 1 + (BUYER_INSTALLMENT_INTEREST_MONTHLY / 100) * (installments - 1);
  return Math.round(amountCents * factor) + SERVICE_FEE_CENTS;
}

/** Custo total pago à Asaas para essa operação (em centavos). */
export function computeAsaasCost(
  buyerTotalCents: number,
  method: PaymentMethod,
  installments: number,
  antecipacao: Antecipacao,
): number {
  if (method === "pix") return ASAAS_PIX_FIXED_CENTS;
  if (method === "boleto") return ASAAS_BOLETO_FIXED_CENTS;
  const pct = asaasEffectivePct(installments, antecipacao);
  return Math.round(buyerTotalCents * (pct / 100)) + ASAAS_CARD_FIXED_CENTS * installments;
}

/** Taxa VitraPay cobrada do produtor (pct sobre valor do produto + fixo). */
export function computePlatformFee(
  amountCents: number,
  vpPct: number,
  vpFixedCents: number,
): number {
  return Math.round(amountCents * (vpPct / 100)) + vpFixedCents;
}

/** Taxa serviço líquida (após % Asaas incidente no cartão). */
export function computeServiceFeeNet(
  method: PaymentMethod,
  installments: number,
  antecipacao: Antecipacao,
): number {
  if (method !== "card") return SERVICE_FEE_CENTS;
  const pct = asaasEffectivePct(installments, antecipacao);
  return SERVICE_FEE_CENTS - Math.round(SERVICE_FEE_CENTS * (pct / 100));
}

export interface ScenarioInput {
  amountCents: number;
  method: PaymentMethod;
  installments: number;
  antecipacao: Antecipacao;
  vpPct: number;
  vpFixedCents: number;
}

export interface ScenarioResult {
  amountCents: number;
  buyerTotal: number;
  platformFee: number;
  serviceFeeNet: number;
  asaasCost: number;
  producerReceives: number;
  platformProfit: number;
  profitMarginPct: number;
  isProfit: boolean;
  isLoss: boolean;
}

/** Calcula o cenário completo (produtor, plataforma, Asaas). */
export function computeScenario(input: ScenarioInput): ScenarioResult {
  const { amountCents, method, installments, antecipacao, vpPct, vpFixedCents } = input;
  const buyerTotal = computeBuyerTotal(amountCents, method, installments);
  const asaasCost = computeAsaasCost(buyerTotal, method, installments, antecipacao);
  const platformFee = computePlatformFee(amountCents, vpPct, vpFixedCents);
  const serviceFeeNet = computeServiceFeeNet(method, installments, antecipacao);
  const producerReceives = amountCents - platformFee;
  const platformProfit = platformFee + serviceFeeNet - asaasCost;
  const profitMarginPct = amountCents > 0 ? (platformProfit / amountCents) * 100 : 0;
  return {
    amountCents,
    buyerTotal,
    platformFee,
    serviceFeeNet,
    asaasCost,
    producerReceives,
    platformProfit,
    profitMarginPct,
    isProfit: platformProfit > 0,
    isLoss: platformProfit < 0,
  };
}
