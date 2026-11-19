-- Garante a dependência usada para gerar e conferir os códigos.
create extension if not exists pgcrypto with schema extensions;

-- Guarda convites para entrar em um casal.
create table public.couple_invitations (
    id uuid primary key default gen_random_uuid(),

    couple_id uuid not null
        references public.couples (id) on delete cascade,

    created_by uuid not null
        references auth.users (id),

    -- Guarda somente o hash do código secreto do convite.
    token_hash text not null unique,

    created_at timestamptz not null default now(),

    -- Convites terão validade de 24 horas.
    expires_at timestamptz not null
        default (now() + interval '24 hours'),

    -- Preenchidos quando alguém aceitar o convite.
    accepted_by uuid references auth.users (id),
    accepted_at timestamptz,

    -- Preenchido quando o convite for cancelado.
    revoked_at timestamptz,

    -- A validade precisa terminar depois da criação.
    constraint invitation_valid_expiration
        check (expires_at > created_at),

    -- Quem aceitou e quando aceitou devem ser preenchidos juntos.
    constraint invitation_acceptance_consistent
        check (
            (accepted_by is null and accepted_at is null)
            or
            (accepted_by is not null and accepted_at is not null)
        ),

    -- Um convite aceito não pode também estar cancelado.
    constraint invitation_not_accepted_and_revoked
        check (accepted_at is null or revoked_at is null)
);

alter table public.couple_invitations enable row level security;

-- Bloqueia operações diretas pela aplicação.
revoke all on table public.couple_invitations
from public, anon, authenticated;

-- Permite consultar os dados de acompanhamento, sem expor o hash.
grant select (
    id,
    couple_id,
    created_by,
    created_at,
    expires_at,
    accepted_by,
    accepted_at,
    revoked_at
)
on public.couple_invitations
to authenticated;

-- Quem gerou o convite pode acompanhá-lo enquanto estiver no casal.
create policy couple_invitations_select_creator
on public.couple_invitations
for select
to authenticated
using (
    created_by = (select auth.uid())
    and exists (
        select 1
        from public.couple_members
        where couple_members.couple_id = couple_invitations.couple_id
          and couple_members.user_id = (select auth.uid())
    )
);

-- Permite apenas um convite ainda não aceito nem cancelado por casal.
create unique index couple_invitations_one_pending_per_couple
on public.couple_invitations (couple_id)
where accepted_at is null and revoked_at is null;

-- Gera um novo convite para o casal da conta conectada.
create function public.generate_couple_invitation()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid;
    v_couple_id uuid;
    v_token text;
begin
    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception 'Você precisa estar autenticado.';
    end if;

    -- Localiza e bloqueia temporariamente o casal nesta transação.
    select c.id
    into v_couple_id
    from public.couples c
    join public.couple_members m on m.couple_id = c.id
    where m.user_id = v_user_id
    for update of c;

    if v_couple_id is null then
        raise exception 'Você precisa participar de um casal para gerar um convite.';
    end if;

    -- Um casal completo não recebe novos participantes.
    if (
        select count(*)
        from public.couple_members
        where couple_id = v_couple_id
    ) >= 2 then
        raise exception 'Este casal já possui duas pessoas.';
    end if;

    -- Invalida o convite anterior, inclusive se já estiver expirado.
    update public.couple_invitations
    set revoked_at = now()
    where couple_id = v_couple_id
      and accepted_at is null
      and revoked_at is null;

    -- Gera um código aleatório de 32 bytes, representado em hexadecimal.
    v_token := encode(extensions.gen_random_bytes(32), 'hex');

    -- Armazena somente o hash SHA-256 do código.
    insert into public.couple_invitations (
        couple_id,
        created_by,
        token_hash
    )
    values (
        v_couple_id,
        v_user_id,
        encode(extensions.digest(v_token, 'sha256'), 'hex')
    );

    -- Devolve o código original para a aplicação montar o link.
    return v_token;
end;
$$;

-- Restringe a execução a contas autenticadas.
revoke execute on function public.generate_couple_invitation()
from public, anon, authenticated;

grant execute on function public.generate_couple_invitation()
to authenticated;