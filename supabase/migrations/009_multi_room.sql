-- Add room name (editable)
ALTER TABLE public.doodl_rooms
  ADD COLUMN IF NOT EXISTS name text;

-- Allow anyone to update room name
CREATE POLICY "Anyone can update room name" ON public.doodl_rooms
  FOR UPDATE USING (true) WITH CHECK (true);
