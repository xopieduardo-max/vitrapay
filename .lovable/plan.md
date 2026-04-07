
## Agendamento de Notificações no GV+

### Objetivo
Permitir que as vendas simuladas tenham suas notificações push distribuídas ao longo de um período (ex: 9h às 18h), em vez de disparar todas de uma vez.

### Abordagem

**1. Nova tabela `scheduled_fake_pushes`**
- Armazena cada notificação push agendada com horário de disparo
- Campos: `id`, `producer_id`, `title`, `body`, `url`, `scheduled_at`, `sent_at`, `created_at`

**2. Atualizar UI do GV+ (`AdminFakeSales.tsx`)**
- Adicionar campos de "Horário início" e "Horário fim" em cada linha de dia
- Padrão: 09:00 às 18:00
- Toggle "Agendar notificações" (se desligado, envia tudo imediatamente como hoje)
- Quando agendado: as vendas são inseridas normalmente (instantâneo), mas as notificações push são salvas na tabela com horários distribuídos aleatoriamente no intervalo

**3. Nova Edge Function `process-scheduled-pushes`**
- Executada a cada minuto via cron job
- Busca pushes com `scheduled_at <= now()` e `sent_at IS NULL`
- Envia cada push via `send-push` e marca como enviado

### Fluxo
1. Admin configura 20 Pix + 10 Cartão, horário 9h-18h
2. Clica "Gerar" → vendas são inseridas no banco instantaneamente
3. 30 registros são criados em `scheduled_fake_pushes` com horários aleatórios entre 9h-18h
4. Cron a cada minuto verifica e dispara os pushes no horário certo

### Vantagem
- Vendas aparecem no dashboard imediatamente (para métricas)
- Notificações chegam gradualmente ao longo do dia (natural)
