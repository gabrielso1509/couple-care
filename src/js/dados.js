/* ========================================
   1. DADOS DA PRÉVIA — SEM BANCO
   O objeto CoupleCare agrupa as funções do projeto.
   As listas começam vazias. Atualizar ou sair apaga os registros.
   Não há localStorage, envio de informações ou login simulado.
======================================== */
var CoupleCare = {};
CoupleCare.dados = {
    tabelas: {
        tasks: [],
        calendar_events: [],
        financial_transactions: [],
        finance_accounts: [],
        finance_categories: [],
        menstrual_settings: [],
        menstrual_periods: [],
        menstrual_daily_logs: [],
        profiles: [],
    },
    proximoId: 1,
    /* O banco gerará UUIDs; estes IDs servem apenas nesta prévia. */
    adicionar: function (tabela, registro) {
        registro.id = "previa-" + this.proximoId;
        this.proximoId = this.proximoId + 1;
        this.tabelas[tabela].push(registro);
        return registro;
    },
    listar: function (tabela) {
        return this.tabelas[tabela];
    },
    remover: function (tabela, id) {
        const lista = this.tabelas[tabela];
        for (let i = 0; i < lista.length; i++) {
            if (lista[i].id === id) {
                lista.splice(i, 1);
                return;
            }
        }
    },
    substituir: function (tabela, registro) {
        this.tabelas[tabela] = [];
        return this.adicionar(tabela, registro);
    },
};
/* Integração futura: substituir estas funções por consultas reais.
   user_id/couple_id virão da sessão e vínculo autenticados, nunca de
   campos digitados. As chamadas de rede exigirão async/await e RLS. */
