-- ============================================================
-- Expense Diary SA — Supabase Schema
-- Run this in your Supabase SQL editor to set up the database
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  avatar_url text,
  currency text default 'ZAR',
  monthly_income numeric(12,2) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- CATEGORIES
-- ============================================================
create table public.categories (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default '📌',
  color text not null default '#8b949e',
  is_default boolean default false,
  created_at timestamptz default now()
);

alter table public.categories enable row level security;

create policy "Users can manage own categories"
  on public.categories for all
  using (auth.uid() = user_id);

-- Default categories (seeded per user via trigger)
create or replace function public.seed_default_categories(user_uuid uuid)
returns void as $$
begin
  insert into public.categories (user_id, name, icon, color, is_default) values
    (user_uuid, 'Housing',          '🏠', '#58a6ff', true),
    (user_uuid, 'Food & Groceries', '🛒', '#bc8cff', true),
    (user_uuid, 'Transport',        '🚗', '#d4a843', true),
    (user_uuid, 'Utilities',        '⚡', '#3fb950', true),
    (user_uuid, 'Entertainment',    '📺', '#f0883e', true),
    (user_uuid, 'Health',           '🏥', '#ff7b72', true),
    (user_uuid, 'Education',        '📚', '#58a6ff', true),
    (user_uuid, 'Clothing',         '👕', '#bc8cff', true),
    (user_uuid, 'Savings',          '💰', '#3fb950', true),
    (user_uuid, 'Income',           '💼', '#3fb950', true),
    (user_uuid, 'Other',            '📌', '#8b949e', true);
end;
$$ language plpgsql security definer;

create or replace function public.handle_new_user_categories()
returns trigger as $$
begin
  perform public.seed_default_categories(new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created_categories
  after insert on auth.users
  for each row execute procedure public.handle_new_user_categories();

-- ============================================================
-- TRANSACTIONS
-- ============================================================
create table public.transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete set null,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  type text not null check (type in ('income', 'expense')),
  date date not null default current_date,
  notes text,
  is_recurring boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- For offline sync
  client_id text unique,
  synced_at timestamptz
);

alter table public.transactions enable row level security;

create policy "Users can manage own transactions"
  on public.transactions for all
  using (auth.uid() = user_id);

create index transactions_user_id_idx on public.transactions(user_id);
create index transactions_date_idx on public.transactions(date desc);
create index transactions_type_idx on public.transactions(type);

-- ============================================================
-- BUDGETS
-- ============================================================
create table public.budgets (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete cascade not null,
  limit_amount numeric(12,2) not null check (limit_amount > 0),
  month int not null check (month between 1 and 12),
  year int not null,
  alert_at_percent int default 80 check (alert_at_percent between 1 and 100),
  created_at timestamptz default now(),
  unique(user_id, category_id, month, year)
);

alter table public.budgets enable row level security;

create policy "Users can manage own budgets"
  on public.budgets for all
  using (auth.uid() = user_id);

-- ============================================================
-- USEFUL VIEWS
-- ============================================================

-- Monthly summary per user
create or replace view public.monthly_summary as
select
  user_id,
  date_trunc('month', date) as month,
  sum(case when type = 'income' then amount else 0 end) as total_income,
  sum(case when type = 'expense' then amount else 0 end) as total_expenses,
  sum(case when type = 'income' then amount else -amount end) as net_savings
from public.transactions
group by user_id, date_trunc('month', date);

-- Spending by category per month
create or replace view public.category_spending as
select
  t.user_id,
  t.category_id,
  c.name as category_name,
  c.icon,
  c.color,
  date_trunc('month', t.date) as month,
  sum(t.amount) as total_spent
from public.transactions t
join public.categories c on c.id = t.category_id
where t.type = 'expense'
group by t.user_id, t.category_id, c.name, c.icon, c.color, date_trunc('month', t.date);
