# Corrigir clique do botão "Entrar na minha conta" no Workspace

## Problema
Hoje o CTA de login fica dentro de uma `div` `fixed bottom-0 inset-x-0 p-4` com gradient transparente. Essa faixa transparente cobre ~80px da tela inteira e captura os cliques (não tem `pointer-events-none`). Resultado: quando o cursor está sobre a parte transparente acima do botão, o navegador não mostra a mãozinha e cliques nos cards atrás também podem ser bloqueados.

## Solução escolhida
Transformar em um **bloco não-fixo, posicionado no topo do perfil do produtor**, logo abaixo do avatar/nome do workspace. Ele rola junto com a página — zero chance de sobrepor nada e bloquear cliques.

## Mudanças em `src/pages/WorkspaceStorefront.tsx`

1. **Remover** o bloco `fixed bottom-0 inset-x-0 ...` (linhas ~498–513) que renderiza o CTA de login flutuante.
2. **Adicionar** o mesmo CTA como um card estático dentro do container principal, logo após o header do workspace (avatar + nome + descrição), antes da grade de produtos. Renderizar apenas quando `!user`.
3. Estilo do novo bloco:
   - Container centralizado (`max-w-md mx-auto`), `rounded-2xl`, borda usando `cardBorder`, fundo levemente elevado (`bg-white/[0.03]`).
   - Texto "Faça login para acessar seus produtos" + botão "Entrar na minha conta" (mantém `accentColor` / `accentTextColor`).
   - Padding confortável (`p-4 md:p-5`), margem inferior `mb-6` para separar da grade de produtos.
4. Manter navegação `navigate("/minha-conta")` idêntica.

## Por que resolve
- Sem `position: fixed` → não existe mais overlay invisível cobrindo cards.
- Botão sempre "clicável em toda sua área" com cursor pointer natural do `<Button>`.
- Visível assim que o cliente abre o workspace (acima da dobra no mobile e desktop), melhorando a experiência de login.

Sem mudanças de lógica, backend ou outras páginas.