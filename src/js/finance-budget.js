/* O orçamento é compartilhado pelo casal; o gasto sempre cobre o mês atual. */
(function () {
    'use strict';
    const C = CC;
    const area = document.querySelector('[data-budget]');
    if (!area) return;
    const dashboard = area.classList.contains('dashboard-budget');
    let context, budget, expense, generation = 0;
    let month = '';
    let ready = false;
    let unavailable = 'Orçamento indisponível.';

    function draw() {
        area.replaceChildren();
        area.hidden = dashboard && (!ready || !budget);
        if (area.hidden) return;
        const section = C.el('div', 'finance-budget-heading');
        const text = C.el('div');
        text.append(C.el('small', '', 'Orçamento mensal'));
        if (!ready) {
            text.append(C.el('p', '', unavailable));
            section.append(text);
            area.append(section);
            return;
        }
        const percent = budget ? Math.round(expense / budget * 100) : 0;
        const label = budget ? C.money(expense) + ' de ' + C.money(budget) : 'Defina um limite para o mês.';
        text.append(C.el('strong', '', dashboard ? percent + '% do orçamento utilizado' : label));
        section.append(text);
        if (!dashboard) {
            if (budget) section.append(C.el('strong', 'finance-budget-percent', percent + '%'));
            const trigger = C.el('button', 'soft-button', budget ? 'Editar' : 'Definir');
            trigger.type = 'button';
            trigger.setAttribute('aria-haspopup', 'dialog');
            trigger.addEventListener('click', open);
            section.append(trigger);
        }
        if (dashboard && document.querySelector('[data-money-toggle][aria-pressed="true"]')) area.hidden = true;
        area.append(section);
        if (budget) {
            const bar = C.el('progress', 'finance-budget-progress');
            bar.max = budget;
            bar.value = Math.min(budget, expense);
            bar.setAttribute('aria-label', percent + '% do orçamento do mês usado');
            area.append(bar);
        }
    }

    async function load() {
        if (!context?.couple) return;
        const token = ++generation;
        const start = C.today().slice(0, 7) + '-01';
        const end = new Date(Number(start.slice(0, 4)), Number(start.slice(5, 7)), 0).getDate();
        try {
            const [row, summary] = await Promise.all([
                supabaseClient.from('finance_monthly_budgets').select('amount_cents')
                    .eq('couple_id', context.couple).eq('month_start', start).maybeSingle().then(C.result),
                supabaseClient.rpc('finance_period_summary', { p_from: start, p_to: start.slice(0, 8) + end }).then(C.result)
            ]);
            if (token !== generation) return;
            month = start;
            budget = Number(row?.amount_cents || 0);
            expense = Number(summary.expense || 0);
            ready = true;
        } catch (error) {
            if (token !== generation) return;
            ready = false;
            unavailable = C.error(error);
        }
        draw();
    }

    const dialog = dashboard ? null : C.dialog('finance-budget-dialog', 'Orçamento mensal', `
        <form class="form-app" id="finance-budget-form">
            <label class="cc-field">Limite deste mês (R$)<input id="finance-budget-amount" inputmode="decimal" placeholder="Ex.: 1500,00" required></label>
            <button class="primary-button" type="submit">Salvar orçamento</button>
            <p id="finance-budget-status" role="status"></p>
        </form>`);

    function open() {
        C.$('finance-budget-amount').value = budget ? (budget / 100).toFixed(2).replace('.', ',') : '';
        C.$('finance-budget-status').textContent = '';
        dialog.showModal();
        C.$('finance-budget-amount').focus();
    }
    if (dialog) {
        C.form(C.$('finance-budget-form'), async function () {
            const start = C.today().slice(0, 7) + '-01';
            if (start !== month) throw new Error('O mês mudou. Feche e reabra a tela de Finanças.');
            const amount = C.cents(C.$('finance-budget-amount').value.replace(/\.(?=.*[,])/g, ''));
            C.result(await supabaseClient.from('finance_monthly_budgets').upsert({
                couple_id: context.couple, month_start: month, amount_cents: amount
            }, { onConflict: 'couple_id,month_start' }));
            dialog.close();
            await load();
            area.querySelector('button')?.focus();
        });
        window.addEventListener('finance-summary-updated', function () { void load(); });
    } else {
        document.querySelector('[data-money-toggle]')?.addEventListener('click', () => { if (ready) draw(); });
    }
    C.ready.then(function (value) {
        context = value;
        if (context.couple) return load();
        area.hidden = true;
    }).catch(function () { area.hidden = true; });
})();
