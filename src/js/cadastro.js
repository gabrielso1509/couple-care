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
   4. ENVIO — INTEGRAÇÃO AINDA PENDENTE
======================================== */
formularioCadastro.addEventListener('submit', function (evento) {
    // Impede recarregar a página e enviar os campos pela URL.
    evento.preventDefault();

    validarNomeCadastro();
    validarConfirmacaoCadastro();

    if (!formularioCadastro.reportValidity()) {
        return;
    }

    // Não simula sucesso nem armazena senhas no navegador.
    feedbackCadastro.textContent =
        'O cadastro ainda não está disponível. A conexão com o Supabase será implementada na próxima etapa.';
});