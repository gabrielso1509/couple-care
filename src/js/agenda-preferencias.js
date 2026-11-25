(function () {
    'use strict';
    const C = CC, $ = C.$;

    function setPreference(table, context, values) {
        return supabaseClient.from(table).upsert(Object.assign({ couple_id: context.couple }, values), { onConflict: 'user_id' });
    }

    function clearPreference(table, context) {
        return supabaseClient.from(table).delete().eq('user_id', context.user.id);
    }

    async function forecast(context) {
        if (!$('form-previsao') || context.profile.gender !== 'feminino') return;
        const status = $('status-previsao');
        const sharing = $('compartilhar-previsao');
        try {
            const row = C.result(await supabaseClient.from('cycle_forecast_shares').select('couple_id').maybeSingle());
            if (!context.couple && !row) {
                status.textContent = 'Conecte seu casal para compartilhar as estimativas.';
                return;
            }
            sharing.checked = Boolean(row && row.couple_id === context.couple);
            sharing.disabled = !context.couple;
            $('campos-previsao').disabled = false;
        } catch (error) {
            status.textContent = C.error(error);
            return;
        }

        C.form($('form-previsao'), async function () {
            if (sharing.checked) C.result(await setPreference('cycle_forecast_shares', context));
            else C.result(await clearPreference('cycle_forecast_shares', context));
            status.textContent = sharing.checked ? 'Preferência salva. Estimativas compartilhadas.' :
                'Preferência salva. Estimativas privadas.';
        });
    }

    async function birthday(context) {
        const form = $('form-aniversario');
        if (!form) return;
        const day = $('aniversario-dia'), month = $('aniversario-mes'), status = $('status-aniversario');
        const remove = $('remover-aniversario');
        const submit = form.querySelector('[type="submit"]');
        for (let i = 0; i < 12; i += 1) {
            const label = new Date(2000, i, 1).toLocaleDateString('pt-BR', { month: 'long' });
            month.append(new Option(label, String(i + 1)));
        }

        try {
            const row = C.result(await supabaseClient.from('couple_birthdays').select('birthday_day,birthday_month,couple_id').maybeSingle());
            if (row) {
                day.value = row.birthday_day;
                month.value = row.birthday_month;
            }
            remove.hidden = !row;
            submit.disabled = !context.couple;
            $('campos-aniversario').disabled = false;
            if (!context.couple) status.textContent = 'Conecte seu casal em Configurações para compartilhar.';
        } catch (error) {
            status.textContent = C.error(error);
            return;
        }

        C.form(form, async function () {
            if (!context.couple) return;
            const number = Number(day.value);
            const monthNumber = Number(month.value);
            if (number > new Date(2000, monthNumber, 0).getDate()) throw new Error('Escolha um dia válido para esse mês.');
            C.result(await setPreference('couple_birthdays', context, { birthday_month: monthNumber, birthday_day: number }));
            remove.hidden = false;
            status.textContent = 'Aniversário salvo e compartilhado.';
        });

        remove.addEventListener('click', async function () {
            const wasDisabled = submit.disabled;
            $('campos-aniversario').disabled = true;
            try {
                C.result(await clearPreference('couple_birthdays', context));
                form.reset();
                remove.hidden = true;
                status.textContent = 'Compartilhamento do aniversário encerrado.';
            } catch (error) {
                status.textContent = C.error(error);
            } finally {
                submit.disabled = wasDisabled;
                $('campos-aniversario').disabled = false;
            }
        });
    }

    C.ready.then(function (context) {
        return Promise.all([forecast(context), birthday(context)]);
    }).catch(function (error) {
        const status = $('status-previsao') || $('status-aniversario');
        if (status) status.textContent = C.error(error);
    });
})();
