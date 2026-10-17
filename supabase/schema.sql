-- AuthorBIO v2 schema and migration. Safe to run in Supabase SQL Editor more than once.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text unique not null check (username ~ '^[a-z0-9_]{3,30}$'),
 display_name text not null default '',
 bio text not null default '',
 avatar_url text not null default '',
 account_type text not null default 'author',
 headline text not null default '',
 genres text[] not null default '{}',
 website_url text not null default '',
 available_for_work boolean not null default false,
 onboarding_complete boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.profiles add column if not exists headline text not null default '';
alter table public.profiles add column if not exists genres text[] not null default '{}';
alter table public.profiles add column if not exists website_url text not null default '';
alter table public.profiles add column if not exists available_for_work boolean not null default false;
alter table public.profiles add column if not exists onboarding_complete boolean not null default false;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.profiles drop constraint if exists profiles_account_type_check;
alter table public.profiles add constraint profiles_account_type_check check (account_type in ('reader','author','editor','proofreader','translator','illustrator','publisher','designer','other'));

-- Legacy works table retained for backwards compatibility.
create table if not exists public.works (
 id uuid primary key default gen_random_uuid(),
 user_id uuid references public.profiles(id) on delete cascade not null,
 title text not null,
 description text not null default '',
 url text not null default 'https://example.com',
 category text not null default 'Article',
 created_at timestamptz not null default now()
);
alter table public.works add column if not exists status text not null default 'published';
alter table public.works add column if not exists updated_at timestamptz not null default now();
alter table public.works drop constraint if exists works_category_check;
alter table public.works add constraint works_category_check check (category in ('Book','Article','Story','Poem','Service','Repository','Podcast','Website','Other','General'));

