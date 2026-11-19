-- Retorna os participantes do casal da conta autenticada.
create function public.get_couple_members()
returns table (
    couple_id uuid,
    user_id uuid,
    display_name text,
    member_slot smallint,
    joined_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
    select
        member.couple_id,
        member.user_id,
        profile.display_name,
        member.member_slot,
        member.joined_at
    from public.couple_members as member
    join public.profiles as profile
        on profile.id = member.user_id
    where member.couple_id = (
        select own_member.couple_id
        from public.couple_members as own_member
        where own_member.user_id = auth.uid()
    )
    order by member.member_slot;
$$;

-- Libera a execução somente para contas autenticadas.
revoke execute on function public.get_couple_members()
from public, anon, authenticated;

grant execute on function public.get_couple_members()
to authenticated;