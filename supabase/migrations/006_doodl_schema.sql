-- Doodl schema (uses shared Supabase project)

-- Rooms
create table if not exists public.doodl_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  created_at timestamptz default now() not null
);

alter table public.doodl_rooms enable row level security;

create policy "Anyone can create rooms" on public.doodl_rooms
  for insert with check (true);
create policy "Anyone can view rooms by code" on public.doodl_rooms
  for select using (true);

-- Users (anonymous, per-room)
create table if not exists public.doodl_users (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.doodl_rooms(id) on delete cascade,
  nickname text not null,
  created_at timestamptz default now() not null
);

alter table public.doodl_users enable row level security;

create policy "Anyone can create users" on public.doodl_users
  for insert with check (true);
create policy "Anyone can view users in a room" on public.doodl_users
  for select using (true);

-- Doodles
create table if not exists public.doodl_doodles (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.doodl_rooms(id) on delete cascade,
  sender_id uuid not null references public.doodl_users(id) on delete cascade,
  image_url text not null,
  created_at timestamptz default now() not null
);

alter table public.doodl_doodles enable row level security;

create policy "Anyone can insert doodles" on public.doodl_doodles
  for insert with check (true);
create policy "Anyone can view doodles" on public.doodl_doodles
  for select using (true);

-- Reactions (one per doodle)
create table if not exists public.doodl_reactions (
  id uuid primary key default gen_random_uuid(),
  doodle_id uuid not null references public.doodl_doodles(id) on delete cascade unique,
  emoji text not null,
  created_at timestamptz default now() not null
);

alter table public.doodl_reactions enable row level security;

create policy "Anyone can react" on public.doodl_reactions
  for insert with check (true);
create policy "Anyone can update reactions" on public.doodl_reactions
  for update using (true);
create policy "Anyone can view reactions" on public.doodl_reactions
  for select using (true);

-- Indexes
create index idx_doodl_rooms_code on public.doodl_rooms(code);
create index idx_doodl_users_room on public.doodl_users(room_id);
create index idx_doodl_doodles_room on public.doodl_doodles(room_id);
create index idx_doodl_doodles_created on public.doodl_doodles(created_at);

-- Storage bucket for doodle images
insert into storage.buckets (id, name, public) values ('doodles', 'doodles', true)
on conflict (id) do nothing;

-- Storage policies
create policy "Anyone can upload doodles" on storage.objects
  for insert with check (bucket_id = 'doodles');
create policy "Anyone can view doodles" on storage.objects
  for select using (bucket_id = 'doodles');

-- Enable realtime for doodles and reactions
alter publication supabase_realtime add table public.doodl_doodles;
alter publication supabase_realtime add table public.doodl_reactions;
