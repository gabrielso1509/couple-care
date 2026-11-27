(function () {
    'use strict';
    const C=CC, A=C.agenda, $=C.$;
    const suggestionList=$('space-suggestions');
    const eventList=$('space-events');
    const status=$('space-status');
    const custom=$('space-custom');
    let context, events=[], opening;
    const dialog=C.dialog('tempo-a-dois-dialog','Reservar tempo a dois',`
      <form class="form-app">
        <label class="cc-field">O que vocês vão fazer?<input name="title" required maxlength="100" placeholder="Ex.: Jantar, caminhada ou cinema"></label>
        <label class="cc-field">Data<input name="date" type="date" required></label>
        <div class="form-row">
          <label class="cc-field">Início<input name="start" type="time" required></label>
          <label class="cc-field">Fim<input name="end" type="time" required></label>
        </div>
        <label class="cc-field">Detalhes<textarea name="description" maxlength="500" rows="3"></textarea></label>
        <button class="primary-button" type="submit">Reservar no calendário</button>
        <p role="status"></p>
      </form>`);
    const form=dialog.querySelector('form');
    const dateLabel=new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'numeric',month:'short'});
    const time=value=>value?.slice(0,5);
    function overlaps(rows, day, start, end) {
        return rows.some(event=>event.event_date===day &&
            (!event.start_time || (time(event.start_time)<end &&
                (event.end_time ? time(event.end_time)>start : time(event.start_time)>=start))));
    }
    function open(day, button) {
        opening=button;
        form.reset();
        form.querySelector('[role=status]').textContent='';
        form.elements.date.min=C.today();
        form.elements.date.value=day;
        form.elements.start.value='19:00';
        form.elements.end.value='20:00';
        dialog.showModal();
        form.elements.title.focus();
    }
    custom.addEventListener('click',()=>open(C.today(),custom));
    async function load() {
        const start=C.today(), end=A.plusDays(start,13);
        events=await A.events(context.couple,start,end);
        suggestionList.replaceChildren();
        eventList.replaceChildren();
        for(let i=0;i<14 && suggestionList.childElementCount<3;i++){
            const day=A.plusDays(start,i);
            if(day===start && new Date().getHours()>=19)continue;
            if(overlaps(events,day,'19:00','20:00'))continue;
            const button=C.button(dateLabel.format(A.local(day))+' · 19:00',()=>open(day,button),'soft-button cc-action');
            button.prepend(C.uiIcon('calendar'));
            suggestionList.append(button);
        }
        if(!suggestionList.children.length)suggestionList.append(C.el('p','empty-state','Escolham outro horário para a reserva.'));
        events.forEach(event=>{
            const row=C.el('article','space-event');
            const meta=dateLabel.format(A.local(event.event_date))+(event.start_time?' · '+time(event.start_time):' · Dia inteiro');
            row.append(C.el('strong','',event.title),C.el('span','',meta));
            eventList.append(row);
        });
        if(!events.length)eventList.append(C.el('p','empty-state','Ainda não há compromissos nessa quinzena.'));
    }
    C.form(form, async ()=>{
        const fields=form.elements;
        const day=fields.date.value;
        const begins=fields.start.value, ends=fields.end.value;
        const label=fields.title.value.trim();
        if(!label || day<C.today() || ends<=begins)throw new Error('Informe um nome, uma data e um horário de fim após o início.');
        const existing=await A.events(context.couple,day,day);
        if(overlaps(existing,day,begins,ends))throw new Error('Esse horário já tem um compromisso. Escolham outro horário.');
        C.result(await supabaseClient.from('calendar_events').insert({
            couple_id:context.couple,title:label,description:fields.description.value.trim(),
            event_date:day,start_time:begins,end_time:ends
        }).select('id').single());
        dialog.close();
        status.textContent='Encontro reservado no calendário do casal.';
        try { await load(); }
        catch(error) { status.textContent='Encontro reservado. '+C.error(error); }
    });
    dialog.addEventListener('close',()=>{if(opening?.isConnected)opening.focus();});
    C.ready.then(async value=>{
        context=value;
        if(!context.couple){status.textContent='Conecte seu casal em Configurações para planejar juntos.';return;}
        await load();
        custom.disabled=false;
        status.textContent='';
    }).catch(error=>{status.textContent=C.error(error);}).finally(C.pageReady);
})();
