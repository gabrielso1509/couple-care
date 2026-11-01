/* ========================================
   VERCEL WEB ANALYTICS
======================================== */

// Prepara a fila de eventos do Analytics.
window.va = window.va || function () {

    (window.vaq = window.vaq || []).push(arguments);

};

// Cria o elemento que carrega o script da Vercel.
var scriptAnalytics = document.createElement("script");

// Endereço do script de monitoramento.
scriptAnalytics.src = "/_vercel/insights/script.js";

// Carrega o script sem bloquear a página.
scriptAnalytics.async = true;

// Adiciona o script ao HTML.
document.head.appendChild(scriptAnalytics);