create table questions (
  id          uuid primary key default gen_random_uuid(),
  level       text not null,        -- A1 A2 B1 B2 C1 C2
  concept     text not null,        -- slug e.g. 'passe_compose'
  type        text not null default 'multiple_choice',
  question    text not null,
  options     jsonb not null,       -- string[]
  answer      text not null,
  explanation text not null,
  source      text not null default 'ai_generated',
  use_count   integer not null default 0,
  correct_count integer not null default 0,
  flag_count  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index questions_level_concept_idx on questions (level, concept);
create index questions_use_count_idx on questions (use_count);

-- ── Sessions (user history) ───────────────────────────────────────────────────

create table sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  level        text not null,
  concept      text not null,        -- slug
  concept_name text not null,        -- display name e.g. 'Le plus-que-parfait'
  score        integer not null,
  total        integer not null,
  created_at   timestamptz not null default now()
);

create index sessions_user_created_idx on sessions (user_id, created_at desc);

alter table sessions enable row level security;

create policy "users read own sessions"
  on sessions for select using (auth.uid() = user_id);

create policy "users insert own sessions"
  on sessions for insert with check (auth.uid() = user_id);

-- ── Concept lesson cache ──────────────────────────────────────────────────────
-- One row per (level, concept). Generated once by Mistral, reused forever.

create table concept_lessons (
  id         uuid primary key default gen_random_uuid(),
  level      text not null,
  concept    text not null,  -- slug e.g. 'futur_simple'
  lesson     jsonb not null,
  created_at timestamptz not null default now(),
  unique(level, concept)
);

create index concept_lessons_level_concept_idx on concept_lessons (level, concept);

-- ── RPC called by the API route to atomically increment use_count
create or replace function increment_use_counts(p_ids uuid[])
returns void language sql as $$
  update questions set use_count = use_count + 1 where id = any(p_ids);
$$;