create table if not exists public.posts (
 id uuid primary key default gen_random_uuid(),
 author_id uuid not null references public.profiles(id) on delete cascade,
 title text not null default '',
 subtitle text not null default '',
 body text not null default '',
 excerpt text not null default '',
 slug text not null,
 tags text[] not null default '{}',
 cover_url text not null default '',
 status text not null default 'draft' check (status in ('draft','published','unpublished')),
 published_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(author_id, slug)
);
create table if not exists public.books (
 id uuid primary key default gen_random_uuid(),
 author_id uuid not null references public.profiles(id) on delete cascade,
 title text not null,
 subtitle text not null default '',
 slug text not null,
 cover_url text not null default '',
 genre text not null default '',
 blurb text not null default '',
 publication_date date,
 buy_links jsonb not null default '[]'::jsonb,
 series_name text not null default '',
 series_number integer,
 status text not null default 'draft' check (status in ('draft','published','unpublished')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 published_at timestamptz,
 unique(author_id, slug)
);
create table if not exists public.services (
 id uuid primary key default gen_random_uuid(),
 provider_id uuid not null references public.profiles(id) on delete cascade,
 title text not null,
 slug text not null,
 category text not null default 'Other',
 description text not null default '',
 price_from numeric(10,2),
 currency text not null default 'USD',
 turnaround text not null default '',
 sample_links jsonb not null default '[]'::jsonb,
 is_active boolean not null default true,
 status text not null default 'draft' check (status in ('draft','published','unpublished')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(provider_id, slug)
);

create table if not exists public.follows (
 follower_id uuid not null references public.profiles(id) on delete cascade,
 following_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(follower_id, following_id),
 check(follower_id <> following_id)
);
create table if not exists public.reviews (
 id uuid primary key default gen_random_uuid(),
 reviewer_id uuid not null references public.profiles(id) on delete cascade,
 work_id uuid references public.works(id) on delete cascade,
 book_id uuid references public.books(id) on delete cascade,
 service_id uuid references public.services(id) on delete cascade,
 rating integer not null check(rating between 1 and 5),
 title text not null default '',
 body text not null check(char_length(body) between 8 and 2000),
 contains_spoilers boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint reviews_exactly_one_target check (num_nonnulls(work_id,book_id,service_id)=1)
);
alter table public.reviews alter column work_id drop not null;
alter table public.reviews add column if not exists book_id uuid references public.books(id) on delete cascade;
alter table public.reviews add column if not exists service_id uuid references public.services(id) on delete cascade;
alter table public.reviews add column if not exists title text not null default '';
alter table public.reviews add column if not exists contains_spoilers boolean not null default false;
alter table public.reviews add column if not exists updated_at timestamptz not null default now();
alter table public.reviews drop constraint if exists reviews_exactly_one_target;
alter table public.reviews add constraint reviews_exactly_one_target check (num_nonnulls(work_id,book_id,service_id)=1);
create unique index if not exists reviews_one_per_book_per_reader on public.reviews(reviewer_id,book_id) where book_id is not null;
create unique index if not exists reviews_one_per_service_per_reader on public.reviews(reviewer_id,service_id) where service_id is not null;

-- Legacy reviews may target work_id. New reviews use exactly one item reference.

alter table public.profiles enable row level security;
alter table public.works enable row level security;
alter table public.posts enable row level security;
alter table public.books enable row level security;
alter table public.services enable row level security;
alter table public.follows enable row level security;
alter table public.reviews enable row level security;

drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
create policy "Public profiles are viewable by everyone" on public.profiles for select using (true);
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles for update to authenticated using(auth.uid()=id) with check(auth.uid()=id);

drop policy if exists "Public works are viewable by everyone" on public.works;
create policy "Public works are viewable by everyone" on public.works for select using(true);
drop policy if exists "Users can insert their own works" on public.works;
create policy "Users can insert their own works" on public.works for insert to authenticated with check(auth.uid()=user_id);
drop policy if exists "Users can update their own works" on public.works;
create policy "Users can update their own works" on public.works for update to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists "Users can delete their own works" on public.works;
create policy "Users can delete their own works" on public.works for delete to authenticated using(auth.uid()=user_id);

drop policy if exists "Public published items" on public.posts;
create policy "Public published items" on public.posts for select using (status='published' or author_id=auth.uid());
drop policy if exists "Owners manage content" on public.posts;
create policy "Owners manage content" on public.posts for all to authenticated using(author_id=auth.uid()) with check(author_id=auth.uid());
drop policy if exists "Public published items" on public.books;
create policy "Public published items" on public.books for select using(status='published' or author_id=auth.uid());
drop policy if exists "Owners manage content" on public.books;
create policy "Owners manage content" on public.books for all to authenticated using(author_id=auth.uid()) with check(author_id=auth.uid());
drop policy if exists "Public published items" on public.services;
create policy "Public published items" on public.services for select using((status='published' and is_active=true) or provider_id=auth.uid());
drop policy if exists "Owners manage content" on public.services;
create policy "Owners manage content" on public.services for all to authenticated using(provider_id=auth.uid()) with check(provider_id=auth.uid());
drop policy if exists "Follows are public" on public.follows;
create policy "Follows are public" on public.follows for select using(true);
drop policy if exists "Users manage own follows" on public.follows;
create policy "Users manage own follows" on public.follows for all to authenticated using(auth.uid()=follower_id) with check(auth.uid()=follower_id);

drop policy if exists "Public reviews are viewable by everyone" on public.reviews;
create policy "Public reviews are viewable by everyone" on public.reviews for select using(true);
drop policy if exists "Reviewers manage their reviews" on public.reviews;
create policy "Reviewers manage their reviews" on public.reviews for all to authenticated using(auth.uid()=reviewer_id) with check(auth.uid()=reviewer_id and not exists(select 1 from public.books b where b.id=book_id and b.author_id=auth.uid()) and not exists(select 1 from public.services s where s.id=service_id and s.provider_id=auth.uid()) and not exists(select 1 from public.works w where w.id=work_id and w.user_id=auth.uid()));

create or replace function public.handle_new_author()
returns trigger language plpgsql security definer set search_path=''
as $$
declare u text; n text; a text;
begin
 u:=lower(trim(coalesce(new.raw_user_meta_data->>'username','')));
 n:=trim(coalesce(new.raw_user_meta_data->>'display_name',''));
 a:=coalesce(new.raw_user_meta_data->>'account_type','author');
 if u !~ '^[a-z0-9_]{3,30}$' then raise exception 'Username must be 3-30 characters using lowercase letters, numbers, or underscores'; end if;
 if n='' then n:=u; end if;
 if a not in ('reader','author','editor','proofreader','translator','illustrator','publisher','designer','other') then a:='author'; end if;
 insert into public.profiles(id,username,display_name,account_type) values(new.id,u,n,a);
 return new;
end; $$;
drop trigger if exists on_auth_user_created_author_profile on auth.users;
create trigger on_auth_user_created_author_profile after insert on auth.users for each row execute procedure public.handle_new_author();

create index if not exists posts_public_idx on public.posts(status,published_at desc);
create index if not exists posts_author_idx on public.posts(author_id,updated_at desc);
create index if not exists books_public_idx on public.books(status,published_at desc);
create index if not exists services_public_idx on public.services(status,is_active,created_at desc);
create index if not exists reviews_book_idx on public.reviews(book_id,created_at desc);
create index if not exists reviews_service_idx on public.reviews(service_id,created_at desc);
create index if not exists follows_following_idx on public.follows(following_id);
-- Keep secrets out of browser code: never use service_role or sb_secret in NEXT_PUBLIC variables.
