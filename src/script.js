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

    });

}