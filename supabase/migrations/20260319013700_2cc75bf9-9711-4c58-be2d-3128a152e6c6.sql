INSERT INTO public.user_roles (user_id, role)
VALUES ('ab4f9f40-3bbf-44c7-a998-5b2b0cdd2744', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;