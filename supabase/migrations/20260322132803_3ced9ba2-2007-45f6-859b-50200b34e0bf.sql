
CREATE TABLE public.help_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'HelpCircle',
  position INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.help_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.help_categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  position INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.help_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active help categories" ON public.help_categories FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Admins can manage help categories" ON public.help_categories FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can read active help articles" ON public.help_articles FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Admins can manage help articles" ON public.help_articles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Seed initial categories and articles relevant to VitraPay
INSERT INTO public.help_categories (title, description, icon, position) VALUES
  ('Primeiros Passos', 'Guias para começar a usar a plataforma, criar sua conta e configurar seu perfil.', 'Rocket', 0),
  ('Produtos', 'Como cadastrar produtos, configurar preços, área de membros e gerenciar seu catálogo.', 'Package', 1),
  ('Checkout e Vendas', 'Personalize seu checkout, acompanhe vendas e otimize suas conversões.', 'ShoppingBag', 2),
  ('Finanças e Saques', 'Taxas, prazos de recebimento, como solicitar saques e entender seu extrato.', 'Landmark', 3),
  ('Afiliados', 'Como funciona o programa de afiliados, comissões e como se afiliar a produtos.', 'Users', 4),
  ('Integrações', 'Configure pixels, UTMify, webhooks e outras integrações para rastrear suas vendas.', 'Plug', 5),
  ('Compradores', 'Ajuda para quem comprou: como acessar o produto, solicitar estorno e mais.', 'FileText', 6),
  ('Área de Membros', 'Configure módulos, aulas e gerencie o acesso dos alunos ao seu conteúdo.', 'GraduationCap', 7);

