-- AuthorBIO / InkFold database setup
-- Run once in Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null,
  bio text not null default '',
  avatar_url text not null default '',
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text not null default '',
  url text not null check (url ~ '^https?://'),
  category text not null default 'General'
    check (category in ('Book', 'Article', 'Story', 'Repository', 'Podcast', 'General')),
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.profiles enable row level security;
alter table public.works enable row level security;

drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
create policy "Public profiles are viewable by everyone"
  on public.profiles for select using (true);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Public works are viewable by everyone" on public.works;
create policy "Public works are viewable by everyone"
  on public.works for select using (true);

drop policy if exists "Users can insert their own works" on public.works;
create policy "Users can insert their own works"
  on public.works for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own works" on public.works;
create policy "Users can update their own works"
  on public.works for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own works" on public.works;
create policy "Users can delete their own works"
  on public.works for delete to authenticated
  using (auth.uid() = user_id);

-- Create a profile when a new auth user signs up. This works even when email
-- confirmation is enabled and the browser does not yet have an authenticated session.
create or replace function public.handle_new_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
  requested_display_name text;
begin
  requested_username := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  requested_display_name := trim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));

  if requested_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'Username must be 3-24 characters using lowercase letters, numbers, or underscores';
  end if;
  if requested_display_name = '' then
    requested_display_name := requested_username;
  end if;

  insert into public.profiles (id, username, display_name)
  values (new.id, requested_username, requested_display_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_author_profile on auth.users;
create trigger on_auth_user_created_author_profile
  after insert on auth.users
  for each row execute procedure public.handle_new_author();

create index if not exists works_user_id_created_at_idx
  on public.works (user_id, created_at desc);

-- Security note: never put a Supabase service_role key in this frontend.
