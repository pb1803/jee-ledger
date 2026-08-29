-- ============================================================================
-- Migration 0001: initial schema + Row Level Security
-- Project: Mithilesh JEE Tracker (single student)
-- Review carefully before applying (Supabase SQL editor or `supabase db push`).
--
-- Free-tier planning constraints (do NOT build cleanup logic yet):
--   DB 500 MB | Storage 1 GB | Bandwidth ~10 GB (5 GB cached + 5 GB uncached)
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profile  (1 row per auth user; created automatically on signup)
-- ---------------------------------------------------------------------------
create table if not exists public.profile (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text,
  grade         smallint check (grade in (11, 12)),
  exam_targets  text[] not null default '{JEE_MAIN,JEE_ADV,MHT_CET}',
  timezone      text not null default 'Asia/Kolkata',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profile (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- daily_logs  (one row per student per calendar day)
-- ---------------------------------------------------------------------------
create table if not exists public.daily_logs (
  id                     uuid primary key default gen_random_uuid(),
  student_id             uuid not null references public.profile (id) on delete cascade,
  log_date               date not null,
  study_duration_minutes integer not null default 0 check (study_duration_minutes >= 0),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (student_id, log_date)
);

-- ---------------------------------------------------------------------------
-- subject_daily_stats  (attempted / correct / incorrect per subject per day)
--   accuracy = correct::float / nullif(attempted, 0)
-- ---------------------------------------------------------------------------
create table if not exists public.subject_daily_stats (
  id         uuid primary key default gen_random_uuid(),
  daily_log_id uuid not null references public.daily_logs (id) on delete cascade,
  subject    text not null check (subject in ('PHYSICS', 'CHEMISTRY', 'MATHEMATICS')),
  attempted  integer not null default 0 check (attempted >= 0),
  correct    integer not null default 0 check (correct >= 0),
  incorrect  integer not null default 0 check (incorrect >= 0),
  check (correct + incorrect <= attempted),
  unique (daily_log_id, subject)
);

-- ---------------------------------------------------------------------------
-- topics  (curated + student-created; weak/strong derived from stats later)
-- ---------------------------------------------------------------------------
create table if not exists public.topics (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profile (id) on delete cascade,
  subject    text not null check (subject in ('PHYSICS', 'CHEMISTRY', 'MATHEMATICS')),
  name       text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- important_questions  (ONE model, 3 input types: IMAGE / TEXT / URL)
--   Only the field required by input_type may be populated (enforced by CHECK).
--   Images are NOT stored in Postgres; image_path is a Supabase Storage key.
--   OCR (later phase) writes verified text into question_text for TEXT rows.
-- ---------------------------------------------------------------------------
create table if not exists public.important_questions (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.profile (id) on delete cascade,
  question_name    text not null,
  subject          text not null check (subject in ('PHYSICS', 'CHEMISTRY', 'MATHEMATICS')),
  topic_id         uuid references public.topics (id) on delete set null,
  topic_text       text,
  source           text,
  priority         text not null default 'MEDIUM' check (priority in ('LOW', 'MEDIUM', 'HIGH')),
  input_type       text not null check (input_type in ('IMAGE', 'TEXT', 'URL')),
  question_text    text,
  image_path       text,
  external_url     text,
  notes            text,
  revision_status  text not null default 'NOT_STARTED'
                    check (revision_status in ('NOT_STARTED', 'IN_PROGRESS', 'DONE')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (
    (input_type = 'TEXT'  and question_text is not null and image_path is null and external_url is null)
    or (input_type = 'IMAGE' and image_path is not null and question_text is null and external_url is null)
    or (input_type = 'URL'   and external_url is not null and question_text is null and image_path is null)
  )
);

-- ---------------------------------------------------------------------------
-- revisions  (revision history / metadata for an important question)
--   revision_status on the question reflects the latest/overall status.
-- ---------------------------------------------------------------------------
create table if not exists public.revisions (
  id            uuid primary key default gen_random_uuid(),
  question_id   uuid not null references public.important_questions (id) on delete cascade,
  revision_date date not null default current_date,
  outcome       text check (outcome in ('RECALLED', 'PARTIAL', 'FORGOTTEN')),
  notes         text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- goals  (daily / weekly / monthly)
-- ---------------------------------------------------------------------------
create table if not exists public.goals (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.profile (id) on delete cascade,
  frequency     text not null check (frequency in ('DAILY', 'WEEKLY', 'MONTHLY')),
  metric        text not null check (metric in ('QUESTIONS_SOLVED', 'STUDY_MINUTES', 'ACCURACY')),
  target_value  numeric not null check (target_value >= 0),
  period_start  date,
  period_end    date,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at trigger (shared)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profile_updated      before update on public.profile
  for each row execute function public.set_updated_at();
create trigger trg_daily_logs_updated   before update on public.daily_logs
  for each row execute function public.set_updated_at();
create trigger trg_iq_updated           before update on public.important_questions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security  (never rely on client checks alone)
-- ---------------------------------------------------------------------------
alter table public.profile            enable row level security;
alter table public.daily_logs         enable row level security;
alter table public.subject_daily_stats enable row level security;
alter table public.topics             enable row level security;
alter table public.important_questions enable row level security;
alter table public.revisions          enable row level security;
alter table public.goals              enable row level security;

-- profile
create policy profile_select_own on public.profile for select using (auth.uid() = id);
create policy profile_insert_own on public.profile for insert with check (auth.uid() = id);
create policy profile_update_own on public.profile for update using (auth.uid() = id) with check (auth.uid() = id);

-- daily_logs
create policy daily_logs_select_own on public.daily_logs for select using (auth.uid() = student_id);
create policy daily_logs_insert_own on public.daily_logs for insert with check (auth.uid() = student_id);
create policy daily_logs_update_own on public.daily_logs for update using (auth.uid() = student_id) with check (auth.uid() = student_id);
create policy daily_logs_delete_own on public.daily_logs for delete using (auth.uid() = student_id);

-- subject_daily_stats (ownership via parent daily_logs)
create policy sds_select_own on public.subject_daily_stats for select using (
  exists (select 1 from public.daily_logs dl where dl.id = daily_log_id and dl.student_id = auth.uid())
);
create policy sds_insert_own on public.subject_daily_stats for insert with check (
  exists (select 1 from public.daily_logs dl where dl.id = daily_log_id and dl.student_id = auth.uid())
);
create policy sds_update_own on public.subject_daily_stats for update using (
  exists (select 1 from public.daily_logs dl where dl.id = daily_log_id and dl.student_id = auth.uid())
) with check (
  exists (select 1 from public.daily_logs dl where dl.id = daily_log_id and dl.student_id = auth.uid())
);
create policy sds_delete_own on public.subject_daily_stats for delete using (
  exists (select 1 from public.daily_logs dl where dl.id = daily_log_id and dl.student_id = auth.uid())
);

-- topics
create policy topics_select_own on public.topics for select using (auth.uid() = student_id);
create policy topics_insert_own on public.topics for insert with check (auth.uid() = student_id);
create policy topics_update_own on public.topics for update using (auth.uid() = student_id) with check (auth.uid() = student_id);
create policy topics_delete_own on public.topics for delete using (auth.uid() = student_id);

-- important_questions
create policy iq_select_own on public.important_questions for select using (auth.uid() = student_id);
create policy iq_insert_own on public.important_questions for insert with check (auth.uid() = student_id);
create policy iq_update_own on public.important_questions for update using (auth.uid() = student_id) with check (auth.uid() = student_id);
create policy iq_delete_own on public.important_questions for delete using (auth.uid() = student_id);

-- revisions (ownership via parent question)
create policy revs_select_own on public.revisions for select using (
  exists (select 1 from public.important_questions iq where iq.id = question_id and iq.student_id = auth.uid())
);
create policy revs_insert_own on public.revisions for insert with check (
  exists (select 1 from public.important_questions iq where iq.id = question_id and iq.student_id = auth.uid())
);
create policy revs_update_own on public.revisions for update using (
  exists (select 1 from public.important_questions iq where iq.id = question_id and iq.student_id = auth.uid())
) with check (
  exists (select 1 from public.important_questions iq where iq.id = question_id and iq.student_id = auth.uid())
);
create policy revs_delete_own on public.revisions for delete using (
  exists (select 1 from public.important_questions iq where iq.id = question_id and iq.student_id = auth.uid())
);

-- goals
create policy goals_select_own on public.goals for select using (auth.uid() = student_id);
create policy goals_insert_own on public.goals for insert with check (auth.uid() = student_id);
create policy goals_update_own on public.goals for update using (auth.uid() = student_id) with check (auth.uid() = student_id);
create policy goals_delete_own on public.goals for delete using (auth.uid() = student_id);

-- ---------------------------------------------------------------------------
-- Storage bucket for IMAGE important questions
--   Path layout: question-images/{student_id}/{question_id}.ext
--   Only IMAGE questions create objects; TEXT/URL questions store zero bytes.
--   (Create the bucket + policies below in the Supabase dashboard or via CLI.)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('question-images', 'question-images', false)
on conflict (id) do nothing;

create policy qimg_upload_own on storage.objects for insert to authenticated with check (
  bucket_id = 'question-images' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy qimg_select_own on storage.objects for select to authenticated using (
  bucket_id = 'question-images' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy qimg_delete_own on storage.objects for delete to authenticated using (
  bucket_id = 'question-images' and (storage.foldername(name))[1] = auth.uid()::text
);
