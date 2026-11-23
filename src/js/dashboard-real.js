/* Resumo real do casal. Contagens agregadas não dependem do limite de linhas da API. */
(function () {
    'use strict';
    const C = CC, $ = C.$;
    function empty(id, text) { C.empty(id, text); }
    $('cc-hoje').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
    C.ready.then(async function (c) {
        const people = c.members.length ? c.members : [{ display_name: c.profile.display_name }];
        const hour = new Date().getHours();
        $('cc-boas-vindas').textContent = (hour < 12 ? 'Bom dia, ' : hour < 18 ? 'Boa tarde, ' : 'Boa noite, ') + people.map(function (p) { return p.display_name.split(' ')[0]; }).join(' e ') + '.';
        if (!c.couple) {
            $('cc-status-tarefas').textContent = 'Crie um casal ou aceite um convite em Configurações para começar.';
            ['cc-tarefas','cc-eventos'].forEach(function (id) { empty(id, 'Conecte seu casal para compartilhar sua rotina.'); });
            $('dashboard-finance-status').textContent = 'Nenhum casal conectado.'; return;
        }
        const query = function () { return supabaseClient.from('tasks').select('id', { count: 'exact', head: true }).eq('couple_id', c.couple); };
        const results = await Promise.allSettled([
            query().eq('status', 'pending'), query().eq('status', 'completed'), query().eq('status', 'pending').lt('due_date', C.today()),
            supabaseClient.from('tasks').select('id,title,due_date,priority').eq('couple_id', c.couple).eq('status', 'pending').order('due_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }).limit(4),
            supabaseClient.from('calendar_events').select('id,title,event_date,start_time').eq('couple_id', c.couple).gte('event_date', C.today()).order('event_date').order('start_time', { nullsFirst: true }).limit(3),
            supabaseClient.rpc('finance_month_summary', { p_month: C.today().slice(0, 7) + '-01' })
        ]);
        function r(i) { return results[i].status === 'fulfilled' && !results[i].value.error ? results[i].value : null; }
        const pending = r(0), completed = r(1), overdue = r(2);
        $('cc-pendentes').textContent = pending ? pending.count : '—'; $('cc-concluidas').textContent = completed ? completed.count : '—'; $('cc-atrasadas').textContent = overdue ? overdue.count : '—';
        if (pending && completed) {
            const total = pending.count + completed.count, ratio = total ? Math.round(completed.count / total * 100) : 0;
            $('cc-percentual').textContent = total ? ratio + '%' : '—'; $('cc-progresso').style.setProperty('--progress', ratio * 3.6 + 'deg');
            $('cc-progresso').setAttribute('aria-label', total ? ratio + '% das tarefas concluídas' : 'Nenhuma tarefa registrada');
        }
        $('cc-status-tarefas').textContent = pending && completed && overdue ? 'Resumo das tarefas cadastradas. Atualizado ao abrir esta página.' : 'Parte do resumo está indisponível. Recarregue para tentar novamente.';
        const tasks = r(3)?.data;
        if (!tasks) empty('cc-tarefas', 'Consulta indisponível.');
        else if (!tasks.length) empty('cc-tarefas', 'Nenhuma tarefa pendente. Que tal combinar o próximo cuidado?');
        else {
            $('cc-tarefas').replaceChildren(); tasks.forEach(function (task) {
                const a = C.el('a'); a.href = '/src/tarefas.html';
                const p = C.el('p'); p.append(C.el('b', '', task.title), C.el('small', '', task.due_date ? C.date(task.due_date) : 'Sem prazo definido'));
                a.append(C.el('span', 'stat-icon ' + (task.priority === 'high' ? 'orange' : 'purple'), '✓'), p); $('cc-tarefas').append(a);
            });
        }
        const events = r(4)?.data;
        if (!events) empty('cc-eventos', 'Consulta indisponível.');
        else if (!events.length) empty('cc-eventos', 'Nenhum compromisso futuro. Reservem um momento para vocês.');
        else {
            $('cc-eventos').replaceChildren(); events.forEach(function (event) {
                const d = C.el('div', 'cc-event'); d.append(C.el('b', '', event.title), C.el('span', '', C.date(event.event_date) + (event.start_time ? ' · ' + event.start_time.slice(0, 5) : ' · Dia inteiro'))); $('cc-eventos').append(d);
            });
        }
        const finance = r(5);
        if (finance) { $('dashboard-balance').textContent = C.money(finance.data.balance); $('dashboard-finance-status').textContent = 'Saldo pelos registros do mês atual. Despesas: ' + C.money(finance.data.expense); }
        else { $('dashboard-balance').textContent = '—'; $('dashboard-finance-status').textContent = finance === null && results[5].status === 'fulfilled' ? C.error(results[5].value.error) : 'Consulta financeira indisponível.'; }
    }).catch(function (e) { $('cc-status-tarefas').textContent = C.error(e); });
})();
