/* O editor usa os mesmos compromissos que já apareciam no Calendário. */
(function () {
    'use strict';
    const C = CC, A = C.agenda, $ = C.$;
    const month = $('mes-compromissos');
    const list = $('lista-compromissos');
    const status = $('status-compromissos');
    const newItem = $('novo-item');
    let context;
    let rows = [];
    let generation = 0;

    const dialog = $('editor-tarefa-mobile');

    const monthButton = $('compromisso-mes-atual');
    const previousMonth = $('compromisso-mes-anterior');
    const nextMonth = $('compromisso-mes-seguinte');
    const monthDialog = C.dialog('compromisso-mes-dialog', 'Consultar compromissos', `
        <form class="form-app" id="compromisso-mes-form">
            <label class="cc-field">Mês
                <select id="compromisso-mes-numero" required></select>
            </label>
            <label class="cc-field">Ano
                <input type="number" id="compromisso-mes-ano" min="1900" max="2100" step="1" required>
            </label>
            <button class="primary-button" type="submit">Consultar</button>
        </form>`);
    const monthSelect = $('compromisso-mes-numero');
    const yearInput = $('compromisso-mes-ano');
    for (let index = 0; index < 12; index += 1) {
        const name = new Date(2000, index, 1).toLocaleDateString('pt-BR', { month: 'long' });
        monthSelect.append(new Option(name, String(index + 1).padStart(2, '0')));
    }

    function setMonth(value) {
        month.value = value;
        void load();
    }
    monthButton.addEventListener('click', function () {
        monthSelect.value = month.value.slice(5);
        yearInput.value = month.value.slice(0, 4);
        monthDialog.showModal();
        monthSelect.focus();
    });
    $('compromisso-mes-form').addEventListener('submit', function (event) {
        event.preventDefault();
        setMonth(yearInput.value + '-' + monthSelect.value);
        monthDialog.close();
    });
    [previousMonth, nextMonth].forEach(function (button, index) {
        button.addEventListener('click', function () {
            const date = A.local(month.value + '-01');
            date.setMonth(date.getMonth() + (index === 0 ? -1 : 1));
            setMonth(A.key(date).slice(0, 7));
        });
    });

    const form = $('form-compromisso');
    let editing = null;

    function prepararEditor(row, day) {
        editing = row || null;
        form.reset();
        $('feedback-compromisso').textContent = '';
        $('compromisso-titulo').value = row?.title || '';
        $('compromisso-descricao').value = row?.description || '';
        const today = C.today();
        $('compromisso-data').value = row?.event_date || day || today;
        $('compromisso-inicio').value = row?.start_time?.slice(0, 5) || '';
        $('compromisso-fim').value = row?.end_time?.slice(0, 5) || '';
    }

    function open(row, day) {
        prepararEditor(row, day);
        C.tarefasEditor.abrir('compromisso', row ? 'Editar compromisso' : null);
    }

    function draw() {
        const fragment = document.createDocumentFragment();
        rows.forEach(function (row) {
            const item = C.el('article', 'tarefas-compromisso');
            const summary = C.el('div');
            summary.append(C.el('h3', '', row.title),
                C.el('p', 'cc-status', C.date(row.event_date) + ' · ' + A.clock(row)));
            if (row.description) summary.append(C.el('p', '', row.description));
            const actions = C.el('div', 'acoes-app');
            const edit = C.button('Editar', function () { open(row); }, 'botao-secundario');
            const remove = C.button('Excluir', async function () {
                if (!window.confirm('Excluir o compromisso “' + row.title + '”?')) return;
                C.result(await supabaseClient.from('calendar_events').delete()
                    .eq('id', row.id).eq('version', row.version).select('id').single());
                await load();
                newItem.focus();
                C.notify('Compromisso excluído.');
            }, 'botao-secundario');
            edit.setAttribute('aria-label', 'Editar ' + row.title);
            remove.setAttribute('aria-label', 'Excluir ' + row.title);
            actions.append(edit, remove);
            item.append(summary, actions);
            fragment.append(item);
        });
        list.replaceChildren(fragment);
    }

    async function load() {
        const token = ++generation;
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month.value) || month.value < '1900-01' || month.value > '2100-12') {
            rows = [];
            draw();
            status.textContent = 'Escolha um mês válido no formato AAAA-MM.';
            return;
        }
        const start = month.value + '-01';
        const date = A.local(start);
        monthButton.textContent = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        monthButton.disabled = false;
        previousMonth.disabled = month.value === '1900-01';
        nextMonth.disabled = month.value === '2100-12';
        const end = A.key(new Date(date.getFullYear(), date.getMonth() + 1, 0));
        status.textContent = 'Atualizando compromissos…';
        list.replaceChildren();
        try {
            const result = await A.events(context.couple, start, end);
            if (token !== generation) return;
            rows = result;
            draw();
            status.textContent = rows.length ? '' : 'Nenhum compromisso neste mês.';
        } catch (error) {
            if (token === generation) status.textContent = C.error(error);
        }
    }

    C.form(form, async function () {
        const title = $('compromisso-titulo').value.trim();
        const start = $('compromisso-inicio').value;
        const end = $('compromisso-fim').value;
        if (!title) throw new Error('Informe um título para o compromisso.');
        if (end && (!start || end <= start)) throw new Error('O fim precisa ser depois do início no mesmo dia.');
        const values = {
            title: title, description: $('compromisso-descricao').value.trim(), event_date: $('compromisso-data').value,
            start_time: start || null, end_time: end || null
        };
        const query = editing
            ? supabaseClient.from('calendar_events').update(values).eq('id', editing.id).eq('version', editing.version)
            : supabaseClient.from('calendar_events').insert(Object.assign({ couple_id: context.couple }, values));
        C.result(await query.select('id').single());
        month.value = values.event_date.slice(0, 7);
        const feedback = editing ? 'Compromisso atualizado.' : 'Compromisso criado.';
        $('feedback-compromisso').textContent = feedback;
        dialog.close();
        await load();
        newItem.focus();
    });

    newItem.addEventListener('click', function () { prepararEditor(); });
    C.ready.then(async function (value) {
        context = value;
        month.value = C.today().slice(0, 7);
        if (!context.couple) {
            status.textContent = 'Conecte seu casal em Configurações para criar compromissos.';
            return;
        }
        newItem.disabled = false;
        await load();
        const requested = new URLSearchParams(location.search).get('evento');
        if (location.hash === '#compromissos' && /^\d{4}-\d{2}-\d{2}$/.test(requested || '')) {
            const date = A.local(requested);
            if (date.getTime() && A.key(date) === requested && requested >= '1900-01-01' && requested <= '2100-12-31') {
                month.value = requested.slice(0, 7);
                void load();
                open(null, requested);
            }
        }
    }).catch(function (error) { status.textContent = C.error(error); });
})();
