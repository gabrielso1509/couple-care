begin;

-- Um registro de como a pessoa se sente em cada dia.
create table public.daily_wellbeing (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid()
        references auth.users(id) on delete cascade,
    entry_date date not null
        check (entry_date between date '1900-01-01' and date '2100-12-31'),

    -- Guardamos códigos; o JavaScript exibirá o emoji e o texto correspondentes.
    feelings text[] not null default array[]::text[],
    note text not null default '' check (char_length(note) <= 1000),

    -- NULL significa privado. Compartilhar exige escolher o casal atual.
    -- A escolha vale para os emojis e a observação deste registro.
    shared_with_couple_id uuid references public.couples(id) on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    version integer not null default 1,

    constraint daily_wellbeing_one_per_day unique(user_id, entry_date),
    constraint daily_wellbeing_nonempty check (
        cardinality(feelings) > 0 or char_length(trim(note)) > 0
    ),
    constraint daily_wellbeing_valid_feelings check (
        cardinality(feelings) <= 18
        and array_position(feelings, null) is null
        and feelings <@ array[
            'happy', 'affectionate', 'calm', 'sad', 'tearful', 'sensitive',
            'irritated', 'anxious', 'overwhelmed', 'sleepy', 'tired', 'energetic',
            'pain', 'nausea', 'bloated', 'wants_affection', 'wants_company', 'wants_space'
        ]::text[]
    )
);

create index daily_wellbeing_shared_date_idx
on public.daily_wellbeing(shared_with_couple_id, entry_date)
where shared_with_couple_id is not null;

alter table public.daily_wellbeing enable row level security;
revoke all on public.daily_wellbeing from public, anon, authenticated;
grant select, delete on public.daily_wellbeing to authenticated;
grant insert(entry_date, feelings, note, shared_with_couple_id)
on public.daily_wellbeing to authenticated;
grant update(entry_date, feelings, note, shared_with_couple_id)
on public.daily_wellbeing to authenticated;

-- A pessoa vê os próprios registros. O parceiro vê apenas os compartilhados
-- com seu casal atual, enquanto a autora ainda participa desse mesmo casal.
create policy daily_wellbeing_select_author_or_partner
on public.daily_wellbeing for select to authenticated
using (
    user_id = (select auth.uid())
    or exists (
        select 1 from public.get_couple_members() as member
        where member.couple_id = daily_wellbeing.shared_with_couple_id
          and member.user_id = daily_wellbeing.user_id
    )
);

-- A autoria vem da sessão; o compartilhamento só pode apontar ao próprio casal.
create policy daily_wellbeing_insert_author
on public.daily_wellbeing for insert to authenticated
with check (
    user_id = (select auth.uid())
    and (
        shared_with_couple_id is null
        or shared_with_couple_id in (
            select couple_id from public.couple_members
            where user_id = (select auth.uid())
        )
    )
);

-- Mesmo que consiga ler, o parceiro não pode editar o registro.
create policy daily_wellbeing_update_author
on public.daily_wellbeing for update to authenticated
using (user_id = (select auth.uid()))
with check (
    user_id = (select auth.uid())
    and (
        shared_with_couple_id is null
        or shared_with_couple_id in (
            select couple_id from public.couple_members
            where user_id = (select auth.uid())
        )
    )
);

create policy daily_wellbeing_delete_author
on public.daily_wellbeing for delete to authenticated
using (user_id = (select auth.uid()));

create function public.prepare_daily_wellbeing_update()
returns trigger language plpgsql set search_path = '' as $$
begin
    new.updated_at := now();
    new.version := old.version + 1;
    return new;
end;
$$;

create trigger daily_wellbeing_before_update
before update on public.daily_wellbeing
for each row execute function public.prepare_daily_wellbeing_update();

revoke execute on function public.prepare_daily_wellbeing_update()
from public, anon, authenticated;

commit;
