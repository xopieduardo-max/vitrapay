

# Melhorar a Página de Instalação PWA (`/install`)

## O que será feito

Redesign da página `/install` para ficar mais moderna, visualmente rica e alinhada com a identidade visual do VitraPay (tema escuro, amarelo como cor primária).

## Melhorias planejadas

### 1. Hero mais impactante
- Usar o mockup `celular_vitra.png` ou `iphone-3d-mockup.png` (assets 3D já existentes) no lugar do `app-mockup.png` dentro do IPhoneFrame
- Adicionar glow amarelo sutil atrás do celular (consistente com o estilo da Landing)
- Logo VitraPay no topo em vez do ícone genérico

### 2. Steps com visual melhorado
- Adicionar uma **timeline vertical** conectando os passos (linha contínua com dots numerados)
- Step ativo com animação de pulse no indicador
- Ícones maiores e mais distintos para cada passo (usar ícones reais do iOS/Android em vez de caracteres texto como "↑", "⋮")

### 3. Seção de benefícios redesenhada
- Layout em lista horizontal scrollável em mobile (carrossel) em vez de grid 2x2
- Cards com gradiente sutil e ícone com glow

### 4. Botão de instalação nativo (beforeinstallprompt)
- Capturar o evento `beforeinstallprompt` do navegador (Android/Chrome)
- Mostrar um botão "Instalar agora" que dispara o prompt nativo quando disponível
- Fallback para as instruções manuais quando o prompt não está disponível

### 5. Animações e polish
- Fundo escuro com gradiente radial amarelo sutil (consistente com Landing)
- Transição suave entre plataformas iOS/Android
- Progress indicator mostrando em qual passo o usuário está

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/pages/Install.tsx` | Redesign completo da página |
| `src/components/IPhoneFrame.tsx` | Sem alteração (reutilizado) |

## Detalhes técnicos

- Captura do `beforeinstallprompt` via `useEffect` + `useState` para armazenar o evento
- Timeline vertical usando CSS (border-left + circles posicionados)
- Manter detecção automática de plataforma existente
- Manter verificação de `display-mode: standalone` para estado "já instalado"
- Usar assets 3D existentes (`iphone-3d-mockup.png`) para o hero

