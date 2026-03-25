-- Push notification subscriptions for Doodl
CREATE TABLE IF NOT EXISTS public.doodl_push_subs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.doodl_users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  keys_p256dh text NOT NULL,
  keys_auth text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.doodl_push_subs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert push subs" ON public.doodl_push_subs
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view push subs" ON public.doodl_push_subs
  FOR SELECT USING (true);
CREATE POLICY "Anyone can delete push subs" ON public.doodl_push_subs
  FOR DELETE USING (true);