INSERT INTO public.help_articles (category_id, title, content, position) VALUES
  ((SELECT id FROM public.help_categories WHERE title = 'Primeiros Passos'), 'Como criar sua conta na VitraPay', '## Como criar sua conta\n\n1. Acesse **vitrapay.com** e clique em **Criar Conta**\n2. Preencha seus dados: nome, e-mail e senha\n3. Confirme seu e-mail clicando no link enviado\n4. Faça login e complete o quiz de onboarding\n5. Pronto! Você já está na plataforma\n\n> **Dica:** Complete a verificação do seu perfil em **Perfil** para poder vender produtos.', 0),
  ((SELECT id FROM public.help_categories WHERE title = 'Primeiros Passos'), 'Como verificar meu perfil', '## Verificação de Perfil\n\nPara vender na VitraPay, você precisa verificar seus dados:\n\n1. Clique no seu avatar no canto superior direito\n2. Vá em **Perfil**\n3. Preencha CPF, telefone e endereço completo\n4. Cadastre sua chave Pix\n5. Clique em **Verificar e Salvar**\n\nApós a verificação, você poderá criar produtos e receber pagamentos.', 1),
  ((SELECT id FROM public.help_categories WHERE title = 'Produtos'), 'Como cadastrar um produto', '## Cadastrando seu produto\n\n1. Vá em **Meus Produtos** no menu lateral\n2. Clique em **Criar Produto**\n3. Preencha título, descrição e preço\n4. Faça upload da capa e do arquivo do produto\n5. Configure as opções de afiliação\n6. Publique seu produto\n\n> **Importante:** Seu perfil precisa estar verificado para criar produtos.', 0),
  ((SELECT id FROM public.help_categories WHERE title = 'Checkout e Vendas'), 'Como personalizar seu checkout', '## Personalizando o Checkout\n\n1. Vá em **Meus Produtos** e clique em **Editar** no produto desejado\n2. Acesse a aba **Checkout**\n3. Personalize:\n   - **Tema:** Claro ou Escuro\n   - **Banner:** Adicione uma imagem de destaque\n   - **Headline:** Texto persuasivo acima do formulário\n   - **Timer:** Defina um cronômetro de urgência\n   - **Depoimentos:** Adicione provas sociais\n4. Salve as alterações', 0),
  ((SELECT id FROM public.help_categories WHERE title = 'Checkout e Vendas'), 'Como consultar minhas vendas', '## Consultando suas vendas\n\n1. No menu lateral, clique em **Vendas** → **Minhas Vendas**\n2. Você verá todas as vendas com status, valor e data\n3. Use os filtros para buscar por período ou status\n4. Clique em uma venda para ver detalhes completos\n\n> **Dica:** Ative as notificações push em **Perfil** para receber alertas de venda no celular.', 1),
  ((SELECT id FROM public.help_categories WHERE title = 'Finanças e Saques'), 'Como solicitar um saque', '## Solicitando um saque\n\n1. Vá em **Vendas** → **Financeiro**\n2. Verifique seu saldo disponível\n3. Digite o valor que deseja sacar (mínimo R$ 10,00)\n4. Confirme sua chave Pix e o valor líquido (taxa de R$ 5,00)\n5. Clique em **Confirmar Saque**\n\n### Prazos\n- **Pix:** Saldo liberado imediatamente (D+0)\n- **Cartão:** Saldo liberado em 2 dias (D+2)\n\n> Certifique-se de ter cadastrado sua chave Pix no **Perfil**.', 0),
  ((SELECT id FROM public.help_categories WHERE title = 'Finanças e Saques'), 'Minhas taxas', '## Taxas da VitraPay\n\n| Item | Valor |\n|------|-------|\n| Taxa por venda | Configurada pelo admin |\n| Taxa de saque | R$ 5,00 por operação |\n| Saque mínimo | R$ 10,00 |\n\nAs taxas são descontadas automaticamente no momento da venda e do saque.', 1),
  ((SELECT id FROM public.help_categories WHERE title = 'Afiliados'), 'Como se afiliar a um produto', '## Afiliando-se a um produto\n\n1. Vá em **Marketplace**\n2. Encontre o produto desejado\n3. Clique em **Afiliar-se**\n4. Seu link de afiliado será gerado automaticamente\n5. Compartilhe o link e ganhe comissões a cada venda\n\n### Comissões\nA comissão é definida pelo produtor e pode variar de produto para produto. O saldo de comissões segue o prazo D+2.', 0),
  ((SELECT id FROM public.help_categories WHERE title = 'Integrações'), 'Como configurar o pixel do Facebook', '## Configurando o Pixel do Facebook\n\n1. Acesse o **Gerenciador de Eventos** do Facebook\n2. Crie ou selecione um Pixel\n3. Copie o **ID do Pixel** (número de 15-16 dígitos)\n4. Na VitraPay, vá em **Meus Produtos** → **Editar** → aba **Pixels**\n5. Adicione um pixel **Facebook** com o ID copiado\n6. Salve\n\n### Eventos disparados\n- **PageView:** Ao carregar o checkout\n- **InitiateCheckout:** Ao preencher dados\n- **Purchase:** Ao confirmar o pagamento\n\n> **Teste:** Instale a extensão **Meta Pixel Helper** no Chrome para verificar.', 0),
  ((SELECT id FROM public.help_categories WHERE title = 'Integrações'), 'Como integrar com a UTMify', '## Integrando com a UTMify\n\n1. Acesse sua conta na **UTMify**\n2. Vá em **Configurações** → **API**\n3. Copie seu **Token de API**\n4. Na VitraPay, vá em **Integrações**\n5. Na seção **UTMify**, cole o token e ative\n\nTodas as vendas confirmadas serão enviadas automaticamente para a UTMify com os parâmetros UTM capturados no checkout.', 1),
  ((SELECT id FROM public.help_categories WHERE title = 'Compradores'), 'Como acessar o produto que comprei', '## Acessando seu produto\n\n1. Após a compra, você receberá um e-mail com o link de acesso\n2. Crie sua conta na VitraPay (se ainda não tiver)\n3. Vá em **Minhas Compras** no menu lateral\n4. Clique no produto para acessar o conteúdo\n\n> **Importante:** Use o mesmo e-mail da compra para criar sua conta.', 0),
  ((SELECT id FROM public.help_categories WHERE title = 'Compradores'), 'Como solicitar estorno', '## Solicitando estorno\n\nSe você deseja cancelar uma compra dentro do período de garantia (7 dias):\n\n1. Entre em contato com o produtor do produto\n2. Solicite o estorno informando o motivo\n3. O produtor processará o estorno pela plataforma\n\n> O prazo de garantia padrão é de **7 dias** após a compra.', 1),
  ((SELECT id FROM public.help_categories WHERE title = 'Área de Membros'), 'Como criar sua Área de Membros', '## Criando a Área de Membros\n\n1. Crie um produto do tipo **Curso Online (LMS)**\n2. Após criar, vá em **Editar Produto**\n3. Na aba **Conteúdo**, adicione **Módulos**\n4. Dentro de cada módulo, adicione **Aulas**\n5. Configure o título, descrição e URL do vídeo de cada aula\n6. Publique o produto\n\nOs compradores terão acesso automático à área de membros após o pagamento.', 0);
