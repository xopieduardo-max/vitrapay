import { describe, it, expect } from "vitest";
import {
  maxInstallmentsForPrice,
  asaasCardTierPct,
  asaasEffectivePct,
  computeBuyerTotal,
  computeAsaasCost,
  computePlatformFee,
  computeServiceFeeNet,
  computeScenario,
  ASAAS_CARD_FIXED_CENTS,
  ASAAS_D2_ADD_PCT,
  ASAAS_PIX_FIXED_CENTS,
  ASAAS_BOLETO_FIXED_CENTS,
  SERVICE_FEE_CENTS,
  BUYER_INSTALLMENT_INTEREST_MONTHLY,
} from "@/lib/pricing";

// =============================================================================
// 1) Limite de parcelas por faixa de preço
// =============================================================================
describe("maxInstallmentsForPrice", () => {
  it.each([
    [0, 3],
    [499, 3],
    [1999, 3],
    [2000, 6],
    [4999, 6],
    [5000, 10],
    [9999, 10],
    [10000, 12],
    [50000, 12],
    [1_000_000, 12],
  ])("preço %i cents → máx %i parcelas", (amount, expected) => {
    expect(maxInstallmentsForPrice(amount)).toBe(expected);
  });

  it("nunca retorna mais que 12 parcelas", () => {
    for (const cents of [500, 1999, 5000, 9999, 100000, 5_000_000]) {
      expect(maxInstallmentsForPrice(cents)).toBeLessThanOrEqual(12);
    }
  });

  it("é monotonicamente não-decrescente conforme o preço sobe", () => {
    let prev = 0;
    for (const cents of [0, 1999, 2000, 4999, 5000, 9999, 10000]) {
      const cur = maxInstallmentsForPrice(cents);
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
  });
});

// =============================================================================
// 2) Faixas Asaas por número de parcelas
// =============================================================================
describe("asaasCardTierPct", () => {
  it("1x → 2,99%", () => expect(asaasCardTierPct(1)).toBe(2.99));
  it("2-6x → 3,49%", () => {
    for (const n of [2, 3, 4, 5, 6]) expect(asaasCardTierPct(n)).toBe(3.49);
  });
  it("7-12x → 3,99%", () => {
    for (const n of [7, 8, 9, 10, 11, 12]) expect(asaasCardTierPct(n)).toBe(3.99);
  });
});

describe("asaasEffectivePct", () => {
  it("D+30 = faixa base", () => {
    expect(asaasEffectivePct(1, "D30")).toBe(2.99);
    expect(asaasEffectivePct(6, "D30")).toBe(3.49);
    expect(asaasEffectivePct(12, "D30")).toBe(3.99);
  });
  it("D+2 adiciona 1,15%", () => {
    expect(asaasEffectivePct(1, "D2")).toBeCloseTo(2.99 + ASAAS_D2_ADD_PCT, 5);
    expect(asaasEffectivePct(6, "D2")).toBeCloseTo(3.49 + ASAAS_D2_ADD_PCT, 5);
    expect(asaasEffectivePct(12, "D2")).toBeCloseTo(3.99 + ASAAS_D2_ADD_PCT, 5);
  });
});

// =============================================================================
// 3) Juros repassado ao comprador (parcelamento)
// =============================================================================
describe("computeBuyerTotal", () => {
  it("PIX / Boleto: só adiciona taxa serviço", () => {
    expect(computeBuyerTotal(10000, "pix", 1)).toBe(10000 + SERVICE_FEE_CENTS);
    expect(computeBuyerTotal(10000, "boleto", 1)).toBe(10000 + SERVICE_FEE_CENTS);
  });

  it("Cartão 1x: sem juros, só taxa serviço", () => {
    expect(computeBuyerTotal(10000, "card", 1)).toBe(10000 + SERVICE_FEE_CENTS);
  });

  it("Cartão 2x: aplica 1,6% × 1 mês", () => {
    // 10000 × (1 + 0.016×1) = 10160 + 99
    expect(computeBuyerTotal(10000, "card", 2)).toBe(10160 + SERVICE_FEE_CENTS);
  });

  it("Cartão 12x: aplica 1,6% × 11 meses", () => {
    // fator = 1 + 0.016*11 = 1.176 → 10000 * 1.176 = 11760
    expect(computeBuyerTotal(10000, "card", 12)).toBe(11760 + SERVICE_FEE_CENTS);
  });

  it("juros cresce linearmente com o número de parcelas", () => {
    const base = 10000;
    let prev = computeBuyerTotal(base, "card", 1);
    for (let n = 2; n <= 12; n++) {
      const cur = computeBuyerTotal(base, "card", n);
      expect(cur).toBeGreaterThan(prev);
      prev = cur;
    }
  });

  it("juros mensal está travado em 1,6%", () => {
    expect(BUYER_INSTALLMENT_INTEREST_MONTHLY).toBe(1.6);
  });
});

// =============================================================================
// 4) Custo Asaas
// =============================================================================
describe("computeAsaasCost", () => {
  it("PIX = R$ 1,99 fixo", () => {
    expect(computeAsaasCost(10099, "pix", 1, "D30")).toBe(ASAAS_PIX_FIXED_CENTS);
  });
  it("Boleto = R$ 1,99 fixo", () => {
    expect(computeAsaasCost(10099, "boleto", 1, "D30")).toBe(ASAAS_BOLETO_FIXED_CENTS);
  });

  it("Cartão 1x D+30: 2,99% × total + R$ 0,49", () => {
    const bTotal = computeBuyerTotal(10000, "card", 1); // 10099
    const expected = Math.round(bTotal * 0.0299) + ASAAS_CARD_FIXED_CENTS;
    expect(computeAsaasCost(bTotal, "card", 1, "D30")).toBe(expected);
  });

  it("Cartão 12x D+30: 3,99% × total + R$ 0,49 × 12", () => {
    const bTotal = computeBuyerTotal(10000, "card", 12);
    const expected = Math.round(bTotal * 0.0399) + ASAAS_CARD_FIXED_CENTS * 12;
    expect(computeAsaasCost(bTotal, "card", 12, "D30")).toBe(expected);
  });

  it("Cartão D+2 é sempre mais caro que D+30 para mesmas parcelas", () => {
    for (const n of [1, 3, 6, 9, 12]) {
      const b = computeBuyerTotal(10000, "card", n);
      expect(computeAsaasCost(b, "card", n, "D2"))
        .toBeGreaterThan(computeAsaasCost(b, "card", n, "D30"));
    }
  });

  it("fixo escala com número de parcelas (bug histórico)", () => {
    const b1 = computeBuyerTotal(10000, "card", 1);
    const b12 = computeBuyerTotal(10000, "card", 12);
    const fixed1 = computeAsaasCost(b1, "card", 1, "D30") - Math.round(b1 * 0.0299);
    const fixed12 = computeAsaasCost(b12, "card", 12, "D30") - Math.round(b12 * 0.0399);
    expect(fixed1).toBe(ASAAS_CARD_FIXED_CENTS);
    expect(fixed12).toBe(ASAAS_CARD_FIXED_CENTS * 12);
  });
});

// =============================================================================
// 5) Taxa VitraPay e serviço líquido
// =============================================================================
describe("computePlatformFee", () => {
  it("aplica pct + fixo", () => {
    expect(computePlatformFee(10000, 3.99, 249)).toBe(399 + 249);
  });
  it("PIX zero pct → só fixo", () => {
    expect(computePlatformFee(10000, 0, 399)).toBe(399);
  });
});

describe("computeServiceFeeNet", () => {
  it("PIX/Boleto = R$ 0,99 bruto", () => {
    expect(computeServiceFeeNet("pix", 1, "D30")).toBe(SERVICE_FEE_CENTS);
    expect(computeServiceFeeNet("boleto", 1, "D30")).toBe(SERVICE_FEE_CENTS);
  });
  it("Cartão desconta % Asaas incidente sobre R$ 0,99", () => {
    const net = computeServiceFeeNet("card", 1, "D30");
    expect(net).toBe(SERVICE_FEE_CENTS - Math.round(SERVICE_FEE_CENTS * 0.0299));
  });
  it("Cartão 12x D+2 desconta faixa maior", () => {
    const pct = 0.0399 + ASAAS_D2_ADD_PCT / 100;
    expect(computeServiceFeeNet("card", 12, "D2"))
      .toBe(SERVICE_FEE_CENTS - Math.round(SERVICE_FEE_CENTS * pct));
  });
});

// =============================================================================
// 6) Cálculo de lucro/prejuízo (cenários end-to-end)
// =============================================================================
describe("computeScenario — lucro/prejuízo", () => {
  const CARD_VP = { pct: 3.99, fixed: 249 };

  it("R$ 100 cartão 1x D+30 → lucro", () => {
    const r = computeScenario({
      amountCents: 10000, method: "card", installments: 1, antecipacao: "D30",
      vpPct: CARD_VP.pct, vpFixedCents: CARD_VP.fixed,
    });
    expect(r.isProfit).toBe(true);
    expect(r.platformProfit).toBeGreaterThan(0);
    expect(r.producerReceives).toBe(10000 - r.platformFee);
  });

  it("R$ 100 cartão 12x D+30 com defaults atuais → LUCRO (juro do parcelamento cobre o custo Asaas)", () => {
    // O juro de parcelamento cobrado do comprador (1,6% a.m.) NUNCA é repassado ao
    // produtor — fica retido pela plataforma, então é receita real (igual ao
    // buyerInterest somado ao netProfit em create-card-payment/index.ts). Por isso
    // 12x D+30 é lucrativo: custo Asaas ≈ R$ 10,61, mas receita total (taxa + serviço
    // + juro retido) ≈ R$ 25,07.
    const r = computeScenario({
      amountCents: 10000, method: "card", installments: 12, antecipacao: "D30",
      vpPct: CARD_VP.pct, vpFixedCents: CARD_VP.fixed,
    });
    expect(r.isProfit).toBe(true);
    expect(r.buyerInterest).toBeGreaterThan(0);
  });

  it("R$ 100 cartão 12x D+2 → margem menor que D+30", () => {
    const d30 = computeScenario({
      amountCents: 10000, method: "card", installments: 12, antecipacao: "D30",
      vpPct: CARD_VP.pct, vpFixedCents: CARD_VP.fixed,
    });
    const d2 = computeScenario({
      amountCents: 10000, method: "card", installments: 12, antecipacao: "D2",
      vpPct: CARD_VP.pct, vpFixedCents: CARD_VP.fixed,
    });
    expect(d2.platformProfit).toBeLessThan(d30.platformProfit);
  });

  it("PIX R$ 100: lucro = taxa VitraPay + R$0,99 − R$1,99", () => {
    const r = computeScenario({
      amountCents: 10000, method: "pix", installments: 1, antecipacao: "D30",
      vpPct: 0, vpFixedCents: 399,
    });
    // 399 + 99 − 199 = 299
    expect(r.platformProfit).toBe(299);
    expect(r.isProfit).toBe(true);
  });

  it("Taxa VitraPay insuficiente → prejuízo detectado (sem juro de parcelamento pra cobrir o custo)", () => {
    // 1x não gera juro repassado, então sem taxa VitraPay nem serviço suficiente
    // pra cobrir o custo Asaas, o cenário é mesmo prejuízo — diferente de 12x,
    // onde o juro retido cobre a diferença.
    const r = computeScenario({
      amountCents: 10000, method: "card", installments: 1, antecipacao: "D2",
      vpPct: 0, vpFixedCents: 0, // sem taxa
    });
    expect(r.buyerInterest).toBe(0);
    expect(r.isLoss).toBe(true);
    expect(r.platformProfit).toBeLessThan(0);
  });

  it("Produto barato (R$ 5) parcelado no máximo → conta bate com breakdown", () => {
    const amount = 500;
    const n = maxInstallmentsForPrice(amount); // 3
    const r = computeScenario({
      amountCents: amount, method: "card", installments: n, antecipacao: "D30",
      vpPct: CARD_VP.pct, vpFixedCents: CARD_VP.fixed,
    });
    // Sanidade: soma dos componentes
    expect(r.platformProfit).toBe(r.platformFee + SERVICE_FEE_CENTS + r.buyerInterest - r.asaasCost);
    expect(r.buyerTotal).toBe(computeBuyerTotal(amount, "card", n));
  });

  it("Consistência: profit = fee + serviceNet − asaasCost para todo cenário", () => {
    for (const amount of [500, 2000, 5000, 10000, 50000]) {
      const nMax = maxInstallmentsForPrice(amount);
      for (let n = 1; n <= nMax; n++) {
        for (const antec of ["D30", "D2"] as const) {
          const r = computeScenario({
            amountCents: amount, method: "card", installments: n, antecipacao: antec,
            vpPct: CARD_VP.pct, vpFixedCents: CARD_VP.fixed,
          });
          expect(r.platformProfit).toBe(r.platformFee + SERVICE_FEE_CENTS + r.buyerInterest - r.asaasCost);
          expect(r.producerReceives).toBe(amount - r.platformFee);
        }
      }
    }
  });

  it("Margem em % é coerente com valor absoluto do lucro", () => {
    const r = computeScenario({
      amountCents: 10000, method: "card", installments: 1, antecipacao: "D30",
      vpPct: CARD_VP.pct, vpFixedCents: CARD_VP.fixed,
    });
    expect(r.profitMarginPct).toBeCloseTo((r.platformProfit / 10000) * 100, 5);
  });
});

// =============================================================================
// 7) Regressão: bugs históricos que NÃO podem voltar
// =============================================================================
describe("regressão — bugs históricos", () => {
  it("fixo Asaas é multiplicado por n_parcelas (não somado uma vez só)", () => {
    const bTotal = computeBuyerTotal(10000, "card", 6);
    const cost = computeAsaasCost(bTotal, "card", 6, "D30");
    const pctPart = Math.round(bTotal * 0.0349);
    expect(cost - pctPart).toBe(ASAAS_CARD_FIXED_CENTS * 6);
  });

  it("faixa Asaas escala corretamente (não usa 2,99% fixo para 12x)", () => {
    const b = computeBuyerTotal(10000, "card", 12);
    // Se estivesse chumbado 2,99%, custo seria bem menor
    const bugged = Math.round(b * 0.0299) + ASAAS_CARD_FIXED_CENTS * 12;
    const real = computeAsaasCost(b, "card", 12, "D30");
    expect(real).toBeGreaterThan(bugged);
  });

  it("serviceFeeNet desconta gateway (não usa R$ 0,99 bruto no cartão)", () => {
    const net = computeServiceFeeNet("card", 12, "D2");
    expect(net).toBeLessThan(SERVICE_FEE_CENTS);
  });
});
