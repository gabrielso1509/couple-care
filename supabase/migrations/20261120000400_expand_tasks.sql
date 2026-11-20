-- Execute esta migration uma única vez, depois da tabela tasks existente.
-- A transação evita deixar apenas parte das melhorias aplicada.
begin;

alter table public.tasks
    add column description text not null default '' check (char_length(description) <= 3000),
    add column category text not null default 'house' check (category in ('house','shopping','bills','care','leisure','other')),
    add column assigned_to uuid,
    add column recurrence text not null default 'none' check (recurrence in ('none','daily','weekly','monthly')),
    add column recurrence_anchor date,
    add column recurrence_generated boolean not null default false,
    add column recurrence_parent uuid unique references public.tasks(id) on delete set null,
    add column checklist jsonb not null default '[]'::jsonb,
    add column completed_by uuid references auth.users(id) on delete set null,
    add column updated_at timestamptz not null default now(),
    add column version integer not null default 1,
    add constraint tasks_assignee_member foreign key (couple_id, assigned_to)
        references public.couple_members(couple_id, user_id),
    add constraint tasks_recurrence_date check (recurrence = 'none' or due_date is not null);

-- Valida também no banco: até 30 itens, com texto, identificador e estado.
create function public.valid_task_checklist(items jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item jsonb; ids text[] := array[]::text[];
begin
    if jsonb_typeof(items) <> 'array' then return false; end if;
    if jsonb_array_length(items) > 30 then return false; end if;
    for item in select value from jsonb_array_elements(items) loop
        if jsonb_typeof(item) <> 'object'
            or jsonb_typeof(item->'id') is distinct from 'string'
            or jsonb_typeof(item->'text') is distinct from 'string'
            or jsonb_typeof(item->'done') is distinct from 'boolean'
            or char_length(trim(item->>'text')) not between 1 and 200
            or (item->>'id') !~ '^[0-9a-f-]{36}$'
            or (item->>'id') = any(ids) then return false;
        end if;
        ids := array_append(ids, item->>'id');
    end loop;
    return true;
end; $$;
alter table public.tasks add constraint tasks_checklist_valid check (public.valid_task_checklist(checklist));

-- Eventos guardam o histórico mesmo depois de uma tarefa ser excluída.
-- Sem FK para task_id: excluir a tarefa preserva o registro do ocorrido.
create table public.task_events (
    id uuid primary key default gen_random_uuid(),
    couple_id uuid not null references public.couples(id) on delete cascade,
    task_id uuid not null,
    actor_id uuid references auth.users(id) on delete set null,
    action text not null check (action in ('created','edited','completed','reopened','deleted')),
    title text not null,
    created_at timestamptz not null default now()
);
create index task_events_couple_time_idx on public.task_events(couple_id, created_at desc);
alter table public.task_events enable row level security;
revoke all on public.task_events from public, anon, authenticated;
grant select on public.task_events to authenticated;
create policy task_events_select_member on public.task_events for select to authenticated
using (couple_id in (select couple_id from public.couple_members where user_id = (select auth.uid())));

-- Metadados são definidos no servidor, sem confiar no relógio do navegador.
create function public.prepare_task_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
    new.title := trim(new.title);
    if tg_op = 'INSERT' then
        new.created_by := auth.uid();
        new.created_at := now();
        new.version := 1;
        new.status := 'pending';
        new.completed_at := null;
        new.completed_by := null;
        new.recurrence_anchor := new.due_date;
        if new.recurrence_parent is not null then
            select coalesce(recurrence_anchor, due_date) into new.recurrence_anchor
            from public.tasks where id = new.recurrence_parent;
        end if;
    else
        new.version := old.version + 1;
        if new.status = 'completed' and old.status = 'pending' then
            new.completed_at := now();
            new.completed_by := auth.uid();
            if new.recurrence <> 'none' then new.recurrence_generated := true; end if;
        elsif new.status = 'pending' then
            new.completed_at := null;
            new.completed_by := null;
        else
            new.completed_at := old.completed_at;
            new.completed_by := old.completed_by;
        end if;
        if new.due_date is distinct from old.due_date then
            new.recurrence_anchor := new.due_date;
        end if;
    end if;
    new.updated_at := now();
    return new;
end; $$;
create trigger tasks_prepare_write before insert or update on public.tasks
for each row execute function public.prepare_task_write();

-- Completar cria a próxima ocorrência uma única vez, na mesma transação.
create function public.record_task_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_action text; v_next date; v_checklist jsonb; v_anchor date;
begin
    if tg_op = 'DELETE' then
        -- Excluir o próprio casal também remove as tarefas e seu histórico.
        if not exists (select 1 from public.couples where id = old.couple_id) then return old; end if;
        insert into public.task_events(couple_id, task_id, actor_id, action, title)
        values (old.couple_id, old.id, auth.uid(), 'deleted', old.title);
        return old;
    end if;
    v_action := case when tg_op = 'INSERT' then 'created'
        when new.status = 'completed' and old.status = 'pending' then 'completed'
        when new.status = 'pending' and old.status = 'completed' then 'reopened'
        else 'edited' end;
    insert into public.task_events(couple_id, task_id, actor_id, action, title)
    values (new.couple_id, new.id, auth.uid(), v_action, new.title);

    if v_action = 'completed' and new.recurrence <> 'none'
        and not old.recurrence_generated then
        v_anchor := coalesce(new.recurrence_anchor, new.due_date);
        if new.recurrence = 'daily' then v_next := new.due_date + 1;
        elsif new.recurrence = 'weekly' then v_next := new.due_date + 7;
        else
            -- Preserva o dia original: 31/jan → 28/fev → 31/mar.
            v_next := (date_trunc('month', new.due_date) + interval '1 month')::date;
            v_next := v_next + (least(extract(day from v_anchor)::integer,
                extract(day from (v_next + interval '1 month - 1 day'))::integer) - 1);
        end if;
        select coalesce(jsonb_agg(jsonb_set(value, '{done}', 'false'::jsonb)), '[]'::jsonb)
        into v_checklist from jsonb_array_elements(new.checklist);
        insert into public.tasks(couple_id, title, description, due_date, priority,
            category, assigned_to, recurrence, checklist, recurrence_parent)
        values (new.couple_id, new.title, new.description, v_next, new.priority,
            new.category, new.assigned_to, new.recurrence, v_checklist, new.id);
    end if;
    return new;
end; $$;
create trigger tasks_record_change after insert or update or delete on public.tasks
for each row execute function public.record_task_change();

-- Só o banco pode alterar autoria, versão, datas técnicas e histórico.
revoke insert, update on public.tasks from authenticated;
revoke insert(couple_id,title,due_date,priority) on public.tasks from authenticated;
revoke update(title,due_date,priority,status,completed_at) on public.tasks from authenticated;
grant insert(couple_id,title,due_date,priority,description,category,assigned_to,recurrence,checklist)
on public.tasks to authenticated;
grant update(title,due_date,priority,status,description,category,assigned_to,recurrence,checklist)
on public.tasks to authenticated;
revoke execute on function public.prepare_task_write() from public, anon, authenticated;
revoke execute on function public.record_task_change() from public, anon, authenticated;
revoke execute on function public.valid_task_checklist(jsonb) from public, anon;
grant execute on function public.valid_task_checklist(jsonb) to authenticated;

-- Transmite apenas eventos de histórico protegidos pela RLS.
-- INSERT também informa exclusões, evitando as limitações de DELETE no Realtime.
do $$ begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
        and not exists (select 1 from pg_publication_tables
            where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'task_events') then
        alter publication supabase_realtime add table public.task_events;
    end if;
end; $$;
commit;
