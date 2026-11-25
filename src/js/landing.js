(function () {
    'use strict';
    const login = document.getElementById('modal-login');
    const cadastro = document.getElementById('modal-cadastro');
    const senha = document.getElementById('senha');
    const entrada = document.querySelector('[data-login]');
    const mostrar = document.createElement('button');
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
        if (!cadastro.open) origemLogin.focus();
    });

    document.getElementById('abrir-cadastro').addEventListener('click', event => {
        origemCadastro = event.currentTarget;
    });
    document.querySelector('[data-signup]').addEventListener('click', event => {
        origemCadastro = event.currentTarget;
        abrirCadastro();
    });
    document.getElementById('voltar-login').addEventListener('click', () => {
        if (!cadastroEmAndamento && !login.open) abrirLogin(origemCadastro);
    });
    cadastro.addEventListener('close', () => {
        if (!login.open) origemCadastro.focus();
    });

    if (location.hash === '#entrar') abrirLogin(entrada);
    window.addEventListener('hashchange', () => {
        if (location.hash === '#entrar' && !cadastro.open) abrirLogin(entrada);
    });
})();