-- Representa o casal; os participantes serão vinculados em couple_members.
create table public.couples (
    -- Identificador gerado pelo próprio banco.
    id uuid primary key default gen_random_uuid(),

    -- Conta responsável pela criação do casal.
    created_by uuid not null references auth.users (id),

    -- Data e hora de criação.
    created_at timestamptz not null default now()
);

-- Ativa o controle de acesso por linha.
alter table public.couples enable row level security;

-- Liga as contas ao casal e controla as duas vagas.
create table public.couple_members (
    couple_id uuid not null
        references public.couples (id) on delete cascade,

    user_id uuid not null
        references auth.users (id) on delete cascade,

    -- Vaga de participação; não define gênero nem permissões.
    member_slot smallint not null
        check (member_slot in (1, 2)),

    joined_at timestamptz not null default now(),

    -- Impede repetir um participante no mesmo casal.
    primary key (couple_id, user_id),

    -- Cada conta participa de somente um casal por vez.
    constraint couple_members_one_couple_per_user
        unique (user_id),

    -- Cada casal possui apenas duas vagas, sem ocupação repetida.
    constraint couple_members_unique_slot
        unique (couple_id, member_slot)
);

-- Ativa o controle de acesso por linha dos participantes.
alter table public.couple_members enable row level security;

-- Permite consultar o próprio vínculo com o casal.
create policy couple_members_select_own
on public.couple_members
for select
to authenticated
using ((select auth.uid()) = user_id);

-- Permite consultar o casal do qual o usuário participa.
create policy couples_select_member
on public.couples
for select
to authenticated
using (
    exists (
        select 1
        from public.couple_members
        where couple_members.couple_id = couples.id
          and couple_members.user_id = (select auth.uid())
    )
);

-- Remove permissões diretas concedidas aos papéis da aplicação.
revoke all on table public.couples, public.couple_members
from anon, authenticated;

-- Usuários autenticados podem consultar, respeitando as políticas de RLS.
grant select on table public.couples, public.couple_members
to authenticated;

-- Cria um casal para a conta autenticada e ocupa a primeira vaga.
create function public.create_couple()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid;
    v_couple_id uuid;
begin
    -- Usa a identidade da sessão, sem receber um ID pelo navegador.
    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception 'Você precisa estar autenticado para criar um casal.';
    end if;

    -- Uma conta não pode participar de dois casais.
    if exists (
        select 1
        from public.couple_members
        where user_id = v_user_id
    ) then
        raise exception 'Você já participa de um casal.';
    end if;

    -- Cria o casal e captura o identificador gerado.
    insert into public.couples (created_by)
    values (v_user_id)
    returning id into v_couple_id;

    -- Vincula quem criou à primeira vaga.
    insert into public.couple_members (
        couple_id,
        user_id,
        member_slot
    )
    values (
        v_couple_id,
        v_user_id,
        1
    );

    -- Devolve o identificador do casal para a aplicação.
    return v_couple_id;
end;
$$;

-- Remove as permissões de execução concedidas por padrão.
revoke execute on function public.create_couple()
from public, anon, authenticated;

-- Somente contas autenticadas podem chamar a função.
grant execute on function public.create_couple()
to authenticated;