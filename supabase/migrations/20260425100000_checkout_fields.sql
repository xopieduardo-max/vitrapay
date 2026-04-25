-- Campos opcionais do checkout configuráveis pelo produtor
-- name: solicitar nome completo
-- cpf: solicitar CPF/CNPJ
-- phone: solicitar telefone
-- address: solicitar endereço
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS checkout_fields JSONB
    DEFAULT '{"name": true, "cpf": true, "phone": true, "address": false}'::jsonb;
