/* Memórias compartilhadas e sonhos reais. As imagens usam um bucket privado. */
(function () {
    'use strict';
    const C = CC, $ = C.$;
    let context, memories = [], dreams = [], edited = null, limit = 12, generation = 0;
    let loading = false;
    const types = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
    const memoryDialog = C.dialog('memory-dialog', 'Guardar um momento', `
        <form id="memory-form"><label class="cc-field">Título<input id="memory-title" maxlength="150" required></label><label class="cc-field">Quando aconteceu?<input id="memory-date" type="date" min="1900-01-01" max="2100-12-31" required></label><label class="cc-field">A lembrança de vocês<textarea id="memory-note" maxlength="3000"></textarea></label><label class="cc-field">Até 6 fotos · JPG, PNG ou WebP · até 5 MB cada<input id="memory-files" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><label id="memory-clear-wrap" class="check-row" hidden><input type="checkbox" id="memory-clear"> Retirar as fotos anteriores</label><p class="cc-status">Esta memória e as fotos serão compartilhadas com seu casal atual. Novas fotos substituem as anteriores.</p><button class="primary-button" type="submit">Guardar momento</button><p id="memory-status" role="status"></p></form>`);
    const dreamDialog = C.dialog('dream-dialog', 'Ainda vamos…', '<form id="dream-form"><label class="cc-field">Qual é o sonho?<input id="dream-title" maxlength="200" required></label><button type="submit" class="primary-button">Guardar sonho</button><p role="status" id="dream-form-status"></p></form>');
    const viewer = C.dialog('memory-view', 'Uma memória de vocês', '<p id="memory-view-date" class="cc-status"></p><p id="memory-view-note"></p><div id="memory-view-photos" class="memory-view-photos"></div>');
    function newMemory(row) {
        edited = row; $('memory-form').reset(); $('memory-status').textContent = '';
        $('memory-title').value = row?.title || ''; $('memory-date').value = row?.memory_date || C.today(); $('memory-note').value = row?.note || '';
        $('memory-clear-wrap').hidden = !row?.photo_paths?.length; memoryDialog.showModal();
    }
    async function showMemory(row) {
        $('memory-view-title').textContent = row.title; $('memory-view-date').textContent = C.date(row.memory_date); $('memory-view-note').textContent = row.note;
        const box = $('memory-view-photos'); box.replaceChildren(); viewer.showModal();
        row.photo_paths.forEach(function (path) { const img = C.el('img'); img.hidden = true; img.alt = row.title; box.append(img); C.photo(img, path); });
    }
    function renderDreams() {
        const box = $('dream-list'); box.replaceChildren();
        if (!dreams.length) box.append(C.el('p', 'empty-state', 'O que vocês querem viver juntos? Guardem o primeiro sonho.'));
        dreams.forEach(function (row, index) {
            const line = C.el('div', 'bucket-item' + (row.completed ? ' completed' : ''));
            line.append(C.el('span', '', String(index + 1).padStart(2, '0')), C.el('p', '', row.title));
            const controls = C.el('div', 'cc-row-actions');
            const check = C.button(row.completed ? '✓' : '○', async function () {
                C.result(await supabaseClient.from('couple_dreams').update({ completed: !row.completed }).eq('id', row.id).eq('version', row.version).select('id').single()); C.notify(row.completed ? 'Sonho reaberto.' : 'Sonho marcado como realizado!'); await load();
            }, 'dream-action dream-action-check'); check.setAttribute('aria-label', (row.completed ? 'Reabrir: ' : 'Concluir: ') + row.title);
            const remove = C.button('×', async function () {
                if (!confirm('Excluir este sonho ou ideia?')) return;
                C.result(await supabaseClient.from('couple_dreams').delete().eq('id', row.id).eq('version', row.version).select('id').single()); C.notify('Sonho removido.'); await load();
            }, 'dream-action dream-action-remove'); remove.setAttribute('aria-label', 'Excluir: ' + row.title);
            check.title = row.completed ? 'Reabrir sonho' : 'Marcar como realizado';
            check.setAttribute('aria-pressed', String(row.completed));
            remove.title = 'Remover sonho';
            // SVGs com dimensões reais, sem depender do tamanho de caracteres.
            check.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
            remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6"/></svg>';
            controls.append(check, remove); line.append(controls); box.append(line);
        });
    }
    function renderMemories() {
        C.releasePhotos();
        const box = $('memory-list'); box.replaceChildren();
        ['one','two'].forEach(function (suffix, index) {
            const img = $('memory-stack-' + suffix); img.hidden = true; img.removeAttribute('src');
            $('memory-stack-title-' + suffix).textContent = memories[index]?.title || (index ? 'A história de vocês' : 'Seus momentos');
            if (memories[index]?.photo_paths.length) C.photo(img, memories[index].photo_paths[0]);
        });
        if (!memories.length) box.append(C.el('p', 'empty-state', 'A primeira memória ainda está por vir. Guarde um momento de vocês.'));
        memories.forEach(function (row) {
            const card = C.el('article', 'memory-item');
            if (row.photo_paths.length) { const img = C.el('img'); img.hidden = true; img.alt = row.title; card.append(img); C.photo(img, row.photo_paths[0]); }
            const body = C.el('div'); body.append(C.el('h4', '', row.title), C.el('small', '', C.date(row.memory_date) + ' · ' + row.photo_paths.length + ' foto(s)'));
            if (row.note) body.append(C.el('p', '', row.note.slice(0, 180)));
            const actions = C.el('div', 'cc-row-actions');
            actions.append(C.button('Relembrar →', function () { return showMemory(row); }), C.button('Editar', function () { newMemory(row); }), C.button('Excluir', async function () {
                if (!confirm('Excluir esta memória e retirar as fotos dela?')) return;
                C.result(await supabaseClient.from('couple_memories').delete().eq('id', row.id).eq('version', row.version).select('id').single()); C.notify('Memória removida.');
                let pendingCleanup = false;
                if (row.photo_paths.length) {
                    const cleanup = await supabaseClient.storage.from('couple-memories').remove(row.photo_paths);
                    pendingCleanup = !!cleanup.error;
                }
                await load();
                if (pendingCleanup) $('moments-status').textContent = 'Memória excluída. Algumas fotos ficaram pendentes de limpeza.';
            })); body.append(actions); card.append(body); box.append(card);
        });
        $('more-memories').hidden = memories.length < limit;
    }
    async function load() {
        if (!context?.couple) return;
        const token = ++generation; loading = true;
        $('moments-status').textContent = 'Atualizando o espaço de vocês…';
        try {
            const responses = await Promise.all([
                supabaseClient.from('couple_memories').select('*').eq('couple_id', context.couple).order('memory_date', { ascending: false }).order('id').limit(limit),
                C.all(function () { return supabaseClient.from('couple_dreams').select('*').eq('couple_id', context.couple).order('created_at').order('id'); })
            ]);
            const rows = C.result(responses[0]); if (token !== generation) return;
            memories = rows; dreams = responses[1]; renderMemories(); renderDreams();
            const ideaSaved = dreams.some(function (r) { return r.kind === 'idea' && r.title === 'Noite de memórias'; });
            $('save-idea').disabled = ideaSaved; $('save-idea').textContent = ideaSaved ? 'Ideia guardada' : 'Guardar ideia';
            $('moments-status').textContent = 'Memórias e sonhos compartilhados com seu casal atual.';
        } catch (error) { if (token !== generation) return; C.empty('memory-list', 'Consulta indisponível.'); C.empty('dream-list', 'Consulta indisponível.'); $('moments-status').textContent = C.error(error); }
        finally { loading = false; }
    }
    C.form($('memory-form'), async function () {
        const title = $('memory-title').value.trim(); if (!title) throw new Error('Informe o título desta memória.');
        const files = Array.from($('memory-files').files);
        if (files.length > 6 || files.some(function (f) { return !types[f.type] || !f.size || f.size > 5 * 1024 * 1024; })) throw new Error('Escolha até 6 fotos JPG, PNG ou WebP, com até 5 MB cada.');
        let paths = edited && !$('memory-clear').checked ? edited.photo_paths.slice() : [];
        if (files.length) {
            paths = [];
            for (const file of files) {
                const path = context.couple + '/' + context.user.id + '/' + crypto.randomUUID() + '.' + types[file.type];
                C.result(await supabaseClient.storage.from('couple-memories').upload(path, file, { contentType: file.type, upsert: false })); paths.push(path);
            }
        }
        const values = { title: title, memory_date: $('memory-date').value, note: $('memory-note').value.trim(), photo_paths: paths };
        const query = edited ? supabaseClient.from('couple_memories').update(values).eq('id', edited.id).eq('version', edited.version) : supabaseClient.from('couple_memories').insert(Object.assign({ couple_id: context.couple }, values));
        C.result(await query.select('id').single());
        // Só limpa fotos anteriores depois da confirmação do novo registro.
        const old = edited ? edited.photo_paths.filter(function (p) { return !paths.includes(p); }) : [];
        if (old.length) await supabaseClient.storage.from('couple-memories').remove(old);
        memoryDialog.close(); await load();
    });
    C.form($('dream-form'), async function () {
        const title = $('dream-title').value.trim(); if (!title) throw new Error('Escreva o sonho de vocês.');
        C.result(await supabaseClient.from('couple_dreams').insert({ couple_id: context.couple, title: title, kind: 'dream' }).select('id').single()); dreamDialog.close(); await load();
    });
    $('new-memory').addEventListener('click', function () { newMemory(null); });
    $('new-dream').addEventListener('click', function () { $('dream-form').reset(); $('dream-form-status').textContent = ''; dreamDialog.showModal(); });
    $('save-idea').addEventListener('click', async function () {
        this.disabled = true;
        try { C.result(await supabaseClient.from('couple_dreams').insert({ couple_id: context.couple, title: 'Noite de memórias', kind: 'idea' }).select('id').single()); C.notify('Ideia guardada!'); await load(); }
        catch (e) { $('idea-status').textContent = C.error(e); this.disabled = false; }
    });
    $('reload-moments').addEventListener('click', load);
    $('more-memories').addEventListener('click', function () { if (!loading) { limit += 12; load(); } });
    ['new-memory','new-dream','save-idea'].forEach(function (id) { $(id).disabled = true; });
    C.ready.then(function (c) {
        context = c;
        if (!c.couple) { $('moments-status').textContent = 'Conecte seu casal em Configurações para guardar memórias e sonhos.'; C.empty('memory-list', 'Nenhum casal conectado.'); C.empty('dream-list', 'Nenhum casal conectado.'); return; }
        ['new-memory','new-dream','save-idea'].forEach(function (id) { $(id).disabled = false; }); load();
    }).catch(function (e) { $('moments-status').textContent = C.error(e); });
})();
