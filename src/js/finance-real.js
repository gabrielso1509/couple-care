/* Lançamentos reais em centavos. */
(function () {
    'use strict';
    const C = CC, $ = C.$;
    const categories = { house: 'Casa', leisure: 'Lazer', health: 'Saúde', market: 'Mercado', transport: 'Transporte', salary: 'Salário', other: 'Outros' };
    let context, entries = [], financeAccounts = [], bills = [], billsReady = false, edited = null, billEdit = null, limit = 30, generation = 0;
    let loading = false, customCategories = [], draftKey = null;
    $('finance-month').value = C.today().slice(0, 7);
    const periodControl = C.el('div', 'finance-period-controls');
    periodControl.innerHTML = '<label class="cc-field"><span class="cc-sr">Período</span><select id="finance-period"><option value="day">Hoje</option><option value="week">Últimos 7 dias</option><option value="15days">Últimos 15 dias</option><option value="month" selected>Este mês</option><option value="6months">Últimos 6 meses</option><option value="year">Este ano</option><option value="custom">Personalizado</option><option value="selected-month" hidden>Mês selecionado</option></select></label><label class="cc-field finance-custom-date" id="finance-from-wrap" hidden>De<input id="finance-from" type="date"></label><label class="cc-field finance-custom-date" id="finance-to-wrap" hidden>Até<input id="finance-to" type="date"></label>';
    $('finance-month').closest('.finance-month-control').after(periodControl);
    $('finance-from').value = C.today(); $('finance-to').value = C.today();
    const entryDialog = C.dialog('entry-dialog', 'Lançamento do casal', `
        <form id="entry-form"><label class="cc-field">Descrição<input id="entry-description" maxlength="150" required></label>
        <div class="form-row"><label class="cc-field">Tipo<select id="entry-type"><option value="expense">Despesa</option><option value="income">Receita</option></select></label><label class="cc-field">Valor em reais<input id="entry-amount" inputmode="decimal" placeholder="0,00" required></label></div>
        <div class="form-row"><label class="cc-field">Data<input id="entry-date" type="date" min="1900-01-01" max="2100-12-31" required></label><label class="cc-field">Categoria<select id="entry-category"></select></label></div>
        <label class="cc-field">Conta vinculada (opcional)<select id="entry-account"><option value="">Sem conta vinculada</option></select></label>
        <button type="submit" class="primary-button">Salvar lançamento</button><p id="entry-status" role="status"></p></form>`);
    function syncCategorySelect(select, value, fallback) {
        const previous = value ?? (select.value || fallback);
        select.replaceChildren();
        Object.entries(categories).forEach(([key, name]) => select.add(new Option(name, key)));
        if (customCategories.length) {
            const group = C.el('optgroup');
            group.label = 'Categorias do casal';
            customCategories.forEach(category => group.append(new Option(category.name, 'custom:' + category.id)));
            select.append(group);
        }
        select.value = previous;
        if (!select.value) select.value = fallback;
    }
    const syncCategories = value => syncCategorySelect($('entry-category'), value, 'house');
    function categoryName(row) {
        return row.custom_category_id ? customCategories.find(function (c) { return c.id === row.custom_category_id; })?.name || 'Categoria do casal' : categories[row.category] || 'Outros';
    }
    const normalize = name => name.trim().toLocaleLowerCase('pt-BR');
    const loadCategories = () => C.all(() => supabaseClient.from('finance_categories').select('id,name')
        .eq('couple_id', context.couple).order('name').order('id'));
    function findCustomCategory(name) {
        return customCategories.find(category => normalize(category.name) === normalize(name));
    }
    function categoryEditor(dialog, kind, select) {
        const trigger = C.el('button', 'soft-button', '+ Nova categoria');
        trigger.id = 'new-' + kind + '-category';
        trigger.type = 'button';
        trigger.setAttribute('aria-expanded', 'false');
        const tools = C.el('div', 'inline-category-tools');
        tools.append(trigger);
        const editor = C.el('div', 'inline-category-editor');
        editor.id = kind + '-category-editor';
        editor.hidden = true;
        trigger.setAttribute('aria-controls', editor.id);
        editor.innerHTML = '<label class="cc-field">Nome da nova categoria<input maxlength="40" placeholder="Ex.: Pets, Educação, Assinaturas"></label>' +
            '<div class="cc-row-actions"><button type="button" class="soft-button" data-save-category>Salvar categoria</button>' +
            '<button type="button" class="text-button" data-cancel-category>Cancelar</button></div><p role="status"></p>';
        select.closest('.form-row').after(tools, editor);
        const nameInput = editor.querySelector('input');
        const feedback = editor.querySelector('[role=status]');
        const save = editor.querySelector('[data-save-category]');
        function close(focus = true) {
            editor.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
            nameInput.value = '';
            feedback.textContent = '';
            if (focus) select.focus();
        }
        function choose(value) {
            syncCategories(kind === 'entry' ? value : undefined);
            syncCategorySelect($('bill-category'), kind === 'bill' ? value : undefined, 'other');
            close();
        }
        trigger.addEventListener('click', () => {
            editor.hidden = false;
            trigger.setAttribute('aria-expanded', 'true');
            nameInput.focus();
        });
        editor.querySelector('[data-cancel-category]').addEventListener('click', () => close());
        nameInput.addEventListener('keydown', event => {
            if (event.key === 'Enter' && !event.isComposing) {
                event.preventDefault();
                save.click();
            }
        });
        save.addEventListener('click', async () => {
            if (dialog.dataset.busy) return;
            const name = nameInput.value.trim();
            if (!name) { feedback.textContent = 'Escreva o nome da categoria.'; nameInput.focus(); return; }
            const builtIn = Object.keys(categories).find(key => normalize(categories[key]) === normalize(name));
            if (builtIn) { choose(builtIn); return; }
            const existing = findCustomCategory(name);
            if (existing) { choose('custom:' + existing.id); return; }
            dialog.dataset.busy = 'true';
            const controls = Array.from(dialog.querySelectorAll('input,select,textarea,button'));
            const states = controls.map(control => control.disabled);
            controls.forEach(control => control.disabled = true);
            feedback.textContent = 'Salvando categoria…';
            let saved;
            try {
                saved = C.result(await supabaseClient.from('finance_categories')
                    .insert({ couple_id: context.couple, name }).select('id,name').single());
                if (!customCategories.some(category => category.id === saved.id)) customCategories.push(saved);
                C.notify('Categoria criada.');
            } catch (error) {
                try {
                    if (error.code !== '23505') throw error;
                    customCategories = await loadCategories();
                    saved = findCustomCategory(name);
                    if (!saved) throw error;
                } catch (failure) { feedback.textContent = C.error(failure); }
            } finally {
                controls.forEach((control, index) => control.disabled = states[index]);
                delete dialog.dataset.busy;
            }
            if (saved) choose('custom:' + saved.id);
        });
        return () => close(false);
    }
    syncCategories();
    const financeGrid = document.querySelector('.finance-grid');
    const billsPanel = C.el('section', 'card finance-bills-panel');
    billsPanel.innerHTML = '<div class="card-title"><div><h3>Contas a pagar</h3></div><button type="button" class="finance-bill-action" id="new-bill" aria-label="Adicionar conta a pagar">+ Adicionar</button></div><div id="finance-bills-list"></div>';
    if (financeGrid) financeGrid.parentNode.insertBefore(billsPanel, financeGrid);
    const billDialog = C.dialog('bill-dialog', 'Conta a pagar', '<form id="bill-form"><label class="cc-field">Descrição<input id="bill-name" maxlength="100" placeholder="Ex.: Luz, internet, aluguel" required></label><div class="form-row"><label class="cc-field">Valor previsto (R$)<input id="bill-amount" inputmode="decimal" placeholder="0,00" required></label><label class="cc-field">Vencimento<input id="bill-due-date" type="date" min="1900-01-01" max="2100-12-31" required></label></div><div class="form-row"><label class="cc-field">Recorrência<select id="bill-recurrence"><option value="once">Uma vez</option><option value="monthly">Todo mês</option><option value="yearly">Todo ano</option></select></label><label class="cc-field">Categoria<select id="bill-category"></select></label></div><label class="cc-field">Conta relacionada (opcional)<select id="bill-account"><option value="">Sem conta vinculada</option></select></label><button type="submit" class="primary-button">Salvar conta</button><p id="bill-status" role="status"></p></form>');
    const resetEntryCategory = categoryEditor(entryDialog, 'entry', $('entry-category'));
    const resetBillCategory = categoryEditor(billDialog, 'bill', $('bill-category'));
    function syncAccountOptions(selected) {
        const select = $('entry-account'), value = selected || select.value; select.replaceChildren();
        const empty = C.el('option', '', 'Sem conta vinculada'); empty.value = ''; select.append(empty);
        financeAccounts.forEach(function (account) { const option = C.el('option', '', account.name); option.value = account.id; select.append(option); });
        select.value = value || '';
    }
    function syncBillOptions(categoryValue, accountValue) {
        syncCategorySelect($('bill-category'), categoryValue, 'other');
        const accountSelect = $('bill-account'), old = accountValue || accountSelect.value;
        accountSelect.replaceChildren(); const noAccount = C.el('option', '', 'Sem conta vinculada'); noAccount.value = ''; accountSelect.append(noAccount);
        financeAccounts.forEach(function (account) { const option = C.el('option', '', account.name); option.value = account.id; accountSelect.append(option); });
        accountSelect.value = old || '';
    }
    function editBill(row) {
        resetBillCategory();
        billEdit = row; $('bill-form').reset(); $('bill-status').textContent = '';
        $('bill-name').value = row?.name || '';
        $('bill-amount').value = row ? (Number(row.amount_cents) / 100).toFixed(2).replace('.', ',') : '';
        $('bill-due-date').value = row?.due_date || C.today();
        $('bill-recurrence').value = row?.recurrence || 'once';
        syncBillOptions(row?.custom_category_id ? 'custom:' + row.custom_category_id : row?.category || 'other', row?.account_id || '');
        billDialog.showModal();
    }
    const shortBillDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' });
    let billsError = '';
    let billsGeneration = 0;
    async function loadBills() {
        const token = ++billsGeneration;
        try {
            const rows = await C.all(() => supabaseClient.from('finance_bills').select('*')
                .eq('couple_id', context.couple).order('is_active', { ascending: false }).order('due_date').order('id'));
            if (token !== billsGeneration) return;
            bills = rows;
            billsReady = true;
            billsError = '';
        } catch (error) {
            if (token !== billsGeneration) return;
            billsError = C.error(error);
        }
        renderBills();
    }
    function renderBills() {
        const box = $('finance-bills-list'); box.replaceChildren();
        $('new-bill').disabled = !billsReady;
        if (billsError) {
            const status = C.el('p', 'empty-state', 'Não foi possível atualizar as contas a pagar. ' + billsError);
            status.setAttribute('role', 'status');
            box.append(status, C.button('Tentar novamente', loadBills, 'soft-button'));
        }
        if (!bills.length) {
            if (!billsError) box.append(C.el('p', 'empty-state', 'Cadastre uma conta a pagar para acompanhar vencimentos.'));
            return;
        }
        if (!bills.some(bill => bill.is_active)) box.append(C.el('p', 'empty-state finance-bills-overview-empty', 'Nenhuma conta em aberto.'));
        bills.forEach(function (bill) {
            const row = C.el('article', 'finance-bill-row'), details = C.el('div');
            row.dataset.active = String(bill.is_active);
            row.dataset.category = bill.category;
            const account = financeAccounts.find(function (item) { return item.id === bill.account_id; });
            const recurrence = bill.recurrence === 'monthly' ? 'Mensal' : bill.recurrence === 'yearly' ? 'Anual' : 'Avulsa';
            const status = bill.is_active ? (bill.due_date < C.today() ? 'Vencida' : bill.due_date === C.today() ? 'Vence hoje' : 'Vence em ' + C.date(bill.due_date)) : 'Paga em ' + C.date(bill.last_paid_at);
            let compactStatus = status;
            if (bill.is_active && bill.due_date > C.today()) {
                const parts = shortBillDate.formatToParts(new Date(bill.due_date + 'T00:00:00Z'));
                const day = parts.find(part => part.type === 'day').value;
                const month = parts.find(part => part.type === 'month').value.replace('.', '');
                compactStatus = 'Vence em ' + day + ' ' + month;
            }
            details.append(C.el('strong', '', bill.name),
                C.el('small', 'finance-bill-status', status + ' · ' + recurrence + (account ? ' · ' + account.name : '')),
                C.el('small', 'finance-bill-status-compact', compactStatus));
            row.append(details, C.el('strong', '', C.money(bill.amount_cents)));
            const actions = C.el('div', 'cc-row-actions');
            if (bill.is_active) actions.append(C.button('Marcar paga', async function () {
                C.result(await supabaseClient.rpc('finance_mark_bill_paid', { p_bill_id: bill.id, p_paid_on: C.today() }));
                C.notify('Pagamento registrado. Registre o gasto manualmente se ele não vier do banco.'); await loadBills();
            }, 'soft-button'));
            actions.append(C.button('Editar', function () { editBill(bill); }), C.button('Excluir', async function () {
                if (!confirm('Excluir esta conta a pagar?')) return;
                C.result(await supabaseClient.from('finance_bills').delete().eq('id', bill.id).eq('version', bill.version).select('id').single());
                await loadBills();
            }));
            const menu = C.el('details', 'finance-bill-menu');
            const toggle = C.el('summary', '', 'Opções');
            toggle.setAttribute('aria-label', 'Opções de ' + bill.name);
            menu.append(toggle, actions);
            row.append(menu); box.append(row);
        });
    }
    function enable(ok) { $('new-entry').disabled = !ok; $('new-bill').disabled = !ok || !billsReady; }
    enable(false);
    function editEntry(row) {
        edited = row;
        const key = row ? row.id : 'new';
        if (draftKey === key) { entryDialog.showModal(); return; }
        draftKey = key;
        resetEntryCategory();
        $('entry-form').reset(); $('entry-status').textContent = '';
        $('entry-description').value = row?.description || '';
        $('entry-type').value = row?.entry_type || 'expense';
        $('entry-amount').value = row ? (Number(row.amount_cents) / 100).toFixed(2).replace('.', ',') : '';
        $('entry-date').value = row?.entry_date || C.today();
        syncCategories(row?.custom_category_id ? 'custom:' + row.custom_category_id : row?.category || 'house');
        syncAccountOptions(row?.account_id || '');
        entryDialog.showModal();
    }
    function shiftDate(date, days) {
        const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + days);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function periodBounds() {
        const preset = $('finance-period').value, today = C.today(); let start = today, end = today;
        if (preset === 'week') start = shiftDate(today, -6);
        if (preset === '15days') start = shiftDate(today, -14);
        if (preset === 'month') start = today.slice(0, 7) + '-01';
        if (preset === 'selected-month') {
            const selectedMonth = $('finance-month').value;
            const [year, month] = selectedMonth.split('-').map(Number);
            start = selectedMonth + '-01';
            end = selectedMonth + '-' + new Date(year, month, 0).getDate();
        }
        if (preset === '6months') { const d = new Date(today + 'T12:00:00'); d.setMonth(d.getMonth() - 6); start = d.toISOString().slice(0, 10); }
        if (preset === 'year') start = today.slice(0, 4) + '-01-01';
        if (preset === 'custom') { start = $('finance-from').value; end = $('finance-to').value; }
        if (!start || !end || end < start) throw new Error('Escolha datas válidas para o período.');
        if ((new Date(end + 'T12:00:00') - new Date(start + 'T12:00:00')) / 86400000 > 365) throw new Error('O intervalo personalizado pode ter até 366 dias.');
        return { start: start, end: end, label: preset === 'custom' ? C.date(start) + ' a ' + C.date(end) : $('finance-period').selectedOptions[0].textContent };
    }
    const paymentLabels = { pix: 'Pix', credit: 'Crédito', debit: 'Débito', boleto: 'Boleto', ted: 'TED', doc: 'DOC' };
    function paymentLabel(entry) {
        return paymentLabels[entry.payment_method] || 'Meio não informado';
    }
    function chart(summary) {
        const box = $('finance-chart');
        box.replaceChildren();
        const data = (summary.categories || []).filter(row => Number(row.amount) > 0);
        const total = data.reduce((sum, row) => sum + Number(row.amount), 0);
        if (!total) {
            box.append(C.el('p', 'empty-state', 'Nenhuma despesa neste período.'));
            return;
        }
        data.forEach(function (row, index) {
            const name = row.name || categories[row.category] || 'Categoria do casal';
            const share = Number(row.amount) / total;
            const details = C.el('details', 'finance-category-row');
            const title = C.el('summary', 'finance-category-title');
            const line = C.el('span', 'finance-category-line');
            const figures = C.el('span', 'finance-category-figures');
            const percent = Math.round(share * 100) + '%';
            figures.append(C.el('strong', '', C.money(row.amount)), C.el('span', '', percent));
            line.append(C.el('strong', '', name), figures);
            const bar = C.el('progress', 'finance-category-progress');
            bar.max = total;
            bar.value = Number(row.amount);
            bar.dataset.tone = String(index % 7);
            bar.setAttribute('aria-label', name + ': ' + percent + ' do total de despesas');
            const amounts = new Map();
            let loaded = 0;
            entries.filter(entry => entry.entry_type === 'expense' &&
                (entry.custom_category_id ? 'custom:' + entry.custom_category_id : entry.category) === row.category
            ).forEach(entry => {
                const method = paymentLabel(entry), value = Number(entry.amount_cents);
                amounts.set(method, (amounts.get(method) || 0) + value);
                loaded += value;
            });
            const methods = Array.from(amounts, ([method, value]) => method + ' ' + C.money(value));
            const detail = methods.length ? methods.join(' · ') : 'Sem detalhes nos lançamentos carregados.';
            title.append(line, bar);
            details.append(title, C.el('p', 'finance-category-detail',
                methods.length && loaded !== Number(row.amount) ? 'Lançamentos carregados · ' + detail : detail));
            box.append(details);
        });
    }
    function summaryState(summary) {
        const balance = Number(summary.balance), card = $('balance-card');
        card.classList.remove('is-positive','is-negative','is-neutral'); card.classList.add(balance > 0 ? 'is-positive' : balance < 0 ? 'is-negative' : 'is-neutral');
        $('finance-balance').setAttribute('aria-label',
            (balance < 0 ? 'Saldo negativo: ' : balance > 0 ? 'Saldo positivo: ' : 'Saldo: ') + C.money(balance));
    }
    function renderEntries() {
        const box = $('finance-entries'); box.replaceChildren();
        if (!entries.length) box.append(C.el('p', 'empty-state', 'Nenhum lançamento neste período.'));
        const accountNames = new Map(financeAccounts.map(account => [account.id, account.name]));
        let date;
        entries.forEach(function (row) {
            if (row.entry_date !== date) {
                date = row.entry_date;
                box.append(C.el('h4', 'finance-entry-date', C.date(date)));
            }
            const incoming = row.entry_type === 'income';
            const line = C.el('article', 'transaction finance-entry'), text = C.el('div', 'finance-entry-copy');
            line.dataset.direction = incoming ? 'in' : 'out';
            const label=categoryName(row);
            const categoryIcons={house:'home',market:'shopping',transport:'transport',health:'health',leisure:'heart',salary:'income'};
            const kinds=[
                [/energia|luz|eletric/i,'charge'],[/restaur|pizza|lanch|alimenta/i,'food'],
                [/invest|aplicação|resgate/i,'investment'],[/transfer[êe]ncia/i,'transfer'],
                [/cartão|fatura/i,'card']
            ];
            const key=kinds.find(([pattern])=>pattern.test(label+' '+row.description))?.[1] ||
                categoryIcons[row.category] || (incoming?'income':row.payment_method==='credit'?'card':row.payment_method==='pix'?'transfer':'receipt');
            const mark=C.el('span','entry-icon');
            mark.dataset.icon=key;
            mark.append(C.uiIcon(key));
            const source = accountNames.get(row.account_id);
            const labels = [categoryName(row), source, row.payment_method && paymentLabel(row)].filter(Boolean);
            text.append(C.el('strong', '', row.description), C.el('small', '', labels.join(' · ')));
            line.append(mark, text, C.el('strong', 'finance-entry-amount', (incoming ? '+ ' : '− ') + C.money(row.amount_cents)));
            if (row.source === 'pluggy') {
                text.append(C.el('small', 'finance-entry-source', 'Open Finance'));
            } else {
                const actions = C.el('div', 'cc-row-actions');
                actions.append(C.button('Editar', function () { editEntry(row); }), C.button('Excluir', async function () {
                    if (!confirm('Excluir este lançamento?')) return;
                    C.result(await supabaseClient.from('finance_entries').delete().eq('id', row.id).eq('version', row.version).select('id').single()); C.notify('Lançamento removido.');
                    await load();
                }));
                const menu = C.el('details', 'finance-entry-menu');
                const toggle = C.el('summary', '', 'Opções');
                toggle.setAttribute('aria-label', 'Opções de ' + row.description);
                menu.append(toggle, actions);
                line.append(menu);
            }
            box.append(line);
        });
        $('more-entries').hidden = entries.length < limit;
    }
    async function load() {
        if (!context?.couple) return;
        const token = ++generation; loading = true; $('reload-finance').hidden = true; $('finance-status').classList.add('cc-sr'); $('finance-status').textContent = 'Atualizando finanças…'; $('finance-status').classList.remove('is-error');
        const billsRequest = loadBills();
        try {
            const bounds = periodBounds();
            const [summary, entriesResponse, categoriesResponse, accountsResponse] = await Promise.all([
                C.financeSummary(bounds.start, bounds.end),
                supabaseClient.from('finance_entries').select('*').eq('couple_id', context.couple).gte('entry_date', bounds.start).lte('entry_date', bounds.end).order('entry_date', { ascending: false }).order('id').limit(limit),
                loadCategories(),
                supabaseClient.from('finance_accounts').select('id,name,account_type,source,balance_cents,currency_code,balance_updated_at,version').eq('couple_id', context.couple).order('created_at', { ascending: false })
            ]);
            if (token !== generation) return;
            entries = C.result(entriesResponse);
            // Uma atualização do extrato pode ter começado antes de uma categoria ser salva.
            customCategories = Array.from(new Map([...customCategories, ...categoriesResponse]
                .map(category => [category.id, category])).values());
            financeAccounts = C.result(accountsResponse);
            syncCategories(); syncAccountOptions(); syncBillOptions(); summaryState(summary);
            $('finance-balance').textContent = C.money(summary.balance); $('finance-income').textContent = C.money(summary.income); $('finance-expense').textContent = C.money(summary.expense);
            chart(summary); renderEntries();
            C.mockFinanceData = { bounds, summary, entries, accounts: financeAccounts, complete: entries.length < limit };
            window.dispatchEvent(new CustomEvent('finance-summary-updated', { detail: C.mockFinanceData }));
            $('finance-status').textContent = 'Resumo de ' + bounds.label + ' atualizado.';
        } catch (error) {
            if (token !== generation) return;
            ['finance-balance','finance-income','finance-expense'].forEach(function (id) { $(id).textContent = '—'; });
            ['finance-chart','finance-entries'].forEach(function (id) { C.empty(id, 'Consulta indisponível.'); });
            $('finance-status').textContent = C.error(error); $('finance-status').classList.add('is-error'); $('finance-status').classList.remove('cc-sr');
            $('balance-card').classList.remove('is-positive','is-negative'); $('balance-card').classList.add('is-neutral');
            $('finance-balance').removeAttribute('aria-label');
            $('reload-finance').hidden = false;
            C.mockFinanceData = null; window.dispatchEvent(new Event('finance-summary-updated'));
        } finally {
            await billsRequest;
            if (token === generation) { loading = false; C.pageReady(); }
        }
    }
    C.form($('entry-form'), async function () {
        const title = $('entry-description').value.trim(); if (!title) throw new Error('Informe uma descrição.');
        const values = { description: title, entry_type: $('entry-type').value, amount_cents: C.cents($('entry-amount').value), entry_date: $('entry-date').value, category: $('entry-category').value.startsWith('custom:') ? 'other' : $('entry-category').value, custom_category_id: $('entry-category').value.startsWith('custom:') ? $('entry-category').value.slice(7) : null, account_id: $('entry-account').value || null };
        const query = edited ? supabaseClient.from('finance_entries').update(values).eq('id', edited.id).eq('version', edited.version) : supabaseClient.from('finance_entries').insert(Object.assign({ couple_id: context.couple }, values));
        C.result(await query.select('id').single()); draftKey = null; entryDialog.close(); await load();
    });
    $('new-entry').addEventListener('click', function () { editEntry(null); });
    $('new-bill').addEventListener('click', function () { editBill(null); });
    C.form($('bill-form'), async function () {
        const name = $('bill-name').value.trim(); if (!name) throw new Error('Informe uma descrição.');
        const categoryValue = $('bill-category').value;
        const values = { name: name, amount_cents: C.cents($('bill-amount').value), due_date: $('bill-due-date').value, recurrence: $('bill-recurrence').value, category: categoryValue.startsWith('custom:') ? 'other' : categoryValue, custom_category_id: categoryValue.startsWith('custom:') ? categoryValue.slice(7) : null, account_id: $('bill-account').value || null };
        const query = billEdit ? supabaseClient.from('finance_bills').update(values).eq('id', billEdit.id).eq('version', billEdit.version) : supabaseClient.from('finance_bills').insert(Object.assign({ couple_id: context.couple }, values));
        const saved = C.result(await query.select('*').single());
        ++billsGeneration;
        bills = [...bills.filter(bill => bill.id !== saved.id), saved].sort((a, b) =>
            Number(b.is_active) - Number(a.is_active) || a.due_date.localeCompare(b.due_date));
        renderBills();
        billDialog.close();
        await loadBills();
    });
    function changePeriod() {
        const custom = $('finance-period').value === 'custom';
        if (custom) {
            if (!$('finance-from').value) $('finance-from').value = C.today();
            if (!$('finance-to').value) $('finance-to').value = C.today();
        }
        limit = 30;
        try {
            const bounds = periodBounds();
            load();
            if (window.CCOpenFinance) window.CCOpenFinance.syncRange(bounds.start, bounds.end);
        } catch (error) { $('finance-status').textContent = C.error(error); }
    }
    $('finance-period').addEventListener('change', changePeriod);
    window.addEventListener('cc-finance-bank-synced', function () { load(); });
    $('reload-finance').addEventListener('click', function () { if (context) void load(); else window.location.reload(); });
    C.refreshOnReturn(function () { if (!loading && !document.querySelector('dialog[open]')) return load(); });
    $('more-entries').addEventListener('click', function () { if (!loading) { limit += 30; load(); } });
    C.ready.then(function (c) { context = c; if (!c.couple) { C.pageReady(); $('finance-status').textContent = 'Conecte seu casal em Configurações para usar as finanças.'; ['finance-chart','finance-entries','finance-bills-list'].forEach(function (id) { C.empty(id, 'Nenhum casal conectado.'); }); return; } enable(true); load(); }).catch(function (e) { C.pageReady(); $('reload-finance').hidden = false; $('finance-status').textContent = C.error(e); });
})();



