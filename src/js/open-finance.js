/* Conexões Pluggy e importação dos movimentos para as finanças compartilhadas. */
(function () {
    'use strict';
    const C = CC, $ = C.$;
    let user, coupleId, active = null, cursor = null, rows = [], busy = false;
    let accounts = [], syncing = false, queuedRange = null;

    const section = C.el('section', 'card bank-panel');
    section.setAttribute('aria-labelledby', 'bank-title');
    section.innerHTML = '<header class="card-title"><div><span>OPEN FINANCE · COMPARTILHADO</span><h2 id="bank-title">Contas do casal</h2></div><button type="button" class="primary-button" id="connect-bank" disabled>＋ Conectar banco</button></header><p>Conecte uma conta para atualizar saldos e importar movimentações para as finanças compartilhadas.</p><p class="bank-privacy">✓ O casal verá os saldos e lançamentos importados. A conexão Pluggy continua vinculada a quem autorizou o banco.</p><p id="bank-status" role="status" aria-live="polite">Carregando conexões…</p><div id="bank-connections"></div><div id="bank-statement" hidden><div class="bank-toolbar"><h3 id="bank-account-title">Extrato</h3><label>De <input id="bank-date-from" type="date" required></label><label>Até <input id="bank-date-to" type="date" required></label><button type="button" class="soft-button" id="bank-reload">Atualizar e importar</button></div><p>Movimentações efetivadas entram nos totais compartilhados. Pendentes não entram; transferências internas e pagamentos de fatura identificados pela descrição são ignorados. Confira os lançamentos importados.</p><div id="bank-transactions" class="bank-scroll"></div><button type="button" id="bank-more" class="soft-button" hidden>Carregar mais transações</button></div>';
    $('conteudo-pagina').insertBefore(section, $('conteudo-pagina').querySelector('footer'));
    const today = C.today();
    $('bank-date-from').value = today.slice(0, 7) + '-01';
    $('bank-date-to').value = today;

    function notice(text, error) {
        $('bank-status').textContent = text;
        $('bank-status').classList.toggle('bank-error', !!error);
        if (error && C.notify) C.notify(text, 'error');
    }

    function controls(value) {
        busy = value;
        section.querySelectorAll('button,input').forEach(function (item) { item.disabled = value; });
        section.setAttribute('aria-busy', String(value));
    }

    async function api(path, body) {
        const result = await supabaseClient.auth.getSession();
        if (result.error || !result.data.session) throw new Error('Sua sessão expirou. Entre novamente.');
        const response = await fetch('/api/pluggy/' + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + result.data.session.access_token },
            body: JSON.stringify(body),
            cache: 'no-store'
        });
        let data;
        try { data = await response.json(); }
        catch (_) { throw new Error('A API bancária não está disponível. Use a versão publicada na Vercel.'); }
        if (!response.ok) throw new Error(data.error || 'Consulta indisponível.');
        return data;
    }

    async function sdk() {
        if (window.PluggyConnect) return;
        if (!sdk.promise) sdk.promise = new Promise(function (resolve, reject) {
            const script = document.createElement('script');
            script.src = 'https://cdn.pluggy.ai/pluggy-connect/v2.5.0/pluggy-connect.js';
            script.onload = resolve;
            script.onerror = function () {
                sdk.promise = null; script.remove();
                reject(new Error('Não foi possível abrir a Pluggy. Tente novamente.'));
            };
            document.head.append(script);
        });
        await sdk.promise;
        if (!window.PluggyConnect) throw new Error('Widget bancário indisponível.');
    }

    async function connect(itemId) {
        if (busy || syncing) return;
        controls(true); notice('Preparando conexão segura…');
        try {
            await sdk();
            const token = await api('connect-token', itemId ? { itemId: itemId } : {});
            const widget = new PluggyConnect({
                connectToken: token.accessToken,
                includeSandbox: token.sandbox,
                updateItem: itemId || undefined,
                onSuccess: async function (data) {
                    try {
                        const id = data.item?.id || data.id;
                        if (!id) throw new Error('Conexão sem identificador.');
                        await api('connection', { action: 'register', itemId: id });
                        await load();
                        await syncRange($('bank-date-from').value, $('bank-date-to').value);
                        if (C.notify) C.notify('Banco conectado e sincronizado com as finanças do casal.');
                    } catch (error) { notice(error.message, true); }
                    finally { controls(false); }
                },
                onError: function () {
                    notice('A instituição não concluiu a conexão. Confira o aviso da Pluggy e tente novamente.', true);
                    controls(false);
                },
                onClose: function () { controls(false); }
            });
            await widget.init();
            notice(token.sandbox ? 'Ambiente de desenvolvimento: contas sandbox são de teste.' : 'Autorize a conexão no fluxo seguro da instituição.');
        } catch (error) { notice(error.message, true); controls(false); }
    }

    function money(value, currency) {
        return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: currency || 'BRL' });
    }

    function accountType(type) {
        if (type === 'CREDIT') return 'credit';
        if (type === 'SAVINGS') return 'savings';
        if (type === 'CHECKING') return 'checking';
        return 'other';
    }

    async function saveAccount(itemId, bank, account) {
        const payload = {
            couple_id: coupleId,
            name: (bank + ' · ' + account.name).slice(0, 100),
            account_type: accountType(account.type),
            source: 'pluggy',
            provider: bank,
            external_account_id: account.id,
            balance_cents: Math.round(Number(account.balance || 0) * 100),
            currency_code: account.currency || 'BRL',
            balance_updated_at: new Date().toISOString()
        };
        const findExisting = async function () {
            return C.result(await supabaseClient.from('finance_accounts').select('id')
                .eq('couple_id', coupleId).eq('provider', bank).eq('external_account_id', account.id).maybeSingle());
        };
        const values = {
            name: payload.name, account_type: payload.account_type, source: payload.source,
            provider: payload.provider, external_account_id: payload.external_account_id,
            balance_cents: payload.balance_cents, currency_code: payload.currency_code,
            balance_updated_at: payload.balance_updated_at
        };
        const updateExisting = async function (row) {
            const result = await supabaseClient.from('finance_accounts').update(values)
                .eq('id', row.id).eq('couple_id', coupleId).select('id').single();
            return C.result(result).id;
        };
        let existing = await findExisting();
        if (existing) return updateExisting(existing);
        try {
            return C.result(await supabaseClient.from('finance_accounts').insert(payload).select('id').single()).id;
        } catch (error) {
            // Outra aba pode ter cadastrado a mesma conta entre a busca e o INSERT.
            if (error.code !== '23505') throw error;
            existing = await findExisting();
            if (!existing) throw error;
            return updateExisting(existing);
        }
    }

    async function load() {
        const result = await supabaseClient.from('pluggy_connections')
            .select('item_id,created_at').eq('user_id', user.id).order('created_at', { ascending: false });
        if (result.error) throw new Error('Não foi possível carregar as conexões. Confira se a migration Pluggy foi aplicada.');
        const box = $('bank-connections'); box.replaceChildren(); accounts = [];
        const reload = $('bank-refresh-connections'); if (reload) reload.hidden = !result.data.length;
        if (!result.data.length) {
            const empty = C.el('div', 'bank-empty'), icon = C.el('span', 'bank-empty-icon');
            icon.setAttribute('aria-hidden', 'true');
            icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m3 9 9-6 9 6H3ZM5 10v7m5-7v7m4-7v7m5-7v7M3 21h18M3 18h18"/></svg>';
            empty.append(icon, C.el('h3', '', 'Seu banco, no espaço do casal'), C.el('p', '', 'Conecte uma conta para importar saldo e movimentações.'));
            box.append(empty);
        }
        let failures = 0;
        for (const ref of result.data) {
            const card = C.el('article', 'bank-connection'); box.append(card);
            try {
                const data = await api('connection', { action: 'accounts', itemId: ref.item_id });
                card.append(C.el('h3', '', data.bank), C.el('small', '', data.status === 'UPDATED' ? 'Dados disponíveis' : 'Situação: ' + data.status));
                const actions = C.el('div', 'bank-toolbar');
                actions.append(C.button('Reconectar', function () { return connect(ref.item_id); }, 'soft-button'));
                actions.append(C.button('Desconectar', async function () {
                    if (!confirm('Desconectar este banco? O histórico já importado ficará nas finanças do casal.')) return;
                    await api('connection', { action: 'disconnect', itemId: ref.item_id });
                    active = null; $('bank-statement').hidden = true; await load();
                    if (C.notify) C.notify('Banco desconectado. O histórico importado foi mantido.');
                }, 'soft-button'));
                card.append(actions);
                for (const account of data.accounts || []) {
                    const financeAccountId = await saveAccount(ref.item_id, data.bank, account);
                    accounts.push({ itemId: ref.item_id, accountId: account.id, financeAccountId: financeAccountId, name: account.name, bank: data.bank, type: account.type });
                    const row = C.el('div', 'bank-account'), info = C.el('div');
                    info.append(C.el('strong', '', account.name), C.el('p', '', (account.type === 'CREDIT' ? 'Saldo do cartão: ' : 'Saldo: ') + money(account.balance, account.currency)));
                    row.append(info, C.button('Ver e importar extrato', async function () {
                        active = { itemId: ref.item_id, accountId: account.id, financeAccountId: financeAccountId, name: data.bank + ' · ' + account.name };
                        await statement(false);
                        if (!$('bank-statement').hidden) $('bank-statement').scrollIntoView({ block: 'nearest' });
                    }, 'soft-button'));
                    row.append(C.button('Agendamentos', async function () {
                        const end = new Date(today + 'T12:00:00Z');
                        end.setUTCDate(end.getUTCDate() + 30);
                        const detail = row.querySelector('.scheduled-list') || C.el('div', 'scheduled-list');
                        row.append(detail); detail.textContent = 'Consultando próximos 30 dias…';
                        try {
                            const found = new Map(), seen = new Set();
                            let page = null;
                            do {
                                if (seen.has(page)) throw new Error('Consulta incompleta. Tente novamente.');
                                seen.add(page);
                                const result = await api('connection', { action: 'transactions', itemId: ref.item_id,
                                    accountId: account.id, dateFrom: today, dateTo: end.toISOString().slice(0,10), cursor: page });
                                for (const t of result.transactions) {
                                    if (t.status === 'PENDING' && t.type === 'DEBIT' && t.date.slice(0,10) > today) found.set(t.id,t);
                                }
                                page = result.next;
                            } while (page);
                            detail.replaceChildren();
                            for (const t of found.values()) detail.append(C.el('p','',C.date(t.date)+' · '+t.description+' · '+money(t.amount,t.currency)));
                            if (!found.size) detail.textContent = 'A instituição não informou débitos futuros para os próximos 30 dias.';
                        } catch (error) { detail.textContent = error.message; }
                    }, 'soft-button'));
                    card.append(row);
                }
                if (!data.accounts?.length) card.append(C.el('p', '', 'A instituição ainda não disponibilizou contas. Atualize em alguns instantes.'));
            } catch (error) { failures++; card.append(C.el('p', 'bank-error', error.message)); }
        }
        notice(!result.data.length ? '' : failures ? 'Algumas conexões não puderam ser consultadas. Tente atualizar novamente.' : 'Contas atualizadas. Saldos compartilhados com o casal.', !!failures);
    }

    function categoryFor(transaction) {
        const value = ((transaction.category || '') + ' ' + (transaction.description || '')).toLocaleLowerCase('pt-BR');
        if (/sal[aá]rio|folha|remunera|pagamento recebido/.test(value)) return 'salary';
        if (/mercado|supermercado|hortifruti|a[cç]ougue|padaria/.test(value)) return 'market';
        if (/uber|99|combust|posto|transporte|estacionamento/.test(value)) return 'transport';
        if (/farm[aá]cia|hospital|cl[ií]nica|m[eé]dico|sa[uú]de/.test(value)) return 'health';
        if (/aluguel|condom[ií]nio|energia|luz|[áa]gua|internet|g[aá]s/.test(value)) return 'house';
        if (/cinema|streaming|restaurante|lazer|viagem/.test(value)) return 'leisure';
        return 'other';
    }

    function isInternalTransfer(transaction) {
        const value = ((transaction.category || '') + ' ' + (transaction.description || '')).toLocaleLowerCase('pt-BR');
        return /transfer[eê]ncia entre contas|pagamento de fatura|pagamento cart[aã]o|quitar fatura/.test(value);
    }

    async function saveTransactions(transactions, financeAccountId) {
        const payload = transactions.filter(function (item) {
            return item.status !== 'PENDING' && !item.billPayment && !isInternalTransfer(item) && Number.isFinite(Number(item.amount)) && Number(item.amount) !== 0;
        }).map(function (item) {
            return {
                couple_id: coupleId,
                account_id: financeAccountId,
                payment_method: item.paymentMethod || null,
                description: String(item.description || 'Movimentação bancária').slice(0, 150),
                entry_type: item.type === 'CREDIT' ? 'income' : 'expense',
                amount_cents: Math.max(1, Math.round(Math.abs(Number(item.amount)) * 100)),
                category: categoryFor(item),
                entry_date: String(item.date).slice(0, 10),
                source: 'pluggy',
                external_provider: 'pluggy',
                external_transaction_id: item.id
            };
        });
        for (let index = 0; index < payload.length; index += 100) {
            const chunk = payload.slice(index, index + 100);
            const externalIds = chunk.map(function (row) { return row.external_transaction_id; });
            const existingRows = C.result(await supabaseClient.from('finance_entries')
                .select('id,external_transaction_id,account_id,description,entry_type,amount_cents,category,entry_date,payment_method')
                .eq('couple_id', coupleId).eq('external_provider', 'pluggy').in('external_transaction_id', externalIds));
            const existingById = new Map(existingRows.map(function (row) { return [row.external_transaction_id, row]; }));
            const inserts = [];
            for (const row of chunk) {
                const existing = existingById.get(row.external_transaction_id);
                if (!existing) { inserts.push(row); continue; }
                const changed = existing.account_id !== row.account_id || existing.description !== row.description ||
                    existing.entry_type !== row.entry_type || Number(existing.amount_cents) !== row.amount_cents ||
                    existing.category !== row.category || existing.entry_date !== row.entry_date ||
                    (row.payment_method !== null && existing.payment_method !== row.payment_method);
                if (!changed) continue;
                // Atualiza somente as colunas liberadas para o papel authenticated.
                C.result(await supabaseClient.from('finance_entries').update({
                    account_id: row.account_id, description: row.description, entry_type: row.entry_type,
                    amount_cents: row.amount_cents, category: row.category, entry_date: row.entry_date,
                    payment_method: row.payment_method || existing.payment_method
                }).eq('id', existing.id).eq('couple_id', coupleId).select('id').single());
            }
            if (inserts.length) {
                try { C.result(await supabaseClient.from('finance_entries').insert(inserts).select('id')); }
                catch (error) {
                    // Em sincronizações simultâneas, outra aba pode inserir um ID primeiro.
                    if (error.code !== '23505') throw error;
                }
            }
        }
        return payload.length;
    }

    function dateRange() {
        const from = $('bank-date-from').value, to = $('bank-date-to').value;
        if (!from || !to || to < from) throw new Error('Escolha um intervalo de datas válido.');
        if ((new Date(to + 'T12:00:00') - new Date(from + 'T12:00:00')) / 86400000 > 365) throw new Error('Escolha um intervalo de até 366 dias.');
        return { dateFrom: from, dateTo: to };
    }

    async function fetchTransactions(more) {
        const range = dateRange(), account = active;
        const data = await api('connection', Object.assign({ action: 'transactions' }, account, range, more && cursor ? { cursor: cursor } : {}));
        cursor = data.next || null;
        const map = new Map(rows.map(function (row) { return [row.id, row]; }));
        data.transactions.forEach(function (row) { map.set(row.id, row); });
        rows = Array.from(map.values());
        return saveTransactions(data.transactions, account.financeAccountId);
    }

    async function statement(more) {
        if (!active || busy) return;
        controls(true);
        try {
            if (!more) { rows = []; cursor = null; $('bank-transactions').replaceChildren(); }
            const imported = await fetchTransactions(more);
            window.dispatchEvent(new Event('cc-finance-bank-synced'));
            $('bank-statement').hidden = false;
            $('bank-account-title').textContent = active.name + ' · Extrato';
            const box = $('bank-transactions'); box.replaceChildren();
            rows.forEach(function (transaction) {
                const line = C.el('article', 'bank-transaction'), text = C.el('div');
                text.append(C.el('strong', '', transaction.description), C.el('small', '', C.date(transaction.date) + ' · ' + (transaction.status === 'PENDING' ? 'Pendente · não entra nos totais' : 'Registrada')));
                const amount = C.el('strong', transaction.type === 'CREDIT' ? 'bank-credit' : '', money(transaction.amount, transaction.currency));
                line.append(text, amount); box.append(line);
            });
            const download=C.button('Baixar extrato exibido (CSV)', function(){
                const escapeCell=value=>{let v=String(value??''); if (/^[=+@-]/.test(v)) v="'"+v; return '"'+v.replace(/"/g,'""')+'"';};
                const lines=[['Data','Descrição','Tipo','Valor','Moeda'],...rows.map(t=>[t.date,t.description,t.type,t.amount,t.currency])];
                const blob=new Blob(['\uFEFF'+lines.map(line=>line.map(escapeCell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
                const url=URL.createObjectURL(blob), a=document.createElement('a'); a.href=url; a.download='extrato.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
            },'soft-button');
            if(rows.length) box.prepend(download);
            if (!rows.length) box.append(C.el('p', '', 'Nenhuma transação disponibilizada para estas datas.'));
            $('bank-more').hidden = !cursor;
            notice('Extrato atualizado. ' + imported + ' movimentações importadas para as finanças compartilhadas.');
        } catch (error) { notice(error.message, true); }
        finally { controls(false); }
    }

    async function syncRange(from, to) {
        if (!user || !accounts.length || !from || !to) return false;
        if (syncing) { queuedRange = [from, to]; return false; }
        syncing = true;
        let partial = false;
        try {
            for (const account of accounts.slice()) {
                let cursor = null;
                const seen = new Set();
                for (let page = 0; page < 20; page++) {
                    const data = await api('connection', {
                        action: 'transactions', itemId: account.itemId, accountId: account.accountId,
                        dateFrom: from, dateTo: to, cursor
                    });
                    await saveTransactions(data.transactions, account.financeAccountId);
                    cursor = data.next;
                    if (!cursor) break;
                    if (seen.has(cursor)) break;
                    seen.add(cursor);
                }
                if (cursor) partial = true;
            }
            notice(partial ? 'Importação parcial. Escolha um período menor para concluir.' :
                'Contas sincronizadas com as finanças compartilhadas.');
            return true;
        } catch (error) {
            notice('Não foi possível sincronizar o extrato: ' + error.message, true);
            return false;
        } finally {
            window.dispatchEvent(new Event('cc-finance-bank-synced'));
            syncing = false;
            if (queuedRange) {
                const next = queuedRange;
                queuedRange = null;
                syncRange(next[0], next[1]);
            }
        }
    }

    window.CCOpenFinance = { syncRange: syncRange };
    $('connect-bank').addEventListener('click', function () { connect(); });
    $('bank-date-from').addEventListener('change', function () { if (!$('bank-statement').hidden) statement(false); });
    $('bank-date-to').addEventListener('change', function () { if (!$('bank-statement').hidden) statement(false); });
    $('bank-reload').addEventListener('click', function () { statement(false); });
    $('bank-more').addEventListener('click', function () { statement(true); });

    const reloadButton = C.button('Atualizar conexões', async function () {
        if (busy) return;
        controls(true);
        try { await load(); await syncRange($('bank-date-from').value, $('bank-date-to').value); }
        catch (error) { notice(error.message, true); }
        finally { controls(false); }
    }, 'soft-button bank-refresh');
    reloadButton.id = 'bank-refresh-connections'; reloadButton.hidden = true;
    section.insertBefore(reloadButton, $('bank-connections'));

    C.ready.then(async function (context) {
        user = context.user; coupleId = context.couple; controls(true);
        try {
            if (!coupleId) throw new Error('Conecte seu casal em Configurações para compartilhar as finanças.');
            await load();
            await syncRange($('bank-date-from').value, $('bank-date-to').value);
        } catch (error) { notice(error.message, true); }
        finally { controls(false); }
    }).catch(function () { notice('Entre novamente para carregar as conexões.', true); });
})();

