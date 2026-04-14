-- Add email template fields to cart_recovery_settings
ALTER TABLE public.cart_recovery_settings
  ADD COLUMN IF NOT EXISTS email_first_subject TEXT NOT NULL DEFAULT 'Você esqueceu algo, {nome}!',
  ADD COLUMN IF NOT EXISTS email_first_body TEXT NOT NULL DEFAULT 'Olá {nome},

Notamos que você iniciou a compra de {produto} mas não finalizou o pagamento.

Clique no link abaixo para completar sua compra:
{link}

Se precisar de ajuda, é só responder este email.

Equipe VitraPay',
  ADD COLUMN IF NOT EXISTS email_second_subject TEXT NOT NULL DEFAULT 'Última chance — {produto} ainda está disponível',
  ADD COLUMN IF NOT EXISTS email_second_body TEXT NOT NULL DEFAULT 'Olá {nome},

Seu link de pagamento para {produto} está prestes a expirar.

Finalize agora antes que seja tarde:
{link}

Equipe VitraPay';
