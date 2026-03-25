-- Allow users to delete their own membership
CREATE POLICY "Anyone can delete users" ON public.doodl_users
  FOR DELETE USING (true);
