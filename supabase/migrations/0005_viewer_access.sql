-- ============================================================================
-- Migration 0005: read-only parent/mentor viewer access (single student).
--
-- Access model:
--   * A viewer is a SEPARATE Supabase auth account with profile.role = 'VIEWER'.
--   * The student explicitly grants access via a viewer_access allowlist row
--     (viewer_id -> student_id). Until granted, a viewer account has NO data
--     access (RLS denies everything), so viewer self-signup is inert.
--   * All read access is enforced by RLS SELECT policies scoped to the linked
--     student. Viewers receive NO insert/update/delete policies, so they cannot
--     mutate any data. Mutations are only possible via SECURITY DEFINER helpers
--     callable by the student (grant/revoke). No service-role key is used.
-- ============================================================================

alter table public.profile
  add column if not exists role text not null default 'STUDENT'
  check (role in ('STUDENT', 'VIEWER'));

-- Store the role chosen at signup (students default to STUDENT).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profile (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email),
    case
      when new.raw_user_meta_data ->> 'role' in ('STUDENT', 'VIEWER')
      then new.raw_user_meta_data ->> 'role'
      else 'STUDENT'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create table if not exists public.viewer_access (
  viewer_id   uuid primary key references auth.users (id) on delete cascade,
  student_id  uuid not null references public.profile (id) on delete cascade,
  viewer_email text not null,
  created_at  timestamptz not null default now()
);

alter table public.viewer_access enable row level security;

-- Viewer reads their own link; student reads the grants they created.
create policy va_select_own on public.viewer_access for select using (
  auth.uid() = viewer_id or auth.uid() = student_id
);
-- Student may revoke a grant they own (delete scoped to their student_id).
create policy va_delete_student on public.viewer_access for delete using (
  auth.uid() = student_id
);

-- Grant by email (student-only). Resolves email -> auth user id internally.
create or replace function public.grant_viewer_access(viewer_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.profile where id = auth.uid() and role = 'STUDENT'
  ) then
    raise exception 'Only the student can grant viewer access.';
  end if;
  select id into v_id from auth.users where email = viewer_email limit 1;
  if v_id is null then
    raise exception 'No account found with that email.';
  end if;
  insert into public.viewer_access (viewer_id, student_id, viewer_email)
  values (v_id, auth.uid(), viewer_email)
  on conflict (viewer_id) do update set student_id = auth.uid(), viewer_email = viewer_email;
end;
$$;

-- Revoke by email (student-only).
create or replace function public.revoke_viewer_access(viewer_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profile where id = auth.uid() and role = 'STUDENT'
  ) then
    raise exception 'Only the student can revoke viewer access.';
  end if;
  delete from public.viewer_access
  where student_id = auth.uid() and viewer_email = viewer_email;
end;
$$;

-- Viewer SELECT policies on student data. No viewer INSERT/UPDATE/DELETE policies
-- exist, so mutation is impossible for viewers at the database level.
create policy profile_select_viewer on public.profile for select using (
  exists (
    select 1 from public.viewer_access va
    where va.viewer_id = auth.uid() and va.student_id = profile.id
  )
);

create policy daily_logs_select_viewer on public.daily_logs for select using (
  exists (
    select 1 from public.viewer_access va
    where va.viewer_id = auth.uid() and va.student_id = daily_logs.student_id
  )
);

create policy sds_select_viewer on public.subject_daily_stats for select using (
  exists (
    select 1 from public.daily_logs dl
    where dl.id = subject_daily_stats.daily_log_id
      and exists (
        select 1 from public.viewer_access va
        where va.viewer_id = auth.uid() and va.student_id = dl.student_id
      )
  )
);

create policy topics_select_viewer on public.topics for select using (
  exists (
    select 1 from public.viewer_access va
    where va.viewer_id = auth.uid() and va.student_id = topics.student_id
  )
);

create policy iq_select_viewer on public.important_questions for select using (
  exists (
    select 1 from public.viewer_access va
    where va.viewer_id = auth.uid() and va.student_id = important_questions.student_id
  )
);

create policy revs_select_viewer on public.revisions for select using (
  exists (
    select 1 from public.important_questions iq
    where iq.id = revisions.question_id
      and exists (
        select 1 from public.viewer_access va
        where va.viewer_id = auth.uid() and va.student_id = iq.student_id
      )
  )
);

create policy goals_select_viewer on public.goals for select using (
  exists (
    select 1 from public.viewer_access va
    where va.viewer_id = auth.uid() and va.student_id = goals.student_id
  )
);

create policy dlt_select_viewer on public.daily_log_topics for select using (
  exists (
    select 1 from public.daily_logs dl
    where dl.id = daily_log_topics.daily_log_id
      and exists (
        select 1 from public.viewer_access va
        where va.viewer_id = auth.uid() and va.student_id = dl.student_id
      )
  )
);
