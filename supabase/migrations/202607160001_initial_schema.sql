create extension if not exists pgcrypto;

create type public.entry_status as enum ('draft', 'queued', 'analyzing', 'completed', 'failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  locale text not null default 'ko-KR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create schema if not exists private;

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1), '독자'));
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure private.handle_new_user();

create table public.personas (
  id text primary key,
  name text not null,
  role text not null,
  description text not null,
  system_prompt text not null,
  prompt_version text not null,
  default_language text not null default 'ko',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  persona_id text not null references public.personas(id),
  title text not null default '',
  body text not null default '',
  status public.entry_status not null default 'draft',
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check (char_length(title) <= 160),
  check (char_length(body) <= 50000)
);

create index entries_user_created_idx on public.entries(user_id, created_at desc);

create table public.emotion_analyses (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null unique references public.entries(id) on delete cascade,
  model text not null,
  model_version text not null,
  summary text not null,
  dominant_emotion text,
  raw_output jsonb,
  created_at timestamptz not null default now()
);

create table public.emotion_scores (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.emotion_analyses(id) on delete cascade,
  emotion text not null,
  score numeric(5,4) not null check (score between 0 and 1),
  evidence text,
  unique (analysis_id, emotion)
);

create table public.generated_comments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  persona_id text not null references public.personas(id),
  prompt_version text not null,
  model text not null,
  model_version text not null,
  language text not null default 'ko',
  content text not null,
  translated_content text,
  safety_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index generated_comments_entry_idx on public.generated_comments(entry_id, created_at desc);

create table public.sound_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  sound_key text not null default 'rain',
  volume numeric(4,3) not null default 0.35 check (volume between 0 and 1),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.entries enable row level security;
alter table public.emotion_analyses enable row level security;
alter table public.emotion_scores enable row level security;
alter table public.generated_comments enable row level security;
alter table public.sound_preferences enable row level security;
alter table public.personas enable row level security;

create policy "profiles own row" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "personas public read" on public.personas for select using (is_active = true);
create policy "entries own rows" on public.entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "analyses through owned entries" on public.emotion_analyses for select using (exists (select 1 from public.entries e where e.id = entry_id and e.user_id = auth.uid()));
create policy "scores through owned entries" on public.emotion_scores for select using (exists (select 1 from public.emotion_analyses a join public.entries e on e.id = a.entry_id where a.id = analysis_id and e.user_id = auth.uid()));
create policy "comments through owned entries" on public.generated_comments for select using (exists (select 1 from public.entries e where e.id = entry_id and e.user_id = auth.uid()));
create policy "sound preferences own row" on public.sound_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant usage on schema public to authenticated;
grant select on public.personas to authenticated;
grant select, insert, update, delete on public.entries to authenticated;

insert into public.personas (id, name, role, description, system_prompt, prompt_version, default_language) values
  ('listener', '다온', '차분한 경청자', '판단 없이 감정의 결을 짚는 독자', 'See docs/persona-guidelines.md', '1.0', 'ko'),
  ('penpal', 'Alex', '외국인 펜팔', '자연스러운 영어 편지로 답하는 독자', 'See docs/persona-guidelines.md', '1.0', 'en'),
  ('librarian', '해온', '밤의 사서', '이미지와 시간의 흐름을 읽는 독자', 'See docs/persona-guidelines.md', '1.0', 'ko');
