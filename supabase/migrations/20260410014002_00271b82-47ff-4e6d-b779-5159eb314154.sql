-- Fix missing user_role for the "master" account
INSERT INTO public.user_roles (user_id, role, approved)
VALUES ('e73c6d4f-9c90-4cf6-aa68-24e28d5eb241', 'user', true)
ON CONFLICT DO NOTHING;