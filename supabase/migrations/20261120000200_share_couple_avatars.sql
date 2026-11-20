-- O retorno da função vai ganhar uma coluna.
-- Por isso, precisamos recriá-la.
drop function public.get_couple_members();

-- Retorna somente os participantes do casal da conta conectada.
create function public.get_couple_members()
returns table (
    couple_id uuid,
    user_id uuid,
    display_name text,
    member_slot smallint,
    joined_at timestamptz,
    avatar_path text
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
        member.joined_at,
        profile.avatar_path
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

-- Restaura as permissões restritas da função recriada.
revoke execute on function public.get_couple_members()
from public, anon, authenticated;

grant execute on function public.get_couple_members()
to authenticated;

-- Libera somente a leitura das fotos cadastradas pelo próprio casal.
-- As permissões de envio, alteração e exclusão continuam individuais.
create policy avatars_select_couple
on storage.objects
for select
to authenticated
using (
    bucket_id = 'avatars'
    and exists (
        select 1
        from public.get_couple_members() as member
        where member.avatar_path = storage.objects.name
    )
);