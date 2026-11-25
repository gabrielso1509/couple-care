/* Leituras usadas pelo Calendário e pelo Dashboard. As permissões vivem no Supabase. */
(function () {
    'use strict';
    const C = CC;
    const feelings = {
        calm: '😌 Tranquila', energetic: '⚡ Com energia', sensitive: '🥺 Sensível',
        tired: '🪫 Cansada', happy: '😊 Feliz', affectionate: '😍 Carinhosa',
        sad: '😔 Triste', tearful: '😢 Com vontade de chorar', irritated: '😠 Irritada',
        anxious: '😰 Ansiosa', overwhelmed: '🤯 Sobrecarregada', sleepy: '😴 Sonolenta',
        pain: '🤕 Com dor', nausea: '🤢 Enjoada', bloated: '🎈 Inchada',
        wants_affection: '🤗 Quero carinho', wants_company: '🫂 Quero companhia',
        wants_space: '🌿 Quero um tempo para mim'
    };

    function key(date) {
        return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0')].join('-');
    }

    function local(date) { return new Date(date + 'T12:00:00'); }

    function plusDays(date, amount) {
        const day = local(date);
        day.setDate(day.getDate() + amount);
        return key(day);
    }

    C.agenda = {
        key: key,
        local: local,
        plusDays: plusDays,
        dayCount: function (from, to) {
            return (Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000;
        },
        events: function (couple, from, to) {
            if (!couple) return Promise.resolve([]);
            return C.all(function () {
                return supabaseClient.from('calendar_events').select('id,title,description,event_date,start_time,end_time,version')
                    .eq('couple_id', couple).gte('event_date', from).lte('event_date', to)
                    .order('event_date').order('start_time', { nullsFirst: true }).order('id');
            });
        },
        clock: function (event) {
            if (!event.start_time) return 'Dia inteiro';
            const start = event.start_time.slice(0, 5);
            return event.end_time ? start + '–' + event.end_time.slice(0, 5) : start;
        },
        feelings: function (record) {
            return (record?.feelings || []).map(function (key) { return feelings[key]; }).filter(Boolean);
        },
        cycle: async function (from, to) {
            return C.result(await supabaseClient.rpc('get_agenda_cycle', { p_from: from, p_to: to }));
        }
    };
})();
