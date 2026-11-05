/* 1. Tarefas da prévia. Não há persistência nem responsáveis inventados. */
(function () {
    const ui = CoupleCare.ui;
    const dados = CoupleCare.dados;
    const lista = document.getElementById("lista");
    const form = document.getElementById("form-tarefa");
    let filtro = "all";
    function renderizar() {
        lista.replaceChildren();
        const tarefas = dados.listar("tasks");
        let total = 0;
        document.getElementById("resumo").textContent =
            tarefas.length + " tarefa(s) nesta prévia.";
        for (let i = 0; i < tarefas.length; i++) {
            const t = tarefas[i];
            if (filtro !== "all" && t.status !== filtro) {
                continue;
            }
            total = total + 1;
            const item = ui.elemento("article", "registro-app", "");
            const prioridades = {
                normal: "Normal",
                low: "Baixa",
                high: "Alta",
            };
            item.appendChild(ui.elemento("h3", "", t.titulo));
            item.appendChild(
                ui.elemento(
                    "p",
                    "texto-suave",
                    (t.status === "completed" ? "Concluída" : "Pendente") +
                        " · Prioridade " +
                        prioridades[t.priority],
                ),
            );
            if (t.due_date) {
                item.appendChild(
                    ui.elemento(
                        "p",
                        "texto-suave",
                        "Prazo: " + ui.dataTexto(t.due_date),
                    ),
                );
            }
            const acoes = ui.elemento("div", "acoes-app", "");
            acoes.appendChild(
                ui.botao(
                    t.status === "completed" ? "Reabrir" : "Concluir",
                    function () {
                        t.status =
                            t.status === "completed" ? "pending" : "completed";
                        t.completed_at =
                            t.status === "completed"
                                ? new Date().toISOString()
                                : null;
                        renderizar();
                    },
                ),
            );
            acoes.appendChild(
                ui.botao("Remover", function () {
                    dados.remover("tasks", t.id);
                    renderizar();
                }),
            );
            item.appendChild(acoes);
            lista.appendChild(item);
        }
        if (!total) {
            ui.vazio(lista, "Nenhuma tarefa para este filtro.");
        }
    }
    /* 2. Formulário: trim remove espaços; texto vazio não vira tarefa. */
    form.addEventListener("submit", function (e) {
        e.preventDefault();
        const titulo = ui.valor("titulo");
        if (!titulo) {
            document.getElementById("feedback").textContent =
                "Informe um título.";
            return;
        }
        dados.adicionar("tasks", {
            titulo: titulo,
            due_date: ui.valor("prazo") || null,
            priority: ui.valor("prioridade"),
            status: "pending",
            completed_at: null,
        });
        form.reset();
        renderizar();
        document.getElementById("feedback").textContent =
            "Tarefa adicionada somente à prévia.";
    });
    /* 3. dataset lê o atributo data-filtro de cada botão. */
    const botoes = document.querySelectorAll("[data-filtro]");
    for (let i = 0; i < botoes.length; i++) {
        botoes[i].addEventListener("click", function () {
            filtro = botoes[i].dataset.filtro;
            for (let j = 0; j < botoes.length; j++) {
                botoes[j].setAttribute("aria-pressed", String(i === j));
            }
            renderizar();
        });
    }
    renderizar();
})();
