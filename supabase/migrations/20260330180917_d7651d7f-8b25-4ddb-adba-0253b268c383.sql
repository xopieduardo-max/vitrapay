
CREATE TABLE public.cart_recovery_settings (
  id integer PRIMARY KEY DEFAULT 1,
  whatsapp_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  first_delay_minutes integer NOT NULL DEFAULT 30,
  second_delay_hours integer NOT NULL DEFAULT 6,
  max_age_hours integer NOT NULL DEFAULT 23,
  whatsapp_first_message text NOT NULL DEFAULT '🛒 *Olá, {nome}!*

Notamos que você iniciou a compra do produto *{produto}*, mas o pagamento ainda não foi confirmado.

Finalize sua compra aqui:
{link}

Se já pagou, desconsidere esta mensagem.

_Equipe VitraPay_',
  whatsapp_second_message text NOT NULL DEFAULT '⏰ *Última chance, {nome}!*

O link de pagamento do produto *{produto}* vai expirar em breve.

Finalize agora antes que expire:
{link}

Se já pagou, desconsidere esta mensagem.

_Equipe VitraPay_',
  whatsapp_image_url text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cart_recovery_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage recovery settings"
  ON public.cart_recovery_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access on recovery settings"
  ON public.cart_recovery_settings FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

INSERT INTO public.cart_recovery_settings (id) VALUES (1);

ALTER TABLE public.pending_payments ADD COLUMN IF NOT EXISTS buyer_phone text;
ALTER TABLE public.pending_payments ADD COLUMN IF NOT EXISTS whatsapp_notified_at timestamp with time zone;
ALTER TABLE public.pending_payments ADD COLUMN IF NOT EXISTS whatsapp_second_notified_at timestamp with time zone;
