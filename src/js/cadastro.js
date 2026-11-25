/* ========================================
   1. ELEMENTOS DO CADASTRO
======================================== */
const modalCadastro = document.querySelector('#modal-cadastro');
const botaoAbrirCadastro = document.querySelector('#abrir-cadastro');
const botaoFecharCadastro = document.querySelector('#fechar-cadastro');
const botaoVoltarLogin = document.querySelector('#voltar-login');

const formularioCadastro = document.querySelector('#formulario-cadastro');
const nomeCadastro = document.querySelector('#cadastro-nome');
const senhaCadastro = document.querySelector('#cadastro-senha');
const confirmacaoCadastro = document.querySelector('#cadastro-confirmacao');
const feedbackCadastro = document.querySelector('#feedback-cadastro');

const emailCadastro = document.querySelector('#cadastro-email');
const generoCadastro = document.querySelector('#cadastro-genero');
const botaoEnviarCadastro = formularioCadastro.querySelector('[type="submit"]');

// Impede envios repetidos enquanto aguardamos o Supabase.
let cadastroEmAndamento = false;

/* ========================================
   2. ABERTURA E FECHAMENTO
======================================== */
function abrirCadastro() {
    if (modalCadastro.open) {
        return;
    }

    feedbackCadastro.textContent = '';

    // showModal coloca o dialog sobre a página e limita o foco a ele.
    modalCadastro.showModal();
    document.body.classList.add('cadastro-aberto');
}

function fecharCadastro() {
    if (cadastroEmAndamento) {
        return;
    }

    modalCadastro.close();
}

botaoAbrirCadastro.addEventListener('click', abrirCadastro);
botaoFecharCadastro.addEventListener('click', fecharCadastro);
botaoVoltarLogin.addEventListener('click', fecharCadastro);

// Também acontece quando o usuário fecha pela tecla Esc.
modalCadastro.addEventListener('close', function () {
    document.body.classList.remove('cadastro-aberto');

    // Limpa senhas e demais campos ao sair do cadastro.
    formularioCadastro.reset();
    nomeCadastro.setCustomValidity('');
    confirmacaoCadastro.setCustomValidity('');
    feedbackCadastro.textContent = '';

    botaoAbrirCadastro.focus();
});

// Evita fechar e limpar o formulário durante uma requisição.
modalCadastro.addEventListener('cancel', function (evento) {
    if (cadastroEmAndamento) {
        evento.preventDefault();
    }
});

/* ========================================
   3. VALIDAÇÃO DOS CAMPOS
======================================== */
function validarNomeCadastro() {
    if (nomeCadastro.value.trim() === '') {
        nomeCadastro.setCustomValidity('Informe seu nome de exibição.');
    } else {
        nomeCadastro.setCustomValidity('');
    }
}

function validarConfirmacaoCadastro() {
    if (senhaCadastro.value !== confirmacaoCadastro.value) {
        confirmacaoCadastro.setCustomValidity('As senhas precisam ser iguais.');
    } else {
        confirmacaoCadastro.setCustomValidity('');
    }
}

nomeCadastro.addEventListener('input', validarNomeCadastro);
senhaCadastro.addEventListener('input', validarConfirmacaoCadastro);
confirmacaoCadastro.addEventListener('input', validarConfirmacaoCadastro);

// Remove uma mensagem anterior quando o usuário volta a preencher.
formularioCadastro.addEventListener('input', function () {
    feedbackCadastro.textContent = '';
});


/* ========================================
   4. ENVIO DO CADASTRO AO SUPABASE
======================================== */
formularioCadastro.addEventListener('submit', async function (evento) {
    evento.preventDefault();

    if (cadastroEmAndamento) {
        return;
    }

    validarNomeCadastro();
    validarConfirmacaoCadastro();

    if (!formularioCadastro.reportValidity()) {
        return;
    }

    // Captura os dados antes de bloquear os campos.
    const dadosCadastro = {
        email: emailCadastro.value.trim(),
        password: senhaCadastro.value,
        options: {
            // Endereço de retorno após confirmar o e-mail.
            // Página que receberá e validará o código de confirmação.
            emailRedirectTo: window.location.origin + '/src/confirmacao.html',
            data: {
                display_name: nomeCadastro.value.trim(),
                gender: generoCadastro.value
            }
        }
    };

    const controles = formularioCadastro.querySelectorAll('input, select, button');
    const textoOriginalBotao = botaoEnviarCadastro.innerHTML;

    cadastroEmAndamento = true;
    formularioCadastro.setAttribute('aria-busy', 'true');
    botaoFecharCadastro.disabled = true;
    botaoVoltarLogin.disabled = true;

    controles.forEach(function (controle) {
        controle.disabled = true;
    });

    botaoEnviarCadastro.textContent = 'Criando conta…';
    feedbackCadastro.textContent = 'Aguarde enquanto enviamos seu cadastro.';

    try {
        // O Auth cria a conta; o gatilho no banco cria o perfil.
        const { data, error } = await supabaseClient.auth.signUp(dadosCadastro);

        if (error) {
            feedbackCadastro.textContent =
                'Não foi possível concluir o cadastro. Confira os dados e tente novamente.';

            // Registra apenas o diagnóstico, sem os dados do formulário.
            console.error('Falha no cadastro:', error.code, error.message);
            return;
        }

        formularioCadastro.reset();
        nomeCadastro.setCustomValidity('');
        confirmacaoCadastro.setCustomValidity('');

        if (data.session) {
            window.location.replace('/dashboard');
        } else {
            // Mensagem neutra: o Auth pode ocultar se um e-mail já está cadastrado.
            feedbackCadastro.textContent =
                'Solicitação processada. Confira seu e-mail para confirmar o cadastro. Se já possui uma conta, use o login.';
        }
    } catch (erro) {
        feedbackCadastro.textContent =
            'Não foi possível comunicar com o serviço. Confira sua conexão e tente novamente.';
    } finally {
        // Libera o formulário mesmo se ocorrer um erro.
        cadastroEmAndamento = false;
        formularioCadastro.removeAttribute('aria-busy');
        botaoFecharCadastro.disabled = false;
        botaoVoltarLogin.disabled = false;

        controles.forEach(function (controle) {
            controle.disabled = false;
        });

        botaoEnviarCadastro.innerHTML = textoOriginalBotao;
    }
});