-- Allow updating doodl_users (needed for last_seen_at)
CREATE POLICY "Anyone can update users" ON public.doodl_users
  FOR UPDATE USING (true) WITH CHECK (true);
