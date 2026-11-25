/* O painel só consulta dados. Cada link abre o menu responsável pelo registro. */
(function () {
    'use strict';
    const C = CC, A = C.agenda, $ = C.$;
    const dialog = $('dashboard-modal-tarefas');
    const today = C.today();
    const date = A.local(today);
    const badge = $('dashboard-data');
    badge.dateTime = today;
    badge.append(C.el('strong', '', String(date.getDate())),
        C.el('span', '', date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')));

    // Reutiliza os ícones do menu para manter a mesma linguagem visual.
    const icons = { calendario: 'calendario', tarefas: 'tarefas', financas: 'financas', ciclo: 'menstruacao', espaco: 'espaco' };
    Object.entries(icons).forEach(function ([widget, page]) {
        const icon = document.querySelector('.menu-lateral a[href="/src/' + page + '.html"] svg');
        if (icon) $('widget-' + widget).firstElementChild.replaceChildren(icon.cloneNode(true));
    });

    function note(id, message) {
        $(id).replaceChildren(C.el('p', 'dashboard-vazio', message));
    }

    function renderRows(container, rows, makeRow) {
        const fragment = document.createDocumentFragment();
        rows.forEach(function (row) { fragment.append(makeRow(row)); });
        container.replaceChildren(fragment);
    }

    function due(day) {
        if (day === today) return 'Hoje';
        if (day === A.plusDays(today, 1)) return 'Amanhã';
        return day ? C.date(day) : 'Sem prazo';
    }

    function events(rows) {
        if (!rows.length) {
            note('dashboard-eventos', 'Nenhum compromisso para hoje.');
            return;
        }
        renderRows($('dashboard-eventos'), rows, function (event) {
            const row = C.el('div', 'dashboard-linha');
            const detail = C.el('span', 'dashboard-event-details');
            detail.append(C.el('strong', '', event.title));
            if (event.description) detail.append(C.el('small', 'mobile-only', event.description));
            row.append(detail, C.el('small', 'dashboard-event-time', A.clock(event)));
            return row;
        });
    }

    function tasks(rows, members) {
        const pending = rows.filter(function (task) { return task.status === 'pending'; });
        $('dashboard-pendentes').textContent = pending.length + (pending.length === 1 ? ' pendente' : ' pendentes');
        const summary = $('dashboard-task-summary');
        summary.hidden = false;
        const dueToday = pending.filter(function (task) { return task.due_date === today; }).length;
        summary.textContent = dueToday === 1 ? 'Uma pendência hoje' : dueToday > 1 ? dueToday + ' pendências hoje' :
            pending.length ? 'Próximas tarefas' : 'Tudo em dia';
        const all = $('dashboard-todas-tarefas');
        all.disabled = !rows.length;

        function open(trigger, selected) {
            const list = $('dashboard-modal-lista');
            renderRows(list, rows, function (task) {
                const card = C.el('article', 'modal-consulta-item');
                const complete = task.status === 'completed';
                card.append(C.el('small', '', complete ? 'Concluída' : 'Pendente'),
                    C.el('h3', '', task.title), C.el('p', '', due(task.due_date)));
                if (task.description) card.append(C.el('p', '', task.description));
                if (task.id === selected) card.dataset.destaque = '';
                return card;
            });
            dialog.scrollTop = 0;
            C.openOverview(dialog, trigger);
            list.querySelector('[data-destaque]')?.scrollIntoView({ block: 'nearest' });
        }

        all.onclick = function () { open(all); };
        if (!pending.length) {
            note('dashboard-tarefas', 'Nenhuma tarefa pendente agora.');
            return;
        }
        renderRows($('dashboard-tarefas'), pending, function (task) {
            const button = C.el('button', 'dashboard-linha');
            button.type = 'button';
            button.setAttribute('aria-haspopup', 'dialog');
            button.setAttribute('aria-controls', dialog.id);
            const title = C.el('span', 'dashboard-event-details');
            title.append(C.el('strong', '', task.title));
            if (task.description) title.append(C.el('small', 'mobile-only', task.description));
            const assignment = C.taskAssignment(task, members);
            if (assignment) title.append(assignment);
            button.append(C.el('span', 'mobile-only dashboard-task-mark'), title, C.el('small', '', due(task.due_date)));
            button.addEventListener('click', function () { open(button, task.id); });
            return button;
        });
    }

    function anniversary(id, dateValue, empty) {
        const result = C.anniversary(dateValue);
        $(id).textContent = !result ? empty : result.days === 0 ? 'É hoje!' :
            result.days === 1 ? 'Falta 1 dia' : 'Faltam ' + result.days + ' dias';
    }

    function cycle(rows, userId) {
        const pms = rows.find(function (row) { return row.kind === 'pms_estimate' && row.user_id === userId; });
        $('dashboard-tpm-nota').hidden = true;
        if (!pms) {
            $('dashboard-tpm').textContent = 'Sem estimativa disponível';
            return;
        }
        const days = A.dayCount(today, pms.entry_date);
        $('dashboard-tpm').textContent = days < 0 ? 'Janela estimada em andamento' :
            days === 0 ? 'Pode começar hoje' : 'Em cerca de ' + days + (days === 1 ? ' dia' : ' dias');
        $('dashboard-tpm-nota').hidden = false;
    }

    function mood(record, own) {
        if (!record) {
            note('dashboard-humor', own ? 'Como foi teu dia? Teu check-in fica na aba Menstruação. ♡' :
                'Ela ainda não compartilhou como se sente hoje. Um carinho sempre cabe. ♡');
            return;
        }
        const area = $('dashboard-humor');
        area.replaceChildren();
        const names = A.feelings(record);
        if (names.length) area.append(C.el('p', 'dashboard-humor-nota', names.join(' · ')));
        if (record.note) area.append(C.el('p', 'dashboard-humor-nota', record.note));
    }

    function finance(data) {
        $('dashboard-balance').textContent = C.money(data.balance);
        $('dashboard-balance').toggleAttribute('data-negative', Number(data.balance) < 0);
        $('dashboard-income').textContent = C.money(data.income);
        $('dashboard-expense').textContent = C.money(data.expense);
        $('dashboard-finance-status').textContent = '';
    }

    // Cada consulta falha de forma independente. Um erro no ciclo não esconde tarefas ou finanças.
    async function show(request, render, onError) {
        try { render(await request); }
        catch (error) { $('retry-dashboard').hidden = false; onError(C.error(error)); }
    }

    C.ready.then(async function (context) {
        const own = context.profile.gender === 'feminino';
        const partner = context.members.find(function (person) { return person.user_id !== context.user.id; });
        const cycleOwner = own ? context.user.id : partner?.user_id;
        if (own) {
            $('dashboard-ciclo-titulo').textContent = 'Meu ciclo';
            $('dashboard-humor-titulo').textContent = 'Como me sinto hoje';
        }

        let refreshing = false;
        async function refresh() {
            if (refreshing) return;
            if (today !== C.today()) {
                window.location.reload();
                return;
            }
            refreshing = true;
            $('retry-dashboard').hidden = true;
            try { await loadWidgets(); }
            finally { refreshing = false; C.pageReady(); }
        }

        async function loadWidgets() {
            const loads = [];
            if (!context.couple) {
                note('dashboard-eventos', 'Conecte seu casal em Configurações para ver a agenda.');
                note('dashboard-tarefas', 'Nenhum casal conectado.');
                $('dashboard-finance-status').textContent = 'Nenhum casal conectado.';
                $('dashboard-aniversario-casal').textContent = 'Data ainda não configurada.';
                $('dashboard-aniversario-parceiro').textContent = 'Nenhum parceiro conectado.';
            } else {
                const first = A.key(new Date(date.getFullYear(), date.getMonth(), 1));
                const last = A.key(new Date(date.getFullYear(), date.getMonth() + 1, 0));
                loads.push(
                    show(A.events(context.couple, today, today), events, function (e) { note('dashboard-eventos', e); }),
                    show(C.all(function () {
                        return supabaseClient.from('tasks').select('id,title,description,due_date,status,assigned_to,assigned_to_both')
                            .eq('couple_id', context.couple).order('due_date', { nullsFirst: false }).order('id');
                    }), function (rows) { tasks(rows, context.members); }, function (e) { note('dashboard-tarefas', e); }),
                    show(C.financeSummary(first, last),
                        finance, function (e) { $('dashboard-finance-status').textContent = e; }),
                    show(C.relationship(), function (row) {
                        anniversary('dashboard-aniversario-casal', row?.relationship_date, 'Data ainda não configurada.');
                    }, function (e) { $('dashboard-aniversario-casal').textContent = e; }),
                    show(supabaseClient.rpc('get_partner_birthday').then(C.result), function (rows) {
                        const row = rows[0];
                        const value = row ? '2000-' + String(row.birthday_month).padStart(2, '0') + '-' +
                            String(row.birthday_day).padStart(2, '0') : null;
                        if (partner) $('dashboard-aniversario-titulo').textContent = 'Aniversário de ' + partner.display_name.split(' ')[0];
                        anniversary('dashboard-aniversario-parceiro', value, 'Data ainda não compartilhada.');
                    }, function (e) { $('dashboard-aniversario-parceiro').textContent = e; })
                );
            }

            if (context.couple) window.dispatchEvent(new Event('dashboard-refresh'));

            if (!cycleOwner) {
                $('dashboard-tpm').textContent = 'Sem estimativa compartilhada';
                note('dashboard-humor', 'Conecte seu casal para ver os check-ins compartilhados.');
            } else {
                if (!own) {
                    $('dashboard-tpm').textContent = 'Carregando…';
                    $('dashboard-tpm-nota').hidden = true;
                    note('dashboard-humor', 'Carregando check-in…');
                }
                let checkin = supabaseClient.from('daily_wellbeing').select('feelings,note')
                    .eq('user_id', cycleOwner).eq('entry_date', today);
                if (!own) checkin = checkin.eq('shared_with_couple_id', context.couple);
                loads.push(
                    show(checkin.maybeSingle().then(C.result), function (row) { mood(row, own); },
                        function (e) { note('dashboard-humor', e); }),
                    show(A.cycle(A.plusDays(today, -5), A.plusDays(today, 40)),
                        function (rows) { cycle(rows, cycleOwner); },
                        function (e) { $('dashboard-tpm-nota').hidden = true; $('dashboard-tpm').textContent = e; })
                );
            }
            await Promise.all(loads);
        }
        $('retry-dashboard').addEventListener('click', refresh);
        C.refreshOnReturn(function () { if (!dialog.open) return refresh(); });
        await refresh();
    }).catch(function (error) {
        C.pageReady();
        $('retry-dashboard').hidden = false;
        $('retry-dashboard').onclick = function () { window.location.reload(); };
        const message = C.error(error);
        note('dashboard-eventos', message);
        note('dashboard-tarefas', message);
        $('dashboard-finance-status').textContent = message;
        $('dashboard-tpm').textContent = 'Resumo indisponível';
        $('dashboard-aniversario-casal').textContent = 'Data indisponível';
        $('dashboard-aniversario-parceiro').textContent = 'Data indisponível';
        note('dashboard-humor', 'Check-in indisponível.');
    });
})();
