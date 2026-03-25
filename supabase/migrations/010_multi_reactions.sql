-- Allow multiple reactions per doodle (one per user per doodle)
-- Drop the old unique constraint on doodle_id
ALTER TABLE public.doodl_reactions
  DROP CONSTRAINT IF EXISTS doodl_reactions_doodle_id_key;

-- Add reactor_id to track who reacted
ALTER TABLE public.doodl_reactions
  ADD COLUMN IF NOT EXISTS reactor_id uuid REFERENCES public.doodl_users(id) ON DELETE CASCADE;

-- One reaction per user per doodle
CREATE UNIQUE INDEX IF NOT EXISTS idx_doodl_reactions_user_doodle
  ON public.doodl_reactions(doodle_id, reactor_id);
