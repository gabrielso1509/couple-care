/* Lançamentos reais em centavos; metas e aportes ficam no banco do casal. */
(function () {
    'use strict';
    const C = CC, $ = C.$;
    const categories = { house: 'Casa', leisure: 'Lazer', health: 'Saúde', market: 'Mercado', transport: 'Transporte', salary: 'Salário', other: 'Outros' };
    let context, entries = [], goals = [], edited = null, goalEdit = null, limit = 30, generation = 0;
    let loading = false, customCategories = [], categorySaving = false, draftKey = null;
    $('finance-month').value = C.today().slice(0, 7);
    const entryDialog = C.dialog('entry-dialog', 'Lançamento do casal', `
        <form id="entry-form"><label class="cc-field">Descrição<input id="entry-description" maxlength="150" required></label>
        <div class="form-row"><label class="cc-field">Tipo<select id="entry-type"><option value="expense">Despesa</option><option value="income">Receita</option></select></label><label class="cc-field">Valor em reais<input id="entry-amount" inputmode="decimal" placeholder="0,00" required></label></div>
        <div class="form-row"><label class="cc-field">Data<input id="entry-date" type="date" min="1900-01-01" max="2100-12-31" required></label><label class="cc-field">Categoria<select id="entry-category"></select></label></div>
        <div class="inline-category-tools"><button id="new-entry-category" type="button" class="text-button">+ Nova categoria</button></div>
        <div id="inline-category-editor" class="inline-category-editor" hidden><label class="cc-field">Nome da nova categoria<input id="new-category-name" maxlength="40" placeholder="Ex.: Pets, Educação, Assinaturas"></label><div class="cc-row-actions"><button type="button" class="soft-button" id="save-entry-category">Salvar categoria</button><button type="button" class="text-button" id="cancel-entry-category">Cancelar</button></div><p id="entry-category-status" role="status" aria-live="polite"></p></div>
        <button type="submit" class="primary-button">Salvar lançamento</button><p id="entry-status" role="status"></p></form>`);
    function syncCategories(value) {
        const select = $('entry-category'); const previous = value || select.value || 'house'; select.replaceChildren();
        Object.keys(categories).forEach(function (key) { const o = C.el('option', '', categories[key]); o.value = key; select.append(o); });
        if (customCategories.length) {
            const group = C.el('optgroup'); group.label = 'Categorias do casal';
            customCategories.forEach(function (row) { const o = C.el('option', '', row.name); o.value = 'custom:' + row.id; group.append(o); });
            select.append(group);
        }
        select.value = previous; if (!select.value) select.value = 'house';
    }
    function categoryName(row) {
        return row.custom_category_id ? customCategories.find(function (c) { return c.id === row.custom_category_id; })?.name || 'Categoria do casal' : categories[row.category] || 'Outros';
    }
    function normalized(s) { return s.trim().toLocaleLowerCase('pt-BR'); }
    $('new-entry-category').addEventListener('click', function () {
        $('inline-category-editor').hidden = false; $('new-category-name').focus();
    });
    $('cancel-entry-category').addEventListener('click', function () {
        $('inline-category-editor').hidden = true; $('entry-category-status').textContent = ''; $('new-entry-category').focus();
    });
    $('save-entry-category').addEventListener('click', async function () {
        if (categorySaving || entryDialog.dataset.busy) return;
        const name = $('new-category-name').value.trim();
        if (!name) { $('entry-category-status').textContent = 'Escreva o nome da categoria.'; $('new-category-name').focus(); return; }
        const existingBuiltIn = Object.keys(categories).find(function (key) { return normalized(categories[key]) === normalized(name); });
        if (existingBuiltIn) { syncCategories(existingBuiltIn); $('inline-category-editor').hidden = true; return; }
        const existing = customCategories.find(function (row) { return normalized(row.name) === normalized(name); });
        if (existing) { syncCategories('custom:' + existing.id); $('inline-category-editor').hidden = true; return; }
        categorySaving = true; entryDialog.dataset.busy = 'true';
        const controls = Array.from(entryDialog.querySelectorAll('input,select,textarea,button')); const states = controls.map(function (c) { return c.disabled; });
        controls.forEach(function (c) { c.disabled = true; }); $('entry-category-status').textContent = 'Salvando categoria…';
        try {
            const row = C.result(await supabaseClient.from('finance_categories').insert({ couple_id: context.couple, name: name }).select('id,name').single()); C.notify('Categoria criada.');
            customCategories.push(row); syncCategories('custom:' + row.id); $('inline-category-editor').hidden = true; $('new-category-name').value = '';
        } catch (error) {
            if (error.code === '23505') {
                try {
                    customCategories = await C.all(function () { return supabaseClient.from('finance_categories').select('id,name').eq('couple_id', context.couple).order('name').order('id'); });
                    const row = customCategories.find(function (c) { return normalized(c.name) === normalized(name); });
                    if (!row) throw error;
                    syncCategories('custom:' + row.id); $('inline-category-editor').hidden = true;
                } catch (failure) { $('entry-category-status').textContent = C.error(failure); }
            } else $('entry-category-status').textContent = C.error(error);
        } finally {
            controls.forEach(function (c,i) { c.disabled = states[i]; }); delete entryDialog.dataset.busy; categorySaving = false;
        }
    });
    syncCategories();
    const goalDialog = C.dialog('goal-dialog', 'Um sonho em conjunto', `
        <form id="goal-form"><label class="cc-field">Nome da meta<input id="goal-title" maxlength="150" required></label><label class="cc-field">Valor desejado em reais<input id="goal-target" inputmode="decimal" placeholder="0,00" required></label><label class="cc-field">Prazo opcional<input id="goal-date" type="date" min="1900-01-01" max="2100-12-31"></label><button type="submit" class="primary-button">Salvar meta</button><p id="goal-status" role="status"></p></form>`);
    const contributionDialog = C.dialog('contribution-dialog', 'Adicionar valor à meta', `
        <form id="contribution-form"><p id="contribution-title"></p><label class="cc-field">Valor em reais<input id="contribution-amount" inputmode="decimal" placeholder="0,00" required></label><p class="cc-status">Este aporte acompanha a meta. Ele não cria automaticamente uma receita ou despesa.</p><button type="submit" class="primary-button">Registrar aporte</button><p id="contribution-status" role="status"></p></form><div id="contribution-list"></div>`);
    let contributionGoal = null;
    function enable(ok) { ['new-entry','new-goal'].forEach(function (id) { $(id).disabled = !ok; }); }
    enable(false);
    function editEntry(row) {
        edited = row;
        const key = row ? row.id : 'new';
        if (draftKey === key) { entryDialog.showModal(); return; }
        draftKey = key;
        $('inline-category-editor').hidden = true;
        $('entry-form').reset(); $('entry-status').textContent = '';
        $('entry-description').value = row?.description || '';
        $('entry-type').value = row?.entry_type || 'expense';
        $('entry-amount').value = row ? (Number(row.amount_cents) / 100).toFixed(2).replace('.', ',') : '';
        $('entry-date').value = row?.entry_date || C.today();
        syncCategories(row?.custom_category_id ? 'custom:' + row.custom_category_id : row?.category || 'house');
        entryDialog.showModal();
    }
    function editGoal(row) {
        goalEdit = row; $('goal-form').reset(); $('goal-status').textContent = '';
        $('goal-title').value = row?.title || '';
        $('goal-target').value = row ? (Number(row.target_cents) / 100).toFixed(2).replace('.', ',') : '';
        $('goal-date').value = row?.target_date || '';
        goalDialog.showModal();
    }
    function monthBounds() {
        const m = $('finance-month').value;
        if (!/^\d{4}-\d{2}$/.test(m)) throw new Error('Escolha um mês.');
        const d = new Date(m + '-01T12:00:00'); d.setMonth(d.getMonth() + 1);
        return { start: m + '-01', end: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01' };
    }
    /* Eixos e marcas em reais; a altura das barras usa a mesma escala do eixo Y. */
    function chart(summary) {
        const box = $('finance-chart'); box.replaceChildren();
        const data = summary.categories || [];
        if (!data.length) { box.append(C.el('p', 'empty-state', 'Nenhuma despesa registrada neste mês.')); return; }
        const max = Math.max.apply(null, data.map(function (r) { return Number(r.amount); }));
        const raw = max / 5, power = Math.pow(10, Math.floor(Math.log10(raw)));
        const nice = [1,2,2.5,5,10].find(function (n) { return n * power >= raw; });
        const step = Math.max(1, Math.ceil(nice * power)); const top = step * 5;
        box.append(C.el('p', 'chart-axis-title', 'Valor (R$)'));
        const frame = C.el('div', 'chart-frame'), y = C.el('div', 'chart-y-axis'); y.setAttribute('aria-hidden', 'true');
        for (let i = 0; i <= 5; i++) { const label = C.el('span', '', C.money(top - i * step)); label.style.top = i * 20 + '%'; y.append(label); }
        const scroll = C.el('div', 'chart-scroll'); scroll.tabIndex = 0; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', 'Gráfico de despesas por categoria. Role horizontalmente para ver mais categorias.');
        const plot = C.el('div', 'chart-plot'); plot.style.minWidth = Math.max(220, data.length * 116) + 'px';
        const lines = C.el('div', 'chart-grid'); lines.setAttribute('aria-hidden', 'true');
        for (let i = 0; i <= 5; i++) { const line = C.el('span'); line.style.top = i * 20 + '%'; lines.append(line); }
        const bars = C.el('div', 'chart-bars'); bars.append(lines);
        const x = C.el('div', 'chart-x-axis');
        const table = C.el('table', 'cc-sr'); const caption = C.el('caption', '', 'Despesas por categoria em reais'); const body = C.el('tbody'); table.append(caption, body);
        data.forEach(function (row) {
            const name = row.name || categories[row.category] || 'Categoria do casal';
            const slot = C.el('div', 'chart-bar-slot'), bar = C.el('div', 'chart-bar');
            bar.style.height = Number(row.amount) / top * 100 + '%';
            const amount = C.el('span', 'chart-bar-value', C.money(row.amount)); bar.append(amount); slot.append(bar); bars.append(slot);
            x.append(C.el('span', '', name));
            const tr = C.el('tr'), th = C.el('th', '', name); th.scope = 'row'; tr.append(th, C.el('td', '', C.money(row.amount))); body.append(tr);
        });
        plot.append(bars, x); scroll.append(plot); frame.append(y, scroll); box.append(frame, C.el('p', 'chart-axis-caption', 'Categorias'), table);
    }
    function summaryState(summary) {
        const balance = Number(summary.balance), card = $('balance-card');
        card.classList.remove('is-positive','is-negative','is-neutral'); card.classList.add(balance > 0 ? 'is-positive' : balance < 0 ? 'is-negative' : 'is-neutral');
        card.querySelector('small').textContent = balance > 0 ? 'Receitas acima das despesas neste mês.' : balance < 0 ? 'Despesas acima das receitas neste mês.' : Number(summary.income) ? 'Receitas e despesas equilibradas.' : 'Sem lançamentos neste mês.';
        let badge = $('balance-state');
        if (!badge) { badge = C.el('span', 'balance-state'); badge.id = 'balance-state'; card.append(badge); }
        badge.textContent = balance > 0 ? 'Positivo' : balance < 0 ? 'Negativo' : 'Equilibrado';
    }
    function renderEntries() {
        const box = $('finance-entries'); box.replaceChildren();
        if (!entries.length) box.append(C.el('p', 'empty-state', 'Nenhum lançamento neste mês. Comecem pelo primeiro cuidado com as finanças.'));
        entries.forEach(function (row) {
            const line = C.el('article', 'transaction'), text = C.el('p');
            text.append(C.el('b', '', row.description), C.el('small', '', C.date(row.entry_date) + ' · ' + categoryName(row)));
            line.append(text, C.el('strong', row.entry_type === 'income' ? 'positive' : '', (row.entry_type === 'income' ? '+ ' : '− ') + C.money(row.amount_cents)));
            const actions = C.el('div', 'cc-row-actions');
            actions.append(C.button('Editar', function () { editEntry(row); }), C.button('Excluir', async function () {
                if (!confirm('Excluir este lançamento?')) return;
                C.result(await supabaseClient.from('finance_entries').delete().eq('id', row.id).eq('version', row.version).select('id').single()); C.notify('Lançamento removido.');
                await load();
            })); line.append(actions); box.append(line);
        });
        $('more-entries').hidden = entries.length < limit;
    }
    async function openContributions(goal) {
        contributionGoal = goal; $('contribution-form').reset(); $('contribution-status').textContent = '';
        $('contribution-title').textContent = goal.title; C.empty('contribution-list', 'Carregando aportes…');
        contributionDialog.showModal();
        const rows = C.result(await supabaseClient.from('goal_contributions').select('id,amount_cents,created_at').eq('goal_id', goal.id).order('created_at', { ascending: false }).limit(30));
        const box = $('contribution-list'); box.replaceChildren();
        if (!rows.length) box.append(C.el('p', 'empty-state', 'A meta ainda não recebeu aportes.'));
        rows.forEach(function (r) {
            const line = C.el('div', 'transaction'); line.append(C.el('b', '', C.money(r.amount_cents)), C.el('small', '', C.date(r.created_at)));
            line.append(C.button('Excluir aporte', async function () {
                if (!confirm('Retirar este aporte da meta?')) return;
                C.result(await supabaseClient.from('goal_contributions').delete().eq('id', r.id).select('id').single()); C.notify('Aporte removido.');
                await load(); await openContributions(goals.find(function (g) { return g.id === goal.id; }) || goal);
            })); box.append(line);
        });
    }
    function renderGoals() {
        const box = $('finance-goals'); box.replaceChildren();
        if (!goals.length) box.append(C.el('p', 'empty-state', 'Qual é o próximo sonho de vocês? Crie uma meta para começar.'));
        goals.forEach(function (g) {
            const card = C.el('section', 'cc-goal'); const ratio = Math.min(100, Math.round(Number(g.saved_cents) / Number(g.target_cents) * 100));
            card.append(C.el('h4', '', g.title), C.el('strong', '', C.money(g.saved_cents)), C.el('small', '', 'de ' + C.money(g.target_cents)));
            const progress = C.el('div', 'progress-bar'), fill = C.el('i'); fill.style.width = ratio + '%'; progress.append(fill); progress.setAttribute('aria-label', ratio + '% da meta');
            card.append(progress, C.el('p', 'goal-meta', ratio + '% alcançado' + (g.target_date ? ' · Meta: ' + C.date(g.target_date) : '')));
            const actions = C.el('div', 'cc-row-actions');
            actions.append(C.button('+ Adicionar valor', async function () { await openContributions(g); }, 'soft-button'), C.button('Editar', function () { editGoal(g); }), C.button('Excluir', async function () {
                if (!confirm('Excluir esta meta e os aportes dela?')) return;
                C.result(await supabaseClient.from('savings_goals').delete().eq('id', g.id).eq('version', g.version).select('id').single()); C.notify('Meta removida.'); await load();
            })); card.append(actions); box.append(card);
        });
    }
    async function load() {
        if (!context?.couple) return;
        const token = ++generation; loading = true; $('finance-status').textContent = 'Atualizando finanças…'; $('finance-status').classList.remove('is-error');
        try {
            const bounds = monthBounds();
            const responses = await Promise.all([
                supabaseClient.rpc('finance_month_summary', { p_month: bounds.start }),
                supabaseClient.from('finance_entries').select('*').eq('couple_id', context.couple).gte('entry_date', bounds.start).lt('entry_date', bounds.end).order('entry_date', { ascending: false }).order('id').limit(limit),
                supabaseClient.rpc('list_savings_goals'),
                C.all(function () { return supabaseClient.from('finance_categories').select('id,name').eq('couple_id', context.couple).order('name').order('id'); })
            ]);
            const data = responses.slice(0,3).map(C.result); if (token !== generation) return;
            const summary = data[0]; entries = data[1]; goals = data[2]; customCategories = responses[3]; syncCategories(); summaryState(summary);
            $('finance-balance').textContent = C.money(summary.balance); $('finance-income').textContent = C.money(summary.income); $('finance-expense').textContent = C.money(summary.expense);
            $('finance-ratio').textContent = Number(summary.income) > 0 ? Math.round(Number(summary.expense) / Number(summary.income) * 100) + '% das receitas registradas' : 'Sem receitas registradas no mês';
            chart(summary); renderEntries(); renderGoals();
            $('finance-status').textContent = 'Atualizado. Os valores refletem seus registros, não um saldo bancário conectado.';
        } catch (error) {
            if (token !== generation) return;
            ['finance-balance','finance-income','finance-expense'].forEach(function (id) { $(id).textContent = '—'; });
            ['finance-chart','finance-entries','finance-goals'].forEach(function (id) { C.empty(id, 'Consulta indisponível.'); });
            $('finance-status').textContent = C.error(error); $('finance-status').classList.add('is-error');
            $('balance-card').classList.remove('is-positive','is-negative'); $('balance-card').classList.add('is-neutral');
            $('balance-card').querySelector('small').textContent = 'Consulta indisponível.';
            if ($('balance-state')) $('balance-state').textContent = 'Sem consulta';
        } finally { loading = false; }
    }
    C.form($('entry-form'), async function () {
        const title = $('entry-description').value.trim(); if (!title) throw new Error('Informe uma descrição.');
        const values = { description: title, entry_type: $('entry-type').value, amount_cents: C.cents($('entry-amount').value), entry_date: $('entry-date').value, category: $('entry-category').value.startsWith('custom:') ? 'other' : $('entry-category').value, custom_category_id: $('entry-category').value.startsWith('custom:') ? $('entry-category').value.slice(7) : null };
        const query = edited ? supabaseClient.from('finance_entries').update(values).eq('id', edited.id).eq('version', edited.version) : supabaseClient.from('finance_entries').insert(Object.assign({ couple_id: context.couple }, values));
        C.result(await query.select('id').single()); draftKey = null; entryDialog.close(); await load();
    });
    C.form($('goal-form'), async function () {
        const title = $('goal-title').value.trim(); if (!title) throw new Error('Informe um nome para a meta.');
        const values = { title: title, target_cents: C.cents($('goal-target').value), target_date: $('goal-date').value || null };
        const query = goalEdit ? supabaseClient.from('savings_goals').update(values).eq('id', goalEdit.id).eq('version', goalEdit.version) : supabaseClient.from('savings_goals').insert(Object.assign({ couple_id: context.couple }, values));
        C.result(await query.select('id').single()); goalDialog.close(); await load();
    });
    C.form($('contribution-form'), async function () {
        C.result(await supabaseClient.from('goal_contributions').insert({ goal_id: contributionGoal.id, amount_cents: C.cents($('contribution-amount').value) }).select('id').single());
        $('contribution-form').reset(); $('contribution-status').textContent = 'Aporte registrado.'; await load();
        await openContributions(goals.find(function (g) { return g.id === contributionGoal.id; }) || contributionGoal);
    });
    $('new-entry').addEventListener('click', function () { editEntry(null); });
    $('new-goal').addEventListener('click', function () { editGoal(null); });
    $('finance-month').addEventListener('change', function () { if (this.value) { limit = 30; load(); } });
    $('reload-finance').addEventListener('click', load);
    $('more-entries').addEventListener('click', function () { if (!loading) { limit += 30; load(); } });
    C.ready.then(function (c) { context = c; if (!c.couple) { $('finance-status').textContent = 'Conecte seu casal em Configurações para usar as finanças.'; ['finance-chart','finance-entries','finance-goals'].forEach(function (id) { C.empty(id, 'Nenhum casal conectado.'); }); return; } enable(true); load(); }).catch(function (e) { $('finance-status').textContent = C.error(e); });
})();
