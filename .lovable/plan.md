

## Padronizar Notificações Push de Venda

### Situação Atual

As notificações push estão espalhadas em **6 locais** com formatos inconsistentes e emojis:

| Local | Título atual | Corpo atual |
|-------|-------------|-------------|
| `create-pix-payment` | "Pix Gerado! 💰" | "Pix de R$ XX gerado para [produto]" |
| `create-card-payment` | "Cartão Gerado! 💳" | "Pagamento de R$ XX via cartão gerado para [produto]" |
| `asaas-webhook` (avulso confirmado) | "Nova venda! 🎉" | "Pix de [nome] de R$ XX confirmado" |
| `asaas-webhook` (estorno/chargeback) | "⚠️ Chargeback..." / "🔄 Estorno..." | Texto com valor |
| `useSalesNotifications.ts` (realtime INSERT) | "Venda Aprovada!" | "Pagamento via Pix • Valor: R$ XX" |
| `useSalesNotifications.ts` (realtime UPDATE refund) | "Venda Estornada" | "Pix • R$ XX • ID: ..." |
| `create-pix-avulso` | "Pix Avulso Gerado 💰" | "Cobrança de R$ XX criada..." |

### Novo Formato Padronizado

**Vendas confirmadas (push + toast):**
- Título: `Venda aprovada no Pix!` ou `Venda aprovada no Cartão!`
- Corpo: `Sua comissão: R$ XX,XX`

**Pagamentos gerados (PIX/Cartão pendentes):**
- Título: `Venda aprovada no Pix!` ou `Venda aprovada no Cartão!`
- Corpo: `Sua comissão: R$ XX,XX` (usando valor bruto pois a comissão líquida ainda não é conhecida nesse momento — será o valor do produto)

**Estornos/Chargebacks (sem emojis):**
- Título: `Chargeback Recebido` / `MED Pix Recebido` / `Estorno Realizado`
- Corpo: mantém o texto atual sem emojis

**Pix Avulso:**
- Título: `Pix Avulso Gerado`
- Corpo: sem emoji

### Arquivos a Alterar

1. **`supabase/functions/create-pix-payment/index.ts`** — Alterar título para "Venda aprovada no Pix!" e corpo para "Sua comissão: R$ XX,XX"

2. **`supabase/functions/create-card-payment/index.ts`** — Alterar título para "Venda aprovada no Cartão!" e corpo para "Sua comissão: R$ XX,XX"

3. **`supabase/functions/asaas-webhook/index.ts`** — Duas alterações:
   - Linha ~341: remover emojis dos títulos de estorno/chargeback
   - Linha ~518: alterar "Nova venda! 🎉" para "Venda aprovada no Pix!" e corpo para "Sua comissão: R$ XX,XX" (usando `producerNet`)
   - Adicionar push de venda confirmada para vendas regulares (~linha 708, após processar a venda) com o mesmo formato

4. **`supabase/functions/create-pix-avulso/index.ts`** — Remover emoji, alterar para "Pix Avulso Gerado"

5. **`src/hooks/useSalesNotifications.ts`** — Alterar toast e push:
   - INSERT: título "Venda aprovada no Pix!" ou "Venda aprovada no Cartão!", corpo "Sua comissão: R$ XX,XX"
   - UPDATE (refund): remover emojis, manter formato limpo

6. **`supabase/functions/send-push/index.ts`** — Alterar fallback default de "Nova venda!" para "Venda aprovada!"

### Observação Importante

Nos pontos de **geração** de pagamento (`create-pix-payment`, `create-card-payment`), o valor líquido do produtor ainda não é conhecido com precisão (depende de taxas e comissões de afiliado). Nesses casos, usaremos o valor bruto como aproximação da comissão, ou alternativamente podemos mostrar apenas o valor da venda. O valor exato da comissão só é calculado no `asaas-webhook` quando o pagamento é confirmado.

