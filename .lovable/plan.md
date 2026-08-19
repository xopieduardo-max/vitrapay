# Plano: Ajustar notificações de venda + corrigir postback UTMify

## Resposta à sua pergunta sobre a UTMify

**Não foi porque o webhook da Asaas não disparou — ele disparou sim.** O log mostra:

```
Webhook received: ...pay_x96vv1zroekmrxhu...
Already processed: pay_x96vv1zroekmrxhu
```

O webhook recebeu o evento, mas encontrou a venda **já registrada no banco** e retornou cedo (linha 546-548 do `asaas-webhook`), **antes de chegar no postback da UTMify** (linha 798). Ou seja: o postback só é enviado na *primeira* vez que a venda é processada. Se a venda entrou no banco por outro caminho (ou por uma execução parcial anterior), o postback nunca é disparado.

## O que vou fazer

### 1. Simplificar texto da notificação (push + toast)

Hoje: `Venda aprovada no Pix!` → `R$ 37,00 • Você recebe R$ 34,51`
Depois: `Venda aprovada no Pix!` → `R$ 37,00` (só o valor da venda)

**Arquivos:**
- `supabase/functions/asaas-webhook/index.ts` — 2 blocos de push (linhas 513-521 e 725-733): remover `fmtNet` e a parte `• Você recebe ${fmtNet}`
- `src/hooks/useSalesNotifications.ts` — linhas 35-42: remover cálculo de `net` e `fmtNet`, mostrar só `fmtGross`

### 2. Corrigir postback UTMify em vendas "já processadas"

Hoje, quando o webhook encontra uma venda já existente (linha 539), ele retorna imediatamente sem enviar o postback da UTMify. Isso significa que se a venda foi criada por outro fluxo (ex: cartão) ou se o webhook falhou na primeira tentativa, a UTMify nunca recebe o pedido.

**Correção:** Adicionar um campo `utmify_postback_sent` na tabela `sales` (boolean, default false). Sempre que o webhook processa uma venda — seja nova ou já existente — ele verifica se o postback já foi enviado. Se não foi, envia e marca como enviado.

**Passos:**
- Migration: `ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS utmify_postback_sent boolean DEFAULT false;`
- No `asaas-webhook/index.ts`, mover a chamada `sendUtmifyPostback` para também executar no caminho `already_processed`, com verificação do flag
- Após envio bem-sucedido, atualizar `utmify_postback_sent = true`

## Detalhes técnicos

- A migration roda via `supabase--migration`
- O deploy do webhook é feito via `supabase--deploy_edge_functions`
- O campo `utmify_postback_sent` é seguro sob RLS pois só o webhook (service_role) o escreve
