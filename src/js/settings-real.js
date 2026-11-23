/* Complementa os formulários de perfil/foto/convite existentes com dados reais. */
(function () {
    'use strict';
    const C = CC, $ = C.$;
    let context, details = null;
    const titles = {
        task_updates: ['Lembretes de tarefas', 'Prazos próximos e alterações feitas pelo parceiro.'],
        moments: ['Momentos especiais', 'Novidades no calendário, nas memórias e no vínculo do casal.'],
        weekly_summary: ['Resumo semanal', 'Um aviso por semana ao abrir o aplicativo.']
    };
    async function displayPreferences() {
        const prefs = await C.loadPreferences();
        const box = $('notification-settings'); box.replaceChildren();
        Object.keys(titles).forEach(function (key) {
            const row = C.el('div', 'toggle-row'), text = C.el('p');
            text.append(C.el('b', '', titles[key][0]), C.el('span', '', titles[key][1]));
            const b = C.button('', async function () {
                await C.savePreference(key, !prefs[key]); await displayPreferences();
                $('notification-settings-status').textContent = 'Preferência salva na sua conta.';
            }, 'toggle' + (prefs[key] ? ' on' : ''));
            b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', String(prefs[key])); b.setAttribute('aria-label', titles[key][0]); b.append(C.el('i'));
            row.append(text, b); box.append(row);
        });
    }
    C.ready.then(async function (c) {
        context = c;
        $('settings-own-name').textContent = c.profile.display_name;
        $('settings-own-email').textContent = c.user.email || '';
        $('settings-email').value = c.user.email || '';
        carregarAvatar($('settings-own-avatar'), c.profile.display_name, c.profile.avatar_path);
        const partner = c.members.find(function (p) { return p.user_id !== c.user.id; });
        const link = $('settings-partner');
        link.replaceChildren();
        if (partner) {
            const avatar = C.el('span', 'conta-avatar'); link.append(avatar, C.el('span', '', 'Conectado com ' + partner.display_name));
            carregarAvatar(avatar, partner.display_name, partner.avatar_path);
        } else link.textContent = c.couple ? 'Aguardando a outra pessoa' : 'Nenhum casal conectado';
        $('relationship-form').querySelector('button').disabled = !c.couple;
        $('relationship-date').max = C.today();
        try {
            details = await C.relationship(); $('relationship-date').value = details?.relationship_date || '';
            await displayPreferences();
        } catch (e) { $('notification-settings-status').textContent = C.error(e); }
    }).catch(function (e) { $('email-status').textContent = C.error(e); });
    $('edit-profile-photo').addEventListener('click', function () {
        document.querySelector('.profile-card .cc-advanced').open = true; $('arquivo-avatar').focus();
    });
    C.form($('relationship-form'), async function () {
        if (!context?.couple) throw new Error('Conecte seu casal primeiro.');
        const value = { relationship_date: $('relationship-date').value };
        const query = details ? supabaseClient.from('couple_details').update(value).eq('couple_id', context.couple).eq('version', details.version) : supabaseClient.from('couple_details').insert(Object.assign({ couple_id: context.couple }, value));
        details = C.result(await query.select('*').single()); $('relationship-status').textContent = 'Data do casal salva.';
    });
    C.form($('email-form'), async function () {
        const email = $('settings-email').value.trim();
        if (email.toLowerCase() === C.context.user.email?.toLowerCase()) throw new Error('Informe um endereço diferente do e-mail atual.');
        const r = await supabaseClient.auth.updateUser({ email: email }, { emailRedirectTo: location.origin + '/src/conta-confirmada.html' }); C.result(r);
        $('email-status').textContent = 'Solicitação enviada. Confira os e-mails de confirmação antes de usar o novo endereço.';
    });
    C.form($('password-form'), async function () {
        const password = $('new-password').value;
        if (password !== $('repeat-password').value) throw new Error('As senhas precisam ser iguais.');
        C.result(await supabaseClient.auth.updateUser({ password: password }));
        $('password-form').reset(); $('password-status').textContent = 'Senha alterada.';
    });
    window.addEventListener('perfil-atualizado', async function () {
        try {
            const p = C.result(await supabaseClient.from('profiles').select('display_name,avatar_path').eq('id', context.user.id).single());
            $('settings-own-name').textContent = p.display_name;
            carregarAvatar($('settings-own-avatar'), p.display_name, p.avatar_path);
        } catch (_) {}
    });
})();
