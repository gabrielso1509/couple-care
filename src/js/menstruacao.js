/* 1. PRÉVIA INDIVIDUAL. Sem previsão médica, compartilhamento ou persistência.
   A troca de visualização NÃO protege dados. O banco precisará de Auth e RLS. */
(function () {
    const ui = CoupleCare.ui;
    const dados = CoupleCare.dados;
    const hoje = ui.chave(new Date());
    const lista = document.getElementById("lista");
    document.getElementById("modo").addEventListener("change", function () {
        const parceiro = this.value === "partner";
        document.getElementById("parceiro").hidden = !parceiro;
        document.getElementById("individual").hidden = parceiro;
    });
    /* 2. Configuração. Campo desconhecido permanece null, não vira zero. */
    document
        .getElementById("form-ciclo")
        .addEventListener("submit", function (e) {
            e.preventDefault();
            const inicio = ui.valor("inicio");
            const fim = ui.valor("fim");
            const ciclo = ui.numero("ciclo");
            const periodo = ui.numero("periodo");
            const feedback = document.getElementById("feedback-ciclo");
            if (fim && !inicio) {
                feedback.textContent = "Informe o início antes do fim.";
                return;
            }
            if (inicio > hoje || fim > hoje) {
                feedback.textContent = "Registre datas que já aconteceram.";
                return;
            }
            if (inicio && fim && fim < inicio) {
                feedback.textContent = "O fim não pode ser anterior ao início.";
                return;
            }
            if (
                (ciclo !== null && (!Number.isInteger(ciclo) || ciclo <= 0)) ||
                (periodo !== null &&
                    (!Number.isInteger(periodo) || periodo <= 0))
            ) {
                feedback.textContent =
                    "Informe dias inteiros positivos ou deixe em branco.";
                return;
            }
            if (ciclo !== null && periodo !== null && periodo > ciclo) {
                feedback.textContent =
                    "A menstruação não pode durar mais que o ciclo informado.";
                return;
            }
            dados.substituir("menstrual_settings", {
                average_cycle_length_days: ciclo,
                average_period_length_days: periodo,
                cycle_regularity: ui.valor("regularidade"),
                onboarding_completed_at: new Date().toISOString(),
            });
            dados.listar("menstrual_periods").length = 0;
            if (inicio) {
                dados.adicionar("menstrual_periods", {
                    start_date: inicio,
                    end_date: fim || null,
                });
            }
            feedback.textContent =
                "Configuração preparada só nesta página. Nenhuma previsão foi calculada.";
        });
    function renderizar() {
        const registros = dados.listar("menstrual_daily_logs");
        lista.replaceChildren();
        const fluxos = {
            none: "Sem fluxo",
            spotting: "Escape",
            light: "Leve",
            medium: "Moderado",
            heavy: "Intenso",
        };
        for (let i = 0; i < registros.length; i++) {
            const d = registros[i];
            const item = ui.elemento("article", "registro-app", "");
            item.appendChild(ui.elemento("h3", "", ui.dataTexto(d.log_date)));
            if (d.mood) {
                item.appendChild(
                    ui.elemento("p", "texto-suave", "Humor: " + d.mood),
                );
            }
            if (d.cramps_level !== null) {
                item.appendChild(
                    ui.elemento(
                        "p",
                        "texto-suave",
                        "Cólica informada: " + d.cramps_level + "/10",
                    ),
                );
            }
            if (d.flow_level) {
                item.appendChild(
                    ui.elemento(
                        "p",
                        "texto-suave",
                        "Fluxo: " + fluxos[d.flow_level],
                    ),
                );
            }
            if (d.notes) {
                item.appendChild(ui.elemento("p", "texto-suave", d.notes));
            }
            item.appendChild(
                ui.botao("Remover registro", function () {
                    dados.remover("menstrual_daily_logs", d.id);
                    renderizar();
                }),
            );
            lista.appendChild(item);
        }
        if (!registros.length) {
            ui.vazio(lista, "Nenhum registro adicionado ao diário da prévia.");
        }
    }
    /* 3. Um registro por dia; remove-se o anterior para substituí-lo na prévia. */
    const form = document.getElementById("form-diario");
    form.addEventListener("submit", function (e) {
        e.preventDefault();
        const data = ui.valor("data");
        const humor = ui.valor("humor");
        const dor = ui.numero("dor");
        const fluxo = ui.valor("fluxo");
        const nota = ui.valor("nota");
        const feedback = document.getElementById("feedback");
        if (!data || data > hoje) {
            feedback.textContent = "Escolha uma data até hoje.";
            return;
        }
        if (dor !== null && (!Number.isInteger(dor) || dor < 0 || dor > 10)) {
            feedback.textContent = "Informe a cólica de 0 a 10.";
            return;
        }
        if (!humor && dor === null && !fluxo && !nota) {
            feedback.textContent = "Informe ao menos uma observação.";
            return;
        }
        const registros = dados.listar("menstrual_daily_logs");
        for (let i = 0; i < registros.length; i++) {
            if (registros[i].log_date === data) {
                feedback.textContent =
                    "Já existe um registro nesta data. Remova-o antes de substituir.";
                return;
            }
        }
        dados.adicionar("menstrual_daily_logs", {
            log_date: data,
            mood: humor || null,
            cramps_level: dor,
            flow_level: fluxo || null,
            notes: nota || null,
        });
        form.reset();
        document.getElementById("data").value = hoje;
        renderizar();
        feedback.textContent =
            "Registro apenas na prévia, sem compartilhar ou enviar ao banco.";
    });
    document.getElementById("data").value = hoje;
    for (const id of ["data", "inicio", "fim"]) {
        document.getElementById(id).max = hoje;
    }
    renderizar();
})();
