-- Cada perfil pertence a uma conta do Supabase Auth.
create table public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    -- Nome apresentado no aplicativo.
    display_name text not null check (char_length(trim(display_name)) > 0),

    -- Valores permitidos para o gênero.
    gender text not null check (gender in ('masculino', 'feminino')),

    -- Preenchida automaticamente quando o perfil é criado.
    created_at timestamptz not null default now()
);


-- Ativa o controle de acesso por linha na tabela de perfis.
alter table public.profiles enable row level security;

-- Permite que cada usuário consulte seu próprio perfil.
create policy profiles_select_own
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

-- Permite criar um perfil somente para a própria conta.
create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

-- Permite que cada usuário edite somente o próprio perfil.
create policy profiles_update_own
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);