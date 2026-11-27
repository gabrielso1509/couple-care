# CoupleCare — atualização incremental (prévia, NÃO publicar em produção)

Base: ZIP enviado pelo proprietário, árvore do projeto consultada no GitHub em 26/11/2026. Nenhum ambiente remoto foi modificado.

## O que está implementado nesta entrega
- Cards comerciais Essencial grátis, Plus R$ 19,90, Infinity R$ 34,99. São apresentação de proposta, não checkout nem autorização de plano.
- Seletor claro/escuro em páginas principais; persistência local exclusivamente da preferência visual; camada de CSS sobre a base antiga.
- Editor de tarefas em painel lateral no desktop e tela cheia no mobile. Mantém o dialog nativo, IDs e eventos existentes.
- Logo de dois corações reconstruída com os mesmos caminhos e movimentos da prévia aprovada no chat; não é o vídeo original recuperado. Animação de entrada e hover desktop, sem loop, com preferência de movimento reduzido. Veja docs/preview-logo.html.
- Sugestão de fotos Pexels para metas, consulta por assunto genérico e armazenamento da referência no banco com RLS. Não envia nomes, valores ou descrição financeira ao Pexels. A integração é opcional: se falhar, a meta segue funcionando.
- Código bancário original, endpoints e testes mantidos byte a byte. Nenhuma migration antiga modificada.

## Como testar em uma cópia
1. Faça backup da pasta atual inteira fora do repositório, incluindo arquivos locais não versionados. Não substitua seu .git nem arquivos .env. Este ZIP é uma cópia do projeto sem .git.
2. Descompacte em uma pasta separada. Compare com a sua versão atual antes de mesclar.
3. Para prévia visual pública, use Live Server na raiz do projeto. O HTML de preview-logo.html pode ser aberto diretamente.
4. Execute na raiz: `node testes/pluggy-security.cjs`, `node testes/pluggy-token.cjs`, `node testes/pluggy-webhook.mjs`.
5. Não faça deploy de produção ainda: tema e páginas autenticadas precisam de validação visual; limites de planos e cobrança ainda não existem.

## Pexels (somente em ambiente de teste inicialmente)
- Crie uma chave em https://www.pexels.com/api/ e confira os termos da API para seu uso.
- Na Vercel, configure PEXELS_API_KEY como variável de ambiente do servidor (Preview primeiro). Não coloque no Git ou em JS do navegador.
- Revise a migration supabase/migrations/20261126000100_goal_inspiration.sql. Em banco de teste com migrations anteriores já aplicadas, execute a nova migration uma única vez. Não execute todas as migrations antigas novamente.
- Em um deploy de teste, crie uma meta como Viagem para Paris e abra Nosso Espaço. Confirme que a imagem e o crédito aparecem e que um usuário fora do casal não consegue ler a referência. Não foi possível testar com a API real aqui. A busca pode repetir em caso de falha; controle global de quota e cache compartilhado ainda precisam ser implementados antes de escala.

## Testes e pendências
- Veja testes-executados.txt. Os três testes da Pluggy usam respostas simuladas, não bancos reais.
- O Chromium bloqueou o servidor local neste ambiente (ERR_BLOCKED_BY_ADMINISTRATOR); não foi possível verificar renderização, alinhamentos e interações reais, nem comparar pixel a pixel com mockups.
- A refatoração completa, auditoria de CSS, comentários de todos os arquivos, páginas novas de relatórios/automações, demonstração em página separada, controle de assinatura no servidor e validação PF/PJ ainda não foram concluídos.
- Não há garantia de que o visual completo esteja idêntico aos mockups. Os módulos anteriores foram preservados em vez de serem substituídos por protótipos fictícios.
- Não foi criada uma regra de conexões ilimitadas: depende de custo, contrato e suporte do provedor. Nenhuma mudança nos acessos existentes nesta prévia.
- Não foram removidos arquivos: sem revisão completa das dependências não é seguro apagar estilos/scripts. Consulte auditoria-arquivos.md.


## Revisão da logo pastel
Os dois corações agora têm contornos fechados (comando Z do SVG), degradê laranja/rosa/lilás e animação de aproximadamente três segundos. A prévia está em `docs/preview-logo.html`. Não há nova migration para esta revisão. A validação visual em navegador e os testes bancários reais continuam pendentes.

## Logo aprovada — atualização final de identidade visual

A animação de 3,2 s usa o desenho aprovado, gradientes laranja e roxo, neon móvel, transferência de energia, partículas e dois pulsos. Está centralizada em `src/js/couple-brand.js`. As telas de recuperação e confirmação também usam o componente. Os SVGs antigos foram substituídos pela versão estática equivalente. O ZIP anterior é o backup. Nenhuma migration adicional.
