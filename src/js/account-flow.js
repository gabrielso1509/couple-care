/* Links sensíveis ficam apenas na memória; nunca são enviados para analytics. */
(function () {
    'use strict';
    window.addEventListener('hashchange', function () { if (location.hash) location.reload(); });
    const recovery = document.body.dataset.flow === 'recovery';
    const status = document.getElementById('account-status');
    const request = document.getElementById('request-reset');
    const change = document.getElementById('change-password');
    const query = new URLSearchParams(location.search), hash = new URLSearchParams(location.hash.slice(1));
    const hasLink = query.has('token_hash') || query.has('code') || hash.has('access_token');
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { detectSessionInUrl: false } });
    history.replaceState(null, '', location.pathname);
    function message(text, error) { status.textContent = text; status.className = error ? 'account-error' : 'account-success'; }
    function busy(form, value) { form.querySelector('button').disabled = value; form.setAttribute('aria-busy', String(value)); }
    if (request) request.addEventListener('submit', async function (event) {
        event.preventDefault(); if (!request.reportValidity() || request.dataset.busy) return;
        request.dataset.busy = 'true'; busy(request,true);
        try {
            const result = await client.auth.resetPasswordForEmail(document.getElementById('reset-email').value.trim(), { redirectTo: location.origin + '/src/recuperar-senha.html' });
            if (result.error) throw result.error;
            message('Se houver uma conta com este e-mail, você receberá um link para criar uma nova senha. Confira também o spam.');
        } catch (_) { message('Não foi possível enviar agora. Aguarde um pouco e tente novamente.',true); }
        finally { delete request.dataset.busy; busy(request,false); }
    });
    if (change) change.addEventListener('submit', async function (event) {
        event.preventDefault(); if (!change.reportValidity() || change.dataset.busy) return;
        const password = document.getElementById('new-password').value;
        if (password !== document.getElementById('repeat-password').value) { message('As senhas precisam ser iguais.',true); return; }
        change.dataset.busy = 'true'; busy(change,true);
        try {
            const result = await client.auth.updateUser({password:password}); if (result.error) throw result.error;
            change.reset(); change.hidden = true; message('Senha alterada! Agora você pode entrar com a nova senha.');
            await client.auth.signOut({scope:'local'});
        } catch (_) { message('Não foi possível alterar a senha. Use uma senha diferente ou solicite outro link.',true); }
        finally { delete change.dataset.busy; busy(change,false); }
    });
    (async function () {
        if (!hasLink) { if (!recovery) message('Abra esta página pelo link recebido no seu e-mail.',true); return; }
        if (request) request.hidden = true;
        message('Verificando seu link…');
        try {
            if (query.has('error') || hash.has('error')) throw new Error();
            let result;
            if (query.has('token_hash')) result = await client.auth.verifyOtp({token_hash:query.get('token_hash'),type: recovery ? 'recovery' : 'email_change'});
            else if (query.has('code')) result = await client.auth.exchangeCodeForSession(query.get('code'));
            else {
                if (hash.get('type') !== (recovery ? 'recovery' : 'email_change')) throw new Error();
                result = await client.auth.setSession({access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token')});
            }
            if (result.error) throw result.error;
            const auth = await client.auth.getUser(); if (auth.error || !auth.data.user) throw new Error();
            if (recovery) { change.hidden = false; message('Link validado. Escolha sua nova senha.'); }
            else message(auth.data.user.new_email ? 'Esta etapa foi confirmada. Confirme também o link recebido no outro endereço para finalizar a troca.' : 'Seu e-mail atual é ' + auth.data.user.email + '. Você já pode usar esse endereço para entrar.');
        } catch (_) { message('Este link está inválido ou expirou. Solicite um novo link.',true); if (request) request.hidden = false; }
    })();
})();
