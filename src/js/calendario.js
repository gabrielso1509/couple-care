/* ========================================
   1. ESTADO DO CALENDÁRIO
   A função envolvente (function () { ... })() executa uma vez e mantém
   as variáveis desta página separadas das demais. Sem arrow functions.
======================================== */
(function () {
    const ui = CoupleCare.ui;
    const dados = CoupleCare.dados;
    const agora = new Date();
    let ano = agora.getFullYear();
    let mes = agora.getMonth();
    let selecionada = ui.chave(agora);
    const lista = document.getElementById("lista");
    const grade = document.getElementById("dias");
    const formulario = document.getElementById("form-evento");

    /* 2. Agenda: só mostra registros adicionados pela pessoa nesta página. */
    function agenda() {
        document.getElementById("selecionado").textContent =
            ui.dataTexto(selecionada);
        document.getElementById("data").value = selecionada;
        lista.replaceChildren();
        const eventos = dados.listar("calendar_events");
        let total = 0;
        for (let i = 0; i < eventos.length; i++) {
            const ev = eventos[i];
            if (ev.date !== selecionada) {
                continue;
            }
            total = total + 1;
            const item = ui.elemento("article", "registro-app", "");
            item.appendChild(ui.elemento("h3", "", ev.titulo));
            item.appendChild(
                ui.elemento("p", "texto-suave", ev.time || "Dia inteiro"),
            );
            item.appendChild(
                ui.botao("Remover evento", function () {
                    dados.remover("calendar_events", ev.id);
                    renderizar();
                }),
            );
            lista.appendChild(item);
        }
        if (!total) {
            ui.vazio(lista, "Nenhum evento nesta prévia para este dia.");
        }
    }
    /* 3. Date calcula automaticamente meses de 28, 29, 30 ou 31 dias. */
    function renderizar() {
        const primeiro = new Date(ano, mes, 1);
        const ultimo = new Date(ano, mes + 1, 0).getDate();
        const espacos = (primeiro.getDay() + 6) % 7; // Semana começa na segunda.
        document.getElementById("mes").textContent =
            primeiro.toLocaleDateString("pt-BR", {
                month: "long",
                year: "numeric",
            });
        document.getElementById("anterior").disabled =
            ano === 1900 && mes === 0;
        document.getElementById("seguinte").disabled =
            ano === 2100 && mes === 11;
        grade.replaceChildren();
        for (let i = 0; i < espacos; i++) {
            const vazio = ui.elemento("span", "dia-vazio", "");
            vazio.setAttribute("aria-hidden", "true");
            grade.appendChild(vazio);
        }
        for (let dia = 1; dia <= ultimo; dia++) {
            const chave = ui.chave(new Date(ano, mes, dia));
            const b = ui.elemento("button", "dia-app", String(dia));
            b.type = "button";
            b.setAttribute("aria-label", ui.dataTexto(chave));
            b.setAttribute("aria-pressed", String(chave === selecionada));
            if (chave === ui.chave(agora)) {
                b.classList.add("hoje");
                b.setAttribute("aria-current", "date");
            }
            const eventos = dados.listar("calendar_events");
            for (let i = 0; i < eventos.length; i++) {
                if (eventos[i].date === chave) {
                    b.classList.add("com-evento");
                    b.setAttribute(
                        "aria-label",
                        ui.dataTexto(chave) + ", com evento nesta prévia",
                    );
                    break;
                }
            }
            b.addEventListener("click", function () {
                selecionada = chave;
                renderizar();
                document.querySelector('.dia-app[aria-pressed="true"]').focus();
            });
            grade.appendChild(b);
        }
        agenda();
    }
    /* 4. Mudança de mês: limita o dia ao último dia do novo mês. */
    function mudar(passo) {
        const d = new Date(ano, mes + passo, 1);
        const dia = ui.dataLocal(selecionada).getDate();
        ano = d.getFullYear();
        mes = d.getMonth();
        selecionada = ui.chave(
            new Date(
                ano,
                mes,
                Math.min(dia, new Date(ano, mes + 1, 0).getDate()),
            ),
        );
        renderizar();
    }
    document.getElementById("anterior").addEventListener("click", function () {
        mudar(-1);
    });
    document.getElementById("seguinte").addEventListener("click", function () {
        mudar(1);
    });
    document.getElementById("hoje").addEventListener("click", function () {
        const d = new Date();
        ano = d.getFullYear();
        mes = d.getMonth();
        selecionada = ui.chave(d);
        renderizar();
    });
    /* 5. Preparação do evento: futuro adapter converterá date/time para starts_at. */
    formulario.addEventListener("submit", function (e) {
        e.preventDefault();
        const titulo = ui.valor("titulo");
        const data = ui.valor("data");
        if (!titulo || !data) {
            document.getElementById("feedback").textContent =
                "Informe título e data.";
            return;
        }
        dados.adicionar("calendar_events", {
            titulo: titulo,
            date: data,
            time: ui.valor("hora") || null,
            all_day: ui.valor("hora") === "",
            visibility: "private",
        });
        selecionada = data;
        const d = ui.dataLocal(data);
        ano = d.getFullYear();
        mes = d.getMonth();
        formulario.reset();
        renderizar();
        document.getElementById("feedback").textContent =
            "Evento adicionado só à prévia desta página.";
    });
    renderizar();
})();
