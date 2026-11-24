(function () {
    const one = selector => document.querySelector(selector);
    function button(label, action) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'soft-button'; b.textContent = label;
        b.onclick = action; return b;
    }
    function sheet(title, nodes) {
        const d = document.createElement('dialog');
        d.className = 'finance-sheet'; d.setAttribute('aria-label', title);
        const heading = document.createElement('h2'); heading.textContent = title;
        d.append(heading, button('Fechar', () => d.close()), ...nodes);
        document.body.append(d); return d;
    }
    const summary = one('.finance-summary'), chart = one('.spending-card');
    const accounts = sheet('Minhas contas', [one('.finance-accounts-panel'), one('.bank-panel')]);
    accounts.addEventListener('click', e => {
        if (e.target.closest('#connect-bank') || e.target.textContent === 'Reconectar') accounts.close();
    }, true);
    const tile = button('Contas e saldos', () => accounts.showModal());
    const preview = document.createElement('small'); tile.append(preview); tile.classList.add('account-tile'); const hint=document.createElement('em'); hint.textContent='Ver contas ›'; tile.append(hint); summary.append(tile);
    const list = one('#finance-accounts-list');
    function balances() {
        const rows = Array.from(list.querySelectorAll('.finance-account-row'));
        const first = rows.find(r => !r.querySelector('.finance-account-credit')) || rows[0];
        preview.textContent = first ? first.querySelector('div strong').textContent + ' · ' + first.querySelector(':scope > strong').textContent : 'Gerenciar contas';
    }
    new MutationObserver(balances).observe(list,{childList:true}); balances();
    const goals = sheet('Metas do casal',[one('.goal-card'),one('#new-goal')]);
    const tab = button('Metas', () => goals.showModal());
    one('.navegacao').append(tab);
    one('.finance-bills-panel').hidden = true;
    chart.querySelector('.card-title span').remove();
    const controls = one('.finance-period-controls');
    summary.before(controls);
    const select = one('#finance-period'), group = document.createElement('div');
    group.className = 'cc-periods';
    controls.prepend(group);
    for (const [value,label] of [['week','Semana'],['month','Mês'],['year','Ano'],['custom','Calendário']]) {
        const b = button(label, () => { select.value=value; select.dispatchEvent(new Event('change')); });
        function reflect(){ b.setAttribute('aria-pressed',String(select.value===value)); }
        reflect(); select.addEventListener('change',reflect); group.append(b);
    }
    one('#finance-month').closest('label').remove();
    const movements = one('.transactions-card');
    const more = button('Ver todas', () => history.showModal());
    const holder = document.createElement('div');
    const history = sheet('Movimentações do período',[holder]);
    history.addEventListener('close', () => { anchor.after(movements); more.hidden=false; more.focus(); });
    more.onclick = () => { more.hidden=true; holder.append(movements); history.showModal(); };
    const anchor=document.createComment('movimentações'); movements.before(anchor); movements.append(more); more.classList.add('all-moves');
    one('#finance-entries').classList.add('compact-entries');
})();

