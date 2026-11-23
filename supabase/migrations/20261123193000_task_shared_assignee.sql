begin;
alter table public.tasks add column assigned_to_both boolean not null default false;
alter table public.tasks add constraint tasks_assignee_exclusive check (not assigned_to_both or assigned_to is null);
grant insert(assigned_to_both), update(assigned_to_both) on public.tasks to authenticated;
create or replace function public.record_task_change()
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
            category, assigned_to, assigned_to_both, recurrence, checklist, recurrence_parent)
        values (new.couple_id, new.title, new.description, v_next, new.priority,
            new.category, new.assigned_to, new.assigned_to_both, new.recurrence, v_checklist, new.id);
    end if;
    return new;
end; $$;

revoke execute on function public.record_task_change() from public, anon, authenticated;
notify pgrst, 'reload schema';
commit;
