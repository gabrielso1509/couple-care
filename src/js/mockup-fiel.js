/* Apresentação fiel aos mockups: reutiliza os nós e as fontes de dados existentes.
   Sem dados simulados nas páginas autenticadas. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const q = sel => document.querySelector(sel);
  const page = document.body.dataset.ccPage;
  const C = window.CC;
  if (!C || !page) return;
  const el = (tag, cls, text) => C.el(tag, cls, text);
  const btn = (label, fn) => { const b=el('button','',label); b.type='button'; b.addEventListener('click',fn); return b; };
  const icons = {
    calendar: 'M4 6h16v14H4zM4 10h16M8 3v5m8-5v5',
    layers: 'm12 3 9 5-9 5-9-5zm-9 9 9 5 9-5M3 16l9 5 9-5',
    users: 'M14 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2m18 0v-2a4 4 0 0 0-3-4m-4-9a3.5 3.5 0 0 1 0 7m-2.5-3.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z',
    home: 'm3 11 9-8 9 8m-2-1v10h-5v-6h-4v6H5V10',
    tasks: 'M8 4H5v16h14V9M9 4h7v3H9zM8 13l3 3 8-9',
    heart: 'M20.8 5.5a5 5 0 0 0-7.1 0L12 7.2l-1.7-1.7a5 5 0 0 0-7.1 7.1l1.6 1.6L12 21l7.2-6.8 1.6-1.6a5 5 0 0 0 0-7.1Z',
    wellbeing: 'M3 12h5l2-4 3 8 2-4h6M9 20l3 2 7.5-7.4A5.4 5.4 0 0 0 12 7a5.4 5.4 0 0 0-8 7.6z',
    target: 'M21 11a9 9 0 1 1-9-8m6 8a6 6 0 1 1-6-5m0 6 7-7m-2 0h3v3',
    photo: 'M3 4h18v16H3zM8 9h.01M3 17l5-5 4 4 4-5 5 6',
    note: 'M5 4h14v12l-4 4H5zM8 8h8m-8 4h8m-1 8v-4h4',
    up: 'M12 19V5m-5 5 5-5 5 5',
    down: 'M12 5v14m-5-5 5 5 5-5',
    check: 'm5 12 4 4L19 6',
    pulse: 'M3 12h4l3-6 4 12 3-6h4',
    bars: 'M5 19v-5m5 5V9m5 10V5m5 14V3',
    clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2',
    settings: 'M9 3l-1 3-3 1-2 3 2 2-1 3 3 2 1 3h6l1-3 3-2-1-3 2-2-2-3-3-1-1-3Zm6 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'
  };
  function icon(name) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    const path = document.createElementNS(ns, 'path');
    svg.setAttribute('viewBox','0 0 24 24');
    svg.setAttribute('aria-hidden','true');
    svg.setAttribute('fill','none');
    svg.setAttribute('stroke','currentColor');
    svg.setAttribute('stroke-width','1.8');
    svg.setAttribute('stroke-linecap','round');
    svg.setAttribute('stroke-linejoin','round');
    path.setAttribute('d',icons[name]);
    svg.append(path);
    return svg;
  }
  function tabs(nav, options, callback) {
    function activate(key){nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.key===key)));callback(key);}
    options.forEach(([key,label,symbol])=>{const b=btn(label,()=>activate(key));b.dataset.key=key;if(symbol)b.prepend(icon(symbol));nav.append(b);});
    activate(options[0][0]);return activate;
  }
  const title=q('.cabecalho h1');
  const moduleSymbol = {tarefas:'tasks',menstruacao:'wellbeing'}[page];
  if (title && moduleSymbol) {
    const copy = title.parentElement;
    const heading = el('div','module-heading');
    const mark = el('span','module-icon');
    mark.setAttribute('aria-hidden','true');
    mark.append(icon(moduleSymbol));
    copy.before(heading);
    heading.append(mark, copy);
  }
  if(page==='calendario'){
    const settings=el('a','calendar-header-settings');
    settings.href='/src/config.html';
    settings.setAttribute('aria-label','Configurações');
    settings.title='Configurações';
    settings.append(icon('settings'));
    q('.cc-header-actions')?.append(settings);
  }

  if(page==='financas'){
    const grid=q('.finance-grid'), summary=q('.finance-summary');
    const bills=q('.finance-bills-panel'), movements=q('.transactions-card'), spending=q('.spending-card'), evolution=$('mock-evolution-card');
    // Três colunas no painel geral, com as contas e lançamentos em cartões abaixo.
    grid.append(bills,movements);
    const openConnections=()=>window.CCOpenFinance.open();
    const bankInfo=btn('',openConnections);
    const statementButton=$('finance-open-statement');
    statementButton.setAttribute('aria-haspopup','dialog');
    statementButton.setAttribute('aria-controls','connected-accounts-dialog');
    statementButton.addEventListener('click',()=>window.CCOpenFinance.open(C.mockFinanceData?.bounds));
    bankInfo.setAttribute('aria-haspopup','dialog');
    bankInfo.setAttribute('aria-controls','connected-accounts-dialog');
    bankInfo.className='finance-connection-status';
    const bankLabel=el('strong','','Contas conectadas');
    const bankCount=el('small','','Carregando conexões');
    const bankCopy=el('span','finance-connection-copy');
    bankCopy.append(bankLabel,bankCount);
    bankInfo.append(icon('users'),bankCopy);
    q('.cc-header-actions')?.prepend(bankInfo);
    const connections=$('bank-connections');
    function describeConnections(){
      const count=connections.querySelectorAll('.bank-account').length;
      const linked=!!connections.querySelector('.bank-connection');
      bankInfo.dataset.connected=String(count>0);
      if(count)bankCount.textContent=count+(count===1?' ativa':' ativas');
      else if(linked)bankCount.textContent='Vínculo cadastrado';
      else bankCount.textContent=connections.querySelector('.bank-empty')?'Nenhuma conectada':'Open Finance';
      bankInfo.setAttribute('aria-label',bankLabel.textContent+', '+bankCount.textContent);
    }
    new MutationObserver(describeConnections).observe(connections,{childList:true,subtree:true});
    describeConnections();
    const nav=$('mock-finance-tabs');
    const viewBills=btn('Histórico',()=>{
      const showing=bills.dataset.history!=='true';
      bills.dataset.history=String(showing);
      viewBills.setAttribute('aria-pressed',String(showing));
    });
    viewBills.className='finance-bill-action finance-history-button';
    viewBills.setAttribute('aria-pressed','false');
    viewBills.setAttribute('aria-controls','finance-bills-list');
    $('new-bill').before(viewBills);
    const cards={overview:[evolution,spending,bills],entries:[movements]};
    const views=[['overview','Visão geral','layers'],['entries','Lançamentos']];
    const activateFinance=tabs(nav,views,key=>{
      grid.dataset.view=key;
      document.body.dataset.financeView=key;
      if(key==='entries' && location.hash==='#relatorios')history.replaceState(null,'',location.pathname+location.search);
      Object.values(cards).flat().forEach(card=>card.toggleAttribute('hidden',!cards[key].includes(card)));
      summary.hidden=key!=='overview';
      $('open-finance-budget').hidden=key!=='overview';
    });
    const overviewLabel=nav.querySelector('[data-key="overview"]');
    overviewLabel.replaceChildren(icon('layers'),el('span','finance-overview-wide','Visão geral'),el('span','finance-overview-compact','Geral'));
    const date=$('finance-month'), preset=$('finance-period'), picker=$('finance-month-picker');
    const prevMonth=$('finance-prev-month'), nextMonth=$('finance-next-month');
    function selectMonth(value){
      if(value<date.min || value>date.max)return;
      date.value=value;
      renderMonth();
      preset.value='selected-month';
      preset.dispatchEvent(new Event('change'));
    }
    const updateCaption=C.monthPicker({id:'finance-month-dialog',button:picker,caption:$('finance-month-caption'),
      current:()=>date.value,select:selectMonth});
    function renderMonth(){
      updateCaption();
      prevMonth.disabled=date.value===date.min;
      nextMonth.disabled=date.value===date.max;
    }
    preset.addEventListener('change',()=>{
      if(preset.value==='selected-month')return;
      date.value=C.today().slice(0,7);
      renderMonth();
    });
    function moveMonth(direction) {
      const [year,month]=date.value.split('-').map(Number);
      const next=new Date(year,month-1+direction,1);
      selectMonth(next.getFullYear()+'-'+String(next.getMonth()+1).padStart(2,'0'));
    }
    prevMonth.addEventListener('click',()=>moveMonth(-1));
    nextMonth.addEventListener('click',()=>moveMonth(1));
    renderMonth();
    summary.querySelectorAll('article > span:first-child').forEach((label,index)=>{
      const badge=el('span','finance-metric-icon');
      badge.append(icon(['users','down','up','bars'][index]));
      label.classList.add('finance-metric-label');
      label.replaceChildren(badge,el('span','finance-metric-label-text',label.textContent));
    });
    const billList=$('finance-bills-list');
    function decorateBills(){
      billList.querySelectorAll('.finance-bill-row').forEach(row=>{
        if(row.querySelector('.finance-bill-icon'))return;
        const badge=el('span','finance-bill-icon');
        badge.append(icon(row.dataset.category==='house'?'home':'calendar'));
        row.prepend(badge);
      });
    }
    new MutationObserver(decorateBills).observe(billList,{childList:true});
    decorateBills();
    const colors=Array.from({length:7},(_,index)=>'var(--finance-category-color-'+index+')');
    function renderDonut(data){
      const box=$('mock-donut');
      box.replaceChildren();
      const rows=(data.categories||[]).filter(row=>Number(row.amount)>0);
      const total=rows.reduce((sum,row)=>sum+Number(row.amount),0);
      if(!total){box.hidden=true;return;}
      box.hidden=false;
      const ring=el('div','mock-donut');
      ring.setAttribute('role','img');
      ring.setAttribute('aria-label','Total de despesas: '+C.money(total));
      let pos=0;
      const stops=rows.map((row,index)=>{
        const start=pos;
        pos+=Number(row.amount)/total*100;
        return colors[index%colors.length]+' '+start+'% '+pos+'%';
      });
      ring.style.background='conic-gradient('+stops.join(',')+')';
      const center=el('div','mock-donut-center');
      center.setAttribute('aria-hidden','true');
      center.append(el('strong','',C.money(total)),el('small','','Total'));
      ring.append(center);
      box.append(ring);
    }
    function renderLine(rows,complete){
      const box=$('mock-evolution'), note=$('mock-evolution-note');
      box.replaceChildren();
      note.dataset.complete=String(complete);
      note.textContent='';
      if(!rows?.length){
        box.append(el('p','empty-state','Nenhum lançamento neste período.'));
        return;
      }
      const daily=new Map();
      rows.forEach(row=>{
        const amount=Number(row.amount_cents)*(row.entry_type==='income'?1:-1);
        daily.set(row.entry_date,(daily.get(row.entry_date)||0)+amount);
      });
      let sum=0;
      const points=Array.from(daily).sort(([a],[b])=>a.localeCompare(b))
        .map(([date,value])=>({date,value:sum+=value}));
      const values=points.map(point=>point.value);
      const min=Math.min(0,...values), max=Math.max(0,...values);
      const span=max-min||1;
      const left=8, right=312, top=10, bottom=102;
      const xy=points.map((point,index)=>[
        points.length===1?(left+right)/2:left+index*(right-left)/(points.length-1),
        top+(max-point.value)/span*(bottom-top)
      ]);
      const ns='http://www.w3.org/2000/svg';
      function node(tag,attrs){
        const svgNode=document.createElementNS(ns,tag);
        Object.entries(attrs).forEach(([key,value])=>svgNode.setAttribute(key,value));
        return svgNode;
      }
      const svg=node('svg',{
        viewBox:'0 0 320 110',
        role:'img',
        'aria-label':'Resultado acumulado dos lançamentos carregados',
        'aria-describedby':note.id
      });
      const gradient=node('linearGradient',{id:'finance-chart-fill',x2:0,y2:1});
      gradient.append(node('stop',{offset:0,'stop-color':'var(--purple)','stop-opacity':0.26}),
        node('stop',{offset:1,'stop-color':'var(--purple)','stop-opacity':0.05}));
      const defs=node('defs',{}); defs.append(gradient); svg.append(defs);
      for(let tick=0; tick<4; tick++){
        const y=top+tick*(bottom-top)/3;
        svg.append(node('line',{x1:left,x2:right,y1:y,y2:y,stroke:'var(--line)'}));
      }
      const [endX,endY]=xy.at(-1);
      const path=xy.map(([x,y],index)=>{
        if(!index)return 'M'+x+' '+y;
        const [prevX,prevY]=xy[index-1], middle=(x+prevX)/2;
        return 'C'+middle+' '+prevY+' '+middle+' '+y+' '+x+' '+y;
      }).join(' ');
      if(xy.length>1){
        svg.append(node('path',{d:path+' L'+endX+' '+bottom+' L'+left+' '+bottom+' Z',fill:'url(#finance-chart-fill)'}));
        svg.append(node('path',{d:path,fill:'none',stroke:'var(--purple)','stroke-width':2.5,'stroke-linecap':'round'}));
      }
      svg.append(node('circle',{cx:endX,cy:endY,r:4,fill:'var(--panel)',stroke:'var(--purple)','stroke-width':2.5}));
      box.append(svg);
      const labels=el('div','mock-axis');
      labels.append(el('span','',C.date(points[0].date)),el('strong','',C.money(sum)),el('span','',C.date(points.at(-1).date)));
      box.append(labels);
      note.textContent=complete?'Receitas menos despesas acumuladas no período.':'Resultado dos lançamentos carregados. Carregue mais para ampliar a série.';
    }
    function reflectFinance(data){
      const updated=(data?.accounts||[]).filter(account=>account.source==='pluggy')
        .map(account=>Date.parse(account.balance_updated_at)).filter(Number.isFinite).sort((a,b)=>b-a)[0];
      bankInfo.title=updated ? 'Atualizado em '+new Date(updated).toLocaleString('pt-BR') : 'Abrir contas e conexões';
      summary.querySelector('.result-card .finance-metric-label-text').textContent=
        ['month','selected-month'].includes(preset.value)?'Resultado do mês':'Resultado do período';
      if(!data){
        $('mock-result').textContent='—';
        $('mock-account-balance').textContent='—';
        $('mock-donut').hidden=true;
        $('mock-evolution').replaceChildren(el('p','empty-state','Consulta indisponível.'));
        $('mock-evolution-note').textContent='';
        return;
      }
      $('mock-result').textContent=C.money(data.summary.balance);
      $('mock-result').dataset.negative=String(Number(data.summary.balance)<0);
      const valid=data.accounts.filter(account=>account.source==='pluggy'&&account.account_type!=='credit'&&account.currency_code==='BRL'&&account.balance_cents!=null);
      $('mock-account-balance').textContent=valid.length?C.money(valid.reduce((sum,account)=>sum+Number(account.balance_cents),0)):'—';
      renderDonut(data.summary);
      renderLine(data.entries,data.complete);
    }
    window.addEventListener('finance-summary-updated',e=>reflectFinance(e.detail)); if(C.mockFinanceData)reflectFinance(C.mockFinanceData);
  }
  if(page==='tarefas'){
    const search=$('mock-task-search'),input=$('busca-tarefa');search.addEventListener('input',()=>{input.value=search.value;input.dispatchEvent(new Event('input'));});input.addEventListener('input',()=>{if(search.value!==input.value)search.value=input.value;});
    q('.cc-header-actions')?.prepend(search.closest('.mock-search'));
    function reflectTasks(data){const box=$('mock-task-categories');box.replaceChildren();Object.entries(data.categories).forEach(([name,count])=>{const row=el('div','mock-category-line'),label=el('span','',name);label.prepend(icon('tasks'));row.append(label,el('b','',String(count)));box.append(row);});if(!Object.keys(data.categories).length)box.append(el('p','empty-state','Nenhuma tarefa cadastrada.'));}
    window.addEventListener('cc-task-summary',e=>reflectTasks(e.detail));if(C.mockTaskData)reflectTasks(C.mockTaskData);
    // Compromissos ficam no calendário; o link de criação/edição ainda funciona.
    const autoOpen = new URLSearchParams(location.search).get('nova') === 'tarefa' ? 'novo-item' : null;
    if (autoOpen) C.ready.then(()=>{
      const button=$('novo-item');
      const open=()=>{
        if(button.disabled)return false;
        $(autoOpen).click();
        return true;
      };
      if (!open()) {
        const observer=new MutationObserver(()=>{if(open())observer.disconnect();});
        observer.observe(button,{attributes:true,attributeFilter:['disabled']});
      }
    }).catch(()=>{});
  }
  if (page==='menstruacao') {
    const shortcuts = $('wellness-quick-actions');
    const checkin = $('cc-checkin');
    const dialog = $('mobile-checkin-dialog');
    const dialogContent = $('mobile-checkin-content');
    const symptomList = el('section','checkin-symptom-list');
    const symptomHeading = el('h3','','Como você está hoje?');
    symptomList.append(symptomHeading,el('p','','Selecione o que você sente.'));
    const symptomSlots=[];
    function placeSymptoms(){
      for(const key of ['pain','nausea','bloated','tired','sleepy','sensitive']){
        const button=checkin.querySelector('[data-feeling="'+key+'"]');
        if(!button)continue;
        const slot=document.createComment('posição da opção');
        button.before(slot);
        symptomSlots.push([slot,button]);
        symptomList.append(button);
      }
      checkin.querySelector('.checkin-date-panel').after(symptomList);
      checkin.dataset.checkinMode='symptoms';
    }
    function openCheckin(label){
      if(dialog.open)return;
      $('mobile-checkin-title').textContent=label;
      if(label==='Registrar sintomas')placeSymptoms();
      dialogContent.append(checkin);
      dialog.showModal();
    }
    const busy=()=>checkin.getAttribute('aria-busy')==='true';
    $('fechar-registro-saude').addEventListener('click',()=>{if(!busy())dialog.close();});
    dialog.addEventListener('cancel',event=>{if(busy())event.preventDefault();});
    dialog.addEventListener('close',()=>{
      for(const [slot,button] of symptomSlots)slot.replaceWith(button);
      symptomSlots.length=0;
      symptomList.remove();
      delete checkin.dataset.checkinMode;
      shortcuts.after(checkin);
    });
    $('abrir-registro-saude').addEventListener('click',event=>{
      event.preventDefault();
      openCheckin('Registrar sintomas');
    });
    q('.wellness-sections').querySelectorAll('[data-checkin]').forEach(link=>{
      link.addEventListener('click',event=>{
        event.preventDefault();
        openCheckin(link.dataset.checkin);
      });
    });
    q('.wellness-sections [href="#cc-cycle-title"]').addEventListener('click',event=>{
      event.preventDefault();
      $('cc-cycle-title').scrollIntoView({block:'start'});
    });
    shortcuts.closest('.checkin-card').dataset.dialogEnabled='true';
    const destinations = [
      ['Sintomas','pulse',()=>{
        const more=$('cc-feelings').nextElementSibling;
        if(more?.tagName==='DETAILS')more.open=true;
        return q('[data-feeling="pain"]');
      }],
      ['Bem-estar','heart',()=>q('#cc-feelings button')],
      ['Notas','note',()=>$('cc-checkin-note')]
    ];
    destinations.forEach(([label,symbol,destination])=>{
      const button=btn(label,()=>{
        const target=destination();
        if(!target || target.matches(':disabled'))return;
        openCheckin(label==='Notas'?'Registrar observação':label==='Sintomas'?'Registrar sintomas':'Registrar bem-estar');
        target.scrollIntoView({block:'nearest'});
        target.focus({preventScroll:true});
      });
      button.prepend(icon(symbol));
      shortcuts.append(button);
    });
  }
})();
