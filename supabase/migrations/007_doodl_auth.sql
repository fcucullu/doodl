-- Add auth_id to doodl_users to link anonymous room users to authenticated accounts
ALTER TABLE public.doodl_users
  ADD COLUMN IF NOT EXISTS auth_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_doodl_users_auth ON public.doodl_users(auth_id);
