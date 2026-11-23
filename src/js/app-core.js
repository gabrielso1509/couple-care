/* Serviços compartilhados do interior. Valores privados não são guardados no localStorage. */
(function () {
    'use strict';
    const C = window.CC = {};
    C.$ = function (id) { return document.getElementById(id); };
    C.el = function (tag, classe, texto) {
        const el = document.createElement(tag);
        if (classe) el.className = classe;
        if (texto !== undefined) el.textContent = texto;
        return el;
    };
    /* Avisos compartilhados: não alteram foco nem cobrem a página com um modal. */
    const notices = C.el('div', 'cc-toast-host');
    notices.setAttribute('popover', 'manual');
    notices.setAttribute('aria-label', 'Avisos do CoupleCare');
    const polite = C.el('div'); polite.setAttribute('role', 'status'); polite.setAttribute('aria-live', 'polite');
    const urgent = C.el('div'); urgent.setAttribute('role', 'alert');
    notices.append(polite, urgent); document.body.append(notices);
    let lastNotice = '', lastTime = 0;
    C.notify = function (message, type) {
        if (!message) return;
        type = type || 'success';
        // O mesmo resultado pode chegar pelo formulário e pelo módulo antigo.
        const key = type + message, now = Date.now();
        if (key === lastNotice && now - lastTime < 1200) return;
        lastNotice = key; lastTime = now;
        const item = C.el('div', 'cc-toast cc-toast--' + type);
        const icon = C.el('span', 'cc-toast-icon', type === 'success' ? '✓' : type === 'error' ? '!' : 'i');
        icon.setAttribute('aria-hidden', 'true');
        const body = C.el('div', 'cc-toast-body');
        body.append(C.el('strong', '', type === 'success' ? 'Tudo certo!' : type === 'error' ? 'Não foi possível concluir' : 'Atenção'), C.el('p', '', message));
        const close = C.el('button', 'cc-toast-close', '×'); close.type = 'button'; close.setAttribute('aria-label', 'Fechar aviso');
        let timer;
        function remove() { clearTimeout(timer); item.remove(); if (!notices.querySelector('.cc-toast') && notices.matches(':popover-open')) notices.hidePopover(); }
        function startTimer() { if (type !== 'error') timer = setTimeout(remove, 6500); }
        close.addEventListener('click', remove);
        item.addEventListener('pointerenter', function () { clearTimeout(timer); });
        item.addEventListener('pointerleave', startTimer);
        item.addEventListener('focusin', function () { clearTimeout(timer); });
        item.addEventListener('focusout', startTimer);
        item.append(icon, body, close);
        // Até três avisos; erros permanecem até serem fechados ou substituídos.
        const items = notices.querySelectorAll('.cc-toast'); if (items.length >= 3) items[0].remove();
        // Um dialog modal torna seus irmãos inertes. Hospeda o aviso dentro
        // dele para manter o botão Fechar acessível, também pelo teclado.
        const openDialogs = document.querySelectorAll('dialog[open]');
        const parent = openDialogs.length ? openDialogs[openDialogs.length - 1] : document.body;
        if (notices.parentElement !== parent) parent.append(notices);
        if (notices.showPopover) { if (notices.matches(':popover-open')) notices.hidePopover(); notices.showPopover(); }
        (type === 'error' ? urgent : polite).append(item); startTimer();
    };
    const successText = /^(?:Check-in salvo|Tarefa (?:criada|atualizada|excluída|concluída|reaberta)|Checklist atualizado|Compromisso (?:criado|atualizado|excluído)|Sentimentos salvos|Dia (?:de menstruação salvo|removido)|Período (?:registrado|iniciado|atualizado|excluído|encerrado)|Configurações salvas|Perfil atualizado|Foto (?:salva|removida|retirada)|Preferência salva|Data do casal salva|Solicitação enviada|Senha alterada|Aporte registrado|Código copiado|Casal criado|Convite (?:gerado|aceito|cancelado))/i;
    const routineText = /^(?:Registros atualizados\.|Atualizado(?:[ .]| às)|Tudo em dia|Resumo das tarefas cadastradas|Memórias e sonhos compartilhados|Bem-estar compartilhado, com respeito|Seu registro deste dia foi carregado\.)/i;
    const pendingText = /^(?:Carregando|Atualizando|Salvando|Enviando foto|Removendo foto)/i;
    const errorText = /(?:não foi possível|não foi possivel|falha|indisponível|não está disponível|não tem permissão|entre novamente|escolha|informe|selecione|escreva|precisa|mudou|ficou pendente|ficaram pendentes|ficou pendente|atualize a página antes|falta aplicar|não corresponde|inválid|incorret)/i;
    // Ponte para os módulos já existentes: mantém validações e instruções úteis,
    // mas tira os recados transitórios do fluxo do layout.
    const feedbackSelector = '.feedback-app, form [role="status"], #status-menstruacao, #status-calendario, #status-tarefas, #finance-status, #moments-status, #cc-status-tarefas, #idea-status, #dream-status, #notification-settings-status';
    const previousMessages = new WeakMap();
    let refreshUntil = 0;
    document.addEventListener('click', function (event) {
        const button = event.target.closest('button');
        if (button && /^(atualizar|reload-|refresh-)/.test(button.id)) refreshUntil = Date.now() + 15000;
    }, true);
    function feedbackState(node, announce) {
        if (node.closest('.cc-toast-host') || node.id === 'status-sessao') return;
        const text = node.textContent.trim(), previous = previousMessages.get(node);
        previousMessages.set(node, text);
        const error = errorText.test(text), success = !error && successText.test(text);
        const routine = !error && routineText.test(text);
        node.classList.toggle('cc-feedback-silent', !text || success || routine || pendingText.test(text));
        node.classList.toggle('cc-feedback-error', !!text && error);
        if (!announce || !text || previous === text) return;
        if (success) C.notify(text, 'success');
        else if (error) C.notify(text, 'error');
        else if (routine && refreshUntil > Date.now()) { refreshUntil = 0; C.notify('Dados atualizados.', 'success'); }
    }
    document.querySelectorAll(feedbackSelector).forEach(function (node) { feedbackState(node, false); });
    new MutationObserver(function (records) {
        const changed = new Set();
        records.forEach(function (record) {
            const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
            const feedback = target && target.closest(feedbackSelector); if (feedback) changed.add(feedback);
            record.addedNodes.forEach(function (node) {
                if (node.nodeType !== 1 || node.closest('.cc-toast-host')) return;
                if (node.matches(feedbackSelector)) changed.add(node);
                node.querySelectorAll(feedbackSelector).forEach(function (x) { changed.add(x); });
            });
        });
        changed.forEach(function (node) { feedbackState(node, true); });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
    C.today = function () {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    };
    C.date = function (s) { return s ? new Date(s.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : 'Sem data'; };
    C.money = function (n) { return (Number(n || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); };
    C.cents = function (value) {
        const s = String(value).trim().replace(',', '.');
        if (!/^\d{1,9}(\.\d{1,2})?$/.test(s)) throw new Error('Informe um valor positivo com até duas casas decimais.');
        const parts = s.split('.');
        const n = Number(parts[0]) * 100 + Number((parts[1] || '').padEnd(2, '0'));
        if (!Number.isSafeInteger(n) || n < 1 || n > 99999999999) throw new Error('Valor fora do limite.');
        return n;
    };
    C.result = function (r) { if (r.error) throw r.error; return r.data; };
    C.error = function (e) {
        if (['42P01', 'PGRST205', 'PGRST202', '42703'].includes(e.code)) return 'Falta aplicar a migração SQL deste pacote no Supabase.';
        if (['PGRST116','23505','40001'].includes(e.code)) return 'O registro mudou ou já existe. Atualize a página antes de tentar novamente.';
        if (e.code === 'reauthentication_needed') return 'Entre novamente na sua conta para alterar a senha.';
        if (e.code === 'same_password') return 'Escolha uma senha diferente da atual.';
        if (e.code === '42501') return 'Esta operação não está disponível para sua conta ou seu casal atual.';
        return e.message && !e.code && e.message.length < 180 ? e.message : 'Não foi possível concluir. Atualize a página para conferir o resultado antes de tentar de novo.';
    };
    C.empty = function (id, text) { C.$(id).replaceChildren(C.el('p', 'empty-state', text)); };
    C.all = async function (makeQuery) {
        const all = [];
        for (let start = 0; ; start += 500) {
            const rows = C.result(await makeQuery().range(start, start + 499));
            all.push.apply(all, rows);
            if (rows.length < 500) return all;
        }
    };
    C.button = function (text, fn, classe) {
        const b = C.el('button', classe || 'text-button', text); b.type = 'button';
        b.addEventListener('click', async function () {
            if (b.disabled) return;
            b.disabled = true;
            try { await fn(); }
            catch (e) { const p = b.closest('section,article,dialog')?.querySelector('[role="status"]'); if (p) p.textContent = C.error(e); else C.notify(C.error(e), 'error'); }
            finally { b.disabled = false; }
        });
        return b;
    };
    C.dialog = function (id, title, html) {
        let d = C.$(id);
        if (d) return d;
        d = C.el('dialog', 'cc-modal'); d.id = id; d.setAttribute('aria-labelledby', id + '-title');
        d.innerHTML = '<header><h2 id="' + id + '-title">' + title + '</h2><button type="button" data-close aria-label="Fechar">×</button></header>' + html;
        d.querySelector('[data-close]').addEventListener('click', function () { if (!d.dataset.busy) d.close(); });
        d.addEventListener('cancel', function (e) { if (d.dataset.busy) e.preventDefault(); });
        d.addEventListener('close', function () {
            if (notices.parentElement === d) {
                document.body.append(notices);
                if (notices.querySelector('.cc-toast') && notices.showPopover) notices.showPopover();
            }
        });
        // Só fecha se o gesto começar e terminar fora do conteúdo.
        // Arrastar um campo para fora não descarta a janela; fechar não limpa o formulário.
        let outside = false;
        function isOutside(event) {
            const r = d.getBoundingClientRect();
            return event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom;
        }
        d.addEventListener('pointerdown', function (event) { outside = event.target === d && isOutside(event); });
        d.addEventListener('click', function (event) {
            if (outside && event.target === d && isOutside(event) && !d.dataset.busy) d.close();
            outside = false;
        });
        document.body.append(d); return d;
    };
    C.form = function (form, fn) {
        let busy = false;
        form.addEventListener('submit', async function (e) {
            e.preventDefault();
            if (busy || form.closest('dialog')?.dataset.busy || !form.reportValidity()) return;
            busy = true;
            const fb = form.querySelector('[role="status"]'); if (fb) fb.textContent = 'Salvando…';
            const controls = Array.from(form.querySelectorAll('input,select,textarea,button,fieldset'));
            const states = controls.map(function (x) { return x.disabled; });
            const d = form.closest('dialog');
            if (d) { d.dataset.busy = 'true'; d.querySelector('[data-close]').disabled = true; }
            controls.forEach(function (x) { x.disabled = true; }); form.setAttribute('aria-busy', 'true');
            try {
                await fn();
                await Promise.resolve();
                if (!fb || !successText.test(fb.textContent.trim())) C.notify('Alterações salvas.', 'success');
                if (fb && fb.textContent === 'Salvando…') fb.textContent = '';
            }
            catch (error) { if (fb) fb.textContent = C.error(error); }
            finally {
                controls.forEach(function (x, i) { x.disabled = states[i]; });
                form.removeAttribute('aria-busy'); busy = false;
                if (d) { delete d.dataset.busy; d.querySelector('[data-close]').disabled = false; }
            }
        });
    };
    C.context = null;
    C.ready = (async function () {
        const r = await supabaseClient.auth.getUser();
        const auth = C.result(r); if (!auth.user) throw new Error('Sessão indisponível.');
        const profile = C.result(await supabaseClient.from('profiles').select('id,display_name,gender,avatar_path').eq('id', auth.user.id).single());
        const members = C.result(await supabaseClient.rpc('get_couple_members'));
        const own = members.find(function (m) { return m.user_id === auth.user.id; });
        C.context = { user: auth.user, profile: profile, members: members, couple: own?.couple_id || null };
        return C.context;
    })();
    // Evita rejeição solta antes de o módulo de página registrar seu tratamento.
    C.ready.catch(function () {});

    C.photo = async function (img, path) {
        if (!path) return;
        try {
            const blob = C.result(await supabaseClient.storage.from('couple-memories').download(path));
            if (!img.isConnected) return;
            const url = URL.createObjectURL(blob); img.src = url; img.hidden = false;
            img.addEventListener('error', function () { img.hidden = true; URL.revokeObjectURL(url); }, { once: true });
            C.photoUrls.push(url);
        } catch (_) { img.alt = 'Foto indisponível no momento'; }
    };
    C.photoUrls = [];
    C.releasePhotos = function () { C.photoUrls.forEach(URL.revokeObjectURL); C.photoUrls = []; };
    window.addEventListener('pagehide', C.releasePhotos);
})();
