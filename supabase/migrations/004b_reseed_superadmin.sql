-- ============================================================
-- Business OS — Run this if you need to reset the SuperAdmin password
-- or if the seed in 004 failed.
-- Password: changeme123
-- ============================================================

-- Delete existing superadmin and re-insert with correct hash
delete from public.bos_users where role = 'superadmin';

insert into public.bos_users (name, email, password_hash, role)
values (
  'Super Admin',
  'admin@businessos.local',
  '$2b$12$iSHR/3M4OU/Pq0rk6t0/NuaDt89kGsKD0A3wepKjO4cGxvb9sjg8K',
  'superadmin'
);

-- Verify the row was inserted
select id, name, email, role, created_at from public.bos_users;
