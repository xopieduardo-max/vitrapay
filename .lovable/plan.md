

## Plano: Adicionar filtro Estado/Cidade na seção "Vendas por Região"

### O que será feito

Adicionar um toggle/tabs "Estado" / "Cidade" no header do card de vendas por região, permitindo alternar entre a visualização por estado (atual) e por cidade.

### Alterações em `src/pages/Dashboard.tsx`

1. **Adicionar estado local** `regionView` com valores `'state' | 'city'`
2. **Adicionar tabs no header** do card (ao lado do título "Vendas por região") com dois botões: "Estado" e "Cidade"
3. **Criar dados mock de cidades** para exibir quando o filtro "Cidade" estiver selecionado:

| # | Cidade | Pedidos | Valor |
|---|--------|---------|-------|
| 1 | São Paulo - SP | 98 | R$ 19.200 |
| 2 | Rio de Janeiro - RJ | 64 | R$ 12.500 |
| 3 | Belo Horizonte - MG | 41 | R$ 8.000 |
| 4 | Salvador - BA | 29 | R$ 5.700 |
| 5 | Curitiba - PR | 25 | R$ 4.900 |

4. **Renderizar condicionalmente** a lista de estados ou cidades com base no filtro selecionado
5. **Atualizar os indicadores** ("Total de pedidos" e "Cidades/Estados ativos") conforme o filtro

### Visual dos tabs
Dois botões pequenos estilizados como pills/chips no header, usando o mesmo padrão visual dos filtros de período já existentes no dashboard (bg-muted para inativo, bg-primary para ativo).

