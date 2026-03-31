-- ============================================================
-- Business OS — Seed Migration 003
-- Function to initialize profile reviews for a new user
-- ============================================================

-- This function is called after user signup to create
-- the default LinkedIn and GitHub review checklist items

create or replace function public.initialize_profile_reviews(uid uuid)
returns void as $$
declare
  linkedin_sections text[] := array[
    'Headline & banner image',
    'About section',
    'Featured section',
    'Experience descriptions',
    'Skills & endorsements',
    'Recommendations',
    'Activity & posting frequency'
  ];
  github_sections text[] := array[
    'Pinned Repos (6 best projects)',
    'README quality per pinned repo',
    'Profile README',
    'Contribution graph health',
    'Project descriptions',
    'Live demo links',
    'Tech stack accuracy'
  ];
  s text;
begin
  foreach s in array linkedin_sections loop
    insert into public.profile_reviews (user_id, platform, section, next_review_at)
    values (uid, 'linkedin', s, now() + interval '90 days')
    on conflict do nothing;
  end loop;

  foreach s in array github_sections loop
    insert into public.profile_reviews (user_id, platform, section, next_review_at)
    values (uid, 'github', s, now() + interval '90 days')
    on conflict do nothing;
  end loop;
end;
$$ language plpgsql security definer;

-- Auto-initialize profile reviews on new user signup
-- This trigger fires when a new row is inserted into auth.users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  perform public.initialize_profile_reviews(new.id);
  return new;
end;
$$ language plpgsql security definer;

-- Note: The trigger on auth.users requires superadmin access.
-- Run this manually in the Supabase SQL editor:
--
-- create trigger on_auth_user_created
--   after insert on auth.users
--   for each row execute function public.handle_new_user();
--
-- Alternatively, call initialize_profile_reviews(user_id) from your
-- application code after successful signup.
