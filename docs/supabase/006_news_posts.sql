-- Web Picross Ver2 news posts
-- Apply after 001_schema.sql and 002_rls.sql.

create table if not exists public.news_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  published_at timestamptz,
  is_published boolean not null default false,
  image_url text,
  image_alt text,
  image_caption text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists news_posts_public_order_idx
on public.news_posts (is_published, published_at desc, display_order asc, created_at desc);

drop trigger if exists set_news_posts_updated_at on public.news_posts;
create trigger set_news_posts_updated_at
before update on public.news_posts
for each row execute function public.set_updated_at();

alter table public.news_posts enable row level security;

drop policy if exists "news_posts_select_published" on public.news_posts;
create policy "news_posts_select_published"
on public.news_posts
for select
to anon, authenticated
using (
  public.is_admin()
  or (
    is_published = true
    and (published_at is null or published_at <= now())
  )
);

drop policy if exists "news_posts_admin_insert" on public.news_posts;
create policy "news_posts_admin_insert"
on public.news_posts
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "news_posts_admin_update" on public.news_posts;
create policy "news_posts_admin_update"
on public.news_posts
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "news_posts_admin_delete" on public.news_posts;
create policy "news_posts_admin_delete"
on public.news_posts
for delete
to authenticated
using (public.is_admin());
