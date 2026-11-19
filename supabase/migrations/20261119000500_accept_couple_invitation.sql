-- Aceita um convite usando o código original recebido no link.
create function public.accept_couple_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid;
    v_token_hash text;
    v_couple_id uuid;
    v_slot smallint;
    v_invitation public.couple_invitations%rowtype;
begin
    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception 'Você precisa estar autenticado para aceitar o convite.';
    end if;

    -- O código gerado possui exatamente 64 caracteres hexadecimais.
    if p_token is null or trim(p_token) !~ '^[0-9a-f]{64}$' then
        raise exception 'Convite inválido.';
    end if;

    -- Calcula o hash para localizar o convite sem guardar o código original.
    v_token_hash := encode(
        extensions.digest(trim(p_token), 'sha256'),
        'hex'
    );

    select couple_id
    into v_couple_id
    from public.couple_invitations
    where token_hash = v_token_hash;

    if v_couple_id is null then
        raise exception 'Convite inválido.';
    end if;

    -- Usa o mesmo bloqueio da função que gera convites.
    -- Operações sobre o mesmo casal aguardam sua vez.
    perform 1
    from public.couples
    where id = v_couple_id
    for update;

    if not found then
        raise exception 'Este casal não está mais disponível.';
    end if;

    -- Lê novamente o convite após obter o bloqueio do casal.
    select *
    into v_invitation
    from public.couple_invitations
    where token_hash = v_token_hash
    for update;

    if not found then
        raise exception 'Convite inválido.';
    end if;

    if v_invitation.revoked_at is not null then
        raise exception 'Este convite foi cancelado.';
    end if;

    if v_invitation.accepted_at is not null then
        raise exception 'Este convite já foi utilizado.';
    end if;

    -- Usa o horário atual, inclusive após eventual espera pelo bloqueio.
    if v_invitation.expires_at <= clock_timestamp() then
        raise exception 'Este convite expirou.';
    end if;

    -- Quem enviou ainda precisa participar do casal.
    if not exists (
        select 1
        from public.couple_members
        where couple_id = v_couple_id
          and user_id = v_invitation.created_by
    ) then
        raise exception 'Este convite não está mais disponível.';
    end if;

    -- Impede entrar no próprio casal ou em dois casais diferentes.
    if exists (
        select 1
        from public.couple_members
        where user_id = v_user_id
    ) then
        raise exception 'Você já participa de um casal.';
    end if;

    -- Procura uma vaga livre entre as duas permitidas.
    select s.slot
    into v_slot
    from generate_series(1, 2) as s(slot)
    where not exists (
        select 1
        from public.couple_members m
        where m.couple_id = v_couple_id
          and m.member_slot = s.slot
    )
    order by s.slot
    limit 1;

    if v_slot is null then
        raise exception 'Este casal já possui duas pessoas.';
    end if;

    -- Vincula a conta conectada à vaga disponível.
    insert into public.couple_members (
        couple_id,
        user_id,
        member_slot
    )
    values (
        v_couple_id,
        v_user_id,
        v_slot
    );

    -- Marca o convite como utilizado.
    update public.couple_invitations
    set accepted_by = v_user_id,
        accepted_at = clock_timestamp()
    where id = v_invitation.id;

    return v_couple_id;
end;
$$;

-- Somente contas autenticadas podem executar a aceitação.
revoke execute on function public.accept_couple_invitation(text)
from public, anon, authenticated;

grant execute on function public.accept_couple_invitation(text)
to authenticated;