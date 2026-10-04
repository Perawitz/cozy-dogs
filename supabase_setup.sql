create table if not exists game_data (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);
alter table game_data enable row level security;
grant all on table public.game_data to service_role;
