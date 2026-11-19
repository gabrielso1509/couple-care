// Endereço do projeto, disponível no painel do Supabase.
const SUPABASE_URL = 'https://cwsmavsxeudwjocqakhh.supabase.co';

// Chave pública: deve começar com sb_publishable_.
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_JI8pfLWmoJZW3qx0CaY7sg__GyvX9ob';

// Cria o cliente que usaremos para acessar os serviços do Supabase.
const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);