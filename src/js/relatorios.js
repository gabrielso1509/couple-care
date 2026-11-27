(function () {
    'use strict';
    const C=CC, $=C.$;
    const status=$('report-status'), picker=$('report-picker'), account=$('report-account');
    const source=$('report-source'), csv=$('report-export');
    let context, version=0, visibleRows=[];
    let month=C.today().slice(0,7);
    const accounts=new Map();
    const categoryLabels={house:'Casa',market:'Mercado',leisure:'Lazer',health:'Saúde',transport:'Transporte',salary:'Salário',other:'Outros'};
    const paymentLabels={pix:'Pix',credit:'Crédito',debit:'Débito',boleto:'Boleto',ted:'TED',doc:'DOC'};
    const monthNumber=new Intl.NumberFormat('pt-BR',{style:'percent',maximumFractionDigits:1});
    const name=row=>row.account_id ? accounts.get(row.account_id) || 'Conta anteriormente vinculada' : 'Sem conta vinculada';
    const cents=row=>Number(row.amount_cents);
    const income=row=>row.entry_type==='income';
    function bounds(shift=0) {
        const [year, number]=month.split('-').map(Number);
        const from=new Date(Date.UTC(year,number-1+shift,1)).toISOString().slice(0,10);
        const to=new Date(Date.UTC(year,number+shift,0)).toISOString().slice(0,10);
        return {from,to};
    }
    function fetchRows({from,to}) {
        const type=source.value, accountId=account.value;
        return C.all(()=>{
            let query=supabaseClient.from('finance_entries')
                .select('id,account_id,entry_type,entry_date,amount_cents,description,category,custom_category_id,payment_method,source')
                .eq('couple_id',context.couple).gte('entry_date',from).lte('entry_date',to);
            if(type==='pluggy')query=query.eq('source',type);
            if(accountId)query=query.eq('account_id',accountId);
            return query.order('entry_date').order('id');
        });
    }
    const add=(target,tag,className,text)=>{const node=C.el(tag,className,text);target.append(node);return node;};
    function totals(rows) {
        return rows.reduce((sum,row)=>{
            if(income(row))sum.income+=cents(row);
            else sum.expense+=cents(row);
            return sum;
        },{income:0,expense:0});
    }
    function series(rows,key) {
        const groups=new Map();
        rows.forEach(row=>{
            const label=key(row);
            groups.set(label,(groups.get(label)||0)+cents(row));
        });
        return [...groups].sort((a,b)=>b[1]-a[1]);
    }
    function metric(root,label,value,previous,kind,icon) {
        const tile=add(root,'article','card report-metric');
        tile.dataset.kind=kind;
        const heading=add(tile,'h2','report-metric-label');
        const mark=add(heading,'span','report-metric-icon');
        mark.append(C.uiIcon(icon));
        add(heading,'span','',label);
        add(tile,'strong','',C.money(value));
        const delta=value-previous;
        const detail=add(tile,'p','',delta===0?'Mesmo valor no período anterior':
            (delta>0?'+ ':'− ')+C.money(Math.abs(delta))+' frente ao período anterior');
        detail.dataset.trend=delta===0?'same':delta>0?'up':'down';
    }
    function panel(root,label) {
        const box=add(root,'section','card report-panel');
        add(box,'h2','',label);
        return box;
    }
    function ranking(root,label,rows,total) {
        const box=panel(root,label);
        if(rows.length&&total) {
            const [name,value]=rows[0];
            add(box,'p','report-reading',name+' tem a maior participação ('+monthNumber.format(value/total)+').');
        }
        const list=add(box,'div','report-ranking');
        if(!rows.length)add(list,'p','empty-state','Sem movimentações deste tipo no período.');
        for(const [title,amount] of rows){
            const row=add(list,'div','report-rank');
            const header=add(row,'div','report-rank-label');
            add(header,'strong','',title);
            add(header,'span','',C.money(amount)+' · '+monthNumber.format(total?amount/total:0));
            const bar=add(row,'progress','');
            bar.max=total||1;
            bar.value=amount;
            bar.setAttribute('aria-label',title);
        }
    }
    function weekly(root, rows, lastDay) {
        const box=panel(root,'Entradas e saídas por semana');
        const weeks=[];
        for(let start=1;start<=lastDay;start+=7){
            const end=Math.min(lastDay,start+6);
            const slice=rows.filter(row=>Number(row.entry_date.slice(-2))>=start&&Number(row.entry_date.slice(-2))<=end);
            weeks.push({label:start+'–'+end,...totals(slice)});
        }
        const largest=weeks.reduce((best,week)=>week.expense>best.expense?week:best);
        const reading=largest.expense ? 'O maior volume de saídas ocorreu entre os dias '+largest.label+' ('+C.money(largest.expense)+').' :
            'Nenhuma saída contabilizada no período.';
        add(box,'p','report-reading',reading);
        const max=Math.max(1,...weeks.flatMap(week=>[week.income,week.expense]));
        for (const week of weeks) {
            const row=add(box,'div','report-week');
            add(row,'strong','',week.label);
            const pairs=add(row,'div','report-week-pair');
            for(const [key,label,cls,sign] of [['income','Entradas','report-in','+'],['expense','Saídas','report-out','−']]){
                const line=add(pairs,'div','report-week-bar '+cls);
                line.setAttribute('aria-label',label);
                const track=add(line,'span','report-track');
                const bar=add(track,'span','report-fill');
                bar.style.width=100*week[key]/max+'%';
                add(line,'span','report-week-value',sign+' '+C.money(week[key]));
            }
        }
    }
    function cumulative(root, rows, lastDay) {
        const box=panel(root,'Fluxo líquido acumulado');
        const changes=new Map();
        for(const row of rows){
            const day=Number(row.entry_date.slice(-2));
            changes.set(day,(changes.get(day)||0)+(income(row)?1:-1)*cents(row));
        }
        let net=0;
        const values=[0];
        for(let day=1;day<=lastDay;day++){net+=changes.get(day)||0;values.push(net);}
        add(box,'p','report-reading',net===0?'Entradas e saídas se equilibram no período.' :
            net>0?'As entradas superaram as saídas em '+C.money(net)+'.':'As saídas superaram as entradas em '+C.money(-net)+'.');
        const max=Math.max(...values,0), min=Math.min(...values,0), span=max-min||1;
        const y=value=>12+106*(max-value)/span;
        const points=values.map((value,index)=>(12+296*index/lastDay)+','+y(value)).join(' ');
        const ns='http://www.w3.org/2000/svg';
        const shape=(tag,attrs)=>{
            const node=document.createElementNS(ns,tag);
            Object.entries(attrs).forEach(([key,value])=>node.setAttribute(key,value));
            return node;
        };
        const chart=shape('svg',{viewBox:'0 0 320 130',role:'img','aria-label':'Fluxo acumulado diário. Resultado final: '+C.money(net)});
        chart.classList.add('report-trend-chart');
        chart.append(shape('line',{x1:12,x2:308,y1:y(0),y2:y(0),stroke:'var(--line)','stroke-dasharray':'4 3'}),
            shape('polyline',{points,fill:'none',stroke:'var(--purple)','stroke-width':2.5,'stroke-linejoin':'round'}),
            shape('circle',{cx:308,cy:y(net),r:4,fill:net<0?'var(--report-expense)':'var(--mint)'}));
        box.append(chart);
        const axis=add(box,'div','report-trend-axis');
        add(axis,'span','','Início do mês');
        add(axis,'span','','Dia '+lastDay);
    }
    async function load() {
        const request=++version;
        status.textContent='Atualizando relatório…';
        csv.disabled=true;
        try {
            const current=bounds(), prior=bounds(-1);
            const today=C.today();
            if(month===today.slice(0,7)){
                current.to=today;
                prior.to=prior.to.slice(0,-2)+String(Math.min(Number(prior.to.slice(-2)),Number(today.slice(-2)))).padStart(2,'0');
            }
            const [rows,previous,categories]=await Promise.all([
                fetchRows(current), fetchRows(prior), C.all(()=>supabaseClient.from('finance_categories')
                    .select('id,name').eq('couple_id',context.couple).order('id'))
            ]);
            if(request!==version)return;
            visibleRows=rows;
            const labels=new Map(categories.map(category=>[category.id,category.name]));
            const category=row=>labels.get(row.custom_category_id)||categoryLabels[row.category]||row.category||'Sem categoria';
            const kpis=$('report-kpis'), panels=$('report-panels');
            const currentTotal=totals(rows), priorTotal=totals(previous);
            const expenses=rows.filter(row=>!income(row));
            kpis.replaceChildren();
            panels.replaceChildren();
            const net=currentTotal.income-currentTotal.expense;
            metric(kpis,'Entradas',currentTotal.income,priorTotal.income,'income','income');
            metric(kpis,'Saídas',currentTotal.expense,priorTotal.expense,'expense','receipt');
            metric(kpis,'Fluxo líquido',net,priorTotal.income-priorTotal.expense,net<0?'negative':'net','investment');
            status.textContent=rows.length+(rows.length===1?' movimentação contabilizada':' movimentações contabilizadas')+
                ' · '+C.date(current.from)+' a '+C.date(current.to);
            if(!rows.length){
                add(panels,'p','empty-state','Não há movimentações para esses filtros. Para importar o extrato bancário, abra Finanças.');
                return;
            }
            weekly(panels,rows,Number(current.to.slice(-2)));
            cumulative(panels,rows,Number(current.to.slice(-2)));
            const details=add(panels,'div','report-details');
            const breakdown=add(details,'div','report-stack');
            const spending=add(details,'div','report-stack');
            const byAccount=panel(breakdown,'Movimentação por conta');
            const grouped=new Map();
            rows.forEach(row=>{
                const key=row.account_id||null;
                if(!grouped.has(key))grouped.set(key,[]);
                grouped.get(key).push(row);
            });
            for(const items of grouped.values()){
                const values=totals(items);
                const line=add(byAccount,'div','report-flow');
                add(line,'strong','',name(items[0]));
                add(line,'span','report-in','+ '+C.money(values.income));
                add(line,'span','report-out','− '+C.money(values.expense));
            }
            ranking(breakdown,'Despesas por categoria',series(expenses,category),currentTotal.expense);
            ranking(breakdown,'Origem das entradas',series(rows.filter(income),category),currentTotal.income);
            ranking(spending,'Meios de pagamento',series(expenses,row=>paymentLabels[row.payment_method]||'Não informado'),currentTotal.expense);
            ranking(spending,'Maiores despesas por descrição',series(expenses,row=>row.description||'Sem descrição').slice(0,8),currentTotal.expense);
            csv.disabled=false;
        } catch(error) {
            if(request!==version)return;
            status.textContent=C.error(error);
            $('report-kpis').replaceChildren();
            $('report-panels').replaceChildren();
        }
    }
    function select(value) {
        if(value<'1900-01'||value>'2100-12')return;
        month=value;
        updateCaption();
        $('report-prev').disabled=month==='1900-01';
        $('report-next').disabled=month==='2100-12';
        if(context?.couple)void load();
    }
    const updateCaption=C.monthPicker({id:'report-month-dialog',button:picker,caption:$('report-caption'),current:()=>month,select});
    for(const [id,shift] of [['report-prev',-1],['report-next',1]])$(id).addEventListener('click',()=>select(bounds(shift).from.slice(0,7)));
    source.addEventListener('change',()=>{if(context?.couple)void load();});
    account.addEventListener('change',()=>{if(context?.couple)void load();});
    csv.addEventListener('click',()=>{
        const cell=value=>{
            let text=String(value??'');
            if(/^\s*[=+@-]/.test(text))text="'"+text;
            return '"'+text.replace(/"/g,'""')+'"';
        };
        const columns=['Data','Descrição','Conta','Tipo','Valor (R$)','Origem'];
        const rows=visibleRows.map(row=>[row.entry_date,row.description,name(row),income(row)?'Entrada':'Saída',C.money(cents(row)),row.source==='pluggy'?'Open Finance':'Manual']);
        const blob=new Blob(['\uFEFF'+[columns,...rows].map(row=>row.map(cell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
        const link=C.el('a');
        link.href=URL.createObjectURL(blob);
        link.download='couplecare-relatorio-'+month+'.csv';
        link.click();
        setTimeout(()=>URL.revokeObjectURL(link.href),1000);
    });
    C.refreshOnReturn(()=>{if(context?.couple) return load();});
    C.ready.then(async value=>{
        context=value;
        if(!context.couple){status.textContent='Conecte seu casal em Configurações para consultar os relatórios.';return;}
        const rows=await C.all(()=>supabaseClient.from('finance_accounts').select('id,name').eq('couple_id',context.couple).order('id'));
        rows.forEach(row=>{accounts.set(row.id,row.name);account.add(new Option(row.name,row.id));});
        await load();
    }).catch(error=>{status.textContent=C.error(error);}).finally(C.pageReady);
})();
