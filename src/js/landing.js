(function () {
    'use strict';
    const login = document.getElementById('modal-login');
    const cadastro = document.getElementById('modal-cadastro');
    const senha = document.getElementById('senha');
    const entrada = document.querySelector('[data-login]');
    const mostrar = document.createElement('button');
    const conta = document.getElementById('landing-account');
    const nomeConta = document.getElementById('landing-account-name');
    const avatarConta = document.getElementById('landing-account-avatar');
    const statusConta = document.getElementById('landing-account-status');
    const linkPainel = document.getElementById('landing-dashboard');
    const sair = document.getElementById('landing-sign-out');
    const cadastroPublico = document.querySelectorAll('[data-signup]');
    let versaoConta = 0;
    let origemLogin = entrada;
    let origemCadastro = document.getElementById('abrir-cadastro');

    const campoSenha = document.createElement('div');
    campoSenha.className = 'auth-password';
    senha.before(campoSenha);
    mostrar.type = 'button';
    mostrar.setAttribute('aria-controls', 'senha');
    campoSenha.append(senha, mostrar);

    function atualizarSenha(visivel) {
        senha.type = visivel ? 'text' : 'password';
        mostrar.textContent = visivel ? 'Ocultar' : 'Mostrar';
        mostrar.setAttribute('aria-label', visivel ? 'Ocultar senha' : 'Mostrar senha');
        mostrar.setAttribute('aria-pressed', String(visivel));
    }

    function abrirLogin(origem) {
        if (login.open) return;
        origemLogin = origem;
        login.showModal();
        document.getElementById('email').focus();
    }

    atualizarSenha(false);
    mostrar.addEventListener('click', () => atualizarSenha(senha.type === 'password'));
    entrada.addEventListener('click', () => abrirLogin(entrada));

    document.getElementById('fechar-login').addEventListener('click', () => {
        if (!loginEmAndamento) login.close();
    });
    login.addEventListener('cancel', event => {
        if (loginEmAndamento) event.preventDefault();
    });
    login.addEventListener('close', () => {
        senha.value = '';
        atualizarSenha(false);
        document.getElementById('feedback-login').textContent = '';
        if (location.hash === '#entrar') history.replaceState(null, '', location.pathname + location.search);
        if (!cadastro.open) (origemLogin.hidden ? conta.querySelector('summary') : origemLogin).focus();
    });

    document.getElementById('abrir-cadastro').addEventListener('click', event => {
        origemCadastro = event.currentTarget;
    });
    document.querySelectorAll('[data-signup]').forEach(function (button) {
        button.addEventListener('click', function () {
            origemCadastro = button;
            abrirCadastro();
        });
    });
    document.getElementById('voltar-login').addEventListener('click', () => {
        if (!cadastroEmAndamento && !login.open) abrirLogin(origemCadastro);
    });
    cadastro.addEventListener('close', () => {
        if (!login.open) origemCadastro.focus();
    });

    function mostrarConta(nome) {
        const autenticado = Boolean(nome);
        nomeConta.textContent = nome || 'Minha conta';
        avatarConta.textContent = nome ? Array.from(nome)[0].toLocaleUpperCase('pt-BR') : '';
        entrada.hidden = autenticado;
        cadastroPublico.forEach(button => { button.hidden = autenticado; });
        conta.hidden = !autenticado;
        linkPainel.hidden = !autenticado;
        if (!autenticado) conta.open = false;
    }

    async function atualizarConta() {
        const versao = ++versaoConta;
        // A conta só aparece depois de o Auth validar a sessão.
        try {
            const { data, error } = await supabaseClient.auth.getUser();
            if (versao !== versaoConta) return;
            if (error || !data.user) {
                mostrarConta(null);
                return;
            }
            mostrarConta(data.user.user_metadata?.display_name?.trim() || 'Minha conta');
            const perfil = await supabaseClient.from('profiles')
                .select('display_name').eq('id', data.user.id).maybeSingle();
            if (versao === versaoConta && perfil.data?.display_name?.trim()) {
                mostrarConta(perfil.data.display_name.trim());
            }
        } catch (_) {
            // Se a foto ou o perfil falharem, os controles continuam disponíveis.
        }
    }

    function lerDestinoDeLogin() {
        if (location.hash !== '#entrar' || cadastro.open) return;
        if (conta.hidden) abrirLogin(entrada);
        else window.location.replace('/dashboard');
    }

    document.addEventListener('click', function (event) {
        if (conta.open && !conta.contains(event.target)) conta.open = false;
    });
    conta.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && conta.open) {
            event.preventDefault();
            conta.open = false;
            conta.querySelector('summary').focus();
        }
    });
    sair.addEventListener('click', async function () {
        sair.disabled = true;
        statusConta.textContent = '';
        try {
            const { error } = await supabaseClient.auth.signOut({ scope: 'local' });
            if (error) throw error;
            versaoConta++;
            mostrarConta(null);
            entrada.focus();
        } catch (_) {
            statusConta.textContent = 'Não foi possível sair. Tente novamente.';
        } finally {
            sair.disabled = false;
        }
    });
    if (typeof supabaseClient !== 'undefined') {
        supabaseClient.auth.onAuthStateChange(function (evento) {
            if (evento === 'SIGNED_OUT') {
                versaoConta++;
                mostrarConta(null);
            }
        });
    }
    atualizarConta().then(lerDestinoDeLogin);
    window.addEventListener('hashchange', lerDestinoDeLogin);
    window.addEventListener('pageshow', function (event) {
        if (event.persisted) atualizarConta();
    });
})();

