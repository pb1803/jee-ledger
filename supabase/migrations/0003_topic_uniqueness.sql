-- ============================================================================
-- Migration 0003: case-insensitive topic uniqueness per student + subject
-- Reason: topic creation currently de-dupes only client-side, so concurrent
-- requests could still insert duplicate topics. We add a DB-level unique
-- index on (student_id, subject, lower(name)) so that "Current Electricity"
-- and "current electricity" cannot coexist for the same student + subject.
-- lower(name) makes the constraint case-insensitive; it is the smallest robust
-- PostgreSQL mechanism (no new column or trigger required).
-- NOTE: applying this on a database that already contains duplicate
-- (student_id, subject, name) rows will fail — de-duplicate first. A
-- greenfield project has no such rows.
-- ============================================================================

create unique index if not exists topics_student_subject_lower_name_uniq
  on public.topics (student_id, subject, lower(name));
