/* 1. Prepara o perfil, mas não altera uma conta real nem cria vínculo. */
(function () {
    document
        .getElementById("form-perfil")
        .addEventListener("submit", function (e) {
            e.preventDefault();
            const nome = CoupleCare.ui.valor("nome");
            if (!nome) {
                document.getElementById("feedback").textContent =
                    "Informe seu nome.";
                return;
            }
            CoupleCare.dados.substituir("profiles", {
                nome: nome,
                sexo: CoupleCare.ui.valor("sexo") || null,
            });
            document.getElementById("feedback").textContent =
                "Perfil de " +
                nome +
                " preparado somente nesta página. A conta não foi alterada.";
        });
})();
