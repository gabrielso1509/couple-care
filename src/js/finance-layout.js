(function () {
    'use strict';
    if (location.hash === '#metas') {
        location.replace('/nosso-espaco#metas');
        return;
    }
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
        const close = button('', () => dialog.close());
        close.setAttribute('data-close', '');
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
    tile.className = 'account-tile';
    tile.innerHTML = icon('M3 8l9-5 9 5M4 9h16M6 10v7m6-7v7m6-7v7M3 20h18', 'bank-tone') + '<span class="finance-metric-text"><span>Contas e saldos</span><strong></strong></span>';
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
        const value = card.querySelector('strong');
        card.replaceChildren();
        card.insertAdjacentHTML('afterbegin', icon(path));
        const text = document.createElement('div');
        const title = document.createElement('span');
        title.textContent = label;
        text.className = 'finance-metric-text';
        text.append(title, value);
        card.append(text);
    });
    // Preserve the full BRL string on one line, including cents and sign.
    const metricValues = [income, expense, balance].map(card => card.querySelector('strong'));
    function fitValues() {
        metricValues.forEach(value => {
            value.style.removeProperty('font-size');
            const width = value.clientWidth;
            if (width && value.scrollWidth > width) {
                const size = parseFloat(getComputedStyle(value).fontSize);
                value.style.fontSize = size * (width - 1) / value.scrollWidth + 'px';
            }
        });
    }
    const sizes = new ResizeObserver(fitValues);
    metricValues.forEach(value => sizes.observe(value.parentElement));
    const values = new MutationObserver(fitValues);
    metricValues.forEach(value => values.observe(value, { childList: true, characterData: true, subtree: true }));
    if (document.fonts) document.fonts.ready.then(fitValues);

    const balancePath = balance.querySelector('svg path');
    function balanceIcon() {
        const path = balance.classList.contains('is-negative') ? 'M4 7l6 6 4-4 6 9m-6 0h6v-6' :
            balance.classList.contains('is-positive') ? 'M4 16l6-6 4 4 6-8m-6 0h6v6' : 'M5 12h14';
        balancePath.setAttribute('d', path);
    }
    new MutationObserver(balanceIcon).observe(balance, { attributes: true, attributeFilter: ['class'] });
    balanceIcon();

    one('.finance-bills-panel').hidden = true;
    one('.spending-card .card-title span').hidden = true;
    const controls = one('.finance-period-controls'), toolbar = one('.cc-toolbar');
    const select = one('#finance-period');
    const group = document.createElement('div');
    group.className = 'cc-periods';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Intervalos rápidos');
    controls.prepend(group);
    toolbar.classList.add('finance-toolbar');
    summary.before(toolbar);
    one('#finance-month').closest('label').hidden = true;
    select.closest('label').hidden = true;

    function setPeriod(value) {
        select.value = value;
        select.dispatchEvent(new Event('change'));
    }
    for (const [value, label] of [['week', 'Semana'], ['month', 'Mês'], ['year', 'Ano']]) {
        const item = button(label, () => setPeriod(value));
        item.className = 'finance-segment';
        const reflect = () => item.setAttribute('aria-pressed', String(select.value === value));
        reflect();
        select.addEventListener('change', reflect);
        group.append(item);
    }

    const form = document.createElement('form');
    form.className = 'finance-calendar-form';
    form.innerHTML = '<label class="cc-field">Intervalo<select name="preset"></select></label>' +
        '<div class="finance-calendar-dates"><label class="cc-field">De<input type="date" name="from" min="1900-01-01" max="2100-12-31" required></label>' +
        '<label class="cc-field">Até<input type="date" name="to" min="1900-01-01" max="2100-12-31" required></label></div>' +
        '<button class="soft-button cc-line-button" type="submit">Aplicar</button>';
    const preset = form.elements.namedItem('preset');
    const from = form.elements.namedItem('from'), to = form.elements.namedItem('to');
    preset.replaceChildren(...Array.from(select.options, option => option.cloneNode(true)));
    const calendar = sheet('Intervalo de datas', form);
    calendar.classList.add('finance-calendar-sheet');
    function showDates() {
        const custom = preset.value === 'custom';
        from.disabled = to.disabled = !custom;
        form.querySelector('.finance-calendar-dates').hidden = !custom;
        to.setCustomValidity('');
    }
    preset.addEventListener('change', showDates);
    from.addEventListener('input', () => to.setCustomValidity(''));
    to.addEventListener('input', () => to.setCustomValidity(''));
    const dateButton = button('', () => {
        const current = select.value;
        preset.value = ['week', 'month', 'year'].includes(current) ? 'custom' : current;
        from.value = one('#finance-from').value;
        to.value = one('#finance-to').value;
        showDates();
        calendar.showModal();
        preset.focus();
    });
    dateButton.className = 'finance-calendar';
    dateButton.innerHTML = icon('M4 5h16v16H4zM8 3v5m8-5v5M4 10h16');
    dateButton.setAttribute('aria-label', 'Escolher intervalo de datas');
    dateButton.setAttribute('aria-haspopup', 'dialog');
    const reflectDates = () => dateButton.setAttribute('aria-pressed', String(!['week', 'month', 'year'].includes(select.value)));
    reflectDates();
    select.addEventListener('change', reflectDates);
    group.after(dateButton);
    form.addEventListener('submit', event => {
        event.preventDefault();
        if (preset.value === 'custom') {
            const days = (to.valueAsNumber - from.valueAsNumber) / 86400000;
            if (days < 0 || days > 365) {
                to.setCustomValidity('Escolha um intervalo válido de até 366 dias.');
                to.reportValidity();
                return;
            }
            one('#finance-from').value = from.value;
            one('#finance-to').value = to.value;
        }
        calendar.close();
        setPeriod(preset.value);
    });

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

    const entry = one('#new-entry');
    const desktopSlot = document.createComment('Novo lançamento no desktop');
    const mobileSlot = document.createElement('div');
    mobileSlot.className = 'finance-mobile-entry';
    entry.before(desktopSlot);
    one('.finance-grid').after(mobileSlot);
    const mobile = matchMedia('(max-width: 900px)');
    function positionEntry() {
        if (mobile.matches) mobileSlot.append(entry);
        else desktopSlot.after(entry);
    }
    mobile.addEventListener('change', positionEntry);
    positionEntry();
})();

