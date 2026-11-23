/* Avatares reais, data do casal e central de avisos dentro do aplicativo. */
(function () {
    'use strict';
    const C = CC, $ = C.$;
    C.preferences = null;
    C.loadPreferences = async function () {
        C.preferences = C.result(await supabaseClient.from('notification_preferences').select('*').eq('user_id', C.context.user.id).maybeSingle());
        return C.preferences || { task_updates: true, moments: true, weekly_summary: false };
    };
    C.savePreference = async function (key, value) {
        const values = {}; values[key] = value;
        const query = C.preferences ? supabaseClient.from('notification_preferences').update(values).eq('user_id', C.context.user.id).eq('version', C.preferences.version) : supabaseClient.from('notification_preferences').insert(values);
        C.preferences = C.result(await query.select('*').single());
    };
    C.relationship = async function () {
        if (!C.context.couple) return null;
        return C.result(await supabaseClient.from('couple_details').select('*').eq('couple_id', C.context.couple).maybeSingle());
    };
    C.anniversary = function (date) {
        if (!date) return null;
        const now = new Date(C.today() + 'T12:00:00'), parts = date.split('-').map(Number);
        function anniversary(year) { const last = new Date(year, parts[1], 0).getDate(); return new Date(year, parts[1] - 1, Math.min(parts[2], last), 12); }
        let next = anniversary(now.getFullYear()); if (next < now) next = anniversary(now.getFullYear() + 1);
        const days = Math.round((Date.UTC(next.getFullYear(),next.getMonth(),next.getDate()) - Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())) / 86400000);
        return { days: days, date: next };
    };
    async function reminder() {
        const title = $('cc-anniversary-title'), text = $('cc-anniversary-text'); if (!title) return;
        try {
            const d = await C.relationship(); const next = C.anniversary(d?.relationship_date);
            title.textContent = next ? 'Aniversário de vocês' : 'Uma data de vocês';
            text.textContent = next ? next.days === 0 ? 'É hoje! Que tal reservar um momento para celebrar?' : 'Faltam ' + next.days + ' dia(s). Que tal planejar algo especial?' : 'Adicione a data do relacionamento em Configurações para acompanhar o próximo aniversário.';
        } catch (e) { text.textContent = C.error(e); }
    }
    C.ready.then(async function (context) {
        const actions = document.querySelector('.cc-header-actions');
        if (!actions) return;
        const avatars = C.el('div', 'cc-couple-avatars'); avatars.setAttribute('aria-label', 'Participantes do casal');
        const people = context.members.length ? context.members : [{ display_name: context.profile.display_name, avatar_path: context.profile.avatar_path }];
        people.forEach(function (member) {
            const a = C.el('a'); a.href = '/src/config.html'; a.title = member.display_name; a.setAttribute('aria-label', 'Perfil de ' + member.display_name);
            avatars.append(a); carregarAvatar(a, member.display_name, member.avatar_path);
        });
        const bell = C.button('♧', async function () { dialog.showModal(); await refresh(false); }, 'icon-button cc-notification-button');
        bell.setAttribute('aria-label', 'Abrir notificações');
        bell.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4"/></svg>';
        const badge = C.el('span', 'cc-notification-count'); badge.hidden = true; bell.append(badge);
        actions.append(bell, avatars);
        const dialog = C.dialog('notifications-dialog', 'Notificações', '<button type="button" id="read-all-notifications" class="soft-button">Marcar todas como lidas</button><div id="notifications-list"></div><p id="notifications-status" role="status"></p>');
        let running = false;
        async function refresh(sync) {
            if (running) return; running = true;
            try {
                if (sync) C.result(await supabaseClient.rpc('refresh_my_notifications', { p_today: C.today() }));
                const res = await Promise.all([
                    supabaseClient.from('app_notifications').select('*').eq('user_id', context.user.id).order('created_at', { ascending: false }).limit(30),
                    supabaseClient.from('app_notifications').select('id', { count: 'exact', head: true }).eq('user_id', context.user.id).is('read_at', null)
                ]);
                const rows = C.result(res[0]); C.result(res[1]);
                badge.textContent = res[1].count > 99 ? '99+' : res[1].count; badge.hidden = !res[1].count;
                const box = $('notifications-list'); box.replaceChildren();
                if (!rows.length) box.append(C.el('p', 'empty-state', 'Tudo tranquilo por aqui. Os próximos avisos aparecerão neste espaço.'));
                rows.forEach(function (n) {
                    const a = C.el('a', 'cc-notification' + (n.read_at ? ' read' : ''), n.title);
                    // Somente rotas locais conhecidas são aceitas, mesmo se o banco mudar.
                    a.href = /^\/src\/(tarefas|calendario|espaco|index|config)\.html$/.test(n.link) ? n.link : '/src/index.html';
                    a.append(C.el('small', '', new Date(n.created_at).toLocaleString('pt-BR')));
                    a.addEventListener('click', async function (e) {
                        e.preventDefault();
                        try { C.result(await supabaseClient.from('app_notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id).select('id').single()); location.assign(a.href); }
                        catch (error) { $('notifications-status').textContent = C.error(error); }
                    }); box.append(a);
                });
                $('notifications-status').textContent = 'Avisos internos. Atualizados enquanto o aplicativo está aberto.';
            } catch (e) { $('notifications-status').textContent = C.error(e); }
            finally { running = false; }
        }
        $('read-all-notifications').addEventListener('click', async function () {
            this.disabled = true;
            try { C.result(await supabaseClient.from('app_notifications').update({ read_at: new Date().toISOString() }).eq('user_id', context.user.id).is('read_at', null)); await refresh(false); }
            catch (e) { $('notifications-status').textContent = C.error(e); }
            finally { this.disabled = false; }
        });
        await refresh(true); reminder();
        const timer = setInterval(function () { if (!document.hidden) refresh(false); }, 60000);
        window.addEventListener('pagehide', function () { clearInterval(timer); });
    }).catch(function () {});
})();
