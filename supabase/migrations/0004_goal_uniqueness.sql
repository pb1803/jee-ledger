-- ============================================================================
-- Migration 0004: enforce a single active goal per (student, frequency, metric)
-- Reason: the goals table allows many rows, but the app only ever wants ONE
-- active DAILY + QUESTIONS_SOLVED target (and optionally one DAILY + STUDY_MINUTES).
-- Without a uniqueness constraint, a second insert would create a duplicate that
-- the dashboard/daily-log "maybeSingle()" reads ambiguously. This index makes
-- the invariant real at the database level. We also forbid non-positive targets.
-- Applied manually after review (never edit committed migrations).
-- ============================================================================

create unique index if not exists goals_student_frequency_metric_uniq
  on public.goals (student_id, frequency, metric);

alter table public.goals
  drop constraint if exists goals_positive_target;

alter table public.goals
  add constraint goals_positive_target check (target_value > 0);
