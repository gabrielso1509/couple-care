/* Demonstração pública. Os dados de exemplo e as mudanças vivem só nesta página. */
(function () {
    'use strict';

    const tour = document.getElementById('demo');
    if (!tour) return;
    const screen = document.getElementById('demo-screen');
    const nav = tour.querySelector('.device-nav');
    const dots = tour.querySelector('.showcase-dots');
    const checklist = document.getElementById('demo-checklist');
    const siteMenu = document.querySelector('.mobile-site-menu');
    siteMenu?.addEventListener('click', event => {
        if (event.target.closest('a')) siteMenu.open = false;
    });
    siteMenu?.addEventListener('keydown', event => {
        if (event.key === 'Escape' && siteMenu.open) {
            siteMenu.open = false;
            siteMenu.querySelector('summary').focus();
        }
    });

    const icons = {
        home: '<path d="m3 11 9-8 9 8M5 10v10h14V10M9 20v-6h6v6"/>',
        check: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="m8 12 2.2 2.2L16 8.5"/>',
        calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4m8-4v4M3 10h18"/>',
        heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
        wallet: '<path d="M4 6.5h14a2 2 0 0 1 2 2v10H5a3 3 0 0 1-3-3v-10a3 3 0 0 1 3-3h12M16 12h6v4h-6a2 2 0 0 1 0-4Z"/>'
    };
    const screens = [
        { id: 'home', label: 'Início', title: 'Dashboard', icon: 'home', headline: 'Um resumo do dia de vocês', copy: 'Vejam a agenda, as tarefas e as finanças no painel inicial.' },
        { id: 'tasks', label: 'Tarefas', title: 'Tarefas', icon: 'check', headline: 'Dividam a rotina', copy: 'Marquem o que já foi feito e vejam o progresso de hoje.' },
        { id: 'calendar', label: 'Calendário', title: 'Calendário', icon: 'calendar', headline: 'Planejem a semana juntos', copy: 'Escolham um dia para ver os compromissos ou troquem para a visão do mês.' },
        { id: 'wellbeing', label: 'Bem-estar', title: 'Bem-estar', icon: 'heart', headline: 'Cuidem um do outro', copy: 'Experimentem registrar um sentimento de exemplo.' },
        { id: 'finances', label: 'Finanças', title: 'Finanças', icon: 'wallet', headline: 'Acompanhem as contas do casal', copy: 'Troquem o período para ver o saldo, os gastos por categoria e a atividade recente.' }
    ];
    const tasks = [
        { id: 1, title: 'Passar no mercado', when: 'Hoje', who: 'Nós dois', done: true },
        { id: 2, title: 'Comprar ingressos', when: 'Hoje', who: 'Nós dois', done: false },
        { id: 3, title: 'Organizar a semana', when: 'Hoje', who: 'Nós dois', done: false },
        { id: 4, title: 'Planejar o fim de semana', when: 'Amanhã', who: 'Nós dois', done: false }
    ];
    const referenceDay = new Date(2026, 2, 13, 12);
    const dayKey = date => [date.getFullYear(), date.getMonth() + 1, date.getDate()].join('-');
    const events = {
        '2026-3-12': [['17:30', 'Passar no mercado', 'Tarefa do casal']],
        '2026-3-13': [['10:00', 'Consulta médica', 'Compromisso'], ['20:00', 'Jantar a dois', 'Compromisso']],
        '2026-3-14': [['09:00', 'Passeio no parque', 'Compromisso']],
        '2026-3-16': [['19:00', 'Organizar a semana', 'Tarefa do casal']]
    };
    const entries = [
        { title: 'Salário', category: 'Receita', amount: 3200, day: 2 },
        { title: 'Moradia', category: 'Casa', amount: -1500, day: 4 },
        { title: 'Mercado Central', category: 'Alimentação', amount: -180, day: 11 },
        { title: 'Transporte', category: 'Transporte', amount: -90, day: 12 },
        { title: 'Café a dois', category: 'Lazer', amount: -42, day: 13 }
    ];
    const extraEntries = [
        { title: 'Salário do mês anterior', category: 'Receita', amount: 3200, day: 1 },
        { title: 'Moradia do mês anterior', category: 'Casa', amount: -1500, day: 1 },
        { title: 'Compras do mês anterior', category: 'Alimentação', amount: -475, day: 1 }
    ];
    const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    const moods = ['Tranquila', 'Com energia', 'Sensível', 'Cansada'];
    const state = {
        page: 'calendar', date: referenceDay, month: false,
        taskFilter: 'today', period: 'month', moneyVisible: true,
        feeling: null, savedFeeling: null
    };

    function icon(name) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icons[name] + '</svg>';
    }

    function text(value) {
        return String(value).replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[char]);
    }

    function button(label, action, value, pressed, accessibleLabel) {
        const mode = pressed === undefined ? '' : ' aria-pressed="' + pressed + '"';
        const name = accessibleLabel ? ' aria-label="' + text(accessibleLabel) + '"' : '';
        return '<button type="button" data-demo-action="' + action + '" data-value="' + text(value) + '"' + mode + name + '>' + text(label) + '</button>';
    }

    function dateAt(date, offset) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset, 12);
    }

    function heading(title) {
        return '<div class="device-heading"><div><span class="device-subtitle">Sua rotina compartilhada</span><h3>' + title + '</h3></div></div>';
    }

    function renderCalendar() {
        const month = state.date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        const week = dateAt(state.date, -((state.date.getDay() + 6) % 7));
        const monthStart = new Date(state.date.getFullYear(), state.date.getMonth(), 1, 12);
        const monthGridStart = dateAt(monthStart, -((monthStart.getDay() + 6) % 7));
        const days = Array.from({ length: state.month ? 42 : 7 }, (_, index) => dateAt(state.month ? monthGridStart : week, index));
        const dates = days.map(day => {
            if (state.month && day.getMonth() !== state.date.getMonth()) return '<span aria-hidden="true"></span>';
            const key = dayKey(day);
            const weekday = day.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3);
            const label = day.toLocaleDateString('pt-BR', { dateStyle: 'full' });
            return `<button type="button" data-demo-action="day" data-value="${key}" aria-label="${label}"
                aria-pressed="${key === dayKey(state.date)}" class="${events[key] ? 'has-events' : ''}">
                ${state.month ? '' : '<small>' + weekday + '</small>'}${day.getDate()}<span class="week-dot" aria-hidden="true"></span></button>`;
        }).join('');
        const agenda = events[dayKey(state.date)] || [];
        return heading('Calendário') + `<div class="device-card">
            <span class="device-kicker">${month}</span>
            <h4>${state.month ? 'Mês' : 'Esta semana'}</h4>
            <div class="device-controls" aria-label="Controles do calendário">
                ${button('‹', 'date-step', -1, undefined, state.month ? 'Mês anterior' : 'Semana anterior')}
                ${button('Hoje', 'today', 'today')}
                ${button('›', 'date-step', 1, undefined, state.month ? 'Próximo mês' : 'Próxima semana')}
                ${button(state.month ? 'Ver semana' : 'Ver mês', 'month', 'month', state.month)}
            </div>
            <div class="device-card device-week" role="group" aria-label="Dias do calendário">${dates}</div>
        </div>
        <div class="device-card device-agenda" aria-live="polite">
            <span class="device-kicker">Agenda do dia</span>
            <h4>${state.date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}</h4>
            ${agenda.length ? agenda.map(([time,title,type]) => `<div class="device-row"><time class="event-time">${time}</time><div class="row-title"><strong>${title}</strong><small>${type}</small></div></div>`).join('')
                : '<p class="device-empty">Nenhum compromisso para este dia.</p>'}
        </div>`;
    }

    function taskRows(list, prefix) {
        return list.map(task => `<label class="device-row" for="${prefix}-${task.id}">
            <input id="${prefix}-${task.id}" type="checkbox" data-demo-task="${task.id}"${task.done ? ' checked' : ''}>
            <span class="row-title"><strong>${text(task.title)}</strong><small>${text(task.who)}</small></span>
            <small>${text(task.when)}</small>
        </label>`).join('');
    }

    function renderTasks() {
        const today = tasks.filter(task => task.when === 'Hoje');
        const done = today.filter(task => task.done).length;
        const filters = [['today','Hoje'], ['next','Próximas'], ['done','Concluídas']];
        const visible = tasks.filter(task => {
            if (state.taskFilter === 'done') return task.done;
            if (state.taskFilter === 'next') return !task.done && task.when !== 'Hoje';
            return task.when === 'Hoje';
        });
        return heading('Tarefas') + `<div class="device-card"><span class="device-kicker">Progresso de hoje</span>
            <h4>Um passo de cada vez</h4><p><small>${done} de ${today.length} tarefas concluídas</small></p>
            <div class="device-bar" aria-hidden="true"><span style="width:${done / today.length * 100}%"></span></div></div>
            <div class="device-card"><h4>O que vem por aí</h4><div class="device-controls" aria-label="Filtros de tarefas">
            ${filters.map(([id,label]) => button(label,'filter',id,state.taskFilter === id)).join('')}</div>
            ${visible.length ? taskRows(visible,'phone-task') : '<p class="device-empty">Nenhuma tarefa neste filtro.</p>'}</div>`;
    }

    function renderFinances() {
        const periods = [['week','Semana'],['month','Mês'],['year','Ano']];
        const rows = state.period === 'year' ? [...extraEntries, ...entries] : entries.filter(row => state.period !== 'week' || row.day >= 7);
        const income = rows.reduce((total, row) => total + Math.max(0, row.amount), 0);
        const spending = rows.reduce((total, row) => total + Math.max(0, -row.amount), 0);
        const categories = new Map();
        rows.filter(row => row.amount < 0).forEach(row => categories.set(row.category, (categories.get(row.category) || 0) - row.amount));
        const amounts = Array.from(categories).sort((a,b) => b[1] - a[1]);
        const money = value => state.moneyVisible ? formatter.format(value) : '••••';
        return heading('Finanças') + `<div class="device-controls" aria-label="Período de finanças">${periods.map(([id,label]) => button(label,'period',id,state.period === id)).join('')}</div>
            <div class="device-card"><span class="device-kicker">Saldo do período</span><strong class="device-balance${income < spending && state.moneyVisible ? ' is-negative' : ''}">${money(income - spending)}</strong>
            <div class="device-finance"><div><small>Receitas</small><strong>${money(income)}</strong></div><div><small>Gastos</small><strong>${money(spending)}</strong></div></div>
            <div class="device-controls">${button(state.moneyVisible ? 'Ocultar valores' : 'Mostrar valores','money','toggle')}</div></div>
            <div class="device-card"><h4>Gastos por categoria</h4>${amounts.map(([name,amount]) => `<div class="device-category"><div><span>${name}</span><strong>${money(amount)}</strong></div>
            ${state.moneyVisible ? '<div class="device-bar" aria-hidden="true"><span style="width:' + (amount / amounts[0][1] * 100) + '%"></span></div>' : ''}</div>`).join('')}</div>
            <div class="device-card"><h4>Atividade recente</h4>${rows.slice(-3).reverse().map(row => `<div class="device-row"><span class="row-title"><strong>${row.title}</strong><small>${row.category}</small></span><span>${money(row.amount)}</span></div>`).join('')}</div>`;
    }

    function renderHome() {
        const open = tasks.filter(task => task.when === 'Hoje' && !task.done).length;
        return heading('Dashboard') + `<div class="device-card"><span class="device-kicker">Agenda de hoje</span><h4>O que vem por aí</h4>
            <p>10:00 · Consulta médica</p><p>20:00 · Jantar a dois</p></div>
            <div class="device-card"><h4>Tarefas</h4><p>${open} ${open === 1 ? 'pendência' : 'pendências'} hoje</p></div>
            <div class="device-card"><h4>Finanças do mês</h4><strong class="device-balance">${state.moneyVisible ? formatter.format(entries.reduce((sum,row) => sum + row.amount,0)) : '••••'}</strong></div>
            <div class="device-card"><h4>Ciclo compartilhado</h4><small>Como se sente hoje</small><p>${state.savedFeeling ? text(state.savedFeeling) : 'Ainda sem check-in de exemplo. ♡'}</p></div>`;
    }

    function renderWellbeing() {
        return heading('Bem-estar') + `<div class="device-card"><span class="device-kicker">Check-in de exemplo</span><h4>Como você se sente hoje?</h4>
            <div class="device-controls" aria-label="Sentimentos">${moods.map(mood => button(mood,'feeling',mood,state.feeling === mood)).join('')}</div>
            <button class="device-action primary" type="button" data-demo-action="save-feeling" data-value="save"${state.feeling ? '' : ' disabled'}>Salvar check-in</button>
            ${state.savedFeeling ? '<p class="device-empty" role="status">Check-in de exemplo salvo.</p>' : ''}</div>`;
    }

    const renderers = {
        home: renderHome, tasks: renderTasks, calendar: renderCalendar,
        wellbeing: renderWellbeing, finances: renderFinances
    };

    function renderScreen(options = {}) {
        const { reset = false, focus = null } = options;
        const top = screen.scrollTop;
        screen.innerHTML = renderers[state.page]();
        screen.scrollTop = reset ? 0 : top;
        if (focus) {
            const restored = Array.from(screen.querySelectorAll('[data-demo-action], [data-demo-task]')).find(element =>
                focus.dataset.demoTask ? element.dataset.demoTask === focus.dataset.demoTask :
                    element.dataset.demoAction === focus.dataset.demoAction && element.dataset.value === focus.dataset.value);
            (restored || screen).focus({ preventScroll: true });
        }
    }

    function showPage(id) {
        const active = screens.find(page => page.id === id);
        if (!active) return;
        state.page = id;
        renderScreen({ reset: true });
        tour.querySelectorAll('[data-demo-page]').forEach(tab => tab.setAttribute('aria-pressed', String(tab.dataset.demoPage === id)));
        document.getElementById('demo-feature-title').textContent = active.headline;
        document.getElementById('demo-feature-description').textContent = active.copy;
        dots.innerHTML = screens.map(page => '<span' + (page.id === id ? ' class="active"' : '') + '></span>').join('');
    }

    function renderChecklist() {
        checklist.innerHTML = taskRows(tasks.slice(0,3),'example-task');
    }

    function renderSide(target, markup) {
        // As telas de fundo são puramente decorativas e não recebem foco.
        const preview = document.getElementById(target);
        preview.inert = true;
        preview.innerHTML = markup;
        preview.querySelectorAll('[id], [for]').forEach(element => {
            element.removeAttribute('id');
            element.removeAttribute('for');
        });
    }

    nav.innerHTML = screens.map(page => `<button type="button" data-demo-page="${page.id}" aria-controls="demo-screen" aria-pressed="false">${icon(page.icon)}<span>${page.label}</span></button>`).join('');
    renderSide('demo-left', renderTasks());
    renderSide('demo-right', renderFinances());
    renderChecklist();
    showPage(state.page);

    tour.addEventListener('click', event => {
        const tab = event.target.closest('[data-demo-page]');
        const arrow = event.target.closest('[data-demo-slide]');
        if (tab) showPage(tab.dataset.demoPage);
        if (arrow) {
            const index = screens.findIndex(page => page.id === state.page);
            const next = (index + Number(arrow.dataset.demoSlide) + screens.length) % screens.length;
            showPage(screens[next].id);
        }
    });

    screen.addEventListener('click', event => {
        const control = event.target.closest('[data-demo-action]');
        if (!control) return;
        const { demoAction, value } = control.dataset;
        switch (demoAction) {
            case 'today': state.date = referenceDay; break;
            case 'day': {
                const [year, month, day] = value.split('-').map(Number);
                state.date = new Date(year, month - 1, day, 12);
                break;
            }
            case 'date-step':
                state.date = state.month ?
                    new Date(state.date.getFullYear(),state.date.getMonth() + Number(value),1,12) :
                    dateAt(state.date,Number(value) * 7);
                break;
            case 'month': state.month = !state.month; break;
            case 'filter': state.taskFilter = value; break;
            case 'period': state.period = value; break;
            case 'money': state.moneyVisible = !state.moneyVisible; break;
            case 'feeling': state.feeling = value; break;
            case 'save-feeling': state.savedFeeling = state.feeling; break;
            default: return;
        }
        renderScreen({ focus: control });
    });

    function updateTask(event) {
        const input = event.target.closest('[data-demo-task]');
        if (!input) return;
        const task = tasks.find(item => item.id === Number(input.dataset.demoTask));
        if (!task) return;
        task.done = input.checked;
        const sourceIsPhone = screen.contains(input);
        if (state.page === 'home' || state.page === 'tasks') renderScreen({ focus: sourceIsPhone ? input : null });
        renderChecklist();
        if (!sourceIsPhone) document.getElementById('example-task-' + task.id).focus({ preventScroll: true });
    }

    checklist.addEventListener('change', updateTask);
    screen.addEventListener('change', updateTask);
})();
