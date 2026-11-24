/* Lançamentos reais em centavos; metas e aportes ficam no banco do casal. */
(function () {
    'use strict';
    const C = CC, $ = C.$;
    const categories = { house: 'Casa', leisure: 'Lazer', health: 'Saúde', market: 'Mercado', transport: 'Transporte', salary: 'Salário', other: 'Outros' };
    let context, entries = [], goals = [], financeAccounts = [], bills = [], billsReady = true, edited = null, goalEdit = null, billEdit = null, accountEdit = null, limit = 30, generation = 0;
    let loading = false, customCategories = [], categorySaving = false, draftKey = null;
    $('finance-month').value = C.today().slice(0, 7);
    const periodControl = C.el('div', 'finance-period-controls');
    periodControl.innerHTML = '<label class="cc-field">Período<select id="finance-period"><option value="day">Hoje</option><option value="week">Últimos 7 dias</option><option value="15days">Últimos 15 dias</option><option value="month" selected>Este mês</option><option value="6months">Últimos 6 meses</option><option value="year">Este ano</option><option value="custom">Personalizado</option></select></label><label class="cc-field finance-custom-date" id="finance-from-wrap" hidden>De<input id="finance-from" type="date"></label><label class="cc-field finance-custom-date" id="finance-to-wrap" hidden>Até<input id="finance-to" type="date"></label>';
    const monthWrap = $('finance-month').closest('label');
    if (monthWrap) monthWrap.hidden = true;
    const financeToolbar = $('finance-month').closest('.cc-toolbar');
    if (financeToolbar) financeToolbar.insertBefore(periodControl, monthWrap || financeToolbar.firstChild);
    $('finance-from').value = C.today(); $('finance-to').value = C.today();
    const entryDialog = C.dialog('entry-dialog', 'Lançamento do casal', `
        <form id="entry-form"><label class="cc-field">Descrição<input id="entry-description" maxlength="150" required></label>
        <div class="form-row"><label class="cc-field">Tipo<select id="entry-type"><option value="expense">Despesa</option><option value="income">Receita</option></select></label><label class="cc-field">Valor em reais<input id="entry-amount" inputmode="decimal" placeholder="0,00" required></label></div>
        <div class="form-row"><label class="cc-field">Data<input id="entry-date" type="date" min="1900-01-01" max="2100-12-31" required></label><label class="cc-field">Categoria<select id="entry-category"></select></label></div>
        <label class="cc-field">Conta vinculada (opcional)<select id="entry-account"><option value="">Sem conta vinculada</option></select></label>
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
    function balanceCents(value) {
        const rawValue = String(value || '0').trim();
        const normalizedValue = rawValue.indexOf(',') >= 0 ? rawValue.replace(/\./g, '').replace(',', '.') : rawValue;
        const amount = Number(normalizedValue);
        if (!Number.isFinite(amount) || Math.abs(amount) > 999999999.99) throw new Error('Informe um saldo válido.');
        return Math.round(amount * 100);
    }
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
    const accountsPanel = C.el('section', 'card finance-accounts-panel');
    accountsPanel.innerHTML = '<div class="card-title"><div><span>CONTAS DO CASAL</span><h3>Contas e saldos</h3></div><button type="button" class="soft-button" id="new-account">+ Cadastrar conta</button></div><div id="finance-accounts-list"></div>';
    const financeGrid = document.querySelector('.finance-grid');
    if (financeGrid) financeGrid.parentNode.insertBefore(accountsPanel, financeGrid);
    const billsPanel = C.el('section', 'card finance-bills-panel');
    billsPanel.innerHTML = '<div class="card-title"><div><span>ORGANIZAÇÃO DO CASAL</span><h3>Contas a pagar</h3></div><button type="button" class="soft-button" id="new-bill">+ Cadastrar conta</button></div><p>O controle de vencimento é separado dos gastos. Quando houver pagamento, o valor entra nos totais pelo banco ou por um lançamento.</p><div id="finance-bills-list"></div>';
    if (financeGrid) financeGrid.parentNode.insertBefore(billsPanel, financeGrid);
    const accountDialog = C.dialog('account-dialog', 'Cadastrar conta', '<form id="account-form"><label class="cc-field">Nome da conta<input id="account-name" maxlength="100" placeholder="Ex.: Dinheiro, Nubank, poupança" required></label><div class="form-row"><label class="cc-field">Tipo<select id="account-type"><option value="checking">Conta corrente</option><option value="savings">Poupança</option><option value="credit">Cartão de crédito</option><option value="cash">Dinheiro</option><option value="investment">Investimento</option><option value="other">Outra</option></select></label><label class="cc-field">Saldo atual (R$)<input id="account-balance" inputmode="decimal" placeholder="0,00" required></label></div><button type="submit" class="primary-button">Salvar conta</button><p id="account-status" role="status"></p></form>');
    const billDialog = C.dialog('bill-dialog', 'Conta a pagar', '<form id="bill-form"><label class="cc-field">Descrição<input id="bill-name" maxlength="100" placeholder="Ex.: Luz, internet, aluguel" required></label><div class="form-row"><label class="cc-field">Valor previsto (R$)<input id="bill-amount" inputmode="decimal" placeholder="0,00" required></label><label class="cc-field">Vencimento<input id="bill-due-date" type="date" min="1900-01-01" max="2100-12-31" required></label></div><div class="form-row"><label class="cc-field">Recorrência<select id="bill-recurrence"><option value="once">Uma vez</option><option value="monthly">Todo mês</option><option value="yearly">Todo ano</option></select></label><label class="cc-field">Categoria<select id="bill-category"></select></label></div><label class="cc-field">Conta relacionada (opcional)<select id="bill-account"><option value="">Sem conta vinculada</option></select></label><button type="submit" class="primary-button">Salvar conta</button><p id="bill-status" role="status"></p></form>');
    function syncAccountOptions(selected) {
        const select = $('entry-account'), value = selected || select.value; select.replaceChildren();
        const empty = C.el('option', '', 'Sem conta vinculada'); empty.value = ''; select.append(empty);
        financeAccounts.forEach(function (account) { const option = C.el('option', '', account.name); option.value = account.id; select.append(option); });
        select.value = value || '';
    }
    function syncBillOptions(categoryValue, accountValue) {
        const select = $('bill-category'), previous = categoryValue || select.value || 'other';
        select.replaceChildren();
        Object.keys(categories).forEach(function (key) { const option = C.el('option', '', categories[key]); option.value = key; select.append(option); });
        if (customCategories.length) {
            const group = C.el('optgroup'); group.label = 'Categorias do casal';
            customCategories.forEach(function (row) { const option = C.el('option', '', row.name); option.value = 'custom:' + row.id; group.append(option); });
            select.append(group);
        }
        select.value = previous; if (!select.value) select.value = 'other';
        const accountSelect = $('bill-account'), old = accountValue || accountSelect.value;
        accountSelect.replaceChildren(); const noAccount = C.el('option', '', 'Sem conta vinculada'); noAccount.value = ''; accountSelect.append(noAccount);
        financeAccounts.forEach(function (account) { const option = C.el('option', '', account.name); option.value = account.id; accountSelect.append(option); });
        accountSelect.value = old || '';
    }
    function renderAccounts() {
        const box = $('finance-accounts-list'); box.replaceChildren();
        if (!financeAccounts.length) { box.append(C.el('p', 'empty-state', 'Cadastre uma conta ou conecte um banco para ver os saldos compartilhados aqui.')); return; }
        financeAccounts.forEach(function (account) {
            const row = C.el('article', 'finance-account-row'), details = C.el('div');
            details.append(C.el('strong', '', account.name), C.el('small', '', (account.source === 'pluggy' ? 'Sincronizado pela Pluggy' : 'Conta cadastrada manualmente') + (account.balance_updated_at ? ' · Atualizado ' + C.date(account.balance_updated_at) : '')));
            row.append(details, C.el('strong', account.account_type === 'credit' ? 'finance-account-credit' : '', C.money(account.balance_cents)));
            if (account.source === 'manual') {
                const actions = C.el('div', 'cc-row-actions');
                actions.append(C.button('Editar', function () { editAccount(account); }), C.button('Excluir', async function () {
                    if (!confirm('Excluir esta conta? Ela precisa estar sem lançamentos ou contas a pagar vinculados.')) return;
                    try { C.result(await supabaseClient.from('finance_accounts').delete().eq('id', account.id).eq('version', account.version).select('id').single()); await load(); }
                    catch (error) { C.notify('Não foi possível excluir. Remova ou desvincule os registros que usam esta conta.', 'error'); }
                })); row.append(actions);
            }
            box.append(row);
        });
    }
    function editAccount(account) {
        accountEdit = account; $('account-form').reset(); $('account-status').textContent = '';
        $('account-name').value = account?.name || '';
        $('account-type').value = account?.account_type || 'checking';
        $('account-balance').value = account ? (Number(account.balance_cents) / 100).toFixed(2).replace('.', ',') : '';
        accountDialog.showModal();
    }
    function editBill(row) {
        billEdit = row; $('bill-form').reset(); $('bill-status').textContent = '';
        $('bill-name').value = row?.name || '';
        $('bill-amount').value = row ? (Number(row.amount_cents) / 100).toFixed(2).replace('.', ',') : '';
        $('bill-due-date').value = row?.due_date || C.today();
        $('bill-recurrence').value = row?.recurrence || 'once';
        syncBillOptions(row?.custom_category_id ? 'custom:' + row.custom_category_id : row?.category || 'other', row?.account_id || '');
        billDialog.showModal();
    }
    function renderBills() {
        const box = $('finance-bills-list'); box.replaceChildren();
        if (!billsReady) { box.append(C.el('p', 'empty-state', 'Para ativar o controle de contas a pagar, aplique a migration 20261124200000_finance_bills.sql no Supabase.')); return; }
        if (!bills.length) { box.append(C.el('p', 'empty-state', 'Cadastre uma conta a pagar para acompanhar vencimentos.')); return; }
        bills.forEach(function (bill) {
            const row = C.el('article', 'finance-bill-row'), details = C.el('div');
            const account = financeAccounts.find(function (item) { return item.id === bill.account_id; });
            const recurrence = bill.recurrence === 'monthly' ? 'Mensal' : bill.recurrence === 'yearly' ? 'Anual' : 'Avulsa';
            const status = bill.is_active ? (bill.due_date < C.today() ? 'Vencida' : bill.due_date === C.today() ? 'Vence hoje' : 'Vence em ' + C.date(bill.due_date)) : 'Paga em ' + C.date(bill.last_paid_at);
            details.append(C.el('strong', '', bill.name), C.el('small', '', status + ' · ' + recurrence + (account ? ' · ' + account.name : '')));
            row.append(details, C.el('strong', '', C.money(bill.amount_cents)));
            const actions = C.el('div', 'cc-row-actions');
            if (bill.is_active) actions.append(C.button('Marcar paga', async function () {
                C.result(await supabaseClient.rpc('finance_mark_bill_paid', { p_bill_id: bill.id, p_paid_on: C.today() }));
                C.notify('Pagamento registrado. Registre o gasto manualmente se ele não vier do banco.'); await load();
            }, 'soft-button'));
            actions.append(C.button('Editar', function () { editBill(bill); }), C.button('Excluir', async function () {
                if (!confirm('Excluir esta conta a pagar?')) return;
                C.result(await supabaseClient.from('finance_bills').delete().eq('id', bill.id).eq('version', bill.version).select('id').single());
                await load();
            }));
            row.append(actions); box.append(row);
        });
    }
    function enable(ok) { ['new-entry','new-goal','new-account'].forEach(function (id) { $(id).disabled = !ok; }); $('new-bill').disabled = !ok || !billsReady; }
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
        syncAccountOptions(row?.account_id || '');
        entryDialog.showModal();
    }
    function editGoal(row) {
        goalEdit = row; $('goal-form').reset(); $('goal-status').textContent = '';
        $('goal-title').value = row?.title || '';
        $('goal-target').value = row ? (Number(row.target_cents) / 100).toFixed(2).replace('.', ',') : '';
        $('goal-date').value = row?.target_date || '';
        goalDialog.showModal();
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
        if (preset === '6months') { const d = new Date(today + 'T12:00:00'); d.setMonth(d.getMonth() - 6); start = d.toISOString().slice(0, 10); }
        if (preset === 'year') start = today.slice(0, 4) + '-01-01';
        if (preset === 'custom') { start = $('finance-from').value; end = $('finance-to').value; }
        if (!start || !end || end < start) throw new Error('Escolha datas válidas para o período.');
        if ((new Date(end + 'T12:00:00') - new Date(start + 'T12:00:00')) / 86400000 > 365) throw new Error('O intervalo personalizado pode ter até 366 dias.');
        return { start: start, end: end, label: preset === 'custom' ? C.date(start) + ' a ' + C.date(end) : $('finance-period').selectedOptions[0].textContent };
    }
    /* Eixos e marcas em reais; a altura das barras usa a mesma escala do eixo Y. */
    function chart(summary) {
        const box = $('finance-chart'); box.replaceChildren();
        const data = summary.categories || [];
        if (!data.length) { box.append(C.el('p', 'empty-state', 'Nenhuma despesa registrada neste período.')); return; }
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
            bar.tabIndex = 0; bar.setAttribute('role','button');
            const label = name + ' · ' + C.money(row.amount);
            bar.setAttribute('aria-label',label);
            function showDetail() {
                let detail = box.querySelector('.chart-detail');
                if (!detail) { detail=C.el('p','chart-detail'); box.prepend(detail); }
                detail.textContent=label;
                const amounts = new Map();
                let loaded = 0;
                entries.filter(e => e.entry_type==='expense' && categoryName(e)===name).forEach(e => {
                    const desc=e.description.toLowerCase();
                    const method=/\bpix\b/.test(desc)?'Pix':/cartão de crédito/.test(desc)?'Crédito':/cartão de débito/.test(desc)?'Débito':'Não informado';
                    loaded+=Number(e.amount_cents); amounts.set(method,(amounts.get(method)||0)+Number(e.amount_cents));
                });
                if(loaded===Number(row.amount)) for (const [method, cents] of amounts) detail.textContent+=' · '+method+' '+C.money(cents);
                else detail.textContent+=' · Detalhamento parcial nas movimentações carregadas';
            }
            for(const event of ['focus','mouseenter','click']) bar.addEventListener(event,showDetail);
            bar.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();showDetail();}};
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
        card.querySelector('small').textContent = balance > 0 ? 'Receitas acima das despesas no período.' : balance < 0 ? 'Despesas acima das receitas no período.' : Number(summary.income) ? 'Receitas e despesas equilibradas.' : 'Sem lançamentos no período.';
        let badge = $('balance-state');
        if (!badge) { badge = C.el('span', 'balance-state'); badge.id = 'balance-state'; card.append(badge); }
        badge.textContent = balance > 0 ? 'Positivo' : balance < 0 ? 'Negativo' : 'Equilibrado';
    }
    function renderEntries() {
        const box = $('finance-entries'); box.replaceChildren();
        if (!entries.length) box.append(C.el('p', 'empty-state', 'Nenhum lançamento neste período.'));
        entries.forEach(function (row) {
            const line = C.el('article', 'transaction'), text = C.el('p');
            const icon = /restaurante|lanch|pizza/i.test(row.description)?'🍴':row.category==='market'?'🛒':/pix/i.test(row.description)?'◇':row.entry_type==='income'?'↙':'↗';
            const mark=C.el('span','entry-icon',icon); mark.setAttribute('aria-hidden','true'); text.prepend(mark);
            text.append(C.el('b', '', row.description), C.el('small', '', C.date(row.entry_date) + ' · ' + categoryName(row)));
            line.append(text, C.el('strong', row.entry_type === 'income' ? 'positive' : '', (row.entry_type === 'income' ? '+ ' : '− ') + C.money(row.amount_cents)));
            if (row.source === 'pluggy') {
                text.append(C.el('small', 'finance-entry-source', 'Importado automaticamente · não editável'));
            } else {
                const actions = C.el('div', 'cc-row-actions');
                actions.append(C.button('Editar', function () { editEntry(row); }), C.button('Excluir', async function () {
                    if (!confirm('Excluir este lançamento?')) return;
                    C.result(await supabaseClient.from('finance_entries').delete().eq('id', row.id).eq('version', row.version).select('id').single()); C.notify('Lançamento removido.');
                    await load();
                })); line.append(actions);
            }
            box.append(line);
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
            const bounds = periodBounds();
            const responses = await Promise.all([
                supabaseClient.rpc('finance_period_summary', { p_from: bounds.start, p_to: bounds.end }),
                supabaseClient.from('finance_entries').select('*').eq('couple_id', context.couple).gte('entry_date', bounds.start).lte('entry_date', bounds.end).order('entry_date', { ascending: false }).order('id').limit(limit),
                supabaseClient.rpc('list_savings_goals'),
                C.all(function () { return supabaseClient.from('finance_categories').select('id,name').eq('couple_id', context.couple).order('name').order('id'); })
                ,supabaseClient.from('finance_accounts').select('id,name,account_type,source,balance_cents,currency_code,balance_updated_at,version').eq('couple_id', context.couple).order('created_at', { ascending: false }),
                supabaseClient.from('finance_bills').select('*').eq('couple_id', context.couple).order('is_active', { ascending: false }).order('due_date')
            ]);
            const data = responses.slice(0,3).map(C.result); if (token !== generation) return;
            const summary = data[0]; entries = data[1]; goals = data[2]; customCategories = responses[3]; financeAccounts = C.result(responses[4]);
            const billError = responses[5].error;
            if (billError && billError.code !== 'PGRST205' && billError.code !== '42P01') C.result(responses[5]);
            billsReady = !billError;
            if (billsReady) bills = C.result(responses[5]); else bills = [];
            $('new-bill').disabled = !billsReady;
            syncCategories(); syncAccountOptions(); syncBillOptions(); summaryState(summary);
            $('finance-balance').textContent = C.money(summary.balance); $('finance-income').textContent = C.money(summary.income); $('finance-expense').textContent = C.money(summary.expense);
            $('finance-ratio').textContent = Number(summary.income) > 0 ? Math.round(Number(summary.expense) / Number(summary.income) * 100) + '% das receitas no período' : 'Sem receitas no período';
            $('balance-card').querySelector('span').textContent = 'SALDO · ' + bounds.label.toLocaleUpperCase('pt-BR');
            $('finance-income').parentElement.querySelector('small').textContent = 'Entradas no período selecionado';
            $('finance-expense').parentElement.querySelector('small').textContent = 'Saídas no período selecionado';
            chart(summary); renderEntries(); renderGoals(); renderAccounts(); renderBills();
            $('finance-status').textContent = 'Resumo de ' + bounds.label + '. Lançamentos bancários aparecem após sincronizar uma conta conectada.';
        } catch (error) {
            if (token !== generation) return;
            ['finance-balance','finance-income','finance-expense'].forEach(function (id) { $(id).textContent = '—'; });
            ['finance-chart','finance-entries','finance-goals','finance-accounts-list','finance-bills-list'].forEach(function (id) { C.empty(id, 'Consulta indisponível.'); });
            $('finance-status').textContent = C.error(error); $('finance-status').classList.add('is-error');
            $('balance-card').classList.remove('is-positive','is-negative'); $('balance-card').classList.add('is-neutral');
            $('balance-card').querySelector('small').textContent = 'Consulta indisponível.';
            if ($('balance-state')) $('balance-state').textContent = 'Sem consulta';
        } finally { loading = false; }
    }
    C.form($('entry-form'), async function () {
        const title = $('entry-description').value.trim(); if (!title) throw new Error('Informe uma descrição.');
        const values = { description: title, entry_type: $('entry-type').value, amount_cents: C.cents($('entry-amount').value), entry_date: $('entry-date').value, category: $('entry-category').value.startsWith('custom:') ? 'other' : $('entry-category').value, custom_category_id: $('entry-category').value.startsWith('custom:') ? $('entry-category').value.slice(7) : null, account_id: $('entry-account').value || null };
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
    $('new-account').addEventListener('click', function () { editAccount(null); });
    C.form($('account-form'), async function () {
        const name = $('account-name').value.trim(); if (!name) throw new Error('Informe o nome da conta.');
        const values = { name: name, account_type: $('account-type').value, balance_cents: balanceCents($('account-balance').value), currency_code: 'BRL' };
        const query = accountEdit ? supabaseClient.from('finance_accounts').update(values).eq('id', accountEdit.id).eq('version', accountEdit.version) : supabaseClient.from('finance_accounts').insert(Object.assign({ couple_id: context.couple }, values));
        C.result(await query.select('id').single()); accountEdit = null;
        accountDialog.close(); await load();
    });
    $('new-bill').addEventListener('click', function () { editBill(null); });
    C.form($('bill-form'), async function () {
        const name = $('bill-name').value.trim(); if (!name) throw new Error('Informe uma descrição.');
        const categoryValue = $('bill-category').value;
        const values = { name: name, amount_cents: C.cents($('bill-amount').value), due_date: $('bill-due-date').value, recurrence: $('bill-recurrence').value, category: categoryValue.startsWith('custom:') ? 'other' : categoryValue, custom_category_id: categoryValue.startsWith('custom:') ? categoryValue.slice(7) : null, account_id: $('bill-account').value || null };
        const query = billEdit ? supabaseClient.from('finance_bills').update(values).eq('id', billEdit.id).eq('version', billEdit.version) : supabaseClient.from('finance_bills').insert(Object.assign({ couple_id: context.couple }, values));
        C.result(await query.select('id').single()); billDialog.close(); await load();
    });
    $('new-goal').addEventListener('click', function () { editGoal(null); });
    function changePeriod() {
        const custom = $('finance-period').value === 'custom';
        $('finance-from-wrap').hidden = !custom; $('finance-to-wrap').hidden = !custom;
        if (custom) {
            if (!$('finance-from').value) $('finance-from').value = C.today();
            if (!$('finance-to').value) $('finance-to').value = C.today();
        }
        limit = 30;
        try {
            const bounds = periodBounds();
            if (window.CCOpenFinance) {
                window.CCOpenFinance.syncRange(bounds.start, bounds.end).then(function (synced) {
                    if (!synced) load();
                });
            } else load();
        } catch (error) { $('finance-status').textContent = C.error(error); }
    }
    $('finance-period').addEventListener('change', changePeriod);
    $('finance-from').addEventListener('change', function () { if ($('finance-period').value === 'custom') changePeriod(); });
    $('finance-to').addEventListener('change', function () { if ($('finance-period').value === 'custom') changePeriod(); });
    window.addEventListener('cc-finance-bank-synced', function () { if (!loading) load(); });
    $('reload-finance').addEventListener('click', load);
    $('more-entries').addEventListener('click', function () { if (!loading) { limit += 30; load(); } });
    C.ready.then(function (c) { context = c; if (!c.couple) { $('finance-status').textContent = 'Conecte seu casal em Configurações para usar as finanças.'; ['finance-chart','finance-entries','finance-goals','finance-accounts-list','finance-bills-list'].forEach(function (id) { C.empty(id, 'Nenhum casal conectado.'); }); return; } enable(true); load(); }).catch(function (e) { $('finance-status').textContent = C.error(e); });
})();


