/* Metas e aportes compartilhados, no Nosso espaço. */
(function () {
    'use strict';
    const C = CC, $ = C.$;
    let context, goals = [], goalEdit = null;

    const goalDialog = C.dialog('goal-dialog', 'Um sonho em conjunto', `
        <form id="goal-form"><label class="cc-field">Nome da meta<input id="goal-title" maxlength="150" required></label><label class="cc-field">Valor desejado em reais<input id="goal-target" inputmode="decimal" placeholder="0,00" required></label><label class="cc-field">Prazo opcional<input id="goal-date" type="date" min="1900-01-01" max="2100-12-31"></label><button type="submit" class="primary-button">Salvar meta</button><p id="goal-status" role="status"></p></form>`);
    const contributionDialog = C.dialog('contribution-dialog', 'Adicionar valor à meta', `
        <form id="contribution-form"><p id="contribution-title"></p><label class="cc-field">Valor em reais<input id="contribution-amount" inputmode="decimal" placeholder="0,00" required></label><p class="cc-status">Este aporte acompanha a meta. Ele não cria automaticamente uma receita ou despesa.</p><button type="submit" class="primary-button">Registrar aporte</button><p id="contribution-status" role="status"></p></form><div id="contribution-list"></div>`);
    let contributionGoal = null;
    function editGoal(row) {
        goalEdit = row; $('goal-form').reset(); $('goal-status').textContent = '';
        $('goal-title').value = row?.title || '';
        $('goal-target').value = row ? (Number(row.target_cents) / 100).toFixed(2).replace('.', ',') : '';
        $('goal-date').value = row?.target_date || '';
        goalDialog.showModal();
    }
    async function openContributions(goal) {
        contributionGoal = goal; $('contribution-form').reset(); $('contribution-status').textContent = '';
        $('contribution-title').textContent = goal.title; C.empty('contribution-list', 'Carregando aportes…');
        if (!contributionDialog.open) contributionDialog.showModal();
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
            const content = C.el('div', 'cc-goal-content');
            content.append(C.el('h4', '', g.title), C.el('strong', '', C.money(g.saved_cents)), C.el('small', '', ' de ' + C.money(g.target_cents)));
            const progress = C.el('div', 'progress-bar'), fill = C.el('i');
            fill.style.width = ratio + '%';
            progress.append(fill);
            progress.setAttribute('aria-hidden','true');
            const track = C.el('div','cc-goal-track');
            track.append(progress,C.el('b','',ratio+'%'));
            content.append(track);
            if (g.target_date) content.append(C.el('p','goal-meta','Meta: '+C.date(g.target_date)));
            const actions = C.el('div', 'cc-row-actions');
            actions.append(C.button('+ Adicionar valor', async function () { await openContributions(g); }, 'soft-button'), C.button('Editar', function () { editGoal(g); }), C.button('Excluir', async function () {
                if (!confirm('Excluir esta meta e os aportes dela?')) return;
                C.result(await supabaseClient.from('savings_goals').delete().eq('id', g.id).eq('version', g.version).select('id').single()); C.notify('Meta removida.'); await load();
            })); content.append(actions); card.append(content); box.append(card);
            // A fotografia é opcional e nunca altera os valores financeiros.
            if (window.CCGoalInspiration) void window.CCGoalInspiration(card, g);
        });
    }
    async function load() {
        try {
            goals = C.result(await supabaseClient.rpc('list_savings_goals'));
            renderGoals();
            $('goals-status').textContent = '';
        } catch (error) {
            $('goals-status').textContent = C.error(error);
        }
    }
    C.form($('goal-form'), async function () {
        const title = $('goal-title').value.trim(); if (!title) throw new Error('Informe um nome para a meta.');
        const values = { title: title, target_cents: C.cents($('goal-target').value), target_date: $('goal-date').value || null };
        const query = goalEdit ? supabaseClient.from('savings_goals').update(values).eq('id', goalEdit.id).eq('version', goalEdit.version) : supabaseClient.from('savings_goals').insert(Object.assign({ couple_id: context.couple }, values));
        C.result(await query.select('id').single()); goalDialog.close(); await load();
    });
    C.form($('contribution-form'), async function () {
        C.result(await supabaseClient.from('goal_contributions').insert({ goal_id: contributionGoal.id, amount_cents: C.cents($('contribution-amount').value) }).select('id').single());
        await load();
        await openContributions(goals.find(function (g) { return g.id === contributionGoal.id; }) || contributionGoal);
        $('contribution-status').textContent = 'Aporte registrado.';
    });
    $('new-goal').addEventListener('click', function () { editGoal(null); });
    C.ready.then(function (session) {
        context = session;
        if (!context.couple) {
            $('goals-status').textContent = 'Conecte seu casal em Configurações para usar as metas.';
            return;
        }
        $('new-goal').disabled = false;
        return load();
    }).catch(function (error) {
        $('goals-status').textContent = C.error(error);
    });
})();
