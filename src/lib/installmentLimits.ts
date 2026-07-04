/**
 * Máximo de parcelas permitido conforme o preço do produto (em centavos).
 * Evita que o custo fixo do Asaas por parcela (R$ 0,49 × n) consuma
 * a margem em produtos baratos parcelados em muitas vezes.
 *
 * Deve ficar em sincronia com `maxInstallmentsForPrice` em
 * `supabase/functions/create-card-payment/index.ts`.
 */
export function maxInstallmentsForPrice(amountCents: number): number {
  if (amountCents < 2000) return 3;   // < R$ 20 → até 3x
  if (amountCents < 5000) return 6;   // R$ 20 a R$ 49,99 → até 6x
  if (amountCents < 10000) return 10; // R$ 50 a R$ 99,99 → até 10x
  return 12;                          // ≥ R$ 100 → até 12x
}
