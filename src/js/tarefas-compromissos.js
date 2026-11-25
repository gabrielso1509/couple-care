/* O editor usa os mesmos compromissos que já apareciam no Calendário. */
(function () {
    'use strict';
    const C = CC, A = C.agenda, $ = C.$;
    const month = $('mes-compromissos');
    const list = $('lista-compromissos');
    const status = $('status-compromissos');
    const newEvent = $('novo-compromisso');
    let context;
    let rows = [];
    let generation = 0;

    const dialog = C.dialog('editor-compromisso', 'Compromisso', `
        <form class="form-app" id="form-compromisso">
            <label class="cc-field">Título<input id="compromisso-titulo" required maxlength="150"></label>
            <label class="cc-field">Descrição (opcional)<textarea id="compromisso-descricao" maxlength="3000" rows="3"></textarea></label>
            <label class="cc-field">Data<input id="compromisso-data" type="date" min="1900-01-01" max="2100-12-31" required></label>
            <div class="form-row">
                <label class="cc-field">Início (opcional)<input id="compromisso-inicio" type="time"></label>
                <label class="cc-field">Fim (opcional)<input id="compromisso-fim" type="time"></label>
            </div>
            <p class="cc-status">Sem horário de início, o compromisso aparece como dia inteiro.</p>
            <button class="primary-button" type="submit" id="salvar-compromisso">Salvar compromisso</button>
            <p id="feedback-compromisso" role="status"></p>
        </form>`);

    const form = $('form-compromisso');
    let editing = null;

    function open(row) {
        editing = row || null;
        form.reset();
        $('feedback-compromisso').textContent = '';
        $('editor-compromisso-title').textContent = row ? 'Editar compromisso' : 'Novo compromisso';
        $('compromisso-titulo').value = row?.title || '';
        $('compromisso-descricao').value = row?.description || '';
        const today = C.today();
        $('compromisso-data').value = row?.event_date || (today.startsWith(month.value) ? today : month.value + '-01');
        $('compromisso-inicio').value = row?.start_time?.slice(0, 5) || '';
        $('compromisso-fim').value = row?.end_time?.slice(0, 5) || '';
        dialog.showModal();
        $('compromisso-titulo').focus();
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
                newEvent.focus();
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
            newEvent.disabled = true;
            status.textContent = 'Escolha um mês válido no formato AAAA-MM.';
            return;
        }
        newEvent.disabled = false;
        const start = month.value + '-01';
        const date = A.local(start);
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
        newEvent.focus();
    });

    newEvent.addEventListener('click', function () { open(); });
    month.addEventListener('change', load);
    C.ready.then(function (value) {
        context = value;
        month.value = C.today().slice(0, 7);
        if (!context.couple) {
            status.textContent = 'Conecte seu casal em Configurações para criar compromissos.';
            return;
        }
        month.disabled = false;
        return load();
    }).catch(function (error) { status.textContent = C.error(error); });
})();
