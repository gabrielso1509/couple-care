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
    const mobile = matchMedia('(max-width: 720px)');
    const weekGrid = $('mobile-semana');
    const toggle = $('alternar-calendario');
    const calendar = grid.closest('.calendario-mensal');
    let selected = C.today();
    let weekMode = mobile.matches;
    let month = A.local(selected);
    let context;
    let grouped = new Map();
    let viewing = null;
    let requestId = 0;
    let partial = false;
    let loading = true;

    month.setDate(1);

    function weekStart() {
        return A.plusDays(selected, -A.local(selected).getDay());
    }

    function paintWeek() {
        calendar.toggleAttribute('data-week', weekMode);
        toggle.setAttribute('aria-pressed', String(!weekMode));
        toggle.textContent = weekMode ? 'Ver mês' : 'Ver semana';
        $('mobile-calendar-label').textContent = weekMode ? 'Semana selecionada' : 'Mês selecionado';
        $('anterior').setAttribute('aria-label', weekMode ? 'Semana anterior' : 'Mês anterior');
        $('seguinte').setAttribute('aria-label', weekMode ? 'Próxima semana' : 'Próximo mês');
        if (!mobile.matches) return;

        const focused = document.activeElement?.dataset.semanaDia;
        const fragment = document.createDocumentFragment();
        const first = weekStart();
        for (let index = 0; index < 7; index += 1) {
            const day = A.plusDays(first, index);
            const date = A.local(day);
            const button = C.el('button', 'mobile-semana-dia');
            const count = (grouped.get(day) || []).length;
            button.type = 'button';
            button.dataset.semanaDia = day;
            button.disabled = day < '1900-01-01' || day > '2100-12-31';
            button.setAttribute('aria-pressed', String(day === selected));
            button.setAttribute('aria-label', C.date(day) + (count ? ', ' + count + (count === 1 ? ' item' : ' itens') : ''));
            if (day === C.today()) button.setAttribute('aria-current', 'date');
            button.append(C.el('span', '', date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')),
                C.el('strong', '', String(date.getDate())));
            if (count) button.append(C.el('i', 'mobile-semana-dot'));
            fragment.append(button);
        }
        weekGrid.replaceChildren(fragment);
        if (focused) weekGrid.querySelector('[data-semana-dia="' + focused + '"]')?.focus({ preventScroll: true });
    }

    function paintInline() {
        if (!mobile.matches) return;
        $('mobile-dia-titulo').textContent = A.local(selected).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
        const items = grouped.get(selected) || [];
        const list = $('mobile-dia-itens');
        list.replaceChildren();
        items.forEach(function (item) { list.append(makeCard(item)); });
        if (loading || partial || !items.length) list.append(C.el('p', 'calendario-agenda-vazia',
            loading ? 'Carregando agenda…' : partial ? 'Parte da agenda está indisponível.' : 'Nenhum item para este dia.'));
    }

    function controls() {
        const year = month.getFullYear();
        const number = month.getMonth();
        $('anterior').disabled = weekMode ? A.plusDays(weekStart(), -1) < '1900-01-01' : year === 1900 && number === 0;
        $('seguinte').disabled = weekMode ? A.plusDays(weekStart(), 7) > '2100-12-31' : year === 2100 && number === 11;
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
        paintWeek();
        paintInline();
        controls();
    }

    function record(day, type, label, title, lines) {
        if (!grouped.has(day)) grouped.set(day, []);
        grouped.get(day).push({ type: type, label: label, title: title, lines: lines });
    }

    async function load() {
        if (!context) return;
        const id = ++requestId;
        const first = weekStart();
        const last = A.plusDays(first, 6);
        const start = weekMode ? (first < '1900-01-01' ? '1900-01-01' : first) : A.key(month);
        const end = weekMode ? (last > '2100-12-31' ? '2100-12-31' : last) :
            A.key(new Date(month.getFullYear(), month.getMonth() + 1, 0));
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
            paintInline();
            controls();
        } else drawMonth();

        status.textContent = partial ? 'Parte do calendário está indisponível. Confira a conexão ou atualize.' : 'Calendário atualizado.';
    }

    function go(target) {
        selected = A.key(target);
        month = A.local(selected);
        month.setDate(1);
        grouped = new Map();
        loading = true;
        drawMonth();
        void load();
    }

    function move(amount) {
        if (weekMode) {
            const day = A.plusDays(selected, amount * 7);
            go(A.local(day < '1900-01-01' ? '1900-01-01' : day > '2100-12-31' ? '2100-12-31' : day));
        }
        else go(new Date(month.getFullYear(), month.getMonth() + amount, 1));
    }

    $('anterior').addEventListener('click', function () { move(-1); });
    $('seguinte').addEventListener('click', function () { move(1); });
    $('hoje').addEventListener('click', function () { go(A.local(C.today())); });
    toggle.addEventListener('click', function () {
        weekMode = !weekMode;
        go(A.local(selected));
    });
    mobile.addEventListener('change', function () {
        weekMode = mobile.matches;
        if (dialog.open) dialog.close();
        go(A.local(selected));
    });
    weekGrid.addEventListener('click', function (event) {
        const button = event.target.closest('[data-semana-dia]');
        if (!button || button.disabled) return;
        selected = button.dataset.semanaDia;
        month = A.local(selected);
        month.setDate(1);
        monthTitle.textContent = month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        paintWeek();
        paintInline();
    });
    $('atualizar-calendario').addEventListener('click', load);
    grid.addEventListener('click', function (event) {
        const button = event.target.closest('[data-dia]');
        if (!button) return;
        viewing = button.dataset.dia;
        selected = viewing;
        paintInline();
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
        paintInline();
        controls();
    });
})();
