/* 1. Valores calculados em centavos. Nenhum saldo bancário é simulado. */
(function () {
    const dados = CoupleCare.dados;
    const ui = CoupleCare.ui;
    const lista = document.getElementById("lista");
    const form = document.getElementById("form-financa");
    /* Referências locais entre contas, categorias e lançamentos. */
    function obter(tabela, nome, tipo) {
        const registros = dados.listar(tabela);
        for (let i = 0; i < registros.length; i++) {
            if (
                registros[i].nome.toLowerCase() === nome.toLowerCase() &&
                registros[i].type === tipo
            ) {
                return registros[i];
            }
        }
        return dados.adicionar(tabela, { nome: nome, type: tipo });
    }
    function renderizar() {
        let entradas = 0;
        let saidas = 0;
        lista.replaceChildren();
        const registros = dados.listar("financial_transactions");
        for (let i = 0; i < registros.length; i++) {
            const t = registros[i];
            if (t.type === "income") {
                entradas = entradas + t.amount_cents;
            } else {
                saidas = saidas + t.amount_cents;
            }
            const item = ui.elemento("article", "registro-app", "");
            item.appendChild(ui.elemento("h3", "", t.descricao));
            item.appendChild(
                ui.elemento(
                    "p",
                    "valor-registro",
                    (t.type === "income" ? "Receita: " : "Despesa: ") +
                        ui.moeda(t.amount_cents),
                ),
            );
            item.appendChild(
                ui.elemento("p", "texto-suave", ui.dataTexto(t.occurred_date)),
            );
            item.appendChild(
                ui.elemento(
                    "p",
                    "texto-suave",
                    t.account_name + " · " + t.category_name,
                ),
            );
            item.appendChild(
                ui.botao("Remover lançamento", function () {
                    dados.remover("financial_transactions", t.id);
                    renderizar();
                }),
            );
            lista.appendChild(item);
        }
        document.getElementById("entradas").textContent = registros.length
            ? ui.moeda(entradas)
            : "—";
        document.getElementById("saidas").textContent = registros.length
            ? ui.moeda(saidas)
            : "—";
        document.getElementById("saldo").textContent = registros.length
            ? ui.moeda(entradas - saidas)
            : "—";
        if (!registros.length) {
            ui.vazio(lista, "Nenhum lançamento nesta prévia.");
        }
    }
    form.addEventListener("submit", function (e) {
        e.preventDefault();
        const descricao = ui.valor("descricao");
        const valor = Number(ui.valor("valor"));
        const data = ui.valor("data");
        const conta = ui.valor("conta");
        const categoria = ui.valor("categoria");
        const tipo = ui.valor("tipo");
        if (
            !descricao ||
            !data ||
            !conta ||
            !categoria ||
            !Number.isFinite(valor) ||
            valor <= 0
        ) {
            document.getElementById("feedback").textContent =
                "Preencha os campos com um valor positivo.";
            return;
        }
        const contaRegistro = obter("finance_accounts", conta, "manual");
        const categoriaRegistro = obter("finance_categories", categoria, tipo);
        dados.adicionar("financial_transactions", {
            descricao: descricao,
            type: tipo,
            amount_cents: Math.round(valor * 100),
            occurred_date: data,
            account_id: contaRegistro.id,
            category_id: categoriaRegistro.id,
            account_name: conta,
            category_name: categoria,
        });
        form.reset();
        document.getElementById("data").value = ui.chave(new Date());
        renderizar();
        document.getElementById("feedback").textContent =
            "Lançamento adicionado só à prévia. Nada foi enviado ao banco.";
    });
    document.getElementById("data").value = ui.chave(new Date());
    renderizar();
})();
