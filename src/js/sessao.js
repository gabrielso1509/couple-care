/* ========================================
   EXIBIÇÃO COMPARTILHADA DOS AVATARES
======================================== */
const estadosAvatares = new WeakMap();

async function carregarAvatar(elemento, nome, caminho) {
    if (!elemento) {
        return;
    }

    const anterior = estadosAvatares.get(elemento);

    if (anterior && anterior.url) {
        URL.revokeObjectURL(anterior.url);
    }

    // Identifica esta chamada para ignorar respostas antigas.
    const estado = { url: null };
    estadosAvatares.set(elemento, estado);

    elemento.textContent = nome.trim().charAt(0).toUpperCase();

    if (!caminho) {
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .storage
            .from('avatars')
            .download(caminho);

        if (error) {
            throw error;
        }

        // Outra atualização pode ter ocorrido enquanto aguardávamos.
        if (
            estadosAvatares.get(elemento) !== estado ||
            !elemento.isConnected
        ) {
            return;
        }

        estado.url = URL.createObjectURL(data);

        const imagem = document.createElement('img');
        imagem.alt = '';
        imagem.src = estado.url;

        imagem.addEventListener('error', function () {
            if (estadosAvatares.get(elemento) === estado) {
                elemento.textContent = nome.trim().charAt(0).toUpperCase();
                URL.revokeObjectURL(estado.url);
                estado.url = null;
            }
        });

        elemento.replaceChildren(imagem);
    } catch (erro) {
        // Uma falha na foto mantém a inicial e não bloqueia a página.
    }
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
    statusSessao.textContent = texto;
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
supabaseClient.auth.onAuthStateChange(function (evento) {
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
verificarSessao();

// Atualiza a conta no menu após editar o nome ou a foto.
window.addEventListener('perfil-atualizado', function () {
    usuarioDaPagina = null;
    perfilDaPagina = null;
    verificarSessao();
});

