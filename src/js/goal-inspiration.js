/* Seleciona um assunto genérico e associa uma fotografia à meta, sem upload obrigatório. */
(function () {
    'use strict';
    const temas = [[/paris/i,'paris'],[/praia|maldivas|caribe/i,'praia'],[/viag|férias|ferias/i,'viagem'],[/casa|apartamento|lar/i,'casa'],[/casamento|noivado/i,'casamento'],[/carro|veículo/i,'carro'],[/curso|estudo|faculdade/i,'estudo'],[/reserva|emergência/i,'reserva']];
    const previews = { casa:'casa', praia:'viagem', viagem:'viagem', casamento:'momento', geral:'momento' };
    function tema(titulo) { return temas.find(([padrao]) => padrao.test(titulo))?.[1] || 'geral'; }
    function media(card) {
        let figure = card.querySelector('.cc-goal-media');
        if (!figure) {
            figure = document.createElement('figure');
            figure.className = 'cc-goal-media';
            card.prepend(figure);
        }
        return figure;
    }
    function preview(card, subject) {
        const image = document.createElement('img');
        image.className = 'cc-goal-image';
        image.src = '/src/img/mockup-'+(previews[subject] || previews.geral)+'.webp';
        image.alt = '';
        image.loading = 'lazy';
        media(card).append(image);
    }
    function mostrar(card, foto) {
        if (!foto) return;
        // Validamos os domínios antes de usar URLs recebidas do banco.
        try {
            if (new URL(foto.image_url).origin !== 'https://images.pexels.com' || new URL(foto.source_url).origin !== 'https://www.pexels.com') return;
        } catch (_) { return; }
        const img = document.createElement('img'); img.className = 'cc-goal-image'; img.src = foto.image_url; img.alt = 'Imagem de inspiração para a meta'; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
        const link = document.createElement('a'); link.className = 'cc-goal-credit'; link.href = foto.source_url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Inspiração · Foto de ' + foto.photographer + ' no Pexels';
        const caption = document.createElement('figcaption');
        caption.append(link);
        media(card).replaceChildren(img, caption);
    }
    // Uma consulta por nova meta; as referências já existentes são reutilizadas.
    const pendentes = new Set();
    window.CCGoalInspiration = async function (card, goal) {
        const assunto = tema(goal.title);
        preview(card, assunto);
        if (pendentes.has(goal.id)) return;
        pendentes.add(goal.id);
        try {
            const result = await supabaseClient.from('goal_inspiration').select('*').eq('goal_id',goal.id).maybeSingle();
            if (result.error) return; // A aplicação antiga segue funcionando se a migration ainda não foi aplicada.
            if (result.data?.theme === assunto) { mostrar(card,result.data); return; }
            const sessao = await supabaseClient.auth.getSession();
            const token = sessao.data.session?.access_token;
            if (!token) return;
            const resposta = await fetch('/api/imagens/meta',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({tema:assunto})});
            if (!resposta.ok) return;
            const {foto} = await resposta.json(); if (!foto) return;
            const row = {goal_id:goal.id,pexels_id:foto.id,image_url:foto.imagem,photographer:foto.autor,source_url:foto.url,theme:assunto};
            const saved = await supabaseClient.from('goal_inspiration').upsert(row);
            if (!saved.error) mostrar(card,row);
        } catch (_) { /* Uma falha opcional de imagem não impede a gestão das metas. */ }
        finally { pendentes.delete(goal.id); }
    };
})();
