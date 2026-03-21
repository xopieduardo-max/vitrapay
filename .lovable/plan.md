

## Plano: Webhook PIX Robusto com Asaas

### Resumo
Criar a infraestrutura completa de confirmação automática de pagamento PIX: tabela `pending_payments`, edge function `asaas-webhook` com segurança e idempotência, atualização do `create-pix-payment` para salvar pagamentos pendentes, e polling no checkout.

---

### 1. Migração — Tabela `pending_payments`

```sql
CREATE TABLE public.pending_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asaas_payment_id text UNIQUE NOT NULL,
  product_id uuid NOT NULL,
  buyer_name text,
  buyer_email text,
  buyer_cpf text,
  amount integer NOT NULL,
  affiliate_ref text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_payments ENABLE ROW LEVEL SECURITY;

-- Anon pode ler pelo asaas_payment_id (polling do checkout)
CREATE POLICY "Anyone can read pending payments"
  ON public.pending_payments FOR SELECT
  TO anon, authenticated
  USING (true);
```

RLS permite SELECT público (necessário para polling sem autenticação no checkout). INSERT/UPDATE são feitos via service role nas edge functions.

---

### 2. Atualizar `create-pix-payment`

Duas mudanças:

- **externalReference estruturado**: enviar `"product_id|affiliate_ref"` (ou `"product_id|"` se sem afiliado)
- **Inserir em `pending_payments`** após criar o pagamento no Asaas, salvando `asaas_payment_id`, `product_id`, dados do comprador e `affiliate_ref`

O checkout passa a receber também o `payment_id` do Asaas para usar no polling.

---

### 3. Criar Edge Function `asaas-webhook`

Endpoint público que recebe POST do Asaas. Fluxo:

```text
POST /asaas-webhook
  │
  ├─ Validar access_token header (ASAAS_WEBHOOK_TOKEN secret)
  │   └─ 401 se inválido
  │
  ├─ Verificar evento (PAYMENT_CONFIRMED ou PAYMENT_RECEIVED)
  │   └─ 200 "ignored" se outro evento
  │
  ├─ Extrair payment.id e payment.externalReference
  │   └─ Parse "product_id|affiliate_ref"
  │
  ├─ Buscar pending_payments por asaas_payment_id
  │   └─ 200 "not found" se não existe (evita retry)
  │
  ├─ Checar idempotência: se status já é "confirmed"
  │   └─ 200 "already processed"
  │
  ├─ Inserir em sales (com payment_provider: "pix")
  │   └─ Checar duplicata por payment_id antes
  │
  ├─ Se affiliate_ref, buscar afiliado e criar comissão
  │
  └─ Atualizar pending_payments.status → "confirmed"
      └─ 200 "ok"
```

Toda exceção interna é logada mas retorna 200 para não causar retry infinito do Asaas.

**Secret necessária**: `ASAAS_WEBHOOK_TOKEN` — token que o Asaas envia no header para validação. Será solicitada ao usuário.

---

### 4. Atualizar Checkout — Polling de Status

Após exibir o QR Code PIX:

- Guardar o `asaas_payment_id` no state
- `setInterval` a cada 5 segundos consultando `pending_payments` onde `asaas_payment_id = X`
- Quando `status === 'confirmed'`, exibir tela de sucesso automaticamente
- Limpar interval ao desmontar ou ao confirmar

---

### 5. Configuração no Asaas

URL do webhook para cadastrar no painel Asaas:
```
https://taqseqektbipquvgfylc.supabase.co/functions/v1/asaas-webhook
```

---

### Detalhes Técnicos

| Componente | Arquivo |
|---|---|
| Migração | `supabase/migrations/xxx_pending_payments.sql` |
| PIX creation | `supabase/functions/create-pix-payment/index.ts` |
| Webhook | `supabase/functions/asaas-webhook/index.ts` (novo) |
| Checkout polling | `src/pages/Checkout.tsx` |

**Segurança**: Webhook valida token do Asaas. Idempotência por `asaas_payment_id` único. Sem exposição de dados sensíveis.

**Resiliência**: Sempre retorna 200 ao Asaas. Erros são logados internamente.

