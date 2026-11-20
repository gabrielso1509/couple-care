begin;

-- Compromissos compartilhados pelas duas pessoas do casal.
create table public.calendar_events (
    id uuid primary key default gen_random_uuid(),
    couple_id uuid not null references public.couples(id) on delete cascade,
    created_by uuid default auth.uid() references auth.users(id) on delete set null,

    title text not null check (char_length(trim(title)) between 1 and 150),
    description text not null default '' check (char_length(description) <= 3000),
    event_date date not null check (event_date between date '1900-01-01' and date '2100-12-31'),

    -- Sem horário inicial, o compromisso é de dia inteiro.
    start_time time,
    end_time time,
    constraint calendar_events_valid_times check (
        end_time is null or (start_time is not null and end_time > start_time)
    ),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    version integer not null default 1
);

-- Facilita a busca dos compromissos do casal por data.
create index calendar_events_couple_date_idx
on public.calendar_events(couple_id, event_date);

alter table public.calendar_events enable row level security;

-- A aplicação não pode escrever autoria, versão ou datas técnicas.
revoke all on public.calendar_events from public, anon, authenticated;
grant select, delete on public.calendar_events to authenticated;
grant insert(couple_id, title, description, event_date, start_time, end_time)
on public.calendar_events to authenticated;
grant update(title, description, event_date, start_time, end_time)
on public.calendar_events to authenticated;

-- Somente participantes do casal podem consultar seus compromissos.
create policy calendar_events_select_member
on public.calendar_events for select to authenticated
using (
    couple_id in (
        select couple_id from public.couple_members
        where user_id = (select auth.uid())
    )
);

-- A autoria vem automaticamente da conta conectada.
create policy calendar_events_insert_member
on public.calendar_events for insert to authenticated
with check (
    created_by = (select auth.uid())
    and couple_id in (
        select couple_id from public.couple_members
        where user_id = (select auth.uid())
    )
);

-- As duas pessoas podem editar os compromissos do próprio casal.
create policy calendar_events_update_member
on public.calendar_events for update to authenticated
using (
    couple_id in (
        select couple_id from public.couple_members
        where user_id = (select auth.uid())
    )
)
with check (
    couple_id in (
        select couple_id from public.couple_members
        where user_id = (select auth.uid())
    )
);

create policy calendar_events_delete_member
on public.calendar_events for delete to authenticated
using (
    couple_id in (
        select couple_id from public.couple_members
        where user_id = (select auth.uid())
    )
);

-- O banco registra a alteração e incrementa a versão para controlar edições.
create function public.prepare_calendar_event_update()
returns trigger language plpgsql set search_path = '' as $$
begin
    new.updated_at := now();
    new.version := old.version + 1;
    return new;
end;
$$;

create trigger calendar_events_before_update
before update on public.calendar_events
for each row execute function public.prepare_calendar_event_update();

-- Essa função é usada somente pelo gatilho.
revoke execute on function public.prepare_calendar_event_update()
from public, anon, authenticated;

commit;
