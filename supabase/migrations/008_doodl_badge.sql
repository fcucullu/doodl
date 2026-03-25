-- Track when a user last viewed the feed, for badge count
ALTER TABLE public.doodl_users
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now();
