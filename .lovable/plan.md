## Correção de taxas Asaas + limite automático de parcelas

### 1. Backend — custos reais do Asaas

**`supabase/functions/create-card-payment/index.ts` e `supabase/functions/asaas-webhook/index.ts`**

Substituir a tabela atual de custos por:

```ts
// D+30 (padrão)
const ASAAS_D30 = {
  x1:  { pct: 0.0299, fixed: 49 }, // à vista
  x6:  { pct: 0.0349, fixed: 49 }, // 2 a 6 parcelas
  x12: { pct: 0.0399, fixed: 49 }, // 7 a 12 parcelas
};

// D+2 = D+30 + antecipação 1,15% a.m. (proporcional aos dias)
// Simplificação prática: soma 1,15% ao percentual da faixa
const ASAAS_D2 = {
  x1:  { pct: 0.0299 + 0.0115, fixed: 49 },
  x6:  { pct: 0.0349 + 0.0115, fixed: 49 },
  x12: { pct: 0.0399 + 0.0115, fixed: 49 },
};
```

Correções obrigatórias:
- **Custo fixo por parcela**: `asaasCost = pct × valorCobrado + fixed × n` (hoje soma o fixed uma vez só).
- **`netProfit`**: usar `serviceFeeNet` (R$ 0,99 já descontado do % Asaas), não `SERVICE_FEE` bruto.
- **Piso de `custom_fee_fixed`**: se admin definir taxa personalizada abaixo do custo real do gateway daquela faixa, rejeitar/logar e usar o piso.

### 2. Limite automático de parcelas por faixa de preço

Nova constante compartilhada (backend + frontend):

```ts
// Máximo de parcelas permitido conforme o preço do produto
function maxInstallmentsForPrice(amountCents: number): number {
  if (amountCents < 2000)  return 3;   // < R$ 20 → até 3x
  if (amountCents < 5000)  return 6;   // R$ 20 a R$ 49,99 → até 6x
  if (amountCents < 10000) return 10;  // R$ 50 a R$ 99,99 → até 10x
  return 12;                            // ≥ R$ 100 → até 12x
}
```

- **`create-card-payment/index.ts`**: validar `installments <= maxInstallmentsForPrice(productAmount)`. Se ultrapassar, retornar 400 com mensagem clara.
- **`src/pages/Checkout.tsx`**: gerar os botões de parcela usando esse mesmo helper (ao invés de sempre 12x).
- Mostrar aviso discreto: "Este produto pode ser parcelado em até Nx".

### 3. Frontend — simulador e páginas públicas

**`src/pages/Taxas.tsx`** (simulador do produtor):
- Trocar tabela `ASAAS_PCT` para as 3 faixas reais (2,99 / 3,49 / 3,99), somando 1,15% no D+2.
- Multiplicar `ASAAS_FIXED_PER_INSTALLMENT × n` (já faz certo — confirmar).
- Aplicar o mesmo `maxInstallmentsForPrice` para desabilitar botões acima do permitido.

**`src/pages/admin/AdminFeeSimulator.tsx`**:
- Mesma atualização da tabela de custos e do limite.

**`src/pages/AdminUsers.tsx` linha 489**: corrigir typo "3,89%" → "3,99%".

**`src/pages/FAQ.tsx` e `src/pages/Landing.tsx`**: adicionar linha de transparência — "Parcelamento disponível conforme valor do produto (até 12x)".

### 4. Validação pós-mudança

Cenários de teste que precisam bater no simulador e no backend:

| Produto | Método | Parcelas | Lucro plataforma esperado |
|---|---|---|---|
| R$ 100 | PIX D+0 | — | R$ 1,49 |
| R$ 100 | Cartão D+30 | 1x | ~R$ 4,95 |
| R$ 100 | Cartão D+30 | 12x | ~R$ 4,95 (juros pagam antecipação) |
| R$ 100 | Cartão D+2 | 12x | ~R$ 3,80 |
| R$ 20 | Cartão D+30 | 3x (limite) | > 0 |
| R$ 10 | Cartão D+30 | 3x (limite) | > 0 |

Se qualquer linha der negativo, ajustar as faixas do `maxInstallmentsForPrice` antes de encerrar.

### Fora do escopo
- Não muda a taxa nominal da VitraPay (3,99% + R$ 2,49 / R$ 2,49 PIX / R$ 0,99 serviço).
- Não muda a regra de juros do comprador (1,6% a.m. em parcelado, à vista sem juros).
- Não mexe em vendas antigas — só afeta cobranças novas.