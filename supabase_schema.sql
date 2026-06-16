-- Drop existing objects cleanly
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop table if exists public.applications cascade;
drop table if exists public.resumes cascade;
drop table if exists public.users cascade;

-- Users table
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  plan text default 'free',
  tailors_used_this_month int default 0,
  plan_reset_date date default now(),
  created_at timestamptz default now()
);

-- Base resumes
create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  name text not null,
  raw_text text not null,
  parsed_json jsonb,
  file_url text,
  is_default boolean default false,
  created_at timestamptz default now()
);

-- Tailored applications
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  resume_id uuid references public.resumes(id),
  company text,
  role text,
  jd_text text not null,
  jd_url text,
  tailored_json jsonb,
  pdf_url text,
  ats_score int,
  status text default 'applied',
  created_at timestamptz default now()
);

-- Row Level Security
alter table public.users enable row level security;
alter table public.resumes enable row level security;
alter table public.applications enable row level security;

create policy "users_own_data" on public.users for all using (auth.uid() = id);
create policy "resumes_own_data" on public.resumes for all using (auth.uid() = user_id);
create policy "applications_own_data" on public.applications for all using (auth.uid() = user_id);

-- Auto-create user profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
