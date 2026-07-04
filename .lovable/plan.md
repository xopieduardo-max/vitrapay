## Objetivo
Deixar a geração da senha inicial do comprador flexível conforme os campos que o produtor mantiver ativos no checkout, e sempre comunicar a senha por e-mail.

## Regra de senha (prioridade)
1. **CPF ligado** → 6 primeiros dígitos do CPF (comportamento atual)
2. **CPF desligado + Telefone ligado** → 6 primeiros dígitos do telefone (só números, ignora DDI/máscara)
3. **CPF e Telefone desligados** → senha aleatória numérica de 6 dígitos gerada pela plataforma

Em todos os casos:
- Conta continua sendo criada automaticamente após a compra
- `must_change_password = true` para forçar troca no primeiro login
- E-mail de acesso sempre mostra a senha inicial e explica de onde ela veio

## O que muda no código

### 1. `supabase/functions/_shared/auto-create-buyer.ts`
- Adicionar parâmetro `buyerPhone` e `checkoutSettings` (quais campos estão ativos no produto)
- Refatorar `buildCpfPassword()` para nova função `buildInitialPassword({ cpf, phone, cpfEnabled, phoneEnabled })` seguindo a prioridade acima
- Retornar `passwordSource: 'cpf' | 'phone' | 'random'` e a senha real (quando aleatória) para o chamador enviar no e-mail

### 2. `supabase/functions/process-purchase/index.ts` (e demais chamadores)
- Passar `buyer_phone` e ler as flags do produto (`ask_cpf`, `ask_phone` — ou nomes equivalentes no schema atual) ao chamar `autoCreateBuyerAccount`
- Repassar `passwordSource` + senha para o envio do e-mail de acesso

### 3. E-mail de acesso ao produto (`send-purchase-email` / template correspondente)
- Sempre incluir bloco "Sua senha de acesso"
- Texto condicional:
  - CPF: "Use os **6 primeiros dígitos do seu CPF** como senha."
  - Telefone: "Use os **6 primeiros dígitos do seu telefone** como senha."
  - Aleatória: "Sua senha temporária é **XXXXXX**. Você poderá alterá-la após o primeiro acesso."
- Manter aviso de troca obrigatória no primeiro login

### 4. Login (`MinhaContaLogin.tsx`)
- Atualizar texto de dica abaixo do formulário para refletir as 3 possibilidades ("CPF, telefone ou senha enviada por e-mail")

## Pontos técnicos
- Ler `products.ask_cpf` / `ask_phone` (confirmar nomes exatos no schema durante a implementação) para decidir a fonte
- Sanitizar telefone: `phone.replace(/\D/g, '')` e pegar os últimos 6 se começar com DDI — decisão: **primeiros 6 dígitos após remover DDI 55** para evitar colidir com prefixo de país
- Senha aleatória: 6 dígitos numéricos via `crypto.getRandomValues` (fácil digitar no mobile)
- Sem migração de banco necessária; `must_change_password` já existe em `profiles`

## Fora do escopo
- Mudar UI do produtor (toggles já existem)
- Alterar fluxo de compradores antigos (só afeta contas criadas a partir de agora)
