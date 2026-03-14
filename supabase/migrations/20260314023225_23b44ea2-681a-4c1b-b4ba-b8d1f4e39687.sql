
-- Coupons table
CREATE TABLE public.coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    code TEXT NOT NULL,
    discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value INTEGER NOT NULL,
    max_uses INTEGER,
    uses INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (producer_id, code)
);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Producers can manage own coupons" ON public.coupons FOR ALL USING (auth.uid() = producer_id);
CREATE POLICY "Anyone can read active coupons" ON public.coupons FOR SELECT USING (is_active = true);

-- Order bumps table
CREATE TABLE public.order_bumps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    bump_product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    discount_percentage INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_bumps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Producers can manage bumps" ON public.order_bumps FOR ALL USING (
    EXISTS (SELECT 1 FROM public.products WHERE id = product_id AND producer_id = auth.uid())
);
CREATE POLICY "Anyone can view active bumps" ON public.order_bumps FOR SELECT USING (is_active = true);

-- Upsells / Downsells (funnel steps)
CREATE TABLE public.funnel_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    offer_product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    step_type TEXT NOT NULL CHECK (step_type IN ('upsell', 'downsell')),
    title TEXT NOT NULL,
    description TEXT,
    discount_percentage INTEGER DEFAULT 0,
    position INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.funnel_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Producers can manage funnels" ON public.funnel_steps FOR ALL USING (
    EXISTS (SELECT 1 FROM public.products WHERE id = product_id AND producer_id = auth.uid())
);
CREATE POLICY "Anyone can view active steps" ON public.funnel_steps FOR SELECT USING (is_active = true);

-- Modules for LMS products
CREATE TABLE public.modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Producers can manage modules" ON public.modules FOR ALL USING (
    EXISTS (SELECT 1 FROM public.products WHERE id = product_id AND producer_id = auth.uid())
);
CREATE POLICY "Users with access can view modules" ON public.modules FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.product_access WHERE product_id = modules.product_id AND user_id = auth.uid())
);

-- Lessons inside modules
CREATE TABLE public.lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT,
    content TEXT,
    duration_minutes INTEGER DEFAULT 0,
    position INTEGER DEFAULT 0,
    is_free BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Producers can manage lessons" ON public.lessons FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.modules m
        JOIN public.products p ON p.id = m.product_id
        WHERE m.id = lessons.module_id AND p.producer_id = auth.uid()
    )
);
CREATE POLICY "Users with access can view lessons" ON public.lessons FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.modules m
        JOIN public.product_access pa ON pa.product_id = m.product_id
        WHERE m.id = lessons.module_id AND pa.user_id = auth.uid()
    ) OR is_free = true
);

-- Lesson progress
CREATE TABLE public.lesson_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
    completed BOOLEAN DEFAULT false,
    progress_seconds INTEGER DEFAULT 0,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, lesson_id)
);
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own progress" ON public.lesson_progress FOR ALL USING (auth.uid() = user_id);

-- Withdrawals / Finance
CREATE TABLE public.withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
    pix_key TEXT,
    pix_key_type TEXT CHECK (pix_key_type IN ('cpf', 'email', 'phone', 'random')),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own withdrawals" ON public.withdrawals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can request withdrawals" ON public.withdrawals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage withdrawals" ON public.withdrawals FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Add checkout config columns to products
ALTER TABLE public.products
    ADD COLUMN checkout_banner_url TEXT,
    ADD COLUMN checkout_timer_minutes INTEGER DEFAULT 0,
    ADD COLUMN checkout_headline TEXT;
