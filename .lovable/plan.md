

# Auditoria Completa: create-card-payment (Asaas)

## Status Atual

A função **está deployada e executando corretamente**. Ela responde a requisições, valida campos e se comunica com a API do Asaas. O problema de "0% success rate" NÃO é um erro de código da função em si, mas sim rejeições da API do Asaas nas chamadas reais.

---

## Resultados da Auditoria

### 1. Execução da Função
- **Status**: Funcionando. Responde a requisições POST.
- **Boot time**: ~29ms (normal)
- **Logs capturados**: A função loga corretamente o payload e as respostas do Asaas.

### 2. Erros Identificados nos Logs

O único erro capturado nos logs recentes:
```
Asaas customer create response: {"errors":[{"code":"invalid_object","description":"O CPF/CNPJ informado é inválido."}]}
```
Quando o Asaas rejeita o CPF, a função retorna `customerId = null` e responde com status 400 "CPF/CNPJ inválido". A cobrança nunca chega a ser criada.

### 3. Validação do Payload ao Asaas

| Campo | Status | Observação |
|---|---|---|
| URL | OK | `https://api.asaas.com/v3/payments` |
| billingType | OK | `"CREDIT_CARD"` |
| customer | OK | ID do Asaas |
| value | OK | Convertido de centavos para reais |
| dueDate | OK | Data atual ISO |
| creditCard.holderName | OK | |
| creditCard.number | OK | Limpo com `replace(/\D/g, "")` |
| creditCard.expiryMonth | OK | |
| creditCard.expiryYear | OK | Formato `20XX` |
| creditCard.ccv | OK | |
| creditCardHolderInfo.name | OK | |
| creditCardHolderInfo.email | OK | |
| creditCardHolderInfo.cpfCnpj | OK | |
| creditCardHolderInfo.postalCode | **HARDCODED** | `"69000000"` |
| creditCardHolderInfo.addressNumber | **HARDCODED** | `"123"` |
| creditCardHolderInfo.phone | OK | Fallback `"11999999999"` |

### 4. API Key
- **Header**: `access_token` (correto para Asaas)
- **Secret ASAAS_API_KEY**: Configurada no projeto
- A função verifica se a chave existe antes de prosseguir

### 5. Dados do Cartão
- **NÃO são salvos** no banco (correto)
- Enviados diretamente ao Asaas na requisição

---

## Causas Raiz dos Falhos

### Causa 1: Valor mínimo do Asaas (R$ 5,00)
O Asaas exige valor mínimo de R$ 5,00 para cartão de crédito. Produtos com preço inferior (ex: R$ 2,99) serão rejeitados. A função não valida isso antes de chamar a API.

### Causa 2: CPF inválido
Se o comprador digita um CPF inválido, a criação do cliente falha e a função retorna erro antes de tentar criar o pagamento. A função não valida o CPF localmente.

### Causa 3: postalCode e addressNumber hardcoded
O Asaas pode rejeitar pagamentos em análise antifraude quando CEP e endereço não correspondem ao titular do cartão. Isso pode causar status `PENDING` (análise) em vez de `CONFIRMED`.

---

## Plano de Correção

### Passo 1: Adicionar validação de valor mínimo
Na edge function e no checkout, validar que o valor é >= R$ 5,00 (500 centavos) antes de tentar cartão. No checkout, desabilitar opção de cartão para valores abaixo de R$ 5,00.

### Passo 2: Adicionar validação de CPF no frontend
Implementar validação de CPF com algoritmo de dígito verificador no formulário do checkout, antes de enviar para a edge function.

### Passo 3: Coletar CEP do comprador
Adicionar campo de CEP no formulário de cartão e enviá-lo para a edge function, substituindo o valor hardcoded `"69000000"`. Isso melhora a taxa de aprovação na análise antifraude do Asaas.

### Passo 4: Melhorar logs de diagnóstico
Adicionar log do HTTP status da resposta do Asaas e log do resultado da busca de cliente, para facilitar debug futuro.

### Passo 5: Tratamento de erros mais granular
Mapear os códigos de erro do Asaas para mensagens amigáveis ao usuário (ex: "Cartão recusado pelo banco", "Saldo insuficiente", "Cartão bloqueado").

---

### Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/create-card-payment/index.ts` | Validação de valor mínimo, logs melhorados, CEP dinâmico |
| `src/pages/Checkout.tsx` | Validação CPF, campo CEP, desabilitar cartão < R$5, mensagens de erro |

