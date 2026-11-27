/* O círculo usa o resumo privado já calculado no banco. Não calcula fertilidade. */
(function () {
    'use strict';
    const C = CC, $ = C.$;
    const feelings = { calm: ['😌','Tranquila'], energetic: ['⚡','Com energia'], sensitive: ['🥺','Sensível'], tired: ['🪫','Cansada'], happy: ['😊','Feliz'], affectionate: ['😍','Carinhosa'], sad: ['😔','Triste'], tearful: ['😢','Com vontade de chorar'], irritated: ['😠','Irritada'], anxious: ['😰','Ansiosa'], overwhelmed: ['🤯','Sobrecarregada'], sleepy: ['😴','Sonolenta'], pain: ['🤕','Com dor'], nausea: ['🤢','Enjoada'], bloated: ['🎈','Inchada'], wants_affection: ['🤗','Quero carinho'], wants_company: ['🫂','Quero companhia'], wants_space: ['🌿','Quero um tempo para mim'] };
    let context, current = null, selected = [], generation = 0, dirty = false, dayLoading = false;
    let recentVersion = 0;
    $('cc-checkin-date').value = C.today(); $('cc-checkin-date').max = C.today();
    const more = C.el('details', 'cc-advanced'); more.append(C.el('summary', '', 'Outros sentimentos'));
    const extra = C.el('div', 'feeling-grid'); more.append(extra); $('cc-feelings').after(more);
    Object.keys(feelings).forEach(function (key, index) {
        const b = C.el('button', '', feelings[key].join(' ')); b.type = 'button'; b.dataset.feeling = key; b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', function () {
            selected = selected.includes(key) ? selected.filter(function (x) { return x !== key; }) : selected.concat(key);
            b.setAttribute('aria-pressed', String(selected.includes(key)));
        }); (index < 4 ? $('cc-feelings') : extra).append(b);
    });
    const saveCheckin = $('cc-checkin').querySelector('[type="submit"]');
    function checkinSaved(saved) {
        saveCheckin.classList.toggle('is-saved', saved);
        saveCheckin.textContent = saved ? '✓ Check-in salvo' : 'Salvar check-in';
    }
    $('cc-checkin').addEventListener('input', function (event) { if (event.target.id !== 'cc-checkin-date') dirty = true; checkinSaved(false); });
    $('cc-checkin').addEventListener('click', function (event) { if (event.target.closest('[data-feeling]')) { dirty = true; checkinSaved(false); } });
    function ring(summary) {
        if (!context || context.profile.gender !== 'feminino') return;
        const start = summary?.last_start_date;
        const length = summary?.mean_cycle_days || summary?.estimated_cycle_days;
        let day = null;
        if (start) day = Math.floor((Date.parse(C.today() + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / 86400000) + 1;
        $('cc-cycle-title').textContent = day ? 'Seu ciclo atual' : 'Seu ciclo começa com um registro';
        $('cc-cycle-day').textContent = day || '—';
        $('cc-cycle-length').textContent = length ? 'de '+Math.round(length)+' dias' : '';
        const ring = $('cc-cycle-ring');
        ring.toggleAttribute('data-cycle-position', Boolean(day && length));
        ring.style.setProperty('--cycle-progress', day && length ? Math.min(360, day / length * 360) + 'deg' : '0deg');
        $('cc-cycle-state').textContent = summary?.ongoing_start_date ? 'Em andamento' : 'Ciclo estimado';
        const estimate = summary?.next_period_estimate;
        const remaining = estimate ? Math.round((Date.parse(estimate + 'T00:00:00Z') - Date.parse(C.today() + 'T00:00:00Z')) / 86400000) : null;
        $('cc-cycle-next').textContent = estimate ? remaining >= 0 ? 'Próximo período em ' + remaining + ' dia(s), aproximadamente' : 'Estimativa anterior: ' + C.date(estimate) + ' · o ciclo pode variar' : 'Registre seus períodos para acompanhar as estimativas.';
        let basis = $('cc-cycle-basis');
        if (!basis) { basis = C.el('p', 'cc-cycle-basis'); basis.id = 'cc-cycle-basis'; $('cc-cycle-next').after(basis); }
        basis.textContent = summary?.cycle_source === 'history' ? 'Estimativa baseada no seu histórico.' : summary?.cycle_source === 'informed' ? 'Estimativa baseada na duração que você informou.' : 'Ainda não há histórico suficiente para uma previsão.';
    }
    async function loadRecent() {
        const version = ++recentVersion;
        const today = C.today();
        const beginning = new Date(Date.parse(today+'T00:00:00Z')-6*86400000).toISOString().slice(0,10);
        const chart = $('wellness-chart'), symptoms = $('wellness-symptoms'), notes = $('wellness-notes');
        try {
            const rows = C.result(await supabaseClient.from('daily_wellbeing')
                .select('entry_date,feelings,note').eq('user_id',context.user.id)
                .gte('entry_date',beginning).lte('entry_date',today).order('entry_date',{ascending:false}));
            if (version !== recentVersion) return;
            const groups = [
                ['Energia',['energetic']],['Sono',['sleepy']],['Humor',['calm','happy','sad','irritated']],
                ['Disposição',['tired','overwhelmed']],['Cuidados',['pain','nausea','bloated']]
            ];
            chart.replaceChildren();
            for (const [label,keys] of groups) {
                const count = rows.filter(row => row.feelings.some(key=>keys.includes(key))).length;
                const bar = C.el('div','wellness-chart-bar');
                const fill = C.el('i');
                fill.style.height = Math.round(count/7*100)+'%';
                bar.setAttribute('aria-label',label+': '+count+' de 7 dias');
                bar.setAttribute('role','img');
                bar.append(fill);
                const slot = C.el('div','wellness-chart-slot');
                slot.append(bar,C.el('small','',label));
                chart.append(slot);
            }
            const symptomsKeys = new Set(['pain','nausea','bloated','tired','sleepy']);
            const symptomsRows = rows.flatMap(row=>row.feelings.filter(key=>symptomsKeys.has(key)).map(key=>[row.entry_date,key]));
            symptoms.replaceChildren(...symptomsRows.slice(0,4).map(([date,key])=>{
                const line = C.el('div','wellness-recent-row');
                line.append(C.el('span','',feelings[key][1]),C.el('small','',C.date(date)));
                return line;
            }));
            if (!symptomsRows.length) symptoms.append(C.el('p','empty-state','Nenhum sintoma registrado nos últimos 7 dias.'));
            const withNotes = rows.filter(row=>row.note?.trim());
            notes.replaceChildren(...withNotes.slice(0,2).map(row=>{
                const line = C.el('div','wellness-note');
                line.append(C.el('p','',row.note),C.el('small','',C.date(row.entry_date)));
                return line;
            }));
            if (!withNotes.length) notes.append(C.el('p','empty-state','Suas observações dos últimos 7 dias aparecem aqui.'));
        } catch (_) {
            if (version !== recentVersion) return;
            for (const box of [chart,symptoms,notes]) box.replaceChildren(C.el('p','empty-state','Registros indisponíveis agora.'));
        }
    }
    async function loadDay() {
        if (!context || context.profile.gender !== 'feminino') return;
        const token = ++generation; dayLoading = true; $('cc-checkin-fields').disabled = true;
        $('retry-checkin').hidden = true;
        try {
            const row = C.result(await supabaseClient.from('daily_wellbeing').select('*').eq('user_id', context.user.id).eq('entry_date', $('cc-checkin-date').value).maybeSingle());
            if (token !== generation) return;
            dirty = false;
            checkinSaved(!!row);
            current = row; selected = row ? row.feelings.slice() : [];
            $('cc-checkin-note').value = row?.note || '';
            $('cc-checkin-share').checked = !!(row?.shared_with_couple_id && row.shared_with_couple_id === context.couple);
            $('cc-checkin-share').disabled = !context.couple;
            document.querySelectorAll('[data-feeling]').forEach(function (b) { b.setAttribute('aria-pressed', String(selected.includes(b.dataset.feeling))); });
            $('cc-checkin-status').textContent = row ? 'Seu registro deste dia foi carregado.' : '';
        } catch (e) {
            if (token === generation) { $('cc-checkin-status').textContent = C.error(e); $('retry-checkin').hidden = false; }
            return;
        } finally { if (token === generation) dayLoading = false; }
        $('cc-checkin-fields').disabled = false;
    }
    $('retry-checkin').addEventListener('click', loadDay);
    $('cc-checkin-date').addEventListener('change', function () {
        $('checkin-date-caption').textContent = this.value === C.today() ? 'Registro de hoje · Alterar data' : 'Registro de ' + C.date(this.value) + ' · Alterar data';
        loadDay();
    });
    $('abrir-historico-ciclo').addEventListener('click', function (e) {
        e.preventDefault(); $('cc-cycle-history').open = true;
        $('cc-cycle-history').scrollIntoView({ block: 'start', behavior: 'auto' });
        $('cc-cycle-history').querySelector('summary').focus();
    });
    C.form($('cc-checkin'), async function () {
        const note = $('cc-checkin-note').value.trim();
        if (!selected.length && !note) throw new Error('Escolha ao menos um sentimento ou escreva uma observação.');
        const values = { entry_date: $('cc-checkin-date').value, feelings: selected, note: note, shared_with_couple_id: $('cc-checkin-share').checked ? context.couple : null };
        const query = current ? supabaseClient.from('daily_wellbeing').update(values).eq('id', current.id).eq('version', current.version) : supabaseClient.from('daily_wellbeing').insert(values);
        current = C.result(await query.select('*').single()); dirty = false; checkinSaved(true); $('cc-checkin-status').textContent = 'Check-in salvo. ' + (values.shared_with_couple_id ? 'Compartilhado com seu casal atual.' : 'Só você vê este registro.');
        void loadRecent();
    });
    window.addEventListener('cycle-summary-updated', function (e) { ring(e.detail); });
    /* O parceiro vê apenas sentimentos autorizados; nenhum período privado é consultado. */
    let partnerLoading = false;
    async function loadPartner() {
        if (!context || context.profile.gender === 'feminino' || partnerLoading) return;
        partnerLoading = true; $('refresh-partner-wellness').disabled = true; $('refresh-partner-wellness').hidden = true;
        $('status-menstruacao').textContent = 'Bem-estar compartilhado, com respeito à privacidade.';
        const other = context.members.find(function (p) { return p.user_id !== context.user.id; });
        $('partner-wellness-name').textContent = other ? 'Como ' + other.display_name.split(' ')[0] + ' está se sentindo' : 'Bem-estar de vocês';
        if (other) carregarAvatar($('partner-wellness-avatar'), other.display_name, other.avatar_path);
        $('partner-feelings-note').textContent = ''; $('partner-feelings').replaceChildren();
        try {
            if (!context.couple || !other) {
                $('partner-wellness-caption').textContent = 'Conectem as duas contas para acompanhar os momentos de vocês.';
                $('partner-feelings-status').textContent = 'O compartilhamento continua sendo uma escolha de cada pessoa.';
                return;
            }
            const records = C.result(await supabaseClient.from('daily_wellbeing').select('entry_date,feelings,note,user_id').eq('shared_with_couple_id', context.couple).eq('user_id', other.user_id).order('entry_date', { ascending: false }).limit(1));
            const row = records[0];
            $('partner-wellness-caption').textContent = row ? 'Último registro compartilhado · ' + C.date(row.entry_date) : 'Quando ela compartilhar um check-in, os sentimentos aparecerão aqui.';
            if (row) {
                row.feelings.forEach(function (key) { if (feelings[key]) $('partner-feelings').append(C.el('span', 'partner-feeling', feelings[key].join(' '))); });
                $('partner-feelings-note').textContent = row.note || '';
            }
            $('partner-feelings-status').textContent = 'Somente o que ela escolheu compartilhar com seu casal atual.';
            $('status-menstruacao').textContent = 'Bem-estar compartilhado, com respeito à privacidade.';
        } catch (e) { $('refresh-partner-wellness').hidden = false; $('partner-wellness-caption').textContent = 'Não foi possível atualizar agora.'; $('partner-feelings-status').textContent = C.error(e); }
        finally { partnerLoading = false; $('refresh-partner-wellness').disabled = false; }
    }
    $('refresh-partner-wellness').addEventListener('click', loadPartner);
    C.refreshOnReturn(function () {
        if (!context) return;
        if (context.profile.gender !== 'feminino') return loadPartner();
        if (!dirty && !dayLoading && !$('cc-checkin').hasAttribute('aria-busy')) return Promise.all([loadDay(),loadRecent()]);
    });
    C.ready.then(async function (c) {
        context = c;
        if (c.profile.gender !== 'feminino') { await loadPartner(); return; }
        await Promise.all([loadDay(),loadRecent()]);
        try { const data = C.result(await supabaseClient.rpc('get_cycle_summary', { p_today: C.today() })); ring(data[0]); }
        catch (_) { $('cc-cycle-title').textContent = 'Resumo indisponível'; }
    }).catch(function (e) { $('cc-checkin-status').textContent = C.error(e); });
})();
