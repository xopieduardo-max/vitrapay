

## Plano: Preview da seção "Vendas por Região" no Dashboard

Vou adicionar a seção diretamente no dashboard usando **dados fictícios (mockados)** para você visualizar como ficará. Nenhuma alteração no banco de dados será feita — é puramente visual.

### O que será adicionado

Um novo card "Vendas por região" ao lado do card "Conversão de pagamento", na mesma linha do gráfico comparativo (grid `lg:grid-cols-5`). O layout atual será ajustado de `col-span-3 + col-span-2` para `col-span-3 + col-span-1 + col-span-1`, ou alternativamente uma nova linha abaixo.

**Conteúdo do card (dados mock):**
- Título: "Vendas por região"
- Lista ranqueada dos top 5 estados com barra de progresso, quantidade de pedidos e valor
- Indicadores: "Total de pedidos" e "Estados ativos"
- Mesmo estilo visual dos cards existentes (rounded-xl, border, bg-card, text-xs)

**Dados de exemplo:**

| # | Estado | Pedidos | Valor |
|---|--------|---------|-------|
| 1 | São Paulo | 145 | R$ 28.500 |
| 2 | Rio de Janeiro | 89 | R$ 17.200 |
| 3 | Minas Gerais | 67 | R$ 13.100 |
| 4 | Bahia | 42 | R$ 8.300 |
| 5 | Paraná | 38 | R$ 7.400 |

### Arquivo alterado
- `src/pages/Dashboard.tsx` — adicionar o card mock na seção desktop, após o bloco de "Conversão de pagamento"

### Observação
Após sua aprovação visual, implementaremos a captura real de geolocalização (migração de banco + edge function) para substituir os dados mock por dados reais.

