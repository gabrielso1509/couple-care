/* Calendário de consulta: compromissos, prazos, check-ins e ciclo autorizado. */
(function () {
    'use strict';
    const C = CC, A = C.agenda, $ = C.$;
    const dialog = $('dialogo-dia');
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
    const agendaToggle = $('calendar-agenda-toggle');
    let selected = C.today();
    let weekMode = false;
    let displayMode = "month", filterType = "all";
    const filtered = day => (grouped.get(day) || []).filter(item => filterType === "all" || item.type === filterType);
    let month = A.local(selected);
    let context;
    let grouped = new Map();
    let openGroup = null;
    let requestId = 0;
    let partial = false;
    let loading = true;

    month.setDate(1);

    function weekStart() {
        return A.plusDays(selected, -A.local(selected).getDay());
    }

    function paintWeek() {
        calendar.toggleAttribute('data-week', weekMode); calendar.dataset.mode=displayMode;
        toggle.setAttribute('aria-pressed', String(!weekMode));
        toggle.textContent = weekMode ? 'Ver mês' : 'Ver semana';
        $('anterior').setAttribute('aria-label', weekMode ? 'Semana anterior' : 'Mês anterior');
        $('seguinte').setAttribute('aria-label', weekMode ? 'Próxima semana' : 'Próximo mês');
        const focused = document.activeElement?.dataset.semanaDia;
        const fragment = document.createDocumentFragment();
        const first = weekStart();
        for (let index = 0; index < 7; index += 1) {
            const day = A.plusDays(first, index);
            const date = A.local(day);
            const button = C.el('button', 'mobile-semana-dia');
            const count = filtered(day).length;
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
        const listMode = $("mock-calendar-list");
        if (listMode) {
            listMode.hidden = displayMode !== "list";
            listMode.replaceChildren();
            if (displayMode === "list") {
                Array.from(grouped.keys()).sort().forEach(day => { const items=filtered(day); if(!items.length)return;const heading=C.el("h3","",C.date(day));listMode.append(heading);items.forEach(item=>listMode.append(makeCard(item))); });
                if(!listMode.children.length)listMode.append(C.el("p","empty-state","Nenhum evento neste período."));
            }
        }
        const date = A.local(selected);
        $('mobile-dia-semana').textContent = date.toLocaleDateString('pt-BR', { weekday: 'long' });
        const action = document.querySelector('.calendar-day-action');
        action.href = 'tarefas.html?evento=' + selected + '#compromissos';
        $('mobile-dia-titulo').textContent = date.toLocaleDateString('pt-BR', { weekday:'short', day:'numeric', month:'long' });
        const items = filtered(selected);
        const cover = items.find(item => item.type !== 'pessoal');
        $('calendar-day-cover').hidden = !cover;
        if (cover) {
            $('calendar-day-cover-date').textContent = String(date.getDate());
            $('calendar-day-cover-title').textContent = cover.title;
            $('calendar-day-cover-type').textContent = cover.time || '';
            $('calendar-day-cover-description').textContent = descriptionLines(cover).join(' · ');
        }
        const list = $('mobile-dia-itens');
        list.replaceChildren();
        items.filter(item => item !== cover).forEach(function (item) {
            const row = C.el('article', 'mobile-day-row cal-tipo-' + item.type);
            const detail = C.el('div');
            detail.append(C.el('h3', '', item.title));
            descriptionLines(item).forEach(line => detail.append(C.el('p', '', line)));
            row.append(C.el('span', 'mobile-day-time', item.time || '—'), detail);
            list.append(row);
        });
        if (loading || partial || !items.length) list.append(C.el('p', 'calendario-agenda-vazia',
            loading ? 'Carregando agenda…' : partial ? 'Parte da agenda está indisponível.' : 'Nenhum item para este dia.'));
    }

    function controls() {
        const year = month.getFullYear();
        const number = month.getMonth();
        $('anterior').disabled = weekMode ? A.plusDays(weekStart(), -1) < '1900-01-01' : year === 1900 && number === 0;
        $('seguinte').disabled = weekMode ? A.plusDays(weekStart(), 7) > '2100-12-31' : year === 2100 && number === 11;
        $('atualizar-calendario').hidden = !partial;
        $('atualizar-calendario').disabled = loading;
    }

    function byPerson(personId) {
        if (personId === context.user.id) return 'Seu registro';
        const person = context.members.find(function (member) { return member.user_id === personId; });
        return person ? person.display_name.split(' ')[0] : 'Compartilhado com você';
    }

    function descriptionLines(item) {
        const normalize = text => text.trim().toLocaleLowerCase('pt-BR');
        const seen = new Set([item.title, item.label].map(normalize));
        const author = item.type === 'pessoal' ? item.label.split(' · ')[1] : '';
        return [author, ...item.lines].filter(line => {
            if (!line || seen.has(normalize(line))) return false;
            seen.add(normalize(line));
            return true;
        });
    }

    function makeCard(item, day) {
        const card = C.el('article', 'modal-consulta-item cal-tipo-' + item.type);
        if (day || item.time) {
            const meta = C.el('div', 'calendar-item-meta');
            if (day) {
                const date = C.el('time', '', C.date(day));
                date.dateTime = day;
                meta.append(date);
            }
            if (item.time) meta.append(C.el('span', '', item.time));
            card.append(meta);
        }
        card.append(C.el('h3', '', item.title));
        descriptionLines(item).forEach(line => card.append(C.el('p', '', line)));
        return card;
    }

    const weekGroups = [
        ['aniversario','Aniversários','birthday'], ['evento','Compromissos do casal','calendar'],
        ['conta','Contas a vencer','card'], ['lembrete','Lembretes','bell'],
        ['momento','Momentos especiais','heart'], ['tarefa','Tarefas','task'], ['pessoal','Ciclo e bem-estar','cycle']
    ];
    function drawAgenda() {
        const first=weekStart(), last=A.plusDays(first,6);
        $('selecionado').textContent=C.date(first)+' a '+C.date(last);
        const list=$('lista');
        const groups=weekGroups.map(([type,label,symbol])=>{
            const entries=[];
            for(let index=0;index<7;index++){
                const day=A.plusDays(first,index);
                for(const item of grouped.get(day)||[]) if(item.type===type)entries.push({day,item});
            }
            const details=C.el('details','calendar-week-category');
            details.dataset.kind=type;
            details.open=openGroup===type;
            const summary=C.el('summary','');
            const icon=C.el('span','calendar-week-icon'); icon.append(C.uiIcon(symbol));
            summary.append(icon,C.el('strong','',label),C.el('span','calendar-week-count',String(entries.length)));
            summary.addEventListener('click',()=>{
                openGroup=details.open?null:type;
                for(const other of list.children)if(other!==details)other.open=false;
            });
            const panel=C.el('div','calendar-week-items');
            for(const {day,item} of entries){
                panel.append(makeCard(item,day));
            }
            if(!entries.length)panel.append(C.el('p','empty-state',loading?'Carregando…':'Nenhum item nesta semana.'));
            details.append(summary,panel);
            return details;
        });
        list.replaceChildren(...groups);
        $('agenda-vazia').hidden=true;
        $('agenda-aviso').hidden=!loading&&!partial;
        $('agenda-aviso').textContent=loading?'Carregando a agenda…':'Parte da agenda está indisponível.';
    }

    const updateMonth=C.monthPicker({id:'calendar-month-dialog',button:$('calendar-month-picker'),caption:$('mes'),
        current:()=>A.key(month).slice(0,7),select:value=>go(A.local(value+'-01'))});

    function drawMonth() {
        updateMonth();
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
                blank.append(C.el('span','calendario-dia-numero',String(new Date(year,number,day).getDate())));
                days.append(blank);
                continue;
            }

            const key = A.key(new Date(year, number, day));
            const button = C.el('button', 'calendario-dia');
            const markers = C.el('span', 'calendario-dia-resumo');
            const byType = new Map();
            filtered(key).forEach(function (item) {
                if (!byType.has(item.type)) byType.set(item.type, []);
                byType.get(item.type).push(item);
            });
            const groups = Array.from(byType);
            for (const [type,items] of groups.slice(0,2)) {
                const marker = C.el('span', 'calendario-marcador cal-tipo-' + type);
                marker.append(C.el('span', 'calendario-marcador-titulo', items[0].title));
                if (items.length > 1) marker.append(C.el('span', 'calendario-marcador-total', '+' + (items.length - 1)));
                markers.append(marker);
            }
            const remaining = groups.slice(2).reduce((sum,[,items])=>sum+items.length,0);
            if (remaining) markers.append(C.el('span','calendar-extra-count','+'+remaining));

            button.type = 'button';
            button.dataset.dia = key;
            button.setAttribute('aria-controls', 'mobile-dia-agenda');
            button.setAttribute('aria-pressed', String(key === selected));
            const total = filtered(key).length;
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

    function record(day, type, label, title, lines, time) {
        if (!grouped.has(day)) grouped.set(day, []);
        grouped.get(day).push({ type: type, label: label, title: title, lines: lines, time: time });
    }

    function recordAnniversary(title, monthNumber, dayNumber, start, end) {
        const firstYear = Number(start.slice(0,4));
        const lastYear = Number(end.slice(0,4));
        for (let year = firstYear; year <= lastYear; year++) {
            const day = Math.min(dayNumber, new Date(year,monthNumber,0).getDate());
            const key = A.key(new Date(year,monthNumber-1,day));
            if (key >= start && key <= end) record(key,'aniversario','Aniversário',title,[]);
        }
    }

    async function load() {
        if (!context) return;
        const id = ++requestId;
        const first = weekStart();
        const last = A.plusDays(first, 6);
        const monthFirst=A.key(month);
        const monthLast=A.key(new Date(month.getFullYear(),month.getMonth()+1,0));
        const paddedStart=A.plusDays(monthFirst,-month.getDay());
        const paddedEnd=A.plusDays(monthLast,6-A.local(monthLast).getDay());
        const start = weekMode ? (first < '1900-01-01' ? '1900-01-01' : first) : (paddedStart<'1900-01-01'?'1900-01-01':paddedStart);
        const end = weekMode ? (last > '2100-12-31' ? '2100-12-31' : last) :
            (paddedEnd>'2100-12-31'?'2100-12-31':paddedEnd);
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
            A.cycle(start, end),
            couple ? C.all(() => supabaseClient.from('finance_bills').select('id,name,due_date')
                .eq('couple_id',couple).eq('is_active',true).gte('due_date',start).lte('due_date',end)
                .order('due_date').order('id')) : [],
            couple ? C.all(() => supabaseClient.from('couple_memories').select('id,title,memory_date')
                .eq('couple_id',couple).gte('memory_date',start).lte('memory_date',end)
                .order('memory_date').order('id')) : [],
            couple ? C.relationship() : null,
            couple ? supabaseClient.rpc('get_partner_birthday').then(C.result) : [],
            C.all(() => supabaseClient.from('app_notifications').select('id,title,created_at')
                .eq('user_id',context.user.id).gte('created_at',start+'T00:00:00').lt('created_at',A.plusDays(end,1)+'T00:00:00')
                .order('created_at').order('id'))
        ]);
        if (id !== requestId) return;

        grouped = new Map();
        partial = results.some(function (result) { return result.status === 'rejected'; });
        loading = false;
        const rows = results.map(function (result) { return result.status === 'fulfilled' ? result.value : []; });

        rows[0].forEach(function (event) {
            record(event.event_date, 'evento', 'Compromisso', event.title, [event.description], A.clock(event));
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
        rows[4].forEach(bill => record(bill.due_date,'conta','Conta a vencer',bill.name,[]));
        rows[5].forEach(memory => record(memory.memory_date,'momento','Momento especial',memory.title,[]));
        if (rows[6]?.relationship_date) {
            const [,m,d] = rows[6].relationship_date.split('-').map(Number);
            recordAnniversary('Aniversário de vocês',m,d,start,end);
        }
        const birthday = rows[7][0];
        const partner = context.members.find(member => member.user_id !== context.user.id);
        if (birthday && partner) recordAnniversary('Aniversário de '+partner.display_name.split(' ')[0],
            birthday.birthday_month,birthday.birthday_day,start,end);

        rows[8].forEach(item=>record(A.key(new Date(item.created_at)),'lembrete','Lembrete',item.title,[]));

        // Mantém o botão de origem no DOM enquanto o modal estiver aberto.
        if (dialog.open) {
            drawAgenda();
            paintInline();
            controls();
        } else drawMonth();

        status.textContent = partial ? 'Parte do calendário está indisponível. Confira a conexão ou tente novamente.' : 'Atualizado agora';
        C.pageReady();
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

    function selectDay(day) {
        selected = day;
        month = A.local(day);
        month.setDate(1);
        updateMonth();
        grid.querySelector('[aria-pressed="true"]')?.setAttribute('aria-pressed','false');
        grid.querySelector('[data-dia="'+day+'"]')?.setAttribute('aria-pressed','true');
        paintWeek();
        paintInline();
    }

    document.querySelectorAll('[data-calendar-mode]').forEach(button => button.addEventListener('click', () => { displayMode=button.dataset.calendarMode; weekMode=displayMode==='week'; calendar.dataset.mode=displayMode; document.querySelectorAll('[data-calendar-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===button))); go(A.local(selected)); }));
    $('mock-calendar-filter')?.addEventListener('change', function(){filterType=this.value;drawMonth();});
    $('anterior').addEventListener('click', function () { move(-1); });
    $('seguinte').addEventListener('click', function () { move(1); });
    $('hoje').addEventListener('click', function () { go(A.local(C.today())); });
    toggle.addEventListener('click', function () {
        weekMode = !weekMode;
        displayMode = weekMode ? "week" : "month";
        go(A.local(selected));
    });
    mobile.addEventListener('change', function () {
        weekMode = displayMode === "week";
        if (dialog.open) dialog.close();
        go(A.local(selected));
    });
    weekGrid.addEventListener('click', function (event) {
        const button = event.target.closest('[data-semana-dia]');
        if (!button || button.disabled) return;
        selectDay(button.dataset.semanaDia);
    });
    $('atualizar-calendario').addEventListener('click', function () { if (context) void load(); else window.location.reload(); });
    grid.addEventListener('click', function (event) {
        const button = event.target.closest('[data-dia]');
        if (!button) return;
        selectDay(button.dataset.dia);
    });
    function openWeek() {
        openGroup=null;
        drawAgenda();
        dialog.scrollTop=0;
        C.openOverview(dialog,this);
    }
    $('calendar-day-detail').addEventListener('click',openWeek);
    agendaToggle.addEventListener('click',openWeek);
    dialog.addEventListener('close', function () {
        // Redesenha só depois que o foco voltar ao botão que abriu o modal.
        queueMicrotask(drawMonth);
    });
    C.refreshOnReturn(function () {
        if (!context || loading) return;
        return load();
    });

    drawMonth();
    C.ready.then(function (value) {
        context = value;
        return load();
    }).catch(function (error) {
        C.pageReady();
        loading = false;
        partial = true;
        status.textContent = C.error(error);
        if (dialog.open) drawAgenda();
        paintInline();
        controls();
    });
})();
