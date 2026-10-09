create table if not exists public.quiz_rush_sessions (
  id text primary key,
  document_id uuid not null references public.documents(id) on delete cascade,
  questions jsonb not null,
  responses jsonb not null default '[]'::jsonb,
  answered_count integer not null default 0 check (answered_count >= 0 and answered_count <= 10),
  score integer not null default 0 check (score >= 0),
  streak integer not null default 0 check (streak >= 0),
  best_streak integer not null default 0 check (best_streak >= 0),
  xp integer not null default 0 check (xp >= 0),
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.quiz_rush_sessions enable row level security;
