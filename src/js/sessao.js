/* ========================================
   EXIBIÇÃO COMPARTILHADA DOS AVATARES
======================================== */
const estadosAvatares = new WeakMap();
const fotosDaPagina = new Map();

async function carregarAvatar(elemento, nome, caminho) {
    if (!elemento) return;
    const inicial = nome.trim().charAt(0).toUpperCase();
    const estado = {};
    estadosAvatares.set(elemento, estado);
    elemento.textContent = inicial;
    if (!caminho || sessaoEncerrada) return;

    if (!fotosDaPagina.has(caminho)) {
        const foto = supabaseClient.storage.from('avatars').download(caminho)
            .then(function ({ data, error }) {
                if (error || !data || sessaoEncerrada) throw error || new Error('Foto indisponível.');
                return URL.createObjectURL(data);
            }).catch(function () {
                fotosDaPagina.delete(caminho);
                return null;
            });
        fotosDaPagina.set(caminho, foto);
    }
    const url = await fotosDaPagina.get(caminho);
    if (!url || !elemento.isConnected || estadosAvatares.get(elemento) !== estado) return;

    const imagem = document.createElement('img');
    imagem.alt = '';
    imagem.addEventListener('error', function () {
        if (estadosAvatares.get(elemento) === estado) elemento.textContent = inicial;
    });
    imagem.src = url;
    elemento.replaceChildren(imagem);
}

/* ========================================
   1. ELEMENTOS DA PÁGINA E DA CONTA
======================================== */
const conteudoAplicacao = document.querySelector('.aplicacao');
const statusSessao = document.querySelector('#status-sessao');

const nomeUsuario = document.querySelector('#nome-usuario');
const avatarUsuario = document.querySelector('#avatar-usuario');
const botaoSair = document.querySelector('#botao-sair');

/* ========================================
   2. VERIFICAÇÃO DE ACESSO À PÁGINA
======================================== */
// A proteção da página e o app-core compartilham a mesma validação do Auth.
let usuarioDaPagina;
let perfilDaPagina;
let versaoSessao = 0;
let sessaoEncerrada = false;
let usuarioValidado = null;

function obterUsuarioDaPagina() {
    if (!usuarioDaPagina) {
        usuarioDaPagina = supabaseClient.auth.getUser().then(function ({ data, error }) {
            if (error) throw error;
            return data.user;
        });
    }
    return usuarioDaPagina;
}

function obterPerfilDaPagina() {
    if (!perfilDaPagina) {
        perfilDaPagina = obterUsuarioDaPagina().then(async function (user) {
            if (!user) return null;
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('id,display_name,gender,avatar_path')
                .eq('id', user.id)
                .single();
            if (error) throw error;
            return data;
        });
    }
    return perfilDaPagina;
}

function mostrarFalhaDeSessao(texto) {
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'soft-button cc-session-retry';
    retry.textContent = 'Tentar novamente';
    retry.addEventListener('click', function () { window.location.reload(); });
    statusSessao.replaceChildren(texto + ' ', retry);
    conteudoAplicacao.dataset.shellState = 'error';
    statusSessao.hidden = false;
}

async function verificarSessao() {
    const versao = ++versaoSessao;
    if (sessaoEncerrada) return;

    try {
        const user = await obterUsuarioDaPagina();
        if (versao !== versaoSessao) return;
        if (!user) {
            window.location.replace('/#entrar');
            return;
        }
        usuarioValidado = user.id;
    } catch (erro) {
        if (versao !== versaoSessao) return;
        if (erro.name === 'AuthSessionMissingError' || [401, 403].includes(erro.status)) {
            window.location.replace('/#entrar');
            return;
        }
        mostrarFalhaDeSessao('Não foi possível verificar sua sessão. Confira sua conexão e recarregue a página.');
        return;
    }

    try {
        const perfil = await obterPerfilDaPagina();
        if (versao !== versaoSessao || sessaoEncerrada) return;
        if (nomeUsuario) {
            nomeUsuario.textContent = perfil.display_name;
            nomeUsuario.title = perfil.display_name;
        }
        carregarAvatar(avatarUsuario, perfil.display_name, perfil.avatar_path);
        conteudoAplicacao.dataset.shellState = 'ready';
        conteudoAplicacao.hidden = false;
        statusSessao.hidden = true;
    } catch (erro) {
        if (versao !== versaoSessao || sessaoEncerrada) return;
        mostrarFalhaDeSessao('Não foi possível carregar seu perfil. Recarregue a página para tentar novamente.');
    }
}

/* ========================================
   3. ENCERRAMENTO DA SESSÃO
======================================== */
async function sairDaConta() {
    if (botaoSair.disabled) {
        return;
    }

    botaoSair.disabled = true;
    botaoSair.setAttribute('aria-busy', 'true');

    try {
        // Encerra apenas a sessão deste navegador.
        const { error } = await supabaseClient.auth.signOut({
            scope: 'local'
        });

        if (error) {
            throw error;
        }

        sessaoEncerrada = true;
        conteudoAplicacao.hidden = true;
        window.location.replace('/index.html');
    } catch (erro) {
        statusSessao.hidden = false;
        statusSessao.textContent =
            'Não foi possível sair. Confira sua conexão e tente novamente.';

        botaoSair.disabled = false;
        botaoSair.removeAttribute('aria-busy');
    }
}

// Permite usar este arquivo em páginas que ainda não têm o botão.
if (botaoSair) {
    botaoSair.addEventListener('click', sairDaConta);
}

/* ========================================
   4. ALTERAÇÕES NA AUTENTICAÇÃO
======================================== */
// Também reage quando a sessão é encerrada em outra aba.
if (window.supabase) supabaseClient.auth.onAuthStateChange(function (evento, sessao) {
    if (evento === 'SIGNED_IN' && usuarioValidado && sessao?.user.id !== usuarioValidado) {
        conteudoAplicacao.hidden = true;
        window.location.reload();
        return;
    }
    if (evento === 'SIGNED_OUT') {
        sessaoEncerrada = true;
        versaoSessao++;
        conteudoAplicacao.hidden = true;
        window.location.replace('/index.html');
    }
});

/* ========================================
   5. INICIALIZAÇÃO
======================================== */
if (window.supabase) verificarSessao();
else mostrarFalhaDeSessao('Não foi possível conectar. Confira sua conexão.');

window.addEventListener('online', function () {
    if (conteudoAplicacao.dataset.shellState === 'error') window.location.reload();
});

// Atualiza a conta no menu após editar o nome ou a foto.
window.addEventListener('perfil-atualizado', function () {
    usuarioDaPagina = null;
    perfilDaPagina = null;
    verificarSessao();
});

