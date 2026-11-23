/* Função Node.js da Vercel. Este arquivo nunca deve ser importado pelo navegador. */
module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') { res.setHeader('Allow','POST'); return res.status(405).json({error:'Método não permitido.'}); }
    const authorization = req.headers.authorization || '';
    if (!/^Bearer \S+$/.test(authorization)) return res.status(401).json({error:'Entre na sua conta para conectar um banco.'});
    if (!process.env.PLUGGY_CLIENT_ID || !process.env.PLUGGY_CLIENT_SECRET) return res.status(503).json({error:'A conexão bancária ainda não foi configurada.'});
    const base = 'https://cwsmavsxeudwjocqakhh.supabase.co';
    const publicKey = 'sb_publishable_JI8pfLWmoJZW3qx0CaY7sg__GyvX9ob';
    try {
        // Consulta o Auth: decodificar o JWT sozinho não valida a identidade.
        const auth = await fetch(base+'/auth/v1/user',{headers:{apikey:publicKey,Authorization:authorization},signal:AbortSignal.timeout(10000)});
        if (auth.status === 401 || auth.status === 403) return res.status(401).json({error:'Sua sessão expirou. Entre novamente.'});
        if (!auth.ok) return res.status(502).json({error:'Não foi possível verificar sua sessão agora.'});
        const user = await auth.json();
        if (!user.id || user.is_anonymous) return res.status(403).json({error:'Use uma conta cadastrada para conectar um banco.'});
        const credentials = await fetch('https://api.pluggy.ai/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId:process.env.PLUGGY_CLIENT_ID,clientSecret:process.env.PLUGGY_CLIENT_SECRET}),signal:AbortSignal.timeout(10000)});
        if (!credentials.ok) return res.status(502).json({error:'Não foi possível autenticar a integração bancária.'});
        const key = await credentials.json();
        if (!key.apiKey) throw new Error('Invalid upstream');
        // Ignora IDs enviados pelo navegador; o usuário vem da sessão validada.
        const response = await fetch('https://api.pluggy.ai/connect_token',{method:'POST',headers:{'Content-Type':'application/json','X-API-KEY':key.apiKey},body:JSON.stringify({options:{clientUserId:user.id,avoidDuplicates:true}}),signal:AbortSignal.timeout(10000)});
        if (!response.ok) return res.status(502).json({error:'Não foi possível iniciar a conexão bancária.'});
        const token = await response.json();
        if (!token.accessToken) throw new Error('Invalid upstream');
        return res.status(200).json({accessToken:token.accessToken});
    } catch (_) { return res.status(502).json({error:'O serviço demorou para responder. Tente novamente.'}); }
};
