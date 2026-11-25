/* Calendário de consulta: compromissos, prazos, check-ins e ciclo autorizado. */
(function () {
    'use strict';
    const C = CC, A = C.agenda, $ = C.$;
    const dialog = $('dialogo-dia');
    const monthTitle = $('mes');
    const grid = $('dias');
    const status = $('status-calendario');
    const cycleLabels = {
        period_start: 'Início da menstruação',
        period_end: 'Fim da menstruação',
        period_start_end: 'Início e fim da menstruação',
        period_day: 'Dia de menstruação registrado',
        fertility_estimate: 'Janela fértil estimada',
        pms_estimate: 'Possível início da TPM'
    };
    let month = A.local(C.today());
    let context;
    let grouped = new Map();
    let viewing = null;
    let requestId = 0;
    let partial = false;
    let loading = true;

    month.setDate(1);

    function controls() {
        const year = month.getFullYear();
        const number = month.getMonth();
        $('anterior').disabled = year === 1900 && number === 0;
        $('seguinte').disabled = year === 2100 && number === 11;
        $('atualizar-calendario').disabled = !context || loading;
    }

    function byPerson(personId) {
        if (personId === context.user.id) return 'Seu registro';
        const person = context.members.find(function (member) { return member.user_id === personId; });
        return person ? person.display_name.split(' ')[0] : 'Compartilhado com você';
    }

    function makeCard(item) {
        const card = C.el('article', 'modal-consulta-item cal-tipo-' + item.type);
        card.append(C.el('small', '', item.label), C.el('h3', '', item.title));
        item.lines.forEach(function (line) { if (line) card.append(C.el('p', '', line)); });
        return card;
    }

    function drawAgenda(day) {
        $('selecionado').textContent = A.local(day).toLocaleDateString('pt-BR', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
        const items = grouped.get(day) || [];
        const cards = document.createDocumentFragment();
        items.forEach(function (item) { cards.append(makeCard(item)); });
        $('lista').replaceChildren(cards);
        $('agenda-vazia').hidden = Boolean(items.length || loading || partial);
        $('agenda-aviso').hidden = !loading && !partial;
        $('agenda-aviso').textContent = loading ? 'Carregando os itens do dia…' : 'Parte da agenda está indisponível.';
    }

    function drawMonth() {
        monthTitle.textContent = month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        const today = C.today();
        const year = month.getFullYear();
        const number = month.getMonth();
        const offset = month.getDay();
        const last = new Date(year, number + 1, 0).getDate();
        const cells = Math.ceil((offset + last) / 7) * 7;
        const activeDay = document.activeElement?.dataset.dia;
        const days = document.createDocumentFragment();

        for (let i = 0; i < cells; i += 1) {
            const day = i - offset + 1;
            if (day < 1 || day > last) {
                const blank = C.el('span', 'calendario-dia-vazio');
                blank.setAttribute('aria-hidden', 'true');
                days.append(blank);
                continue;
            }

            const key = A.key(new Date(year, number, day));
            const button = C.el('button', 'calendario-dia');
            const markers = C.el('span', 'calendario-dia-resumo');
            const byType = new Map();
            (grouped.get(key) || []).forEach(function (item) {
                if (!byType.has(item.type)) byType.set(item.type, []);
                byType.get(item.type).push(item);
            });
            byType.forEach(function (items, type) {
                const marker = C.el('span', 'calendario-marcador cal-tipo-' + type);
                marker.append(C.el('span', 'calendario-marcador-titulo', items[0].title));
                if (items.length > 1) marker.append(C.el('span', 'calendario-marcador-total', '+' + (items.length - 1)));
                markers.append(marker);
            });

            button.type = 'button';
            button.dataset.dia = key;
            button.setAttribute('aria-haspopup', 'dialog');
            button.setAttribute('aria-controls', dialog.id);
            const total = (grouped.get(key) || []).length;
            button.setAttribute('aria-label', C.date(key) + (total ? ', ' + total + (total === 1 ? ' item' : ' itens') : ''));
            if (key === today) button.setAttribute('aria-current', 'date');
            markers.setAttribute('aria-hidden', 'true');
            button.append(C.el('span', 'calendario-dia-numero', String(day)), markers);
            days.append(button);
        }

        grid.replaceChildren(days);
        if (activeDay) grid.querySelector('[data-dia="' + activeDay + '"]')?.focus();
        controls();
    }

    function record(day, type, label, title, lines) {
        if (!grouped.has(day)) grouped.set(day, []);
        grouped.get(day).push({ type: type, label: label, title: title, lines: lines });
    }

    async function load() {
        if (!context) return;
        const id = ++requestId;
        const start = A.key(month);
        const end = A.key(new Date(month.getFullYear(), month.getMonth() + 1, 0));
        const couple = context.couple;
        loading = true;
        controls();
        status.textContent = 'Atualizando calendário…';

        const results = await Promise.allSettled([
            A.events(couple, start, end),
            couple ? C.all(function () {
                return supabaseClient.from('tasks').select('id,title,due_date,status').eq('couple_id', couple)
                    .gte('due_date', start).lte('due_date', end).order('due_date').order('id');
            }) : [],
            C.all(function () {
                return supabaseClient.from('daily_wellbeing').select('id,user_id,entry_date,feelings,note')
                    .gte('entry_date', start).lte('entry_date', end).order('entry_date').order('id');
            }),
            A.cycle(start, end)
        ]);
        if (id !== requestId) return;

        grouped = new Map();
        partial = results.some(function (result) { return result.status === 'rejected'; });
        loading = false;
        const rows = results.map(function (result) { return result.status === 'fulfilled' ? result.value : []; });

        rows[0].forEach(function (event) {
            record(event.event_date, 'evento', 'Compromisso · ' + A.clock(event), event.title, [event.description]);
        });
        rows[1].forEach(function (task) {
            record(task.due_date, 'tarefa', 'Prazo de tarefa', task.title, [task.status === 'completed' ? 'Concluída' : 'Pendente']);
        });
        rows[2].forEach(function (mood) {
            record(mood.entry_date, 'pessoal', 'Sentimentos · ' + byPerson(mood.user_id), 'Como se sentiu',
                [A.feelings(mood).join(' · '), mood.note]);
        });
        rows[3].forEach(function (entry) {
            const estimated = ['pms_estimate', 'fertility_estimate'].includes(entry.kind);
            const line = entry.kind === 'fertility_estimate' ? 'Estimativa aproximada. Não use para evitar gravidez.' :
                estimated ? 'Estimativa aproximada. Os sintomas podem variar.' : '';
            record(entry.entry_date, 'pessoal', 'Ciclo · ' + byPerson(entry.user_id), cycleLabels[entry.kind], [line]);
        });

        // Mantém o botão de origem no DOM enquanto o modal estiver aberto.
        if (dialog.open) {
            drawAgenda(viewing);
            controls();
        } else drawMonth();

        status.textContent = partial ? 'Parte do calendário está indisponível. Confira a conexão ou atualize.' : 'Calendário atualizado.';
    }

    function go(target) {
        month = target;
        month.setDate(1);
        grouped = new Map();
        drawMonth();
        void load();
    }

    $('anterior').addEventListener('click', function () {
        go(new Date(month.getFullYear(), month.getMonth() - 1, 1));
    });
    $('seguinte').addEventListener('click', function () {
        go(new Date(month.getFullYear(), month.getMonth() + 1, 1));
    });
    $('hoje').addEventListener('click', function () { go(A.local(C.today())); });
    $('atualizar-calendario').addEventListener('click', load);
    grid.addEventListener('click', function (event) {
        const button = event.target.closest('[data-dia]');
        if (!button) return;
        viewing = button.dataset.dia;
        drawAgenda(viewing);
        dialog.scrollTop = 0;
        C.openOverview(dialog, button);
    });
    dialog.addEventListener('close', function () {
        // Redesenha só depois que o foco voltar ao botão que abriu o modal.
        queueMicrotask(drawMonth);
    });
    window.addEventListener('pageshow', function (event) { if (event.persisted) void load(); });
    document.addEventListener('visibilitychange', function () {
        if (document.hidden || !context) return;
        // Evita exibir dados antigos após trocar de aba ou revogar compartilhamento.
        grouped = new Map();
        partial = false;
        void load();
        if (dialog.open) drawAgenda(viewing);
        else drawMonth();
    });

    drawMonth();
    C.ready.then(function (value) {
        context = value;
        return load();
    }).catch(function (error) {
        loading = false;
        partial = true;
        status.textContent = C.error(error);
        if (dialog.open) drawAgenda(viewing);
        controls();
    });
})();
