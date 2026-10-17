-- AuthorBIO database setup / migration
-- Run in Supabase Dashboard > SQL Editor. Safe to re-run.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null,
  bio text not null default '',
  avatar_url text not null default '',
  account_type text not null default 'author',
  service_title text not null default '',
  service_description text not null default '',
  service_price text not null default '',
  created_at timestamptz not null default timezone('utc'::text, now())
);
alter table public.profiles add column if not exists account_type text not null default 'author';
alter table public.profiles add column if not exists service_title text not null default '';
alter table public.profiles add column if not exists service_description text not null default '';
alter table public.profiles add column if not exists service_price text not null default '';

alter table public.profiles drop constraint if exists profiles_account_type_check;
alter table public.profiles add constraint profiles_account_type_check
  check (account_type in ('reader','author','editor','proofreader','translator','illustrator','publisher','other'));

create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text not null default '',
  url text not null check (url ~ '^https?://'),
  category text not null default 'Book'
    check (category in ('Book','Article','Story','Poem','Service','Repository','Podcast','Website','Other','General')),
  created_at timestamptz not null default timezone('utc'::text, now())
);
alter table public.works drop constraint if exists works_category_check;
alter table public.works add constraint works_category_check
  check (category in ('Book','Article','Story','Poem','Service','Repository','Podcast','Website','Other','General'));

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid references public.profiles(id) on delete cascade not null,
  work_id uuid references public.works(id) on delete cascade not null,
  rating integer not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 8 and 2000),
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (reviewer_id, work_id)
);

alter table public.profiles enable row level security;
alter table public.works enable row level security;
alter table public.reviews enable row level security;

drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
create policy "Public profiles are viewable by everyone" on public.profiles for select using (true);
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Public works are viewable by everyone" on public.works;
create policy "Public works are viewable by everyone" on public.works for select using (true);
drop policy if exists "Users can insert their own works" on public.works;
create policy "Users can insert their own works" on public.works for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update their own works" on public.works;
create policy "Users can update their own works" on public.works for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their own works" on public.works;
create policy "Users can delete their own works" on public.works for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Public reviews are viewable by everyone" on public.reviews;
create policy "Public reviews are viewable by everyone" on public.reviews for select using (true);
drop policy if exists "Signed in readers can review works" on public.reviews;
create policy "Signed in readers can review works" on public.reviews for insert to authenticated
  with check (auth.uid() = reviewer_id and reviewer_id <> (select user_id from public.works where id = work_id));
drop policy if exists "Reviewers can edit their own reviews" on public.reviews;
create policy "Reviewers can edit their own reviews" on public.reviews for update to authenticated
  using (auth.uid() = reviewer_id) with check (auth.uid() = reviewer_id);
drop policy if exists "Reviewers can delete their own reviews" on public.reviews;
create policy "Reviewers can delete their own reviews" on public.reviews for delete to authenticated using (auth.uid() = reviewer_id);

create or replace function public.handle_new_author()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  requested_username text;
  requested_display_name text;
  requested_type text;
begin
  requested_username := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  requested_display_name := trim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  requested_type := coalesce(new.raw_user_meta_data ->> 'account_type', 'author');
  if requested_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'Username must be 3-24 characters using lowercase letters, numbers, or underscores';
  end if;
  if requested_display_name = '' then requested_display_name := requested_username; end if;
  if requested_type not in ('reader','author','editor','proofreader','translator','illustrator','publisher','other') then requested_type := 'author'; end if;
  insert into public.profiles (id, username, display_name, account_type)
  values (new.id, requested_username, requested_display_name, requested_type);
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_author_profile on auth.users;
create trigger on_auth_user_created_author_profile after insert on auth.users
  for each row execute procedure public.handle_new_author();

create index if not exists works_user_id_created_at_idx on public.works (user_id, created_at desc);
create index if not exists reviews_work_id_created_at_idx on public.reviews (work_id, created_at desc);

-- Never put a service_role or sb_secret key in frontend code.
