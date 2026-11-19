/* ========================================
   1. ELEMENTOS DO LOGIN
======================================== */
const formularioLogin = document.querySelector('#formulario-login');
const emailLogin = document.querySelector('#email');
const senhaLogin = document.querySelector('#senha');
const feedbackLogin = document.querySelector('#feedback-login');
const botaoEntrar = formularioLogin.querySelector('[type="submit"]');

// Controla se já existe uma tentativa de login em andamento.
let loginEmAndamento = false;

/* ========================================
   2. AUTENTICAÇÃO COM E-MAIL E SENHA
======================================== */
formularioLogin.addEventListener('submit', async function (evento) {
    // Impede o envio padrão e o recarregamento da página.
    evento.preventDefault();

    if (loginEmAndamento || !formularioLogin.reportValidity()) {
        return;
    }

    const email = emailLogin.value.trim();
    const senha = senhaLogin.value;
    const textoOriginalBotao = botaoEntrar.innerHTML;

    loginEmAndamento = true;
    formularioLogin.setAttribute('aria-busy', 'true');
    botaoEntrar.disabled = true;
    emailLogin.disabled = true;
    senhaLogin.disabled = true;
    botaoEntrar.textContent = 'Entrando…';
    feedbackLogin.textContent = '';

    try {
        // Envia as credenciais ao Supabase Auth.
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: senha
        });

        if (error) {
            if (error.code === 'invalid_credentials') {
                feedbackLogin.textContent = 'E-mail ou senha incorretos.';
            } else if (error.code === 'email_not_confirmed') {
                feedbackLogin.textContent =
                    'Confirme seu e-mail antes de entrar. Confira também o spam.';
            } else {
                feedbackLogin.textContent =
                    'Não foi possível entrar agora. Tente novamente mais tarde.';
            }

            return;
        }

        if (!data.session) {
            feedbackLogin.textContent =
                'Não foi possível iniciar uma sessão. Tente novamente.';
            return;
        }

        senhaLogin.value = '';
        
        // Consulta o perfil usando a sessão do usuário autenticado.
        const { data: perfil, error: erroPerfil} = await supabaseClient
            .from('profiles')
            .select('id, display_name, gender')
            .eq('id', data.user.id)
            .single();

        if (erroPerfil) {
            feedbackLogin.textContent =
                'Login realizado, mas não foi possível carregar seu perfil.';

            console.error('Falha ao consultar perfil:', erroPerfil.code, erroPerfil.message);
            return;
        }

        feedbackLogin.textContent =
            'Login realizado! Bem-vindo(a), ' + perfil.display_name + '.';

    } catch (erro) {
        feedbackLogin.textContent =
            'Não foi possível comunicar com o serviço. Verifique sua conexão.';
    } finally {
        // Libera os campos mesmo se a autenticação falhar.
        loginEmAndamento = false;
        formularioLogin.removeAttribute('aria-busy');
        botaoEntrar.disabled = false;
        emailLogin.disabled = false;
        senhaLogin.disabled = false;
        botaoEntrar.innerHTML = textoOriginalBotao;
    }
});