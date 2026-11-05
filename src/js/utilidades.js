/* ========================================
   1. FUNÇÕES COMPARTILHADAS
======================================== */
CoupleCare.ui = {};
CoupleCare.ui.valor = function (id) {
    return document.getElementById(id).value.trim();
};
CoupleCare.ui.numero = function (id) {
    const valor = this.valor(id);
    return valor === "" ? null : Number(valor);
};
/* textContent escreve texto sem executar HTML digitado pelo usuário. */
CoupleCare.ui.elemento = function (tag, classe, texto) {
    const el = document.createElement(tag);
    el.className = classe;
    el.textContent = texto;
    return el;
};
CoupleCare.ui.botao = function (texto, acao) {
    const b = this.elemento("button", "botao-secundario", texto);
    b.type = "button";
    b.addEventListener("click", acao);
    return b;
};
CoupleCare.ui.vazio = function (lista, texto) {
    lista.replaceChildren(); // Remove o conteúdo anterior antes de redesenhar.
    lista.appendChild(this.elemento("p", "estado-vazio", texto));
};
/* Date recebe mês de 0 a 11. A conversão por partes preserva o dia local. */
CoupleCare.ui.dataLocal = function (texto) {
    const p = texto.split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
};
CoupleCare.ui.chave = function (d) {
    return (
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0")
    );
};
CoupleCare.ui.dataTexto = function (texto) {
    return this.dataLocal(texto).toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
};
CoupleCare.ui.moeda = function (centavos) {
    return (centavos / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
};
