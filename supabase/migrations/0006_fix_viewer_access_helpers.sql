-- ============================================================================
-- Migration 0006: fix viewer_access helper functions (0005 already applied).
--
-- Fixes ambiguous parameter/column references in grant_viewer_access() and
-- revoke_viewer_access(), and hardens grant_viewer_access() so it can only
-- grant access to accounts whose profile.role = 'VIEWER' (never to another
-- STUDENT account). Uses CREATE OR REPLACE FUNCTION; no table or RLS changes.
-- ============================================================================

-- Grant by email (student-only). Resolves email -> auth user id internally,
-- and only permits granting access to a VIEWER account.
create or replace function public.grant_viewer_access(p_viewer_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid;
  v_role text;
begin
  if not exists (
    select 1 from public.profile where id = auth.uid() and role = 'STUDENT'
  ) then
    raise exception 'Only the student can grant viewer access.';
  end if;

  select u.id, p.role
    into v_id, v_role
  from auth.users u
  join public.profile p on p.id = u.id
  where u.email = p_viewer_email
  limit 1;

  if v_id is null then
    raise exception 'No account found with that email.';
  end if;

  if v_role <> 'VIEWER' then
    raise exception 'That account is not a viewer/mentor account.';
  end if;

  insert into public.viewer_access (viewer_id, student_id, viewer_email)
  values (v_id, auth.uid(), p_viewer_email)
  on conflict (viewer_id) do update
    set student_id   = auth.uid(),
        viewer_email = p_viewer_email;
end;
$$;

-- Revoke by email (student-only). Deletes only the row owned by the caller.
create or replace function public.revoke_viewer_access(p_viewer_email text)
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
  where student_id  = auth.uid()
    and viewer_email = p_viewer_email;
end;
$$;
