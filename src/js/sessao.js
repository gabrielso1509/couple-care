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
async function verificarSessao() {
    try {
        // Consulta o Auth para validar o usuário atual.
        const { data, error } = await supabaseClient.auth.getUser();

        if (error) {
            // Sessão ausente ou rejeitada: volta ao login.
            if (
                error.name === 'AuthSessionMissingError' ||
                error.status === 401 ||
                error.status === 403
            ) {
                window.location.replace('/index.html');
                return;
            }

            throw error;
        }

        if (!data.user) {
            window.location.replace('/index.html');
            return;
        }

        // Busca o perfil correspondente à conta autenticada.
        const { data: perfil, error: erroPerfil } = await supabaseClient
            .from('profiles')
            .select('display_name, avatar_path')
            .eq('id', data.user.id)
            .single();

        if (erroPerfil) {
            statusSessao.textContent =
                'Não foi possível carregar seu perfil. Recarregue a página para tentar novamente.';

            console.error(
                'Falha ao carregar perfil:',
                erroPerfil.code,
                erroPerfil.message
            );

            return;
        }

        // Preenche a área da conta se ela estiver presente na página.
        if (nomeUsuario) {
            nomeUsuario.textContent = perfil.display_name;

            // Permite consultar o nome completo ao passar o mouse.
            nomeUsuario.title = perfil.display_name;
        }

        // Carrega a foto sem atrasar a abertura do conteúdo.
        carregarAvatar(
            avatarUsuario,
            perfil.display_name,
            perfil.avatar_path
        );

        // Exibe a página somente após validar a conta e carregar o perfil.
        conteudoAplicacao.hidden = false;
        statusSessao.hidden = true;
    } catch (erro) {
        // Falha de conexão não significa que a conta foi desconectada.
        statusSessao.hidden = false;
        statusSessao.textContent =
            'Não foi possível verificar sua sessão. Confira sua conexão e recarregue a página.';
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
        conteudoAplicacao.hidden = true;
        window.location.replace('/index.html');
    }
});

/* ========================================
   5. INICIALIZAÇÃO
======================================== */
verificarSessao();

// Atualiza a conta no menu após editar o nome ou a foto.
window.addEventListener('perfil-atualizado', verificarSessao);