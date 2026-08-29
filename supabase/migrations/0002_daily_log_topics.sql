-- ============================================================================
-- Migration 0002: daily_log <-> topics join table
-- Reason: the Phase 1 schema has `daily_logs`, `topics`, and
-- `subject_daily_stats` but NO relationship linking "which topics were studied
-- on a given day". A student studies many topics on many days, so this is a
-- many-to-many relationship that cannot be represented without a join table.
-- Rather than add a topic column to daily_logs (wrong: a day has many topics)
-- or to subject_daily_stats (wrong: splits topics per subject row awkwardly),
-- we add a dedicated join table. This is the smallest correct addition and
-- keeps the existing subject_daily_stats (attempted/correct/incorrect) intact.
-- ============================================================================

create table if not exists public.daily_log_topics (
  daily_log_id uuid not null references public.daily_logs (id) on delete cascade,
  topic_id     uuid not null references public.topics (id) on delete cascade,
  primary key (daily_log_id, topic_id)
);

-- Ownership is resolved through the parent daily_log row.
alter table public.daily_log_topics enable row level security;

create policy dlt_select_own on public.daily_log_topics for select using (
  exists (
    select 1 from public.daily_logs dl
    where dl.id = daily_log_id and dl.student_id = auth.uid()
  )
);

create policy dlt_insert_own on public.daily_log_topics for insert with check (
  exists (
    select 1 from public.daily_logs dl
    where dl.id = daily_log_id and dl.student_id = auth.uid()
  )
);

create policy dlt_delete_own on public.daily_log_topics for delete using (
  exists (
    select 1 from public.daily_logs dl
    where dl.id = daily_log_id and dl.student_id = auth.uid()
  )
);
