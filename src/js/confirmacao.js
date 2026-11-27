/* ========================================
   1. ELEMENTOS E CÓDIGO RECEBIDO PELO LINK
======================================== */
const tituloConfirmacao = document.querySelector('#titulo-confirmacao');
const mensagemConfirmacao = document.querySelector('#mensagem-confirmacao');
const simboloConfirmacao = document.querySelector('#simbolo-confirmacao');
const acaoConfirmacao = document.querySelector('#acao-confirmacao');
const botaoTentarConfirmacao = document.querySelector('#tentar-confirmacao');

const parametrosConfirmacao = new URLSearchParams(window.location.search);
const tokenConfirmacao = parametrosConfirmacao.get('token_hash');

// Remove o código da barra de endereço, mantendo-o apenas na memória.
window.history.replaceState(null, '', window.location.pathname);

let confirmacaoEmAndamento = false;

/* ========================================
   2. VALIDAÇÃO DO LINK NO SUPABASE
======================================== */
async function confirmarEmail() {
    if (confirmacaoEmAndamento) {
        return;
    }

    botaoTentarConfirmacao.hidden = true;

    // Abrir a página diretamente não comprova uma confirmação.
    if (!tokenConfirmacao) {
        simboloConfirmacao.textContent = '!';
        tituloConfirmacao.textContent = 'Link de confirmação ausente';
        mensagemConfirmacao.textContent =
            'Abra esta página pelo botão do e-mail enviado pelo CoupleCare.';
        return;
    }

    confirmacaoEmAndamento = true;
    simboloConfirmacao.textContent = '…';
    tituloConfirmacao.textContent = 'Confirmando seu e-mail…';
    mensagemConfirmacao.textContent =
        'Só um instante. Estamos verificando seu link.';

    try {
        // O Supabase verifica o código e inicia a sessão se ele for válido.
        const { data, error } = await supabaseClient.auth.verifyOtp({
            token_hash: tokenConfirmacao,
            type: 'email'
        });

        if (error) {
            simboloConfirmacao.textContent = '!';

            if (error.code === 'otp_expired') {
                tituloConfirmacao.textContent = 'Este link não está mais disponível';
                mensagemConfirmacao.textContent =
                    'Ele pode ter expirado ou já ter sido utilizado. Se você já confirmou seu e-mail, pode entrar na sua conta.';
            } else {
                tituloConfirmacao.textContent = 'Não foi possível confirmar';
                mensagemConfirmacao.textContent =
                    'Tente novamente. Se o problema continuar, o link pode estar inválido ou expirado.';
                botaoTentarConfirmacao.hidden = false;
            }

            return;
        }

        if (!data.user || !data.user.email_confirmed_at) {
            throw new Error('Confirmação não comprovada.');
        }

        simboloConfirmacao.textContent = '✓';
        tituloConfirmacao.textContent = 'E-mail confirmado!';
        mensagemConfirmacao.textContent =
            'Tudo certo! Seu cadastro está confirmado. Vamos começar a organizar sua vida a dois?';

        // verifyOtp também pode iniciar a sessão.
        if (data.session) {
            acaoConfirmacao.textContent = 'Ir para meu espaço →';
            acaoConfirmacao.href = '/src/dashboard.html';
        } else {
            acaoConfirmacao.textContent = 'Entrar na minha conta →';
        }
    } catch (erro) {
        simboloConfirmacao.textContent = '!';
        tituloConfirmacao.textContent = 'Não foi possível concluir a verificação';
        mensagemConfirmacao.textContent =
            'Confira sua conexão e tente novamente.';

        botaoTentarConfirmacao.hidden = false;
    } finally {
        confirmacaoEmAndamento = false;
    }
}

botaoTentarConfirmacao.addEventListener('click', confirmarEmail);

confirmarEmail();
