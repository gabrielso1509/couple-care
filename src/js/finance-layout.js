(function () {
    'use strict';
    const one = selector => document.querySelector(selector);
    const icon = (path, tone = '') => '<svg class="finance-icon ' + tone + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + path + '"/></svg>';
    function button(label, action) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'soft-button cc-line-button';
        item.textContent = label;
        item.addEventListener('click', action);
        return item;
    }
    function sheet(title, ...nodes) {
        const dialog = document.createElement('dialog');
        dialog.className = 'finance-sheet';
        dialog.setAttribute('aria-label', title);
        const head = document.createElement('header');
        const heading = document.createElement('h2');
        heading.textContent = title;
        const close = button('×', () => dialog.close());
        close.setAttribute('aria-label', 'Fechar ' + title.toLowerCase());
        head.append(heading, close);
        dialog.append(head, ...nodes);
        dialog.addEventListener('click', event => {
            if (event.target !== dialog) return;
            const rect = dialog.getBoundingClientRect();
            if (event.clientX < rect.left || event.clientX > rect.right ||
                event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
        });
        document.body.append(dialog);
        return dialog;
    }
    const summary = one('.finance-summary');
    const accounts = sheet('Contas e saldos', one('.finance-accounts-panel'), one('.bank-panel'));
    accounts.addEventListener('click', event => {
        if (event.target.closest('#connect-bank') || event.target.textContent === 'Reconectar') accounts.close();
    }, true);

    const tile = button('Contas e saldos', () => accounts.showModal());
    tile.classList.add('account-tile');
    tile.innerHTML = icon('M3 8l9-5 9 5M4 9h16M6 10v7m6-7v7m6-7v7M3 20h18', 'bank-tone') + '<span><span>Contas e saldos</span><strong></strong></span>';
    const accountLabel = tile.querySelector('strong');
    summary.append(tile);
    const list = one('#finance-accounts-list');
    function balances() {
        const rows = Array.from(list.querySelectorAll('.finance-account-row'));
        const first = rows.find(row => !row.querySelector('.finance-account-credit')) || rows[0];
        const name = first?.querySelector('div strong')?.textContent || '';
        accountLabel.textContent = /nubank|nu pagamentos/i.test(name) ? 'Nubank' : name || 'Gerenciar contas';
        accountLabel.title = name;
    }
    new MutationObserver(balances).observe(list, { childList: true });
    balances();

    const income = one('.income-card'), expense = one('.expense-card'), balance = one('#balance-card');
    summary.prepend(income, expense, balance);
    [
        [income, 'Receitas', 'M3 7h17v13H5a2 2 0 0 1-2-2V7Zm0 0 13-3m0 9h5v4h-5z'],
        [expense, 'Despesas', 'M3 6h18v13H3zM3 10h18M6 15h4'],
        [balance, 'Saldo', 'M4 16l6-6 4 4 6-8m-6 0h6v6']
    ].forEach(([card, label, path]) => {
        card.insertAdjacentHTML('afterbegin', icon(path));
        const text = document.createElement('div');
        const title = document.createElement('span');
        title.textContent = label;
        text.append(title, card.querySelector('strong'));
        card.append(text);
        card.querySelector('small').hidden = true;
    });
    const balancePath = balance.querySelector('svg path');
    function balanceIcon() {
        const path = balance.classList.contains('is-negative') ? 'M4 7l6 6 4-4 6 9m-6 0h6v-6' :
            balance.classList.contains('is-positive') ? 'M4 16l6-6 4 4 6-8m-6 0h6v6' : 'M5 12h14';
        balancePath.setAttribute('d', path);
    }
    new MutationObserver(balanceIcon).observe(balance, { attributes: true, attributeFilter: ['class'] });
    balanceIcon();

    const goals = sheet('Metas do casal', one('.goal-card'), one('#new-goal'));
    const goalsTab = button('Metas', () => goals.showModal());
    goalsTab.classList.add('cc-goals-link');
    one('.navegacao').append(goalsTab);
    if (location.hash === '#metas') CC.ready.then(() => {
        if (!goals.open) goals.showModal();
    }).catch(() => {});

    one('.finance-bills-panel').hidden = true;
    one('.spending-card .card-title span').hidden = true;
    const controls = one('.finance-period-controls'), toolbar = one('.cc-toolbar');
    const select = one('#finance-period'), group = document.createElement('div');
    group.className = 'cc-periods';
    controls.prepend(group);
    toolbar.classList.add('finance-toolbar');
    one('#finance-month').closest('label').hidden = true;
    for (const [value, label] of [['week', 'Semana'], ['month', 'Mês'], ['year', 'Ano'], ['custom', 'Calendário']]) {
        const item = button(label, () => {
            select.value = value;
            select.dispatchEvent(new Event('change'));
            if (value === 'custom') one('#finance-from').focus();
        });
        if (value === 'custom') {
            item.classList.add('finance-calendar');
            item.innerHTML = icon('M4 5h16v16H4zM8 3v5m8-5v5M4 10h16');
            item.setAttribute('aria-label', 'Escolher intervalo de datas');
        }
        const reflect = () => item.setAttribute('aria-pressed', String(select.value === value));
        reflect();
        select.addEventListener('change', reflect);
        group.append(item);
    }
    select.setAttribute('aria-label', 'Mais períodos');

    const movements = one('.transactions-card');
    const history = sheet('Movimentações do período');
    history.classList.add('finance-history');
    const anchor = document.createComment('Atividade recente');
    movements.before(anchor);
    const more = button('Ver todas ›', () => {
        more.hidden = true;
        history.append(movements);
        history.showModal();
    });
    movements.querySelector('.card-title').append(more);
    history.addEventListener('close', () => {
        anchor.after(movements);
        more.hidden = false;
        more.focus();
    });
    one('#finance-entries').classList.add('compact-entries');
})();
