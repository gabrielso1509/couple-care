/* ========================================
   1. MENU LATERAL
======================================== */

// Busca o botão de recolher o menu no HTML
const botaoMenu = document.querySelector("#botao-menu");

// Busca a estrutura principal do CoupleCare
const aplicacao = document.querySelector(".aplicacao");

// Verifica se os dois elementos existem
if (botaoMenu && aplicacao) {
    // Detecta quando o usuário clica no botão
    botaoMenu.addEventListener("click", function () {
        // Adiciona a classe se ela não existir
        // ou remove a classe se ela já existir
        aplicacao.classList.toggle("menu-recolhido");

        /* Informa o estado atual a quem usa leitor de tela */
        const recolhido = aplicacao.classList.contains("menu-recolhido");
        botaoMenu.setAttribute("aria-expanded", String(!recolhido));
        botaoMenu.setAttribute(
            "aria-label",
            recolhido ? "Expandir menu" : "Recolher menu",
        );
    });
}

/* 2. Em Tarefas, inicia compacto no celular para dar espaço ao conteúdo.
   Depois de carregar, a pessoa continua controlando pelo botão. */
if (
    botaoMenu &&
    aplicacao &&
    document.body.classList.contains("pagina-orbital")
) {
    if (window.matchMedia("(max-width: 600px)").matches) {
        aplicacao.classList.add("menu-recolhido");
        botaoMenu.setAttribute("aria-expanded", "false");
        botaoMenu.setAttribute("aria-label", "Expandir menu");
    }
}
